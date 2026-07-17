/**
 * Graph analysis for sybil detection.
 *
 * Addresses vulnerabilities V2 (no graph traversal), V4 (no behavioral
 * fingerprinting), V6 (interaction density evasion via intermediaries),
 * and V8 (no transaction graph analysis).
 *
 * All functions are pure math — no network calls.
 *
 * Complexity (per function):
 *   buildAdjacencyList:           O(E)
 *   computeClusteringCoefficient: O(k²) per node, O(E × d) batch
 *   computeHubScore:              O(1) per node
 *   computeIntermediateDensity:   O(k² × d) per node (2-hop detection)
 *   bfs:                          O(V+E) with index-based dequeue
 *   findConnectedComponents:      O(V_sub + E_sub) with constrained BFS
 *   computeTemporalCorrelation:   O(V² × R)
 *   computeGraphSignals:          O(E × d + V × k² × d + V² × R)
 */

export interface GraphSignals {
  /** V2+V8: How tightly interconnected the wallet's neighbors are */
  neighborhoodClustering: number;
  /** V4: Is there a central hub wallet orchestrating the cluster? */
  hubScore: number;
  /** V6: Interactions between wallets through intermediaries (2-hop) */
  intermediateDensity: number;
  /** V8: What fraction of cluster is in the largest connected component */
  componentRatio: number;
  /** V4: Do wallets activate/deactivate together? */
  temporalCorrelation: number;
  /** V2+V8: Number of connected sub-groups within the cluster */
  subGroupCount: number;
}

export interface GraphTransaction {
  from: string;
  to: string;
  round?: number;
}

// ── Adjacency List ──────────────────────────────────────────────

export function buildAdjacencyList(
  transactions: GraphTransaction[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const t of transactions) {
    if (t.from === t.to) continue; // skip self-transactions
    if (!adj.has(t.from)) adj.set(t.from, new Set());
    if (!adj.has(t.to)) adj.set(t.to, new Set());
    adj.get(t.from)!.add(t.to);
    adj.get(t.to)!.add(t.from);
  }
  return adj;
}

export function getNeighbors(
  adj: Map<string, Set<string>>,
  node: string,
): Set<string> {
  return adj.get(node) || new Set();
}

// ── V2+V8: Neighborhood Clustering Coefficient ─────────────────

/**
 * Local clustering coefficient for a node.
 *
 * = (edges between neighbors) / (possible edges between neighbors)
 *
 * High value → all counterparties also interact with each other → sybil farm.
 * Low value  → counterparties are independent → legitimate network.
 *
 * Examples:
 *   Triangle (A↔B↔C↔A): clustering=1.0 for each node
 *   Star (B↔A, C↔A, D↔A): clustering=0.0 for A (B,C,D don't interact)
 */
export function computeClusteringCoefficient(
  adj: Map<string, Set<string>>,
  node: string,
): number {
  const neighbors = getNeighbors(adj, node);
  if (neighbors.size < 2) return 0;

  const neighborList = [...neighbors];
  let edgesBetween = 0;

  for (const [i, a] of neighborList.entries()) {
    for (const b of neighborList.slice(i + 1)) {
      if (adj.get(a)?.has(b)) {
        edgesBetween++;
      }
    }
  }

  const possible = (neighborList.length * (neighborList.length - 1)) / 2;
  if (possible === 0) return 0;
  return Math.round((edgesBetween / possible) * 100) / 100;
}

/**
 * Computes clustering coefficients for all nodes using edge-iteration.
 *
 * Time: O(Σ_{(u,v)∈E} min(deg(u), deg(v))) = O(E × d) for sparse graphs.
 * For V=100K, E=1M, d=20: O(20M) — fast.
 *
 * Returns a Map from node → clustering coefficient.
 */
export function computeAllClusteringCoefficients(
  adj: Map<string, Set<string>>,
): Map<string, number> {
  const edgeCounts = new Map<string, number>();
  const degrees = new Map<string, number>();

  for (const [node, neighbors] of adj) {
    edgeCounts.set(node, 0);
    degrees.set(node, neighbors.size);
  }

  // For each edge (u, v), increment counter for all common neighbors
  for (const [u, neighbors] of adj) {
    for (const v of neighbors) {
      if (u < v) { // process each undirected edge once
        const uNeighbors = adj.get(u) || new Set();
        const vNeighbors = adj.get(v) || new Set();
        const [smaller, larger] = uNeighbors.size <= vNeighbors.size
          ? [uNeighbors, vNeighbors] : [vNeighbors, uNeighbors];

        for (const w of smaller) {
          if (larger.has(w) && w !== u && w !== v) {
            edgeCounts.set(w, (edgeCounts.get(w) || 0) + 1);
          }
        }
      }
    }
  }

  const result = new Map<string, number>();
  for (const [node, count] of edgeCounts) {
    const k = degrees.get(node) || 0;
    if (k < 2) {
      result.set(node, 0);
    } else {
      const possible = (k * (k - 1)) / 2;
      result.set(node, Math.round((count / possible) * 100) / 100);
    }
  }

  return result;
}

/**
 * Average clustering coefficient across all nodes in a set.
 * Higher average → tighter-knit cluster → more likely sybil.
 *
 * Uses edge-iteration for O(E × d) time instead of O(V × k²).
 */
export function computeAverageClustering(
  adj: Map<string, Set<string>>,
  nodes: string[],
): number {
  if (nodes.length === 0) return 0;
  const allCoeffs = computeAllClusteringCoefficients(adj);
  const nodeSet = new Set(nodes);
  let sum = 0;
  let count = 0;
  for (const [node, coeff] of allCoeffs) {
    if (nodeSet.has(node)) {
      sum += coeff;
      count++;
    }
  }
  if (count === 0) return 0;
  return Math.round((sum / count) * 100) / 100;
}

// ── V4: Hub Score (Degree Centrality) ───────────────────────────

/**
 * Degree centrality of a node relative to the cluster.
 *
 * High hub score → one wallet interacts with many others → orchestrator.
 * Low hub score  → wallet interacts with few others → typical participant.
 *
 * A single wallet funding all others with no inter-wallet activity
 * produces hubScore=1.0 for the hub, 0.x for the spokes.
 */
export function computeHubScore(
  adj: Map<string, Set<string>>,
  node: string,
  clusterSize: number,
): number {
  if (clusterSize <= 1) return 0;
  const degree = getNeighbors(adj, node).size;
  // Normalize by max possible edges within cluster (clusterSize - 1)
  return Math.round(Math.min(1, degree / (clusterSize - 1)) * 100) / 100;
}

/**
 * Maximum hub score in the cluster.
 * High max hub + high variance → one orchestrator + many spokes.
 */
export function computeMaxHubScore(
  adj: Map<string, Set<string>>,
  nodes: string[],
): number {
  if (nodes.length === 0) return 0;
  return Math.max(...nodes.map(n => computeHubScore(adj, n, nodes.length)));
}

// ── V6: Intermediate Interaction Density ────────────────────────

/**
 * Detects 2-hop intermediary interactions between a wallet's counterparties.
 *
 * For each pair (u, v) of the wallet's direct neighbors:
 *   - If u↔v is a direct edge → not intermediate (direct interaction)
 *   - If ∃w ∉ {u,v,node}: (u,w)∈E ∧ (w,v)∈E → intermediate (2-hop via w)
 *   - Otherwise → no interaction
 *
 * High density -> counterparties interact via intermediaries -> sybil evasion.
 * Low density  -> counterparties interact directly or not at all.
 *
 * Time: O(k² × d) per node where k = degree, d = avg degree.
 * For k=25, d=20: O(12,500) per node — fast.
 *
 * Ratio: (pairs with 2-hop intermediary) / (possible pairs without direct edge)
 */
export function computeIntermediateDensity(
  adj: Map<string, Set<string>>,
  node: string,
): number {
  const neighbors = getNeighbors(adj, node);
  if (neighbors.size < 2) return 0;

  const neighborList = [...neighbors];
  let intermediatePairs = 0;
  let nonDirectPairs = 0;

  for (const [i, a] of neighborList.entries()) {
    for (const b of neighborList.slice(i + 1)) {
      // Skip pairs that interact directly
      const adjA = adj.get(a) || new Set();
      if (adjA.has(b)) continue;

      nonDirectPairs++;

      // Check for 2-hop intermediary: ∃w ∉ {a,b,node} : (a,w)∈E ∧ (w,b)∈E
      for (const w of adjA) {
        if (w === node || w === a || w === b) continue;
        const adjW = adj.get(w) || new Set();
        if (adjW.has(b)) {
          intermediatePairs++;
          break; // count each (a,b) pair once
        }
      }
    }
  }

  // Ratio of intermediate connections among non-direct pairs
  // If all pairs are direct, intermediate density = 0 (no intermediary evasion)
  if (nonDirectPairs === 0) return 0;
  return Math.round((intermediatePairs / nonDirectPairs) * 100) / 100;
}

/**
 * Average intermediate density across all cluster nodes.
 *
 */
export function computeAverageIntermediateDensity(
  adj: Map<string, Set<string>>,
  nodes: string[],
): number {
  if (nodes.length === 0) return 0;
  const sum = nodes.reduce((s, n) => s + computeIntermediateDensity(adj, n), 0);
  return Math.round((sum / nodes.length) * 100) / 100;
}

// ── V8: Connected Components ───────────────────────────────────

/**
 * BFS to find all reachable nodes from a starting node.
 */
export function bfs(
  adj: Map<string, Set<string>>,
  start: string,
  nodeSet?: Set<string>,
): string[] {
  const visited = new Set<string>();
  const queue = [start];
  visited.add(start);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    for (const neighbor of getNeighbors(adj, current)) {
      if (!visited.has(neighbor)) {
        if (nodeSet && !nodeSet.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return [...visited];
}

/**
 * Find all connected components in a subgraph.
 * Each component is a group of wallets that can reach each other.
 */
export function findConnectedComponents(
  adj: Map<string, Set<string>>,
  nodes: string[],
): string[][] {
  const nodeSet = new Set(nodes);
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of nodes) {
    if (visited.has(node)) continue;
    const component = bfs(adj, node, nodeSet);
    for (const n of component) visited.add(n);
    components.push(component);
  }

  return components;
}

/**
 * Ratio of largest component to total cluster size.
 *
 * ratio=1.0 → all wallets are interconnected (single group).
 * ratio=0.5 → only half the cluster is connected (split into sub-groups).
 * ratio≈0   → mostly isolated wallets (no connections).
 *
 * A sybil farm that creates isolated pairs has low ratio.
 * A tightly-coupled farm has high ratio.
 */
export function computeComponentRatio(
  adj: Map<string, Set<string>>,
  nodes: string[],
): number {
  if (nodes.length === 0) return 0;
  const components = findConnectedComponents(adj, nodes);
  if (components.length === 0) return 0;
  const largest = Math.max(...components.map(c => c.length));
  return Math.round((largest / nodes.length) * 100) / 100;
}

// ── V4: Temporal Correlation ────────────────────────────────────

/**
 * Correlation of wallet activity windows.
 *
 * Measures whether wallets activate and deactivate together.
 * If wallet A and B both appear in transactions at the same rounds,
 * they likely were created and operated together (sybil farm).
 *
 * Uses Jaccard similarity: |A ∩ B| / |A ∪ B|
 * where A, B are the sets of active rounds for each wallet.
 *
 * Score = average Jaccard similarity across all pairs with co-activity
 */
export function computeTemporalCorrelation(
  transactions: { from: string; to: string; round: number }[],
  nodes: string[],
): number {
  if (nodes.length < 2) return 0;

  // Build round set per node
  const roundsPerNode = new Map<string, Set<number>>();
  for (const node of nodes) {
    roundsPerNode.set(node, new Set());
  }
  for (const t of transactions) {
    if (roundsPerNode.has(t.from)) roundsPerNode.get(t.from)!.add(t.round);
    if (roundsPerNode.has(t.to)) roundsPerNode.get(t.to)!.add(t.round);
  }

  // Compare each pair using Jaccard similarity
  let totalSimilarity = 0;
  let pairsWithOverlap = 0;

  for (const [i, a] of nodes.entries()) {
    for (const b of nodes.slice(i + 1)) {
      const roundsA = roundsPerNode.get(a) || new Set();
      const roundsB = roundsPerNode.get(b) || new Set();

      // Find intersection size (co-active rounds)
      const [smaller, larger] = roundsA.size <= roundsB.size
        ? [roundsA, roundsB] : [roundsB, roundsA];

      let intersection = 0;
      for (const r of smaller) {
        if (larger.has(r)) intersection++;
      }

      if (intersection > 0) {
        // Jaccard: |intersection| / |union|
        const union = roundsA.size + roundsB.size - intersection;
        totalSimilarity += intersection / union;
        pairsWithOverlap++;
      }
    }
  }

  if (pairsWithOverlap === 0) return 0;
  const ratio = Math.min(1, totalSimilarity / pairsWithOverlap);
  return Math.round(ratio * 100) / 100;
}

// ── Combined Signal Computation ─────────────────────────────────

/**
 * Compute all graph-based sybil signals.
 *
 * Complexity:
 *   - buildAdjacencyList: O(E)
 *   - computeAverageClustering: O(E × d) via edge-iteration
 *   - computeMaxHubScore: O(V)
 *   - computeAverageIntermediateDensity: O(V × k² × d)
 *   - findConnectedComponents: O(V_sub + E_sub) with constrained BFS
 *   - computeTemporalCorrelation: O(V² × R)
 *   Total: O(E × d + V × k² × d + V² × R)
 *   For V=25, E=200, d=20: ~50K operations — fast.
 */
export function computeGraphSignals(
  transactions: GraphTransaction[],
  nodes: string[],
): GraphSignals {
  if (nodes.length === 0) {
    return {
      neighborhoodClustering: 0,
      hubScore: 0,
      intermediateDensity: 0,
      componentRatio: 0,
      temporalCorrelation: 0,
      subGroupCount: 0,
    };
  }

  const adj = buildAdjacencyList(transactions);

  const neighborhoodClustering = computeAverageClustering(adj, nodes);
  const hubScore = computeMaxHubScore(adj, nodes);
  const intermediateDensity = computeAverageIntermediateDensity(adj, nodes);
  const componentRatio = computeComponentRatio(adj, nodes);
  const components = findConnectedComponents(adj, nodes);
  const subGroupCount = components.length;

  // Temporal correlation requires full transaction list with rounds
  const txnsWithRound = transactions.map(t => ({
    from: t.from,
    to: t.to,
    round: t.round || 0,
  }));
  const temporalCorrelation = computeTemporalCorrelation(txnsWithRound, nodes);

  return {
    neighborhoodClustering,
    hubScore,
    intermediateDensity,
    componentRatio,
    temporalCorrelation,
    subGroupCount,
  };
}
