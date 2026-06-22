import algosdk from 'algosdk';

const ALGOD_URL = process.env.ALGOD_URL || 'https://testnet-api.algonode.cloud:443';
const INDEXER_URL = process.env.INDEXER_URL || 'https://testnet-idx.algonode.cloud:443';
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';

export interface GraphEdge {
  from: string;
  to: string;
  amount: number;
  round: number;
}

export interface GraphNode {
  address: string;
  trustScore: number;
  balanceAlgo: number;
  depth: number;
}

export interface TrustPath {
  path: string[];
  depth: number;
  totalDelegated: number;
  weakestLink: number;
}

export interface ExposureAnalysis {
  totalExposure: number;
  directExposure: number;
  indirectExposure: number;
  exposureByDepth: { depth: number; amount: number; wallets: number }[];
  maxLossIfSponsorFails: number;
}

export interface WhatIfResult {
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

async function fetchAccountInfo(wallet: string): Promise<{
  balance: number;
  trustScore: number;
} | null> {
  const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL);
  try {
    const info = await algod.accountInformation(wallet).do();
    const data = info as any;
    return {
      balance: Number(data.amount || 0),
      trustScore: 0, // Will be computed separately if needed
    };
  } catch {
    return null;
  }
}

async function fetchDelegationEdges(wallet: string): Promise<GraphEdge[]> {
  try {
    const url = `${INDEXER_URL}/v2/accounts/${wallet}/transactions?limit=500&tx-type=pay`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json() as any;
    const txns = data.transactions || [];

    return txns
      .filter((t: any) => {
        const receiver = t['payment-transaction']?.receiver;
        return receiver && receiver !== wallet && /^[A-Z2-7]{58}$/.test(receiver);
      })
      .map((t: any) => ({
        from: wallet,
        to: t['payment-transaction'].receiver,
        amount: t['payment-transaction'].amount || 0,
        round: t['confirmed-round'] || 0,
      }));
  } catch {
    return [];
  }
}

// ── Main function ──────────────────────────────────────────────

export async function analyzeTrustGraph(
  wallet: string,
  maxDepth: number = 5
): Promise<TrustGraphResult | null> {
  if (!/^[A-Z2-7]{58}$/.test(wallet)) return null;

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

    // Process each target
    for (const edge of edges) {
      if (!visited.has(edge.to)) {
        const info = await fetchAccountInfo(edge.to);
        visited.set(edge.to, {
          address: edge.to,
          trustScore: 0,
          balanceAlgo: info?.balance ? info.balance / 1_000_000 : 0,
          depth: depth + 1,
        });
        queue.push({ address: edge.to, depth: depth + 1 });
      }
    }
  }

  const nodes = Array.from(visited.values());
  const nodeCount = nodes.length;

  // Build paths (simplified: direct paths from wallet)
  const paths: TrustPath[] = [];
  const directEdges = allEdges.filter(e => e.from === wallet);
  for (const edge of directEdges) {
    paths.push({
      path: [wallet, edge.to],
      depth: 1,
      totalDelegated: edge.amount,
      weakestLink: computeWeakestLink([50]), // placeholder until trust scores are fetched
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
        `If ${edge.to.slice(0, 8)}... is removed, exposure drops from $${(exposure.totalExposure / 1_000_000).toFixed(2)} to $${(remainingExposure.totalExposure / 1_000_000).toFixed(2)}`,
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
  explanation.push(`Direct exposure: $${(exposure.directExposure / 1_000_000).toFixed(2)} ALGO`);
  if (exposure.indirectExposure > 0) {
    explanation.push(`Indirect exposure: $${(exposure.indirectExposure / 1_000_000).toFixed(2)} ALGO`);
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
