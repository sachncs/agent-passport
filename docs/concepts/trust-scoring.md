# Trust Scoring

The composite trust score (0–100) is the primary output of the
service. It is computed by `src/trust-score.ts` and is a weighted
combination of five sub-scores.

This is the canonical algorithm reference. See the sibling concept
docs for the extracted sub-systems:

- [delegation.md](delegation.md) — delegation trust graph
- [sybil-detection.md](sybil-detection.md) — 12 sybil signals
- [reputation.md](reputation.md) — on-chain reputation events
- [credit-and-underwriting.md](credit-and-underwriting.md) — credit
  capacity and the underwriting decision engine
- [passport-document.md](passport-document.md) — the passport
  document

## 1. Formula

```
trustScore = Σ (weight_i × score_i) / Σ weight_i
```

Weights are normalized at runtime.

| Component | Weight | Score Function |
|-----------|--------|----------------|
| Age | 0.20 | `computeAgeScore(days)` |
| Activity | 0.25 | `computeActivityScore(txns, days, assets)` |
| Volume | 0.20 | `computeVolumeScore(balanceMicroAlgo, txns)` |
| Velocity | 0.15 | `computeVelocityScore(txns, days)` |
| Compliance | 0.20 | `computeComplianceScore(balanceMicroAlgo, txns)` |

## 2. Sub-Scores

### 2.1 Age Score (`computeAgeScore`)

Measures wallet longevity using a blend of linear and logarithmic
ramps over 730 days.

```
if days <= 0: return 0
if days >= 730: return 100

linear = (days / 730) × 100
log = (log10(days + 1) / log10(731)) × 100

return 0.6 × linear + 0.4 × log
```

- **Linear component (60%)**: rewards consistent aging proportionally
- **Log component (40%)**: gives diminishing returns after ~1 year
- **730 days (2 years)**: maximum score of 100

### 2.2 Activity Score (`computeActivityScore`)

Measures transaction frequency, account age, and portfolio
diversification.

```
txPerMonth = txns / (days / 30)

return min(100,
  min(40, txPerMonth × 2) +
  min(30, (days / 365) × 30) +
  min(30, assets × 3)
)
```

Three capped components:

- **Transaction frequency**: up to 40 points (20 txns/month → 40)
- **Account age**: up to 30 points (1 year → 30)
- **Asset diversification**: up to 30 points (10 assets → 30)

### 2.3 Volume Score (`computeVolumeScore`)

Measures balance size and transaction count.

```
algo = balanceMicroAlgo / 1_000_000

return min(100,
  min(50, log10(max(1, algo)) × 10) +
  min(50, txns × 0.5)
)
```

Two capped components:

- **Balance**: up to 50 points (logarithmic — 10 ALGO → 10, 100
  → 20, 1000 → 30)
- **Transaction count**: up to 50 points (100 txns → 50)

### 2.4 Velocity Score (`computeVelocityScore`)

Identifies bot-like behaviour. Penalises high transaction frequency
relative to the wallet's age.

```
if days <= 0: return 0
txPerDay = txns / days

if txPerDay <= 5:   return 100
if txPerDay >= 100: return 0
return 100 - (txPerDay - 5) × 100 / 95
```

- **≤ 5 tx/day**: full 100 points
- **100+ tx/day**: 0 points
- **Linear penalty** in between

### 2.5 Compliance Score (`computeComplianceScore`)

Two penalties (continuous, FICO-aligned):

```
velocityPenalty = velocityScore < 40
  ? (40 - velocityScore) / 40 × 50
  : 0
compliancePenalty = complianceScore < 60
  ? (60 - complianceScore) / 60 × 100
  : 0

return 100 - velocityPenalty - compliancePenalty
```

**Design rationale (from `src/trust-score.ts:104`):**

- Binary thresholds (pass/fail) create cliff effects at arbitrary
  boundaries
- Continuous penalties provide smoother graduation between risk
  levels
- Velocity penalty (0–50): penalises bot/spam behaviour
- Compliance penalty (0–100): penalises low balance / zero txns

**Examples:**

| velocity | balance / txns | result |
|---------:|----------------|--------|
| 39 | 90 | $1.25 penalty (4 → 99) |
| 20 | 40 | $92 penalty (4 → 8) |
| 0  | 0  | $150 penalty (4 → 0) |

## 3. Composite Trust Score

After computing the five sub-scores:

1. Apply `applySybilPenalty` to the composite
2. Apply `applyFreshWalletCap` to the composite
3. Clamp to `[0, 100]`
4. Round to one decimal

### 3.1 Sybil penalty (`applySybilPenalty`)

```typescript
function applySybilPenalty(score, sybilRisk) {
  if (sybilRisk < 0.45) return score;          // no penalty
  if (sybilRisk < 0.70) return score * 0.80;   // 20% reduction
  return score * 0.50;                         // 50% reduction
}
```

See [sybil-detection.md](sybil-detection.md) for the 12-signal
formula that produces `sybilRisk`.

### 3.2 Fresh-wallet cap (`applyFreshWalletCap`)

```typescript
function applyFreshWalletCap(score, accountAgeDays) {
  if (accountAgeDays >= 30) return score;
  return Math.min(score, 40);
}
```

A wallet with < 30 days of history cannot exceed 40, regardless of
its other sub-scores. This prevents a fresh wallet from gaming the
score with high activity in a short window.

## 4. Risk Classification

```typescript
function classifyRisk(score) {
  if (score >= 70) return 'low';
  if (score >= 45) return 'medium';
  if (score >= 20) return 'high';
  return 'critical';
}
```

| Range | Bucket |
|-------|--------|
| 70–100 | `low` |
| 45–69 | `medium` |
| 20–44 | `high` |
| 0–19 | `critical` |

## 5. Recommended Limit

```typescript
function computeRecommendedLimit(score) {
  if (score >= 80) return 750;
  if (score >= 70) return 500;
  if (score >= 60) return 300;
  if (score >= 50) return 150;
  if (score >= 40) return 50;
  return 0;
}
```

The limit is in USDC and is the **maximum** credit the underwriting
engine will approve. The system-exposure cap
(`capToSystemCapacity`) further reduces this if the cumulative
total would exceed `MAX_SYSTEM_EXPOSURE = 100 000`.

## 6. Approval Threshold

The underwriting engine approves when `trustScore >= 40` AND
`confidence >= 0.45`. A wallet with a 40 trust score and 0.30
confidence has insufficient data to make a reliable decision —
deny and request more data.

## 7. Explanation Generation

`generateExplanation` produces an array of human-readable strings
describing which factors contributed to the score:

- `"1+ year wallet history"` when `accountAgeDays >= 365`
- `"120 transactions — active wallet"` for high activity
- `"Balance: 45.20 ALGO — well-funded"` for high balance
- `"8 assets — diverse portfolio"` for asset diversity
- `"Strong overall trust profile"` for `low` risk

## 8. On-Chain Data

### 8.1 Account info (via algod)

`algod.accountInformation(wallet)` returns:

- `amount` (microAlgo)
- `assets[]` (count)
- `appsLocalState[]` and `createdApps[]`
- `round` (current block)
- `totalAppsOptedIn`, `totalAssetsOptedIn`

### 8.2 Transaction history (via indexer)

`/v2/accounts/{wallet}/transactions?limit=N` returns:

- `transactions[]` with `confirmed-round`, `sender`, `receiver`,
  `asset-transfer-transaction`, `payment-transaction`
- `next-token` for pagination

The service paginates up to `MAX_TRANSACTION_PAGES = 10` pages ×
`INDEXER_PAGE_SIZE = 100` = 1 000 transactions per wallet. This is
enough for all current scoring decisions.

### 8.3 Derived: account age

```typescript
accountAgeDays = (lastSeenRound - firstSeenRound) × SECONDS_PER_BLOCK / SECONDS_PER_DAY
```

`SECONDS_PER_BLOCK = 3.3` is the average Algorand block time on
testnet/mainnet.

## 9. On-Chain Data Flow

For `/score`:

1. Fetch account information from algod (algod round-trip)
2. Fetch `algod.status().do()` to get current `lastRound` (algod round-trip)
3. Fetch transaction history from indexer (1 indexer round-trip)
4. Compute 5 sub-scores in memory (pure math)
5. Apply sybil penalty and fresh-wallet cap
6. Classify risk and compute recommended limit
7. Generate explanation

Total: 3 round-trips, all cached for 60 s in the response cache.

## 10. Design Decisions

### Why five sub-scores?

- **Age + Activity + Volume** capture the wallet's "track record"
- **Velocity** captures bot-like behaviour
- **Compliance** captures penalty cases (low balance, low
  activity)

Adding a sixth sub-score requires:
1. A new `compute*` function in `src/trust-score.ts`
2. A new field in `WalletTrustScore.breakdown`
3. An updated weight table
4. A new entry in this document
5. New unit tests

### Why these weights?

- Age 0.20: longevity is a strong positive signal
- Activity 0.25: the highest weight — active wallets are more
  valuable
- Volume 0.20: balance is a good signal but whales can game it
- Velocity 0.15: penalty-driven, not a positive signal
- Compliance 0.20: penalty-driven

The weights are designed so that a "perfect" wallet (2-year history,
high activity, whale balance) hits 100, while a typical wallet hits
70+.

### Why continuous penalties?

See the design rationale in
[§ 2.5](#25-compliance-score-computecompliancescore). Binary
thresholds create cliff effects; continuous penalties provide
smoother graduation.

## 11. Known Limitations

- **Indexer page limit.** A wallet with > 1 000 transactions is
  scored on the first 1 000 only. Volume / activity may be
  under-estimated.
- **No sanctions check.** A sanctioned wallet can score high. See
  [../security/sanctions-integration.md](../security/sanctions-integration.md).
- **No KYC.** The service is permissionless; no identity binding.
- **Algorand-only.** The trust algorithm is chain-agnostic but the
  current implementation only reads from Algorand.

## 12. Attack Vectors and Mitigations

| Attack | Mitigation |
|--------|-----------|
| Fresh wallet with burst activity | Fresh-wallet cap (40 max for < 30 days) |
| Sybil cluster to inflate trust | `applySybilPenalty` (50% reduction at `sybilRisk ≥ 0.7`) |
| Velocity gaming | `computeVelocityScore` penalty (5–100 tx/day) |
| Whale delegation to inflate | Log-scale amount score |
| Circular delegation to inflate | BFS with visited set |
| Depth amplification | `cap = max(sponsorTrust) - depth × 20` |

## 13. Underwriting Integration

The underwriting engine in `src/underwriting.ts` uses the trust
score as one of four factors:

- Trust 0.35
- Delegation 0.25
- Sybil 0.20
- Reputation 0.20

`compositeScore` (the underwriting score) is independent of the
trust score. The trust score appears in the response as one of the
`factors[]` entries. See
[credit-and-underwriting.md](credit-and-underwriting.md).

## 14. Sensitivity Analysis

The trust score is most sensitive to:

- **Activity** (weight 0.25): a 10× increase in txns yields
  ~25 points
- **Compliance** (weight 0.20): a low-balance / zero-txn wallet
  loses up to 20 points
- **Velocity** (weight 0.15): a 100+ tx/day wallet loses 15 points

It is **least** sensitive to:

- **Volume** (weight 0.20, log scale): 10× balance yields only
  ~10 points
- **Age** (weight 0.20): capped at 100 at 730 days

## 15. False Positive / Negative Analysis

**False positive (high score for a bad wallet):**

- A fresh attacker wallet with high activity can score 40+ for the
  first 30 days. Mitigated by the fresh-wallet cap.
- A sanctioned wallet can score high. Mitigated only by the
  sanctions integration (future).

**False negative (low score for a good wallet):**

- A long-history wallet with low recent activity scores low on
  Activity and Velocity. The owner is encouraged to use the wallet
  more.
- A low-balance new wallet scores low on Volume. Time + activity
  raise the score.

## 16. See also

- [delegation.md](delegation.md) — delegation trust graph
- [sybil-detection.md](sybil-detection.md) — 12 sybil signals
- [reputation.md](reputation.md) — on-chain reputation events
- [credit-and-underwriting.md](credit-and-underwriting.md) — credit
  capacity and decision engine
- [passport-document.md](passport-document.md) — the passport
  document
- [../architecture/system-design.md](../architecture/system-design.md)
