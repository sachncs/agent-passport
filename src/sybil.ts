import { config } from './config';
import { withTimeout, fetchWithTimeout } from './lib/timeout';
import { algod } from './lib/algorand-client';
import { MICRO_ALGO, isValidWallet } from './lib/constants';
import { TTLCache } from './lib/cache';
import { logger } from './lib/logger';
import { computeGraphSignals, type GraphSignals } from './lib/graph';

const INDEXER_URL = config.indexerUrl;

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
    timingRegularity: number;
    amountFingerprint: number;
    fundingCorrelation: number;
    neighborhoodClustering: number;
    hubScore: number;
    intermediateDensity: number;
    componentRatio: number;
    temporalCorrelation: number;
  };
  flaggedWallets: string[];
  explanation: string[];
}

// ── Pure math functions (exported for testing) ─────────────────

export function computeCreationClustering(
  creationRounds: number[],
  referenceRound: number,
  windowRounds = 14515,  // ~48h at 3.3s/round
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

/**
 * Detects regular timing patterns in transactions.
 *
 * Design rationale:
 * - Bots create wallets at regular intervals (every N rounds)
 * - Humans create wallets at irregular times
 * - Coefficient of variation of inter-arrival times < 0.2 suggests automation
 * - Regularity score = max(0, 1 - cv) where cv = stddev/mean of intervals
 *
 * Examples:
 *   intervals [100, 100, 100, 100] → cv=0 → regularity=1.0 (bot)
 *   intervals [50, 200, 80, 300]   → cv≈0.8 → regularity=0.2 (human)
 */
export function computeTimingRegularity(intervals: number[]): number {
  if (intervals.length <= 1) return 0;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean === 0) return 0;
  const variance = intervals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / intervals.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / mean;
  return Math.round(Math.max(0, Math.min(1, 1 - cv)) * 100) / 100;
}

/**
 * Detects uniform transaction amounts (strong sybil signal).
 *
 * Design rationale:
 * - Sybil farms often send identical amounts to all wallets (e.g., 0.1 ALGO each)
 * - Legitimate transactions have varied amounts
 * - Amount fingerprint = 1 - (unique amounts / total amounts)
 * - High fingerprint = many identical amounts = likely automation
 *
 * Examples:
 *   amounts [100, 100, 100, 100] → fingerprint=1.0 (all identical)
 *   amounts [100, 200, 300, 400] → fingerprint=0.0 (all different)
 *   amounts [100, 100, 200, 200] → fingerprint=0.5 (half identical)
 */
export function computeAmountFingerprint(amounts: number[]): number {
  if (amounts.length <= 1) return 0;
  const uniqueAmounts = new Set(amounts);
  const ratio = uniqueAmounts.size / amounts.length;
  return Math.round(Math.max(0, Math.min(1, 1 - ratio)) * 100) / 100;
}

/**
 * Detects correlation between funding sources (common funder = sybil signal).
 *
 * Design rationale:
 * - If 100 wallets are all funded by the same parent, it's likely a sybil farm
 * - Funding correlation = 1 - (unique funders / total wallets)
 * - High correlation = many wallets share the same funder
 *
 * Examples:
 *   funders [A, A, A, A] → correlation=1.0 (all same funder)
 *   funders [A, B, C, D] → correlation=0.0 (all different)
 *   funders [A, A, B, B] → correlation=0.5 (half same)
 */
export function computeFundingCorrelation(funders: string[]): number {
  if (funders.length <= 1) return 0;
  const uniqueFunders = new Set(funders);
  const ratio = uniqueFunders.size / funders.length;
  return Math.round(Math.max(0, Math.min(1, 1 - ratio)) * 100) / 100;
}

/**
 * Computes combined sybil risk from 11 signals.
 *
 * Weights (sum = 1.0):
 *   Original signals (65%):
 *     creationClustering     0.20 — when wallets were created
 *     interactionDensity     0.15 — internal vs external transactions
 *     balanceSimilarity      0.10 — balance amounts
 *     circularActivity       0.05 — bidirectional transactions
 *     timingRegularity       0.08 — bot-like timing patterns
 *     amountFingerprint      0.05 — uniform transaction amounts
 *     fundingCorrelation     0.02 — common funding source
 *   Graph signals (35%):
 *     neighborhoodClustering 0.10 — V2+V8: are counterparties interconnected?
 *     hubScore               0.08 — V4: is there a central orchestrator?
 *     intermediateDensity    0.10 — V6: interactions through intermediaries
 *     temporalCorrelation    0.07 — V4: do wallets activate together?
 */
export function computeSybilRisk(signals: {
  creationClustering: number;
  interactionDensity: number;
  balanceSimilarity: number;
  circularActivity: number;
  timingRegularity?: number;
  amountFingerprint?: number;
  fundingCorrelation?: number;
  neighborhoodClustering?: number;
  hubScore?: number;
  intermediateDensity?: number;
  temporalCorrelation?: number;
}): number {
  const timing = signals.timingRegularity ?? 0;
  const amount = signals.amountFingerprint ?? 0;
  const funding = signals.fundingCorrelation ?? 0;
  const clustering = signals.neighborhoodClustering ?? 0;
  const hub = signals.hubScore ?? 0;
  const intermediate = signals.intermediateDensity ?? 0;
  const temporal = signals.temporalCorrelation ?? 0;

  const risk =
    0.20 * signals.creationClustering +
    0.15 * signals.interactionDensity +
    0.10 * signals.balanceSimilarity +
    0.05 * signals.circularActivity +
    0.08 * timing +
    0.05 * amount +
    0.02 * funding +
    0.10 * clustering +
    0.08 * hub +
    0.10 * intermediate +
    0.07 * temporal;
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
  sybilRisk: number,
  timingRegularity?: number,
  amountFingerprint?: number,
  fundingCorrelation?: number,
  graphSignals?: GraphSignals,
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

  if (timingRegularity !== undefined && timingRegularity > 0.7) {
    reasons.push(`Bot-like timing patterns detected (${Math.round(timingRegularity * 100)}% regular)`);
  }

  if (amountFingerprint !== undefined && amountFingerprint > 0.5) {
    reasons.push(`Uniform transaction amounts detected (${Math.round(amountFingerprint * 100)}% identical)`);
  }

  if (fundingCorrelation !== undefined && fundingCorrelation > 0.5) {
    reasons.push(`Common funding source detected (${Math.round(fundingCorrelation * 100)}% share same funder)`);
  }

  // Graph-based explanations (V2+V4+V6+V8)
  if (graphSignals) {
    if (graphSignals.neighborhoodClustering > 0.6) {
      reasons.push(`Counterparties are highly interconnected (${Math.round(graphSignals.neighborhoodClustering * 100)}% clustering — likely a coordinated group)`);
    } else if (graphSignals.neighborhoodClustering > 0.3) {
      reasons.push(`Some interconnected counterparties detected (${Math.round(graphSignals.neighborhoodClustering * 100)}% clustering)`);
    }

    if (graphSignals.hubScore > 0.7) {
      reasons.push(`Central hub wallet detected (score ${Math.round(graphSignals.hubScore * 100)}% — one wallet orchestrates the cluster)`);
    }

    if (graphSignals.intermediateDensity > 0.5) {
      reasons.push(`Heavy intermediary usage detected (${Math.round(graphSignals.intermediateDensity * 100)}% of neighbor pairs interact through intermediaries)`);
    } else if (graphSignals.intermediateDensity > 0.2) {
      reasons.push(`Some intermediary patterns detected (${Math.round(graphSignals.intermediateDensity * 100)}% of neighbor pairs interact through intermediaries)`);
    }

    if (graphSignals.temporalCorrelation > 0.6) {
      reasons.push(`Wallets show highly correlated activity timing (${Math.round(graphSignals.temporalCorrelation * 100)}% temporal overlap — likely activated together)`);
    } else if (graphSignals.temporalCorrelation > 0.3) {
      reasons.push(`Moderate temporal correlation between wallets (${Math.round(graphSignals.temporalCorrelation * 100)}%)`);
    }

    if (graphSignals.subGroupCount > 2) {
      reasons.push(`Cluster splits into ${graphSignals.subGroupCount} independent sub-groups (component ratio: ${Math.round(graphSignals.componentRatio * 100)}%)`);
    }
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

interface SybilAccountInfo {
  balance: number;
  createdRound: number;
  fundedBy?: string;
}

const sybilAccountInfoCache = new TTLCache<SybilAccountInfo>({ maxEntries: 500, ttlMs: 60_000 });

const SYBIL_INDEXER_PAGE_SIZE = 2000;

async function fetchAccountInfo(wallet: string, fresh = false): Promise<SybilAccountInfo | null> {
  if (!fresh) {
    const cached = sybilAccountInfoCache.get(wallet);
    if (cached) return cached;
  }

  try {
    const info = (await withTimeout(
      algod.accountInformation(wallet).do(),
      10_000,
      'accountInformation',
    )) as { amount: bigint; createdAtRound?: number };
    const result: SybilAccountInfo = {
      balance: Number(info.amount || 0n),
      createdRound: info.createdAtRound || 0,
    };
    if (!fresh) sybilAccountInfoCache.set(wallet, result);
    return result;
  } catch (e) {
    logger.warn('fetchAccountInfo failed', { wallet, error: String(e) });
    return null;
  }
}

interface SybilIndexerTransaction {
  sender?: string;
  'payment-transaction'?: { receiver?: string; amount?: number };
  'asset-transfer-transaction'?: { receiver?: string; amount?: number };
  'confirmed-round'?: number;
}

interface SybilIndexerResponse {
  transactions?: SybilIndexerTransaction[];
  'next-token'?: string;
}

async function fetchTransactions(wallet: string, fresh = false): Promise<{
  transactions: { from: string; to: string; round: number; amount: number }[];
  counterpartyCounts: Map<string, number>;
  fundingSources: Map<string, string>;
}> {
  try {
    let allTxns: SybilIndexerTransaction[] = [];
    let nextToken: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(`${INDEXER_URL}/v2/accounts/${wallet}/transactions`);
      url.searchParams.set('limit', String(SYBIL_INDEXER_PAGE_SIZE));
      if (nextToken) url.searchParams.set('next', nextToken);

      const res = await fetchWithTimeout(url.toString(), { timeoutMs: 10_000 });
      if (!res.ok) break;

      const data = (await res.json()) as SybilIndexerResponse;
      const txns = data.transactions || [];
      allTxns = allTxns.concat(txns);

      nextToken = data['next-token'];
      hasMore = nextToken !== undefined && nextToken !== null && txns.length === SYBIL_INDEXER_PAGE_SIZE;
    }

    const counterpartyCounts = new Map<string, number>();
    const fundingSources = new Map<string, string>();
    const transactions: { from: string; to: string; round: number; amount: number }[] = [];

    for (const t of allTxns) {
      const sender = t.sender || '';
      const receiver = t['payment-transaction']?.receiver ||
                       t['asset-transfer-transaction']?.receiver || '';
      const round = t['confirmed-round'] || 0;
      const amount = Number(t['payment-transaction']?.amount ||
                            t['asset-transfer-transaction']?.amount || 0);

      if (sender && receiver && sender !== receiver) {
        transactions.push({ from: sender, to: receiver, round, amount });
        counterpartyCounts.set(receiver, (counterpartyCounts.get(receiver) || 0) + 1);
        counterpartyCounts.set(sender, (counterpartyCounts.get(sender) || 0) + 1);

        // Track who funded this wallet (first incoming transaction)
        if (!fundingSources.has(wallet) && receiver === wallet) {
          fundingSources.set(wallet, sender);
        }
      }
    }

    return { transactions, counterpartyCounts, fundingSources };
  } catch (e) {
    logger.warn('fetchTransactions failed', { wallet, error: String(e) });
    return { transactions: [], counterpartyCounts: new Map(), fundingSources: new Map() };
  }
}

// ── Main function ──────────────────────────────────────────────

/**
 * Detects sybil risk for a wallet using cached data (for API endpoints).
 */
export async function detectSybil(wallet: string): Promise<SybilResult | null> {
  return detectSybilInternal(wallet, false);
}

/**
 * Detects sybil risk for a wallet using fresh data (for passport generation).
 * Bypasses all LRU caches to guarantee data freshness.
 */
export async function detectSybilFresh(wallet: string): Promise<SybilResult | null> {
  return detectSybilInternal(wallet, true);
}

async function detectSybilInternal(wallet: string, fresh: boolean): Promise<SybilResult | null> {
  if (!isValidWallet(wallet)) return null;

  const [walletInfo, txData] = await Promise.all([
    fetchAccountInfo(wallet, fresh),
    fetchTransactions(wallet, fresh),
  ]);

  if (!walletInfo) return null;

  // V1 FIX: Increased from 10 to 25 to detect larger farms
  const sortedCounterparties = [...txData.counterpartyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([addr]) => addr);

  // Fetch account info for counterparties in parallel
  const counterpartyResults = await Promise.all(
    sortedCounterparties.map(async (addr) => {
      const info = await fetchAccountInfo(addr, fresh);
      return info ? { addr, ...info } : null;
    })
  );
  const counterpartyInfos = counterpartyResults.filter(Boolean) as { addr: string; balance: number; createdRound: number }[];

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
  const balances = cluster.map(c => c.balance / MICRO_ALGO); // convert to ALGO
  const balanceSimilarity = computeBalanceSimilarity(balances);

  // Signal 4: Circular activity
  const circularActivity = computeCircularActivity(txData.transactions);

  // Signal 5: Timing regularity
  const rounds = txData.transactions.map(t => t.round).sort((a, b) => a - b);
  const intervals: number[] = [];
  let prevRound: number | undefined;
  for (const r of rounds) {
    if (prevRound !== undefined) intervals.push(r - prevRound);
    prevRound = r;
  }
  const timingRegularity = computeTimingRegularity(intervals);

  // Signal 6: Amount fingerprint
  const amounts = txData.transactions
    .filter(t => t.amount > 0)
    .map(t => t.amount);
  const amountFingerprint = computeAmountFingerprint(amounts);

  // Signal 7: Funding correlation
  const funders = cluster.map(c => txData.fundingSources.get(c.addr) || 'unknown');
  const fundingCorrelation = computeFundingCorrelation(funders);

  // Signals 8-11: Graph-based signals (V2+V4+V6+V8)
  const graphNodes = cluster.map(c => c.addr);
  const graphTransactions = txData.transactions.map(t => ({
    from: t.from,
    to: t.to,
    round: t.round,
  }));
  const graphSignals = computeGraphSignals(graphTransactions, graphNodes);

  // Combined sybil risk (11 signals)
  const signals = {
    creationClustering,
    interactionDensity,
    balanceSimilarity,
    circularActivity,
    timingRegularity,
    amountFingerprint,
    fundingCorrelation,
    neighborhoodClustering: graphSignals.neighborhoodClustering,
    hubScore: graphSignals.hubScore,
    intermediateDensity: graphSignals.intermediateDensity,
    componentRatio: graphSignals.componentRatio,
    temporalCorrelation: graphSignals.temporalCorrelation,
  };
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
  if (timingRegularity > 0.5) dataPoints++;
  if (amountFingerprint > 0.3) dataPoints++;
  if (graphSignals.neighborhoodClustering > 0.3) dataPoints++;
  if (graphSignals.hubScore > 0.5) dataPoints++;
  if (graphSignals.intermediateDensity > 0.2) dataPoints++;
  const confidence = computeSybilConfidence(dataPoints);

  const explanation = generateSybilExplanation(
    clusterSize, creationClustering, interactionDensity,
    balanceSimilarity, circularActivity, sybilRisk,
    timingRegularity, amountFingerprint, fundingCorrelation,
    graphSignals,
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
