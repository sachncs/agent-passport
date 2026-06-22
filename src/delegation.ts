import algosdk from 'algosdk';

const ALGOD_URL = process.env.ALGOD_URL || 'https://testnet-api.algonode.cloud:443';
const INDEXER_URL = process.env.INDEXER_URL || 'https://testnet-idx.algonode.cloud:443';
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';

export const REGISTRY_APP_ID = parseInt(process.env.REGISTRY_APP_ID || '0', 10);

export interface Delegation {
  delegator: string;
  delegatee: string;
  amount: number;
  timestamp: number;
  round: number;
}

export interface DelegationPath {
  path: string[];
  depth: number;
  totalAmount: number;
}

export interface DelegationTrustScore {
  wallet: string;
  trustScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  approved: boolean;
  recommendedLimit: number;
  breakdown: {
    depthScore: number;
    sponsorQualityScore: number;
    sponsorCountScore: number;
    amountScore: number;
  };
  delegation: {
    depth: number;
    sponsorCount: number;
    sponsorQuality: number;
    delegationPath: string[];
    totalDelegatedAmount: number;
    isTrustAnchor: boolean;
    trustedAncestors: number;
  };
  explanation: string[];
}

// ── Pure math functions (exported for testing) ─────────────────

export function computeDepthScore(depth: number): number {
  if (depth === 0) return 100;
  if (depth === 1) return 80;
  if (depth === 2) return 60;
  if (depth === 3) return 40;
  return Math.max(0, 40 - (depth - 3) * 10);
}

export function computeSponsorQualityScore(sponsorScore: number): number {
  return Math.round(Math.max(0, Math.min(100, sponsorScore)));
}

export function computeSponsorCountScore(count: number): number {
  return Math.max(0, Math.min(100, count * 20));
}

export function computeAmountScore(amountMicroAlgo: number): number {
  const algo = amountMicroAlgo / 1_000_000;
  if (algo <= 0) return 0;
  if (algo >= 10000) return 100;
  return Math.round(Math.min(100, Math.log10(Math.max(1, algo) + 1) * 25));
}

export function computeDelegationTrustScore(breakdown: {
  depthScore: number;
  sponsorQualityScore: number;
  sponsorCountScore: number;
  amountScore: number;
}): number {
  const w = { depth: 0.35, quality: 0.30, count: 0.15, amount: 0.20 };
  const total = w.depth + w.quality + w.count + w.amount;

  return Math.round(Math.max(0, Math.min(100,
    (w.depth / total) * breakdown.depthScore +
    (w.quality / total) * breakdown.sponsorQualityScore +
    (w.count / total) * breakdown.sponsorCountScore +
    (w.amount / total) * breakdown.amountScore
  )) * 10) / 10;
}

export function classifyDelegationRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 70) return 'low';
  if (score >= 45) return 'medium';
  if (score >= 20) return 'high';
  return 'critical';
}

export function computeDelegationRecommendedLimit(score: number): number {
  const base = (score / 100) * 500;
  const tier = score >= 80 ? 1.5 : score >= 60 ? 1.2 : score >= 40 ? 1.0 : 0.7;
  return Math.round(base * tier * 100) / 100;
}

// ── On-chain data fetching ─────────────────────────────────────

async function fetchDelegationsFromContract(wallet: string): Promise<Delegation[]> {
  if (REGISTRY_APP_ID === 0) return [];

  const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL);
  try {
    const boxName = buildBoxKey(wallet);
    const boxResponse = await algod.getApplicationBoxByName(REGISTRY_APP_ID, boxName).do();
    const boxValue = boxResponse.value;

    const delegations: Delegation[] = [];
    const DELEGATION_SIZE = 72; // 32 delegatee + 8 amount + 8 timestamp + 8 round + 16 padding

    for (let i = 0; i + DELEGATION_SIZE <= boxValue.length; i += DELEGATION_SIZE) {
      const delegateeBytes = boxValue.slice(i, i + 32);
      const delegatee = algosdk.encodeAddress(delegateeBytes);
      const amount = Number(Buffer.from(boxValue.slice(i + 32, i + 40)).readBigUInt64BE(0));
      const timestamp = Number(Buffer.from(boxValue.slice(i + 40, i + 48)).readBigUInt64BE(0));
      const round = Number(Buffer.from(boxValue.slice(i + 48, i + 56)).readBigUInt64BE(0));

      delegations.push({ delegator: wallet, delegatee, amount, timestamp, round });
    }

    return delegations;
  } catch {
    return [];
  }
}

async function fetchDelegationsFromIndexer(wallet: string): Promise<Delegation[]> {
  try {
    const url = `${INDEXER_URL}/v2/accounts/${wallet}/transactions?limit=500&tx-type=axfer`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json() as any;
    const txns = data.transactions || [];

    return txns
      .map((t: any) => ({
        delegator: wallet,
        delegatee: t['asset-transfer-transaction']?.receiver || t.sender || '',
        amount: t['asset-transfer-transaction']?.amount || 0,
        timestamp: t['round-time'] || 0,
        round: t['confirmed-round'] || 0,
      }))
      .filter((d: Delegation) => d.delegatee && d.delegatee !== wallet && /^[A-Z2-7]{58}$/.test(d.delegatee));
  } catch {
    return [];
  }
}

async function fetchDelegations(wallet: string): Promise<Delegation[]> {
  const contractDelegations = await fetchDelegationsFromContract(wallet);
  if (contractDelegations.length > 0) return contractDelegations;
  return fetchDelegationsFromIndexer(wallet);
}

async function fetchWalletTrustScore(wallet: string): Promise<number> {
  try {
    const { scoreWallet } = await import('./trust-score');
    const result = await scoreWallet(wallet);
    return result?.trustScore ?? 0;
  } catch {
    return 0;
  }
}

// ── Graph traversal ────────────────────────────────────────────

function buildBoxKey(wallet: string): Uint8Array {
  const prefix = new TextEncoder().encode('del:');
  const addrBytes = algosdk.decodeAddress(wallet).publicKey;
  const key = new Uint8Array(4 + 32);
  key.set(prefix);
  key.set(addrBytes, 4);
  return key;
}

export async function findDelegationPath(
  wallet: string,
  trustAnchors: Set<string>,
  maxDepth: number = 10
): Promise<DelegationPath | null> {
  if (trustAnchors.has(wallet)) {
    return { path: [wallet], depth: 0, totalAmount: 0 };
  }

  const visited = new Map<string, { parent: string; amount: number }>();
  const queue: Array<{ address: string; depth: number }> = [{ address: wallet, depth: 0 }];
  visited.set(wallet, { parent: '', amount: 0 });

  while (queue.length > 0) {
    const { address, depth } = queue.shift()!;

    if (depth >= maxDepth) continue;

    const delegations = await fetchDelegations(address);

    for (const d of delegations) {
      if (!visited.has(d.delegatee)) {
        visited.set(d.delegatee, { parent: address, amount: d.amount });

        if (trustAnchors.has(d.delegatee)) {
          const path: string[] = [d.delegatee];
          let current = address;
          while (current !== wallet) {
            path.unshift(current);
            current = visited.get(current)!.parent;
          }
          path.unshift(wallet);
          return { path, depth: depth + 1, totalAmount: d.amount };
        }

        queue.push({ address: d.delegatee, depth: depth + 1 });
      }
    }
  }

  return null;
}

export async function findAllTrustedAncestors(
  wallet: string,
  trustAnchors: Set<string>,
  maxDepth: number = 10
): Promise<string[]> {
  const ancestors: string[] = [];
  const visited = new Set<string>();
  const queue: Array<{ address: string; depth: number }> = [{ address: wallet, depth: 0 }];
  visited.add(wallet);

  while (queue.length > 0) {
    const { address, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    const delegations = await fetchDelegations(address);
    for (const d of delegations) {
      if (!visited.has(d.delegatee)) {
        visited.add(d.delegatee);
        if (trustAnchors.has(d.delegatee)) {
          ancestors.push(d.delegatee);
        } else {
          queue.push({ address: d.delegatee, depth: depth + 1 });
        }
      }
    }
  }

  return ancestors;
}

export async function isTrustAnchor(wallet: string): Promise<boolean> {
  if (REGISTRY_APP_ID === 0) return false;

  const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL);
  try {
    const info = await algod.accountInformation(wallet).do();
    const data = info as any;
    return (data['created-apps'] || []).some((app: any) => app.id === REGISTRY_APP_ID);
  } catch {
    return false;
  }
}

// ── Main scoring function ──────────────────────────────────────

export async function scoreDelegation(wallet: string): Promise<DelegationTrustScore | null> {
  if (!/^[A-Z2-7]{58}$/.test(wallet)) return null;

  const [delegations, isAnchor] = await Promise.all([
    fetchDelegations(wallet),
    isTrustAnchor(wallet),
  ]);

  const trustAnchors = new Set<string>();
  if (isAnchor) trustAnchors.add(wallet);

  // For depth scoring, use delegations as graph edges
  let depth = 0;
  let delegationPath: string[] = [wallet];

  if (delegations.length > 0) {
    // Find deepest delegation chain from this wallet
    const visited = new Set<string>([wallet]);
    const queue: Array<{ address: string; path: string[]; depth: number }> = [
      { address: wallet, path: [wallet], depth: 0 },
    ];
    let deepest = { path: [wallet], depth: 0 };

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth > deepest.depth) {
        deepest = current;
      }

      const walletDelegations = await fetchDelegations(current.address);
      for (const d of walletDelegations) {
        if (!visited.has(d.delegatee)) {
          visited.add(d.delegatee);
          queue.push({
            address: d.delegatee,
            path: [...current.path, d.delegatee],
            depth: current.depth + 1,
          });
        }
      }
    }

    depth = deepest.depth;
    delegationPath = deepest.path;
  }

  // Fetch sponsor trust scores
  const sponsorScores: number[] = [];
  for (const d of delegations.slice(0, 5)) {
    const score = await fetchWalletTrustScore(d.delegatee);
    sponsorScores.push(score);
  }

  const avgSponsorQuality = sponsorScores.length > 0
    ? sponsorScores.reduce((a, b) => a + b, 0) / sponsorScores.length
    : 0;

  const totalDelegatedAmount = delegations.reduce((sum, d) => sum + d.amount, 0);

  const trustedAncestors = await findAllTrustedAncestors(wallet, trustAnchors);

  // Compute breakdown
  const breakdown = {
    depthScore: computeDepthScore(depth),
    sponsorQualityScore: computeSponsorQualityScore(avgSponsorQuality),
    sponsorCountScore: computeSponsorCountScore(delegations.length),
    amountScore: computeAmountScore(totalDelegatedAmount),
  };

  const trustScore = computeDelegationTrustScore(breakdown);
  const riskLevel = classifyDelegationRisk(trustScore);
  const recommendedLimit = computeDelegationRecommendedLimit(trustScore);

  // Generate explanation
  const explanation: string[] = [];

  if (isAnchor) {
    explanation.push('Wallet is a trust anchor (deployed the delegation registry)');
  } else if (depth === 0) {
    explanation.push('No delegation chain found');
  } else {
    explanation.push(`Delegation depth: ${depth} hop${depth > 1 ? 's' : ''} from trusted root`);
  }

  if (delegations.length > 0) {
    explanation.push(`${delegations.length} active delegation${delegations.length > 1 ? 's' : ''}`);
  }

  if (avgSponsorQuality > 70) {
    explanation.push(`Sponsor quality: ${avgSponsorQuality.toFixed(0)}% (high trust)`);
  } else if (avgSponsorQuality > 40) {
    explanation.push(`Sponsor quality: ${avgSponsorQuality.toFixed(0)}% (moderate trust)`);
  } else if (delegations.length > 0) {
    explanation.push(`Sponsor quality: ${avgSponsorQuality.toFixed(0)}% (low trust)`);
  }

  if (trustedAncestors.length > 0) {
    explanation.push(`${trustedAncestors.length} trusted ancestor${trustedAncestors.length > 1 ? 's' : ''} reachable`);
  }

  if (trustScore >= 70) explanation.push('Strong delegation trust profile');
  else if (trustScore >= 40) explanation.push('Moderate delegation trust profile');
  else explanation.push('Weak delegation trust profile — limited sponsor backing');

  return {
    wallet,
    trustScore,
    riskLevel,
    approved: trustScore >= 40,
    recommendedLimit,
    breakdown,
    delegation: {
      depth,
      sponsorCount: delegations.length,
      sponsorQuality: Math.round(avgSponsorQuality * 10) / 10,
      delegationPath,
      totalDelegatedAmount,
      isTrustAnchor: isAnchor,
      trustedAncestors: trustedAncestors.length,
    },
    explanation,
  };
}
