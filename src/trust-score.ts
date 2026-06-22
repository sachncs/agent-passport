import algosdk from 'algosdk';

const ALGOD_URL = process.env.ALGOD_URL || 'https://testnet-api.algonode.cloud:443';
const INDEXER_URL = process.env.INDEXER_URL || 'https://testnet-idx.algonode.cloud:443';
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';
const INDEXER_TOKEN = process.env.INDEXER_TOKEN || '';

export interface WalletTrustScore {
  wallet: string;
  trustScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  approved: boolean;
  recommendedLimit: number;
  breakdown: {
    ageScore: number;
    activityScore: number;
    volumeScore: number;
    velocityScore: number;
    complianceScore: number;
  };
  onChain: {
    balanceAlgo: number;
    totalTxns: number;
    assetCount: number;
    appCount: number;
    accountAgeDays: number;
    firstSeenRound: number;
    lastSeenRound: number;
  };
  explanation: string[];
}

function computeAgeScore(days: number): number {
  if (days <= 0) return 0;
  if (days >= 730) return 100;
  const linear = (days / 730) * 100;
  const log = (Math.log10(days + 1) / Math.log10(731)) * 100;
  return Math.round((linear * 0.6 + log * 0.4) * 10) / 10;
}

function computeActivityScore(txns: number, days: number, assets: number): number {
  const txPerMonth = days > 0 ? txns / (days / 30) : 0;
  return Math.min(100,
    Math.min(40, txPerMonth * 2) +
    Math.min(30, (days / 365) * 30) +
    Math.min(30, assets * 3)
  );
}

function computeVolumeScore(balanceMicroAlgo: number, txns: number): number {
  const algo = balanceMicroAlgo / 1_000_000;
  return Math.min(100,
    Math.min(50, Math.log10(Math.max(1, algo)) * 10) +
    Math.min(50, txns * 0.5)
  );
}

function computeVelocityScore(txns: number, days: number): number {
  if (days === 0) return 0;
  const perDay = txns / Math.max(1, days);
  if (perDay > 50) return 20;
  if (perDay > 20) return 40;
  if (perDay > 5) return 60;
  if (perDay > 1) return 80;
  return 100;
}

function computeComplianceScore(balanceMicroAlgo: number, txns: number): number {
  let score = 100;
  if (balanceMicroAlgo / 1_000_000 < 0.01) score -= 20;
  if (txns === 0) score -= 30;
  return Math.max(0, Math.min(100, score));
}

function computeTrustScore(breakdown: {
  ageScore: number;
  activityScore: number;
  volumeScore: number;
  velocityScore: number;
  complianceScore: number;
}): number {
  const w = { age: 0.2, activity: 0.25, volume: 0.2, velocity: 0.15, compliance: 0.2 };
  const total = w.age + w.activity + w.volume + w.velocity + w.compliance;

  return Math.round(Math.max(0, Math.min(100,
    (w.age / total) * breakdown.ageScore +
    (w.activity / total) * breakdown.activityScore +
    (w.volume / total) * breakdown.volumeScore +
    (w.velocity / total) * breakdown.velocityScore +
    (w.compliance / total) * breakdown.complianceScore
  )) * 10) / 10;
}

function classifyRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 70) return 'low';
  if (score >= 45) return 'medium';
  if (score >= 20) return 'high';
  return 'critical';
}

function computeRecommendedLimit(score: number): number {
  const base = (score / 100) * 500;
  const tier = score >= 80 ? 1.5 : score >= 60 ? 1.2 : score >= 40 ? 1.0 : 0.7;
  return Math.round(base * tier * 100) / 100;
}

function generateExplanation(
  onChain: { balanceAlgo: number; totalTxns: number; assetCount: number; accountAgeDays: number },
  trustScore: number
): string[] {
  const reasons: string[] = [];
  const { balanceAlgo, totalTxns, assetCount, accountAgeDays } = onChain;

  if (accountAgeDays > 365) reasons.push(`${Math.floor(accountAgeDays / 365)}+ year wallet history`);
  else if (accountAgeDays > 30) reasons.push(`${Math.floor(accountAgeDays / 30)}-month wallet history`);
  else reasons.push('New wallet with limited history');

  if (totalTxns > 100) reasons.push(`${totalTxns} transactions — active wallet`);
  else if (totalTxns > 10) reasons.push(`${totalTxns} transactions — moderate activity`);
  else reasons.push(`${totalTxns} transactions — limited activity`);

  if (balanceAlgo > 100) reasons.push(`Balance: ${balanceAlgo.toFixed(2)} ALGO — well-funded`);
  else if (balanceAlgo > 1) reasons.push(`Balance: ${balanceAlgo.toFixed(4)} ALGO`);
  else reasons.push(`Balance: ${balanceAlgo.toFixed(6)} ALGO — low balance`);

  if (assetCount > 5) reasons.push(`${assetCount} assets — diverse portfolio`);

  if (trustScore >= 70) reasons.push('Strong overall trust profile');
  else if (trustScore >= 40) reasons.push('Moderate trust profile');
  else reasons.push('Weak trust profile — additional verification recommended');

  return reasons;
}

async function fetchAccountInfo(wallet: string): Promise<{
  amount: number;
  assetCount: number;
  appCount: number;
  createdRound: number;
  lastRound: number;
} | null> {
  const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL);
  try {
    const [info, status] = await Promise.all([
      algod.accountInformation(wallet).do(),
      algod.status().do(),
    ]);
    const data = info as any;
    return {
      amount: Number(data.amount || 0),
      assetCount: (data.assets || []).length,
      appCount: (data['created-apps'] || []).length,
      createdRound: data['created-at-round'] || 0,
      lastRound: Number((status as any)['last-round'] || 0),
    };
  } catch {
    return null;
  }
}

async function fetchTransactionHistory(wallet: string): Promise<{
  totalTxns: number;
  firstRound: number;
  lastRound: number;
}> {
  try {
    const url = `${INDEXER_URL}/v2/accounts/${wallet}/transactions?limit=500`;
    const res = await fetch(url);
    if (!res.ok) return { totalTxns: 0, firstRound: 0, lastRound: 0 };
    const data = await res.json() as any;
    const txns = data.transactions || [];
    let first = Infinity;
    let last = 0;
    for (const t of txns) {
      const round = t['confirmed-round'] || 0;
      if (round > 0) {
        first = Math.min(first, round);
        last = Math.max(last, round);
      }
    }
    return {
      totalTxns: txns.length,
      firstRound: first === Infinity ? 0 : first,
      lastRound: last,
    };
  } catch {
    return { totalTxns: 0, firstRound: 0, lastRound: 0 };
  }
}

export async function scoreWallet(wallet: string): Promise<WalletTrustScore | null> {
  if (!/^[A-Z2-7]{58}$/.test(wallet)) return null;

  const [accountInfo, txHistory] = await Promise.all([
    fetchAccountInfo(wallet),
    fetchTransactionHistory(wallet),
  ]);

  const latestRound = accountInfo?.lastRound || 64600000;
  const createdRound = accountInfo?.createdRound || txHistory.firstRound || latestRound - 1000000;
  const accountAgeDays = Math.max(1, Math.floor(((latestRound - createdRound) * 3.3) / 86400));

  const balanceAlgo = (accountInfo?.amount || 0) / 1_000_000;

  const onChain = {
    balanceAlgo,
    totalTxns: txHistory.totalTxns,
    assetCount: accountInfo?.assetCount || 0,
    appCount: accountInfo?.appCount || 0,
    accountAgeDays,
    firstSeenRound: txHistory.firstRound,
    lastSeenRound: txHistory.lastRound,
  };

  const breakdown = {
    ageScore: computeAgeScore(accountAgeDays),
    activityScore: computeActivityScore(txHistory.totalTxns, accountAgeDays, onChain.assetCount),
    volumeScore: computeVolumeScore(accountInfo?.amount || 0, txHistory.totalTxns),
    velocityScore: computeVelocityScore(txHistory.totalTxns, accountAgeDays),
    complianceScore: computeComplianceScore(accountInfo?.amount || 0, txHistory.totalTxns),
  };

  const trustScore = computeTrustScore(breakdown);
  const riskLevel = classifyRisk(trustScore);
  const recommendedLimit = computeRecommendedLimit(trustScore);
  const explanation = generateExplanation(onChain, trustScore);

  return {
    wallet,
    trustScore,
    riskLevel,
    approved: trustScore >= 40,
    recommendedLimit,
    breakdown,
    onChain,
    explanation,
  };
}
