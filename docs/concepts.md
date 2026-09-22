# Concepts and decision model

This document describes the behavior implemented in `src/`. It is an
explainability reference, not a promise that a score proves identity, safety,
creditworthiness, or regulatory compliance.

## 1. Trust score

`scoreWallet` returns a score from 0 to 100 with five weighted components:

| Component | Weight | Implementation |
|---|---:|---|
| Age | 20% | `computeAgeScore(days)`; 60% linear and 40% logarithmic growth to 730 days |
| Activity | 25% | Transaction frequency, account age, and asset diversity, each capped |
| Volume | 20% | Log-scaled ALGO balance plus transaction count |
| Velocity | 15% | Stepped score based on transactions per day |
| Account state | 20% | Continuous balance and transaction-history penalties |

The weighted result is clamped to `[0, 100]` and rounded to one decimal.

Velocity is calculated as `txns / max(1, days)`. The implementation returns `0`
before that calculation when `days === 0`; otherwise it uses stepped thresholds:
`100` at 1 transaction/day or less, then `80`, `60`, `40`, `20`, and `0` as the
effective rate crosses `>1`, `>5`, `>20`, `>50`, and `>100` transactions per day.
This is a stepped bot/spam signal, not a linear penalty.

The account-state component is not a regulatory compliance check. Its balance
penalty is `round((1 - balanceAlgo) × 40)` below 1 ALGO, capped at 40 points.
Its transaction penalty is 50 points at zero transactions and otherwise
`round(max(0, 50 - log10(txns + 1) × 25))`, reaching zero at 99 or more
transactions. The component is `clamp(0, 100, 100 - balancePenalty -
transactionPenalty)`; penalties are rounded before the final clamp. With
non-negative inputs, the lowest resulting score is 10.

Stale activity applies a multiplier after 180 days of inactivity, using a
365-day half-life and a floor of `0.30`; the staleness-adjusted score is rounded
to one decimal before the fresh-wallet rule. Accounts with `accountAgeDays < 30`
are capped at a trust score of 30, while exactly 30 days is not capped. Risk
bands are low `≥70`, medium `≥45`, high `≥20`, and critical below 20.
`approved` on the trust endpoint is score `≥40`; that is intentionally separate
from the medium-risk boundary.

The trust endpoint's `recommendedLimit` uses the final staleness-adjusted and
fresh-wallet-capped score: `score / 100 × 500 × tier`, rounded to two decimals.
The tier is `1.5` at 80+, `1.2` at 60+, `1.0` at 40+, and `0.7` below 40.
This is separate from the credit capacity and underwriting exposure limits.

## 2. Delegation trust

Delegation uses on-chain endorsements and bounded graph traversal. Its score is
weighted as depth 35%, sponsor quality 30%, sponsor count 15%, and delegated
amount 20%.

- Depth scores are 100 at depth 0, then 80, 60, 40, and decrease by 10 per
  additional level.
- Sponsor count is `min(100, count × 20 × max(0.1, averageQuality / 100))`.
- Amount is logarithmic and reaches 100 at 10,000 ALGO.
- Traversal bounds branching and depth; cycle detection prevents circular
  endorsement chains.

Delegation is an endorsement signal, not collateral. It is used in
underwriting, but it is not added to the credit-capacity formula.

## 3. Sybil indicators

`computeSybilRisk` combines eleven implemented inputs, producing a value from
0 to 1:

| Signal | Weight |
|---|---:|
| Creation clustering | 20% |
| Interaction density | 15% |
| Balance similarity | 10% |
| Circular activity | 5% |
| Timing regularity | 8% |
| Amount fingerprint | 5% |
| Funding correlation | 2% |
| Neighborhood clustering | 10% |
| Hub score | 8% |
| Intermediate density | 10% |
| Temporal correlation | 7% |

Risk bands are low `<0.25`, medium `≥0.25`, high `≥0.45`, and critical
`≥0.70`. The result is a heuristic about coordinated wallet behavior. It is
not a finding of fraud and should be combined with application policy.

The service limits transaction pagination to 10 pages and 5 MiB of fetched
transaction data. Confidence is a data-coverage indicator, not a probability
that the risk classification is correct.

## 4. Reputation

Supported events are payment, purchase, dispute, refund, endorsement, and
service. Base weights are 10, 8, 20, 12, 8, and 5 respectively; dispute and
refund are negative, while the others are positive.

The score starts from the positive-weight ratio and then applies documented
anti-gaming controls: event-count multiplier, recency decay, event-to-
transaction ratio cap, a sub-30-day wallet penalty, event-age weighting,
recovery factor, endorsement weight limits, and a 0.5x penalty for unverified
self-reported events. Duplicate events are deduplicated in a process-local
10,000-entry store with a one-hour TTL. Cycle detection is also process-local
and requires shared state for multi-replica guarantees.

## 5. Credit and underwriting

Credit capacity is independent of delegation:

```text
balanceCapacity = min(1000, max(0, balanceAlgo × 0.5))
activityBonus   = min(200, max(0, totalTxns × 2))
ageBonus        = min(150, max(0, accountAgeDays / 365 × 150))
riskPenalty     = velocity penalty + account-state penalty
creditLimit     = clamp(0, 1350, balanceCapacity + activityBonus + ageBonus - riskPenalty)
```

The standalone credit estimate does not directly apply the trust score's
fresh-wallet cap. Its risk penalty is `round(velocityPenalty +
compliancePenalty, 2)`: velocity contributes `round((40 - velocityScore) / 40
× 50, 2)` only when velocity is below 40, and account-state/compliance
contributes `round((60 - complianceScore) / 60 × 100, 2)` only when compliance
is below 60. Delegation is used by underwriting, but is not collateral and is
not added to the credit-capacity formula.

Underwriting combines four factors: trust score 35%, delegation trust 25%,
Sybil resistance `(1 - sybilRisk) × 100` at 20%, and reputation 20%.

Approval is denied when Sybil risk is `≥0.70`, composite score is below 30, or
reputation is below 10 while composite score is below 50. A configured denied
sanctions result also denies the request. The confidence field reports factor
coverage and does not act as an approval gate.

The recommended limit starts from credit capacity and applies:

```text
scoreMultiplier      = 0.5 + compositeScore / 100
sybilMultiplier      = 1 - 0.7 × sybilRisk
reputationMultiplier = 1 + 0.3 × reputation / 100
```

It is capped at 1,350, then reduced by the process/system exposure safeguards.
The system cap is 100,000 and the per-wallet share is 10,000. These are
software safeguards, not funds held by Agent Passport.

## 6. Passport document

`GET /passport` combines trust, delegation, Sybil, reputation, credit,
on-chain context, capabilities, data-source status, explanations, and a
checksum. `PASSPORT_SCHEMA_VERSION` is currently `1`.

The checksum is a deterministic SHA-256 digest over the selected computed
fields, including wallet, schema version, block round, scores, profiles,
capabilities, data sources, and summary. It excludes `generatedAt` and the
human-readable explanation because those are not independent identity claims.
It detects changes to the selected document fields; it is not a signature and
does not prove wallet ownership.

## 7. Reading a result safely

Use the breakdown and explanation fields to understand why a result was
returned. Treat missing or stale upstream data as uncertainty. Combine these
signals with your own authorization, sanctions, fraud, identity, and credit
controls. See [known limitations](known-limitations.md) and [security](security.md)
for the deployment boundary.
