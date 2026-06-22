# Trust Scoring Algorithm

## Overview

The trust score (0-100) is a weighted composite of five sub-scores, each measuring a different aspect of wallet trustworthiness. All computation is stateless — no database, no prior state.

## Formula

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

## Sub-Scores

### Age Score (`computeAgeScore`)

Measures wallet longevity using a blend of linear and logarithmic ramps over 730 days.

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

### Activity Score (`computeActivityScore`)

Measures transaction frequency, account age, and portfolio diversification.

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

### Volume Score (`computeVolumeScore`)

Measures balance size and transaction count.

```
algo = balanceMicroAlgo / 1_000_000

return min(100,
  min(50, log10(max(1, algo)) × 10) +
  min(50, txns × 0.5)
)
```

Two capped components:
- **Balance**: up to 50 points (logarithmic — 10 ALGO → 10, 100 → 20, 1000 → 30)
- **Transaction count**: up to 50 points (100 txns → 50)

### Velocity Score (`computeVelocityScore`)

Inverse scoring — penalizes high transaction rates (bot/spam behavior).

```
if days === 0: return 0
perDay = txns / max(1, days)

if perDay > 50: return 20
if perDay > 20: return 40
if perDay > 5:  return 60
if perDay > 1:  return 80
return 100
```

| Transactions/Day | Score | Interpretation |
|-------------------|-------|----------------|
| > 50 | 20 | Likely automated/bot |
| > 20 | 40 | Very high activity |
| > 5 | 60 | High activity |
| > 1 | 80 | Moderate activity |
| ≤ 1 | 100 | Normal pace |

### Compliance Score (`computeComplianceScore`)

Penalty-based scoring for low balance and zero transactions.

```
score = 100
if balanceAlgo < 0.01: score -= 20
if txns === 0: score -= 30

return max(0, min(100, score))
```

| Condition | Penalty |
|-----------|---------|
| Balance < 0.01 ALGO | -20 |
| Zero transactions | -30 |

## Composite Trust Score

```
w = { age: 0.2, activity: 0.25, volume: 0.2, velocity: 0.15, compliance: 0.2 }
total = sum of all weights

trustScore = round(
  (w.age / total) × ageScore +
  (w.activity / total) × activityScore +
  (w.volume / total) × volumeScore +
  (w.velocity / total) × velocityScore +
  (w.compliance / total) × complianceScore
)
```

## Risk Classification

```
if score >= 70:  return 'low'
if score >= 45:  return 'medium'
if score >= 20:  return 'high'
return 'critical'
```

| Level | Score Range | Description |
|-------|-------------|-------------|
| `low` | 70-100 | Strong trust profile |
| `medium` | 45-69 | Acceptable with monitoring |
| `high` | 20-44 | Elevated risk |
| `critical` | 0-19 | High risk, additional verification needed |

## Recommended Limit

```
base = (trustScore / 100) × 500
tier = 1.5  if score >= 80
      1.2  if score >= 60
      1.0  if score >= 40
      0.7  otherwise

recommendedLimit = round(base × tier, 2)
```

| Trust Score | Base | Tier | Recommended Limit |
|-------------|------|------|-------------------|
| 90 | 450 | 1.5 | $675.00 |
| 70 | 350 | 1.2 | $420.00 |
| 50 | 250 | 1.0 | $250.00 |
| 30 | 150 | 0.7 | $105.00 |

## Approval Threshold

```
approved = trustScore >= 40
```

Wallets with `trustScore >= 40` are approved. Below 40, additional verification is recommended.

## Explanation Generation

`generateExplanation()` produces human-readable reasons based on on-chain data:

1. **Wallet history** — "> 1 year", "> 1 month", or "New wallet with limited history"
2. **Transaction count** — "> 100 txns — active", "> 10 txns — moderate", or "limited activity"
3. **Balance** — "well-funded" (> 100 ALGO), standard (> 1 ALGO), or "low balance"
4. **Diversification** — "> 5 assets — diverse portfolio" (if applicable)
5. **Profile strength** — "Strong" (>= 70), "Moderate" (>= 40), or "Weak" (< 40)

## On-Chain Data

### Account Info (via Algod)

| Field | Source |
|-------|--------|
| `amount` | Account balance in microAlgo |
| `assetCount` | Number of opted-in ASAs |
| `appCount` | Number of created apps |
| `createdRound` | Round when account was created |
| `lastRound` | Current latest round |

### Transaction History (via Indexer)

| Field | Source |
|-------|--------|
| `totalTxns` | Count of transactions (up to 500) |
| `firstRound` | Lowest confirmed round |
| `lastRound` | Highest confirmed round |

### Derived: Account Age

```
accountAgeDays = max(1, floor(((latestRound - createdRound) × 3.3) / 86400))
```

Uses 3.3 seconds per round (Algorand's ~3.3s block time).
