import algosdk from 'algosdk';

const ALGOD_URL = process.env.ALGOD_URL || 'https://testnet-api.algonode.cloud:443';
const INDEXER_URL = process.env.INDEXER_URL || 'https://testnet-idx.algonode.cloud:443';
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';

export interface SybilResult {
  wallet: string;
  sybilRisk: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  clusterSize: number;
  signals: {
    creationClustering: number;
    interactionDensity: number;
    balanceSimilarity: number;
    circularActivity: number;
  };
  flaggedWallets: string[];
  explanation: string[];
}

// ── Pure math functions (exported for testing) ─────────────────

export function computeCreationClustering(
  creationRounds: number[],
  referenceRound: number,
  windowRounds: number = 14515  // ~48h at 3.3s/round
): number {
  if (creationRounds.length <= 1) return 0;
  const inWindow = creationRounds.filter(
    r => Math.abs(r - referenceRound) <= windowRounds
  ).length;
  return Math.round(((inWindow - 1) / Math.max(1, creationRounds.length - 1)) * 100) / 100;
}

export function computeInteractionDensity(
  internalCount: number,
  externalCount: number
): number {
  const total = internalCount + externalCount;
  if (total === 0) return 0;
  return Math.round((internalCount / total) * 100) / 100;
}

export function computeBalanceSimilarity(balances: number[]): number {
  if (balances.length <= 1) return 0;
  const mean = balances.reduce((a, b) => a + b, 0) / balances.length;
  if (mean === 0) return 0;
  const variance = balances.reduce((sum, b) => sum + Math.pow(b - mean, 2), 0) / balances.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / mean; // coefficient of variation
  return Math.round(Math.max(0, Math.min(1, 1 - cv)) * 100) / 100;
}

export function computeCircularActivity(
  transactions: { from: string; to: string }[]
): number {
  if (transactions.length === 0) return 0;

  const pairSet = new Set<string>();
  for (const t of transactions) {
    if (t.from !== t.to) {
      pairSet.add(`${t.from}->${t.to}`);
    }
  }

  let circularPairs = 0;
  for (const pair of pairSet) {
    const [a, b] = pair.split('->');
    if (pairSet.has(`${b}->${a}`)) {
      circularPairs++;
    }
  }

  // Count unique unordered pairs
  const uniquePairs = new Set<string>();
  for (const pair of pairSet) {
    const [a, b] = pair.split('->');
    const key = [a, b].sort().join('<->');
    uniquePairs.add(key);
  }

  if (uniquePairs.size === 0) return 0;
  // circularPairs counts both directions, so divide by 2
  return Math.round(Math.min(1, (circularPairs / 2) / uniquePairs.size) * 100) / 100;
}

export function computeSybilRisk(signals: {
  creationClustering: number;
  interactionDensity: number;
  balanceSimilarity: number;
  circularActivity: number;
}): number {
  const risk =
    0.35 * signals.creationClustering +
    0.30 * signals.interactionDensity +
    0.20 * signals.balanceSimilarity +
    0.15 * signals.circularActivity;
  return Math.round(Math.max(0, Math.min(1, risk)) * 100) / 100;
}

export function classifySybilRisk(
  risk: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (risk >= 0.70) return 'critical';
  if (risk >= 0.45) return 'high';
  if (risk >= 0.25) return 'medium';
  return 'low';
}

export function computeSybilConfidence(dataPoints: number): number {
  return Math.round(Math.max(0.50, Math.min(0.95, 0.50 + dataPoints * 0.12)) * 100) / 100;
}

export function generateSybilExplanation(
  clusterSize: number,
  creationClustering: number,
  interactionDensity: number,
  balanceSimilarity: number,
  circularActivity: number,
  sybilRisk: number
): string[] {
  const reasons: string[] = [];

  if (clusterSize > 1) {
    reasons.push(`${clusterSize} wallets created within 48 hours of each other`);
  } else {
    reasons.push('No clustering detected with other wallets');
  }

  if (interactionDensity > 0.8) {
    reasons.push(`${Math.round(interactionDensity * 100)}% of transactions are within the cluster`);
  } else if (interactionDensity > 0.5) {
    reasons.push(`${Math.round(interactionDensity * 100)}% of transactions are within the cluster (mixed activity)`);
  } else if (interactionDensity > 0.1) {
    reasons.push(`${Math.round(interactionDensity * 100)}% of transactions are within the cluster (mostly external)`);
  }

  if (balanceSimilarity > 0.8) {
    reasons.push(`Balances are highly similar (${Math.round(balanceSimilarity * 100)}% match)`);
  } else if (balanceSimilarity > 0.5) {
    reasons.push(`Balances are moderately similar (${Math.round(balanceSimilarity * 100)}% match)`);
  }

  if (circularActivity > 0.5) {
    reasons.push('Circular transaction patterns detected');
  } else if (circularActivity > 0.2) {
    reasons.push('Some bidirectional transaction patterns');
  }

  if (sybilRisk >= 0.70) {
    reasons.push('High sybil risk — wallet likely part of a farm');
  } else if (sybilRisk >= 0.45) {
    reasons.push('Moderate sybil risk — suspicious clustering patterns');
  } else if (sybilRisk >= 0.25) {
    reasons.push('Low-moderate sybil risk — some patterns worth monitoring');
  } else {
    reasons.push('Low sybil risk — no significant clustering detected');
  }

  return reasons;
}

// ── On-chain data fetching ─────────────────────────────────────

async function fetchAccountInfo(wallet: string): Promise<{
  balance: number;
  createdRound: number;
} | null> {
  const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL);
  try {
    const info = await algod.accountInformation(wallet).do();
    const data = info as any;
    return {
      balance: Number(data.amount || 0),
      createdRound: data['created-at-round'] || 0,
    };
  } catch {
    return null;
  }
}

async function fetchTransactions(wallet: string): Promise<{
  transactions: { from: string; to: string; round: number }[];
  counterpartyCounts: Map<string, number>;
}> {
  try {
    const url = `${INDEXER_URL}/v2/accounts/${wallet}/transactions?limit=500`;
    const res = await fetch(url);
    if (!res.ok) return { transactions: [], counterpartyCounts: new Map() };

    const data = await res.json() as any;
    const txns = data.transactions || [];
    const counterpartyCounts = new Map<string, number>();
    const transactions: { from: string; to: string; round: number }[] = [];

    for (const t of txns) {
      const sender = t.sender || '';
      const receiver = t['payment-transaction']?.receiver ||
                       t['asset-transfer-transaction']?.receiver || '';
      const round = t['confirmed-round'] || 0;

      if (sender && receiver && sender !== receiver) {
        transactions.push({ from: sender, to: receiver, round });
        counterpartyCounts.set(receiver, (counterpartyCounts.get(receiver) || 0) + 1);
        counterpartyCounts.set(sender, (counterpartyCounts.get(sender) || 0) + 1);
      }
    }

    return { transactions, counterpartyCounts };
  } catch {
    return { transactions: [], counterpartyCounts: new Map() };
  }
}

// ── Main function ──────────────────────────────────────────────

export async function detectSybil(wallet: string): Promise<SybilResult | null> {
  if (!/^[A-Z2-7]{58}$/.test(wallet)) return null;

  const [walletInfo, txData] = await Promise.all([
    fetchAccountInfo(wallet),
    fetchTransactions(wallet),
  ]);

  if (!walletInfo) return null;

  // Get top 10 counterparties by transaction frequency
  const sortedCounterparties = [...txData.counterpartyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([addr]) => addr);

  // Fetch account info for counterparties (batch, with rate limit consideration)
  const counterpartyInfos: { addr: string; balance: number; createdRound: number }[] = [];
  for (const addr of sortedCounterparties) {
    const info = await fetchAccountInfo(addr);
    if (info) {
      counterpartyInfos.push({ addr, ...info });
    }
  }

  // Build cluster: wallet + counterparties
  const cluster = [
    { addr: wallet, balance: walletInfo.balance, createdRound: walletInfo.createdRound },
    ...counterpartyInfos,
  ];

  const clusterSize = cluster.length;
  const creationRounds = cluster.map(c => c.createdRound).filter(r => r > 0);

  // Signal 1: Creation clustering
  const creationClustering = computeCreationClustering(creationRounds, walletInfo.createdRound);

  // Signal 2: Interaction density
  const clusterAddrs = new Set(cluster.map(c => c.addr));
  let internalCount = 0;
  let externalCount = 0;
  for (const t of txData.transactions) {
    const bothInternal = clusterAddrs.has(t.from) && clusterAddrs.has(t.to);
    if (bothInternal) {
      internalCount++;
    } else {
      externalCount++;
    }
  }
  const interactionDensity = computeInteractionDensity(internalCount, externalCount);

  // Signal 3: Balance similarity
  const balances = cluster.map(c => c.balance / 1_000_000); // convert to ALGO
  const balanceSimilarity = computeBalanceSimilarity(balances);

  // Signal 4: Circular activity
  const circularActivity = computeCircularActivity(txData.transactions);

  // Combined sybil risk
  const signals = { creationClustering, interactionDensity, balanceSimilarity, circularActivity };
  const sybilRisk = computeSybilRisk(signals);
  const riskLevel = classifySybilRisk(sybilRisk);

  // Flagged wallets: counterparties in the cluster (excluding the target wallet)
  const flaggedWallets = cluster
    .filter(c => c.addr !== wallet && clusterAddrs.has(c.addr))
    .map(c => c.addr);

  // Confidence
  let dataPoints = 0;
  if (clusterSize >= 5) dataPoints++;
  if (clusterSize >= 3) dataPoints++;
  if (txData.transactions.length >= 20) dataPoints++;
  if (creationClustering > 0) dataPoints++;
  const confidence = computeSybilConfidence(dataPoints);

  const explanation = generateSybilExplanation(
    clusterSize, creationClustering, interactionDensity,
    balanceSimilarity, circularActivity, sybilRisk
  );

  return {
    wallet,
    sybilRisk,
    riskLevel,
    confidence,
    clusterSize,
    signals,
    flaggedWallets,
    explanation,
  };
}
