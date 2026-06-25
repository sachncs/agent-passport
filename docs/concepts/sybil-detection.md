# Sybil Detection

Sybil detection in the service combines **seven wallet-history
signals** (in `src/sybil.ts`) and **four graph-traversal signals**
(in `src/lib/graph.ts`). All 11 signals feed a weighted formula
that produces a `sybilRisk` score in `[0, 1]`.

> **Vulnerabilities addressed** (from `src/lib/graph.ts:3-7`):
> V2 (no graph traversal), V4 (no behavioural fingerprinting),
> V6 (interaction density evasion via intermediaries), V8 (no
> transaction graph analysis).

## 1. The 11 signals

| # | Signal | Source | Purpose |
|---|--------|--------|---------|
| 1 | `creationClustering` | `src/sybil.ts` | V4: many wallets created in a short window |
| 2 | `interactionDensity` | `src/sybil.ts` | V6: tightly-interacted cluster |
| 3 | `balanceSimilarity` | `src/sybil.ts` | V4: suspiciously-similar balances |
| 4 | `circularActivity` | `src/sybil.ts` | V4: A→B→C→A flow |
| 5 | `timingRegularity` | `src/sybil.ts` | V4: bot-like timing |
| 6 | `amountFingerprint` | `src/sybil.ts` | V4: same-amount repeated |
| 7 | `fundingCorrelation` | `src/sybil.ts` | V4: same funder across wallets |
| 8 | `neighborhoodClustering` | `src/lib/graph.ts` | V2: tightly-interconnected neighbours |
| 9 | `hubScore` | `src/lib/graph.ts` | V4: central hub wallet |
| 10 | `intermediateDensity` | `src/lib/graph.ts` | V6: 2-hop intermediary density |
| 11 | `componentRatio` | `src/lib/graph.ts` | V8: fraction in largest component |
| 12 | `temporalCorrelation` | `src/lib/graph.ts` | V8: round-time clustering |

> Note: there are 11 distinct functions but the response
> (`SybilResult.signals`) carries 12 fields — `circularActivity`
> and `temporalCorrelation` are split into two sub-fields.

## 2. Wallet-history signals (7)

### 2.1 `creationClustering`

Wallets created in a narrow round window. Default window: 14 515
rounds (~48 h at 3.3 s/round).

```
if windowRounds === 0: return 0
return min(1, countInWindow / maxWalletsInWindow)
```

| Count in window | Score |
|----------------:|------:|
| 0 | 0 |
| 5 | 0.5 |
| 10+ | 1.0 |

### 2.2 `interactionDensity`

Average number of transactions per connected neighbour, normalised
by the expected density.

```
density = totalTxns / uniqueNeighbours
expected = log10(uniqueNeighbours + 1) × 2
return min(1, density / max(expected, 1))
```

A wallet with 100 txns to 5 unique neighbours has a density of 20
— well above the expected `log10(6) × 2 ≈ 1.6` — yielding a high
interaction-density signal.

### 2.3 `balanceSimilarity`

The fraction of counterparties whose balance is within 10% of the
target's balance.

```
matches = counterparties.filter(c => abs(c.balance - target.balance) < 0.1 × max(balances))
return matches.length / counterparties.length
```

### 2.4 `circularActivity`

Number of A→B→A cycles in the transaction graph. A high value
indicates a tightly-coupled cluster.

```
cycles = countA->B->A(txs)
return min(1, cycles / maxCycles)
```

### 2.5 `timingRegularity`

Coefficient of variation of the inter-transaction time. A low
value (regular intervals) is bot-like.

```
intervals = roundTimes.diff()
mean = mean(intervals)
std = std(intervals)
if mean === 0: return 0
return clamp(1 - std/mean / 0.5, 0, 1)  // 0 (bot) to 1 (human)
```

### 2.6 `amountFingerprint`

Repeated identical amounts in the transaction history.

```
counts = groupBy(txs, t => t.amount)
maxCount = max(counts.values())
return min(1, maxCount / totalTxns)
```

### 2.7 `fundingCorrelation`

The fraction of incoming transactions that come from the same
funder (the first incoming transaction).

```
incoming = txs.filter(t => t.receiver === wallet)
funderCounts = groupBy(incoming, t => t.sender)
return topFunderCount / incoming.length
```

## 3. Graph signals (4)

### 3.1 `neighborhoodClustering`

For each neighbour, the fraction of its neighbours that are also
neighbours of the target. High values indicate a tight cluster.

```
clustering = mean over neighbours n of:
  |intersect(n.neighbours, target.neighbours)| / |n.neighbours|
```

Complexity: O(k²) per node.

### 3.2 `hubScore`

A central hub wallet has many incoming and outgoing edges. A
neighbour with high hub score is itself a hub.

```
hubScore(n) = log10(n.inDegree + n.outDegree + 1) / log10(maxDegree + 1)
```

Complexity: O(1) per node.

### 3.3 `intermediateDensity`

For each 2-hop path N → M → T, the fraction of M's neighbours that
are also N's neighbours. High density indicates a tightly-coupled
intermediary layer.

Complexity: O(k² × d) per node.

### 3.4 `componentRatio`

Fraction of the wallet's cluster that is in the largest connected
component. A cluster entirely in one component is more suspicious
than one spread across components.

```
ratio = |largestComponent ∩ cluster| / |cluster|
```

### 3.5 `temporalCorrelation`

For each pair of wallets in the cluster, the absolute difference in
their first-seen rounds. A low average difference is a strong
sybil signal.

```
diffs = |firstRound(w1) - firstRound(w2)| for all pairs
return clamp(mean(diffs) / (windowRounds × 4), 0, 1)
```

Complexity: O(V² × R).

## 4. The 12-signal weighted formula

```
sybilRisk = Σ (weight_i × signal_i) / Σ weight_i
```

The weights are tuned so that a "clean" wallet hits ~0.1 and a
"sybil cluster" hits ~0.9. The exact weights are in
`src/sybil.ts` (the `computeSybilRisk` function).

`applySybilPenalty` is then applied to the trust score:

| `sybilRisk` | Penalty |
|------------:|--------:|
| < 0.45 | 0% (no penalty) |
| 0.45 – 0.70 | 20% reduction |
| ≥ 0.70 | 50% reduction |

## 5. Confidence

`confidence` reflects the **data availability** for the wallet. A
wallet with < 30 days of history has low confidence; the sybil
detection may produce a falsely-low sybil risk because there isn't
enough data to evaluate the signals.

```typescript
confidence = min(1, totalTxns / 100) × min(1, accountAgeDays / 30)
```

The underwriting engine requires `confidence ≥ 0.45` to approve a
decision.

## 6. Risk classification

```typescript
function classifySybilRisk(sybilRisk, confidence) {
  if (sybilRisk >= 0.7) return 'critical';
  if (sybilRisk >= 0.5) return 'high';
  if (sybilRisk >= 0.3) return 'medium';
  return 'low';
}
```

Note: this is independent of the trust-score `riskLevel` buckets.
A wallet can have `trustScore = 60` (medium trust) but
`sybilRisk = 0.8` (critical sybil).

## 7. Performance characteristics

- **Algorand round-trips:** 1 (algod `accountInformation`) + 1+
  (indexer `/v2/accounts/{wallet}/transactions`, paginated up to
  10 pages × 100 = 1 000 txns)
- **Pure-math signals:** 7 wallet-history + 4 graph = O(V² × R)
  in the worst case
- **Cache:** LRU 200 × 60 s in `src/sybil.ts`; bypassed by
  `detectSybilFresh` (used by `/passport`)

For a wallet with 1 000 transactions, the cold latency is
~1.0–1.5 s on testnet. With a local Algorand node, expect
~200–300 ms.

## 8. Design Decisions

### Why these 7 wallet-history signals?

- **creationClustering + fundingCorrelation:** direct evidence of
  cluster formation
- **balanceSimilarity + amountFingerprint:** behavioural
  fingerprints of a single operator
- **timingRegularity + circularActivity:** bot-like behaviour
- **interactionDensity:** tightly-interacted cluster

### Why these 4 graph signals?

- **neighborhoodClustering:** addresses V2 (no graph traversal)
- **hubScore:** addresses V4 (no behavioural fingerprinting)
- **intermediateDensity:** addresses V6 (interaction density
  evasion via intermediaries)
- **componentRatio + temporalCorrelation:** address V8 (no
  transaction graph analysis)

### Why are signals continuous, not binary?

Binary thresholds (e.g. "if 5+ in 24h = sybil") create cliff
effects. Continuous scoring allows the underwriting engine to
weight the signals independently.

## 9. Known Limitations

- **Sample size.** A wallet with < 30 transactions produces
  low-confidence signals. The underwriting engine handles this via
  the confidence gate.
- **Adversarial adaptation.** A determined attacker can train
  against the signals (e.g. vary funding amount). The signals
  should be retrained periodically.
- **No cross-wallet correlation.** The current implementation
  scores each wallet independently. A future enhancement could
  cluster wallets and detect sybil rings directly.
- **No sanctions check.** A sanctioned wallet can have low
  sybil risk. See
  [../security/sanctions-integration.md](../security/sanctions-integration.md).

## 10. See also

- [trust-scoring.md](trust-scoring.md) — composite trust score
- [delegation.md](delegation.md) — delegation trust graph
- [credit-and-underwriting.md](credit-and-underwriting.md) — the
  decision engine
- [../security/threat-model.md](../security/threat-model.md) §
  Sybil detection
- [../architecture/module-reference.md](../architecture/module-reference.md) §
  `src/sybil.ts` and `src/lib/graph.ts`
