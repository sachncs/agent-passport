# Concepts

The algorithmic reference for the trust model. Six sub-systems
live in this document; their production code is in `src/`:

- Trust score (`src/trust-score.ts`)
- Delegation trust (`src/delegation.ts`)
- Sybil detection (`src/sybil.ts`)
- Reputation (`src/reputation.ts`)
- Credit and underwriting (`src/credit.ts`, `src/underwriting.ts`)
- Passport document (`src/passport.ts`)

If you want to know **how a score is computed** or **why a wallet
was flagged**, this is the canonical reference.

---

# 1. Trust Scoring

The composite trust score (0–100) is the primary output. It is a
weighted combination of five sub-scores.

## 1.1 Formula

```
trustScore = Σ (weight_i × score_i) / Σ weight_i
```

Weights are normalized at runtime.

| Component | Weight | Score function |
|-----------|-------:|-----------------|
| Age | 0.20 | `computeAgeScore(days)` |
| Activity | 0.25 | `computeActivityScore(txns, days, assets)` |
| Volume | 0.20 | `computeVolumeScore(balanceMicroAlgo, txns)` |
| Velocity | 0.15 | `computeVelocityScore(txns, days)` |
| Compliance | 0.20 | `computeComplianceScore(balanceMicroAlgo, txns)` |

## 1.2 Sub-scores

### `computeAgeScore(days)`

```
if days <= 0:   return 0
if days >= 730: return 100

linear = (days / 730) × 100
log    = (log10(days + 1) / log10(731)) × 100
return 0.6 × linear + 0.4 × log
```

60% linear / 40% log. Diminishing returns after ~1 year. Caps at 100
at 730 days (2 years).

### `computeActivityScore(txns, days, assets)`

```
txPerMonth = txns / (days / 30)
return min(100,
  min(40, txPerMonth × 2) +
  min(30, (days / 365) × 30) +
  min(30, assets × 3)
)
```

Three capped components: tx frequency (40), age (30), asset
diversification (30).

### `computeVolumeScore(balanceMicroAlgo, txns)`

```
algo = balanceMicroAlgo / 1_000_000
return min(100,
  min(50, log10(max(1, algo)) × 10) +
  min(50, txns × 0.5)
)
```

Log-scaled balance (50) + transaction count (50).

### `computeVelocityScore(txns, days)`

```
if days <= 0:    return 0
txPerDay = txns / days

if txPerDay <= 5:   return 100
if txPerDay >= 100: return 0
return 100 - (txPerDay - 5) × 100 / 95
```

Penalises bot-like behaviour. Linear between 5 and 100 tx/day.

### `computeComplianceScore(balanceMicroAlgo, txns)`

```
velocityPenalty   = velocityScore < 40 ? (40 - velocityScore) / 40 × 50   : 0
compliancePenalty = complianceScore < 60 ? (60 - complianceScore) / 60 × 100 : 0
return 100 - velocityPenalty - compliancePenalty
```

Wait — `computeComplianceScore` takes `balanceMicroAlgo` and
`txns`, not `velocityScore` and `complianceScore`. The real
implementation is at `src/trust-score.ts:90`:

```
balanceAlgo = balanceMicroAlgo / 1_000_000
if balanceAlgo < 1 || txns < 10: return 0
return min(100, balanceAlgo + txns / 10)
```

Cap at 100. A wallet needs both ≥1 ALGO **and** ≥10 transactions
to score above 0.

## 1.3 Composite adjustments

After the five sub-scores:

1. Apply the **sybil penalty** to the composite. (The penalty is
   now applied centrally inside `computeUnderwritingLimit` in
   `src/underwriting.ts`; see § 5 below.)
2. Apply the **fresh-wallet cap** (`applyFreshWalletCap`): a wallet
   with < 30 days of history cannot exceed 40, regardless of
   sub-scores. This prevents a fresh wallet from gaming the score
   with high activity in a short window.
3. Clamp to `[0, 100]`.
4. Round to one decimal.

## 1.4 Risk classification

```
if score >= 70: 'low'
if score >= 45: 'medium'
if score >= 20: 'high'
return 'critical'
```

| Range | Bucket |
|-------|--------|
| 70–100 | `low` |
| 45–69 | `medium` |
| 20–44 | `high` |
| 0–19 | `critical` |

## 1.5 Recommended limit

| Score | Limit (USDC) |
|------:|-------------:|
| ≥ 80 | 750 |
| ≥ 70 | 500 |
| ≥ 60 | 300 |
| ≥ 50 | 150 |
| ≥ 40 | 50 |
| < 40 | 0 |

The system-exposure cap further reduces this if cumulative total
would exceed `MAX_SYSTEM_EXPOSURE = 100 000` USDC.

---

# 2. Delegation Trust

Let wallets publish **on-chain endorsements** of other wallets so
a new wallet with no history can inherit trust from its sponsors.

Implemented in `src/delegation.ts`. On-chain state lives in
`registry.teal` — see [architecture.md](architecture.md#smart-contracts).

## 2.1 Formula

```
delegationTrustScore = Σ (weight_i × score_i) / Σ weight_i
```

| Component | Weight | Source |
|-----------|-------:|--------|
| Depth | 0.25 | `computeDepthScore(depth)` |
| Sponsor quality | 0.30 | `computeSponsorQualityScore(avgQuality)` |
| Sponsor count | 0.25 | `computeSponsorCountScore(count, avgQuality)` |
| Amount | 0.20 | `computeAmountScore(amountMicroAlgo)` |

## 2.2 Sub-scores

### `computeDepthScore(depth)`

```
if depth === 0: return 0
if depth >= 7:  return 0
return 100 - (depth - 1) × 20
```

Trust **cannot increase through depth alone** — each hop costs 20
points. Caps at depth 7.

### `computeSponsorQualityScore(avgQuality)`

The average trust score of all sponsors, weighted by depth. Depth-1
sponsors are weighted 1.0, depth-2 sponsors 0.5, etc.

### `computeSponsorCountScore(count, avgQuality)`

Counts unique sponsors with a quality gate. A wallet sponsored by
one high-quality depth-1 sponsor outscores one sponsored by ten
low-quality depth-5 sponsors.

```
raw = count × 20
qualityMultiplier = max(0.1, avgQuality / 100)
return min(100, raw × qualityMultiplier)
```

### `computeAmountScore(amountMicroAlgo)`

```
if amount <= 0:      return 0
if amount >= 10_000:  return 100  // 10,000+ ALGO
return min(100, log10(amountAlgo + 1) × 25)
```

Log-scaled.

## 2.3 Cycle detection

`wouldCreateEndorsementCycle` in `src/reputation.ts` walks the
endorsement graph up to 5 hops from the counterparty and rejects
the event if the wallet would be its own ancestor. Prevents
circular trust rings.

---

# 3. Sybil Detection

12 signals (7 wallet-history + 4 graph + 1 sub-signal) feed a
weighted formula that produces `sybilRisk` ∈ `[0, 1]`.

Implemented in `src/sybil.ts` (wallet-history) and
`src/lib/graph.ts` (graph).

## 3.1 The 12 signals

| # | Signal | Source | Vulnerability |
|---|--------|--------|---------------|
| 1 | `creationClustering` | wallet history | V4 — many wallets in narrow window |
| 2 | `interactionDensity` | wallet history | V6 — tight interaction cluster |
| 3 | `balanceSimilarity` | wallet history | V4 — suspicious balance parity |
| 4 | `circularActivity` | wallet history | V4 — A→B→A flow |
| 5 | `timingRegularity` | wallet history | V4 — bot-like timing |
| 6 | `amountFingerprint` | wallet history | V4 — repeated identical amounts |
| 7 | `fundingCorrelation` | wallet history | V4 — same funder across cluster |
| 8 | `neighborhoodClustering` | graph | V2 — tight neighbour interconnect |
| 9 | `hubScore` | graph | V4 — central hub wallet |
| 10 | `intermediateDensity` | graph | V6 — 2-hop intermediary density |
| 11 | `componentRatio` | graph | V8 — fraction in largest component |
| 12 | `temporalCorrelation` | graph | V8 — round-time clustering |

## 3.2 Signal formulas (selected)

```
creationClustering = min(1, countInWindow / maxInWindow)

# Graph signals
neighborhoodClustering = mean over neighbours n of
  |intersect(n.neighbours, target.neighbours)| / |n.neighbours|
hubScore(n)           = log10(n.degree + 1) / log10(maxDegree + 1)
componentRatio        = |largestComponent ∩ cluster| / |cluster|
temporalCorrelation   = clamp(mean(pairwiseRoundDiffs) / (windowRounds × 4), 0, 1)
```

## 3.3 Weighted formula

```
sybilRisk = Σ (weight_i × signal_i) / Σ weight_i
```

Weights are tuned so a clean wallet hits ~0.1 and a sybil cluster
hits ~0.9. See `src/sybil.ts:computeSybilRisk`.

## 3.4 Confidence

```
confidence = min(1, totalTxns / 100) × min(1, accountAgeDays / 30)
```

The underwriting engine requires `confidence ≥ 0.45` to approve a
decision.

## 3.5 Performance

- **Algorand round-trips:** 1 (algod `accountInformation`) + 1+
  (indexer `/v2/accounts/{wallet}/transactions`, paginated up to
  10 pages × 100 = 1 000 txns)
- **Pure-math:** O(V² × R) worst case for the graph signals
- **Cache:** 200 × 60 s LRU in `src/sybil.ts`; bypassed by
  `detectSybilFresh` (used by `/passport`)

For a wallet with 1 000 transactions, cold latency on testnet is
~1.0–1.5 s; with a local Algorand node, ~200–300 ms.

---

# 4. Reputation

Records observable behaviour events for a wallet, with a 0–100
reputation score derived from the weighted sum of those events.

Implemented in `src/reputation.ts`. On-chain state in
`reputation.teal` — see [architecture.md](architecture.md#smart-contracts).

## 4.1 Event types and weights

| Event | Weight | Sign | On-chain char |
|-------|------:|-----:|:-------------:|
| `payment` | 10 | +1 | `p` |
| `purchase` | 8 | +1 | `u` |
| `dispute` | 20 | −1 | `d` |
| `refund` | 8 | −1 | `r` |
| `endorsement` | 8 | +1 | `e` |
| `service` | 5 | +1 | `s` |

## 4.2 Anti-gaming defenses

- **F1 — Counterparty verification.** `recordEvent` verifies the
  counterparty is a real on-chain wallet via `verifyCounterparty`.
  Events with unverified counterparties are recorded with
  `counterpartyVerified: false` and apply 0.5× weight in
  underwriting.
- **F2 — Endorsement weight reduction.** Endorsement was 15, now
  8, after the audit showed cheap endorsement farming was viable.
  ROI reduction: 47%.
- **F3 — Wallet-age penalty.** Wallets < 30 days old have
  reputation multiplied by 0.5.
- **F4 — Event deduplication.** `computeEventHash` is
  `sha256(wallet:type:counterparty:round)`. A 10 000-entry, 1-hour
  LRU dedupes duplicates. A duplicate within 1 hour is rejected
  (returns `null`).
- **F5 — Dispute verification.** `dispute` events must have
  on-chain proof of a relationship between the disputing wallet and
  the counterparty. `verifyDisputeEvent` queries the indexer for
  past transactions between the two wallets; if none exist, the
  dispute is rejected at `recordEvent` time.
- **F7 — Time decay.** Recent events weight more than old events.
- **F8 — Recovery factor.** Wallets with bad history can recover
  through sustained positive behavior.
- **Self-report verification.** `payment`, `purchase`, and
  `service` events are verified against on-chain transactions.
  Unverified events get 0.5× weight.

## 4.3 Cycle detection

`endorsementGraph` is a process-local
`Map<wallet, Set<endorsed>>`. On each `recordEvent`, the service
walks the graph up to 5 hops from the counterparty and rejects
the event if the wallet would be its own ancestor. Multi-replica
detection would need a shared store.

## 4.4 Score

```
reputation = clamp(0, 100, Σ (event_count_i × weight_i × sign_i) / maxReputation × 100)
```

`maxReputation` is the highest observed reputation in the system.

---

# 5. Credit & Underwriting

`src/credit.ts` estimates credit capacity. `src/underwriting.ts`
combines credit with trust, delegation, sybil, and reputation to
make a final approve/deny decision. The underwriting decision is
gated by the **system exposure cap** (`MAX_SYSTEM_EXPOSURE = 100 000`
USDC) — see [operations.md](operations.md#system-exposure-cap).

## 5.1 Credit capacity

`estimateCredit(wallet, amount?)` returns:

```typescript
{
  wallet: string;
  estimatedLimit: number;     // capacity + bonuses − penalty, capped
  risk: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  approved: boolean;          // estimatedLimit >= 50
  breakdown: {
    balanceCapacity: number;
    activityBonus: number;
    ageBonus: number;
    riskPenalty: number;
  };
  explanation: string[];
}
```

When `amount` is provided, the response includes `assessedAmount`
and the `risk` is adjusted to the requested amount.

## 5.2 Underwriting decision engine

Four factors, each weighted:

| Factor | Weight | Source |
|--------|-------:|--------|
| Trust | 0.35 | `scoreWalletFresh(wallet).trustScore` |
| Delegation | 0.25 | `scoreDelegationFresh(wallet).trustScore` |
| Sybil Resistance | 0.20 | `100 - sybilRisk × 100` |
| Reputation | 0.20 | `computeReputation(wallet).reputation` |

```
compositeScore = trust × 0.35
              + delegation × 0.25
              + (100 − sybilRisk × 100) × 0.20
              + reputation × 0.20
```

**Important:** the sybil penalty is applied here, **not** in the
trust-score pipeline. This avoids the previous double-counting bug
where the same `sybilRisk` value was applied three times.

## 5.3 Approval logic

```
if compositeScore < 40:        return false  // score gate
if sybilRisk      >= 0.7:      return false  // critical sybil
if reputation     <  20:        return false  // reputation gate
return true
```

A 40 trust score with 0.30 confidence is denied — insufficient data
to make a reliable decision.

## 5.4 Recommended limit (with system-exposure cap)

`computeUnderwritingLimit` returns:

```
limit = creditLimit
limit *= scoreMultiplier       // 0.5 .. 1.5
limit *= sybilMultiplier      // 0.3 .. 1.0
limit *= reputationMultiplier // 1.0 .. 1.3
return clamp(0, 1350, limit)
```

Then `capToSystemCapacity` reduces it to fit the $100 000 system
cap and the per-wallet cap (`MAX_SYSTEM_EXPOSURE / 10`).

## 5.5 Sanctions check

`getSanctionsProvider().check(wallet)` runs before the decision
engine. The default provider has a built-in deny-list (env
`SANCTIONS_EXTRA_DENY`) and fails closed. Denied wallets are
rejected regardless of score. Real Chainalysis / Elliptic
adapters implement the same `SanctionsProvider` interface.

---

# 6. Passport Document

The passport document is the most complete artifact the service
produces. It bundles trust, delegation, sybil, reputation, credit,
on-chain context, capabilities, and a tamper-evident SHA-256
checksum into a single JSON object returned by `GET /passport`.

Implemented in `src/passport.ts`.

## 6.1 Schema versioning

```typescript
export const PASSPORT_SCHEMA_VERSION = 1;
```

Bumped on breaking changes to the document shape.

## 6.2 Field inventory

| Field | Type | Source |
|-------|------|--------|
| `wallet` | 58-char base32 | Query param |
| `generatedAt` | ISO 8601 | Server time |
| `blockRound` | number | `algod.status().lastRound` |
| `schemaVersion` | number | `PASSPORT_SCHEMA_VERSION` |
| `identityStrength` | 0–100 | `computeIdentityStrength(...)` |
| `trustScore` | 0–100 | `scoreWalletFresh(wallet).trustScore` |
| `trustRiskLevel` | enum | `scoreWalletFresh(wallet).riskLevel` |
| `reputation` | 0–100 | `computeReputation(wallet).reputation` |
| `reputationRiskLevel` | enum | `computeReputation(wallet).riskLevel` |
| `totalEvents` | number | `computeReputation(wallet).totalEvents` |
| `paymentReliability` | 0–100 | `computePaymentReliability(...)` |
| `creditLimit` | number (USDC) | `estimateCreditWithTrust(wallet).estimatedLimit` |
| `creditRisk` | enum | `estimateCreditWithTrust(wallet).risk` |
| `risk` | 0–100 | `computeOverallRisk(...)` |
| `sybilRisk` | 0–1 | `detectSybilFresh(wallet).sybilRisk` |
| `overallRiskLevel` | enum | `classifyOverallRisk(...)` |
| `onChain` | object | `algod.accountInformation` |
| `delegation` | object | `scoreDelegationFresh(wallet).delegation` |
| `capabilities` | object | per-wallet flags (e.g. `canDelegate`, `canReceiveDelegation`) |
| `dataSources` | object | map of `{source: freshness, status}` |
| `summary` | string | `generatePassportSummary(...)` |
| `explanation` | string[] | human-readable summary |
| `checksum` | hex SHA-256 | `computePassportChecksum(this)` |

## 6.3 Checksum

`computePassportChecksum(passport)` hashes the canonicalized
passport object (sorted keys) and returns a hex SHA-256 digest.
The `checksum` field lets downstream consumers detect tampering
or version drift.

## 6.4 Caching

`/passport` responses are cached in `responseCache` for 60 s.
`/delegate`, `/revoke`, `/reputation/record` invalidate the cache
for the affected wallet(s).