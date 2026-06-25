import { config } from './config';
import { withTimeout, fetchWithTimeout } from './lib/timeout';
import { algod } from './lib/algorand-client';
import { MICRO_ALGO, isValidWallet } from './lib/constants';
import { LRUCache } from './lib/cache';
import { logger } from './lib/logger';
import { scoreWallet } from './trust-score';

const INDEXER_URL = config.indexerUrl;

interface GraphEdge {
  from: string;
  to: string;
  amount: number;
  round: number;
}

interface GraphNode {
  address: string;
  trustScore: number;
  balanceAlgo: number;
  depth: number;
}

interface TrustPath {
  path: string[];
  depth: number;
  totalDelegated: number;
  weakestLink: number;
}

interface ExposureAnalysis {
  totalExposure: number;
  directExposure: number;
  indirectExposure: number;
  exposureByDepth: { depth: number; amount: number; wallets: number }[];
  maxLossIfSponsorFails: number;
}

interface WhatIfResult {
  sponsorRemoved: string;
  originalScore: number;
  newScore: number;
  scoreImpact: number;
  affectedWallets: number;
  explanation: string[];
}

export interface TrustGraphResult {
  wallet: string;
  depth: number;
  nodeCount: number;
  edges: GraphEdge[];
  nodes: GraphNode[];
  paths: TrustPath[];
  exposure: ExposureAnalysis;
  whatIfs: WhatIfResult[];
  explanation: string[];
}

// ── Pure math functions (exported for testing) ─────────────────

export function computeWeakestLink(trustScores: number[]): number {
  if (trustScores.length === 0) return 0;
  return Math.min(...trustScores);
}

export function computePathRisk(depth: number, weakestLink: number): number {
  // Risk increases with depth, decreases with weakest link strength
  const depthPenalty = Math.max(0, depth - 1) * 5;
  return Math.max(0, Math.min(100, weakestLink - depthPenalty));
}

export function computeExposure(
  edges: GraphEdge[],
  wallet: string
): ExposureAnalysis {
  const directEdges = edges.filter(e => e.from === wallet);
  const directExposure = directEdges.reduce((sum, e) => sum + e.amount, 0);

  // Group by depth (simplified: direct = depth 1)
  const exposureByDepth = [
    { depth: 1, amount: directExposure, wallets: directEdges.length },
  ];

  const indirectEdges = edges.filter(e => e.from !== wallet);
  const indirectExposure = indirectEdges.reduce((sum, e) => sum + e.amount, 0);

  return {
    totalExposure: directExposure + indirectExposure,
    directExposure,
    indirectExposure,
    exposureByDepth,
    maxLossIfSponsorFails: directExposure,
  };
}

// ── On-chain data fetching ─────────────────────────────────────

type GraphAccountInfo = { balance: number; trustScore: number };

const graphAccountInfoCache = new LRUCache<GraphAccountInfo>(200, 60_000);

async function fetchAccountInfo(wallet: string, fresh: boolean = false): Promise<GraphAccountInfo | null> {
  if (!fresh) {
    const cached = graphAccountInfoCache.get(wallet);
    if (cached) return cached;
  }

  try {
    const info = await withTimeout(algod.accountInformation(wallet).do(), 10_000, 'accountInformation');
    const result: GraphAccountInfo = {
      balance: Number(info.amount || 0n),
      trustScore: 0,
    };
    if (!fresh) graphAccountInfoCache.set(wallet, result);
    return result;
  } catch (e) {
    logger.warn('fetchAccountInfo failed', { wallet, error: String(e) });
    return null;
  }
}

interface TrustGraphIndexerTransaction {
  'payment-transaction'?: { receiver?: string; amount?: number };
  'confirmed-round'?: number;
}

interface TrustGraphIndexerResponse {
  transactions?: TrustGraphIndexerTransaction[];
}

async function fetchDelegationEdges(wallet: string, limit: number = 100): Promise<GraphEdge[]> {
  try {
    const url = `${INDEXER_URL}/v2/accounts/${wallet}/transactions?limit=${limit}&tx-type=pay`;
    const res = await fetchWithTimeout(url, { timeoutMs: 10_000 });
    if (!res.ok) return [];

    const data = (await res.json()) as TrustGraphIndexerResponse;
    const txns = data.transactions || [];

    return txns
      .filter((t) => {
        const receiver = t['payment-transaction']?.receiver;
        return receiver && receiver !== wallet && isValidWallet(receiver);
      })
      .map((t) => ({
        from: wallet,
        to: t['payment-transaction']!.receiver!,
        amount: t['payment-transaction']?.amount || 0,
        round: t['confirmed-round'] || 0,
      }));
  } catch (e) {
    logger.warn('fetchDelegationEdges failed', { wallet, error: String(e) });
    return [];
  }
}

// ── Main function ──────────────────────────────────────────────

export async function analyzeTrustGraph(
  wallet: string,
  maxDepth: number = 5
): Promise<TrustGraphResult | null> {
  if (!isValidWallet(wallet)) return null;

  const allEdges: GraphEdge[] = [];
  const visited = new Map<string, GraphNode>();
  const queue: Array<{ address: string; depth: number }> = [{ address: wallet, depth: 0 }];
  visited.set(wallet, { address: wallet, trustScore: 0, balanceAlgo: 0, depth: 0 });

  // BFS traversal
  while (queue.length > 0) {
    const { address, depth } = queue.shift()!;

    if (depth >= maxDepth) continue;

    // Fetch edges for this wallet
    const edges = await fetchDelegationEdges(address);
    allEdges.push(...edges);

    // Collect unique unseen targets, limit to 10 per depth level
    const newTargets: { edge: GraphEdge; info: { balance: number; trustScore: number } | null }[] = [];
    const seenTargets = new Set<string>();
    for (const edge of edges) {
      if (!visited.has(edge.to) && !seenTargets.has(edge.to)) {
        seenTargets.add(edge.to);
        if (newTargets.length >= 10) break;
        const info = await fetchAccountInfo(edge.to);
        newTargets.push({ edge, info });
      }
    }

    // Process collected targets
    for (const { edge, info } of newTargets) {
      visited.set(edge.to, {
        address: edge.to,
        trustScore: 0,
        balanceAlgo: info?.balance ? info.balance / MICRO_ALGO : 0,
        depth: depth + 1,
      });
      queue.push({ address: edge.to, depth: depth + 1 });
    }
  }

  const nodes = Array.from(visited.values());
  const nodeCount = nodes.length;

  // P0 FIX: Fetch actual trust scores for all visited nodes (was hardcoded to 0)
  const trustScorePromises = nodes.map(async (node) => {
    try {
      const result = await scoreWallet(node.address);
      return { address: node.address, trustScore: result?.trustScore ?? 0 };
    } catch {
      return { address: node.address, trustScore: 0 };
    }
  });
  const trustScoreResults = await Promise.all(trustScorePromises);
  const trustScoreMap = new Map(trustScoreResults.map(r => [r.address, r.trustScore]));

  // Update nodes with actual trust scores
  for (const node of nodes) {
    node.trustScore = trustScoreMap.get(node.address) ?? 0;
  }

  // Build paths from direct edges
  const paths: TrustPath[] = [];
  const directEdges = allEdges.filter(e => e.from === wallet);
  for (const edge of directEdges) {
    const targetNode = visited.get(edge.to);
    const sourceNode = visited.get(wallet);
    const trustScores = [
      sourceNode?.trustScore ?? 0,
      targetNode?.trustScore ?? 0,
    ].filter(s => s > 0);
    paths.push({
      path: [wallet, edge.to],
      depth: 1,
      totalDelegated: edge.amount,
      weakestLink: trustScores.length > 0 ? computeWeakestLink(trustScores) : 0,
    });
  }

  // Exposure analysis
  const exposure = computeExposure(allEdges, wallet);

  // What-if analysis: what happens if each direct sponsor disappears
  const whatIfs: WhatIfResult[] = [];
  for (const edge of directEdges) {
    const remainingEdges = allEdges.filter(e => !(e.from === wallet && e.to === edge.to));
    const remainingExposure = computeExposure(remainingEdges, wallet);
    const scoreImpact = edge.amount > 0
      ? Math.round((remainingExposure.totalExposure / Math.max(1, exposure.totalExposure)) * 100) / 100
      : 1;

    whatIfs.push({
      sponsorRemoved: edge.to,
      originalScore: exposure.totalExposure,
      newScore: remainingExposure.totalExposure,
      scoreImpact,
      affectedWallets: 1,
      explanation: [
        `If ${edge.to.slice(0, 8)}... is removed, exposure drops from $${(exposure.totalExposure / MICRO_ALGO).toFixed(2)} to $${(remainingExposure.totalExposure / MICRO_ALGO).toFixed(2)}`,
        `Impact: ${Math.round((1 - scoreImpact) * 100)}% reduction in delegated trust`,
      ],
    });
  }

  // Explanation
  const explanation: string[] = [];
  if (nodeCount === 1) {
    explanation.push('No delegation graph found — wallet is isolated');
  } else {
    explanation.push(`Trust graph contains ${nodeCount} wallets across ${Math.min(maxDepth, nodeCount - 1)} depth levels`);
  }
  explanation.push(`${allEdges.length} delegation edges detected`);
  explanation.push(`Direct exposure: $${(exposure.directExposure / MICRO_ALGO).toFixed(2)} ALGO`);
  if (exposure.indirectExposure > 0) {
    explanation.push(`Indirect exposure: $${(exposure.indirectExposure / MICRO_ALGO).toFixed(2)} ALGO`);
  }
  if (whatIfs.length > 0) {
    explanation.push(`${whatIfs.length} what-if scenario${whatIfs.length > 1 ? 's' : ''} analyzed`);
  }

  return {
    wallet,
    depth: Math.min(maxDepth, nodeCount - 1),
    nodeCount,
    edges: allEdges,
    nodes,
    paths,
    exposure,
    whatIfs,
    explanation,
  };
}
