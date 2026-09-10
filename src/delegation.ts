import { config } from './config';
import { withTimeout } from './lib/timeout';
import { algod } from './lib/algorand-client';
import { logger } from './lib/logger';
import { isValidWallet, MICRO_ALGO } from './lib/constants';
import { recordDelegationCacheInvalidation } from './lib/metrics';

const INDEXER_URL = config.indexerUrl;

const REGISTRY_APP_ID = config.registryAppId;

const MAX_BRANCHING_FACTOR = 10;

interface Delegation {
  delegator: string;
  delegatee: string;
  amount: number;
  timestamp: number;
  round: number;
}

interface IndexerTransaction {
  sender?: string;
  'asset-transfer-transaction'?: {
    receiver?: string;
    amount?: number;
  };
  'round-time'?: number;
  'confirmed-round'?: number;
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

/**
 * Computes score based on number of sponsors, weighted by sponsor quality.
 *
 * Design rationale:
 * - 5 low-quality sponsors should not equal 5 high-quality sponsors
 * - Quality multiplier prevents trust inflation from sybil endorsement farms
 * - Minimum multiplier of 0.1 ensures some credit for having sponsors at all
 * - Cap at 100 (5+ sponsors with perfect quality)
 *
 * Formula: min(100, count × 20 × max(0.1, avgQuality / 100))
 *
 * Examples:
 *   5 sponsors, quality=100 → min(100, 100 × 1.0) = 100
 *   5 sponsors, quality=50  → min(100, 100 × 0.5) = 50
 *   5 sponsors, quality=0   → min(100, 100 × 0.1) = 10
 *   1 sponsor,  quality=100 → min(100, 20 × 1.0)  = 20
 */
export function computeSponsorCountScore(
  count: number,
  avgQuality = 100,
): number {
  const raw = count * 20;
  const qualityMultiplier = Math.max(0.1, avgQuality / 100);
  const scaled = Math.round(raw * qualityMultiplier * 10) / 10;
  return Math.max(0, Math.min(100, scaled));
}

export function computeAmountScore(amountMicroAlgo: number): number {
  if (!Number.isFinite(amountMicroAlgo) || amountMicroAlgo <= 0) return 0;
  const algo = amountMicroAlgo / MICRO_ALGO;
  if (algo >= 10000) return 100;
  return Math.round(Math.min(100, Math.log10(algo + 1) * 25));
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

async function fetchDelegationsFromIndexer(
  wallet: string,
): Promise<Delegation[]> {
  try {
    const url = `${INDEXER_URL}/v2/accounts/${wallet}/transactions?limit=500&tx-type=axfer`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];

    const data = (await res.json()) as { transactions?: IndexerTransaction[] };
    const txns = data.transactions || [];

    return txns
      .map((t) => ({
        delegator: wallet,
        delegatee: t['asset-transfer-transaction']?.receiver || t.sender || '',
        amount: t['asset-transfer-transaction']?.amount || 0,
        timestamp: t['round-time'] || 0,
        round: t['confirmed-round'] || 0,
      }))
      .filter((d: Delegation) =>
        d.delegatee && d.delegatee !== wallet && isValidWallet(d.delegatee),
      );
  } catch (e) {
    logger.debug('fetchDelegationsFromIndexer failed', { wallet, error: String(e) });
    return [];
  }
}

async function fetchDelegations(wallet: string): Promise<Delegation[]> {
  return fetchDelegationsFromIndexer(wallet);
}

async function fetchWalletTrustScore(wallet: string): Promise<number | null> {
  try {
    const { scoreWallet } = await import('./trust-score');
    const result = await scoreWallet(wallet);
    return result?.trustScore ?? null;
  } catch (e) {
    logger.warn('fetchWalletTrustScore failed', { wallet, error: String(e) });
    return null;
  }
}

// ── Graph traversal ────────────────────────────────────────────


const delegationCache = new Map<string, Delegation[]>();

async function fetchDelegationCached(wallet: string): Promise<Delegation[]> {
  if (delegationCache.has(wallet)) {
    return delegationCache.get(wallet)!;
  }
  const delegations = await fetchDelegations(wallet);
  delegationCache.set(wallet, delegations);
  return delegations;
}

/** Clears the delegation BFS cache. Call after new delegations are recorded. */
export function clearDelegationCache(): void {
  delegationCache.clear();
  recordDelegationCacheInvalidation('global');
}

/**
 * Drops a single wallet's entry from the delegation BFS cache so the
 * next scoreDelegation call for that wallet re-fetches. Other wallets
 * are unaffected. Prefer this over clearDelegationCache() on the
 * fresh-data endpoints (/passport, /underwrite) to keep the cache hit
 * ratio high for everyone else.
 */
export function invalidateDelegationCacheFor(wallet: string): void {
  if (delegationCache.delete(wallet)) {
    recordDelegationCacheInvalidation('single');
  }
}


async function findAllTrustedAncestors(
  wallet: string,
  trustAnchors: Set<string>,
  maxDepth = 10,
): Promise<string[]> {
  const ancestors: string[] = [];
  const visited = new Set<string>();
  const queue: Array<{ address: string; depth: number }> = [
    { address: wallet, depth: 0 },
  ];
  visited.add(wallet);

  while (queue.length > 0) {
    const { address, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    const delegations = await fetchDelegationCached(address);
    let expanded = 0;
    for (const d of delegations) {
      if (expanded >= MAX_BRANCHING_FACTOR) break;
      if (!visited.has(d.delegatee)) {
        visited.add(d.delegatee);
        expanded++;
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

async function isTrustAnchor(wallet: string): Promise<boolean> {
  if (REGISTRY_APP_ID === 0) return false;

  try {
    const info = await withTimeout(
      algod.accountInformation(wallet).do(),
      config.requestTimeoutMs,
      'isTrustAnchor.accountInformation',
    );
    const createdApps = info.createdApps ?? [];
    return createdApps.some((app) => Number(app.id) === REGISTRY_APP_ID);
  } catch (e) {
    logger.warn('isTrustAnchor failed', { wallet, error: String(e) });
    return false;
  }
}

// ── Main scoring function ──────────────────────────────────────

/**
 * Scores delegation trust using cached data (for API endpoints).
 */
export async function scoreDelegation(
  wallet: string,
): Promise<DelegationTrustScore | null> {
  return scoreDelegationInternal(wallet, false);
}

/**
 *
 * Drops only the target wallet from the BFS delegation cache before
 * scoring so the fresh data for `wallet` is reflected. Other wallets'
 * cache entries are preserved.
 */
export async function scoreDelegationFresh(
  wallet: string,
): Promise<DelegationTrustScore | null> {
  invalidateDelegationCacheFor(wallet);
  return scoreDelegationInternal(wallet, true);
}

async function scoreDelegationInternal(
  wallet: string,
  fresh: boolean,
): Promise<DelegationTrustScore | null> {
  if (!isValidWallet(wallet)) return null;

  const [delegations, isAnchor] = await Promise.all([
    fresh ? fetchDelegations(wallet) : fetchDelegationCached(wallet),
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

      const walletDelegations = await fetchDelegationCached(current.address);
      let expanded = 0;
      for (const d of walletDelegations) {
        if (expanded >= MAX_BRANCHING_FACTOR) break;
        if (!visited.has(d.delegatee)) {
          visited.add(d.delegatee);
          expanded++;
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

  // Fetch sponsor trust scores in parallel. A null return means the
  // Algorand/indexer call for that sponsor failed — we keep the null
  // (not 0) so we can distinguish "fetched and scored 0" from "fetch
  // failed entirely". The cap formula at the bottom uses only the
  // non-null scores; if every fetch fails the cap is skipped and the
  // raw score stands.
  const sponsorScores = await Promise.all(
    delegations.slice(0, 5).map(d => fetchWalletTrustScore(d.delegatee))
  );
  const knownSponsorScores = sponsorScores.filter(
    (s): s is number => s !== null,
  );

  const avgSponsorQuality = knownSponsorScores.length > 0
    ? knownSponsorScores.reduce((a, b) => a + b, 0) / knownSponsorScores.length
    : 0;

  const totalDelegatedAmount = delegations.reduce(
    (sum, d) => sum + d.amount, 0,
  );

  const trustedAncestors = await findAllTrustedAncestors(wallet, trustAnchors);

  // Compute breakdown
  const breakdown = {
    depthScore: computeDepthScore(depth),
    sponsorQualityScore: computeSponsorQualityScore(avgSponsorQuality),
    sponsorCountScore: computeSponsorCountScore(
      delegations.length, avgSponsorQuality,
    ),
    amountScore: computeAmountScore(totalDelegatedAmount),
  };

  let trustScore = computeDelegationTrustScore(breakdown);

  // CAP: Trust cannot exceed the highest sponsor trust score (prevents
  // amplification). A wallet's delegation trust represents trust received
  // through its endorsement network. It cannot exceed the trust of the most
  // trusted entity in that network.
  // Analogous to PageRank: a hub's score is bounded by authority scores.
  //
  // The cap is applied only when at least one sponsor score is known.
  // When every sponsor fetch fails (Algorand outage, indexer flakiness),
  // skip the cap so the score reflects the local graph only and
  // surface a degraded-data explanation line.
  const failedSponsorFetches = sponsorScores.length - knownSponsorScores.length;
  if (knownSponsorScores.length > 0) {
    const maxSponsorTrust = Math.max(...knownSponsorScores);
    const depthPenalty = depth * 20;
    const adjustedCap = Math.max(0, maxSponsorTrust - depthPenalty);
    trustScore = Math.min(trustScore, adjustedCap);
  }
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

  if (failedSponsorFetches > 0) {
    explanation.push(
      `${failedSponsorFetches} sponsor fetch${failedSponsorFetches > 1 ? 'es' : ''} failed — score reflects local graph only`,
    );
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
