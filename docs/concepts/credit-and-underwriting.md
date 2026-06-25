# Credit & Underwriting

The credit subsystem (`src/credit.ts`) estimates a wallet's
credit capacity, and the underwriting engine (`src/underwriting.ts`)
combines credit with trust, delegation, sybil, and reputation to
make a final approve/deny decision.

The underwriting decision is gated by the **system exposure cap**
(`MAX_SYSTEM_EXPOSURE = 100 000` USDC) — see
[../operations/system-exposure.md](../operations/system-exposure.md).

## 1. Credit capacity

`src/credit.ts` exposes four pure-math functions and the
`estimateCredit` entry point.

### 1.1 `computeBalanceCapacity(balanceAlgo)`

```typescript
return Math.min(1000, Math.max(0, balanceAlgo × 0.5));
```

| Balance (ALGO) | Capacity |
|---------------:|---------:|
| 0 | 0 |
| 100 | 50 |
| 1 000 | 500 |
| 2 000+ | 1 000 |

### 1.2 `computeActivityBonus(totalTxns)`

```typescript
return Math.min(200, Math.max(0, totalTxns × 2));
```

| Total txns | Bonus |
|-----------:|------:|
| 0 | 0 |
| 50 | 100 |
| 100+ | 200 |

### 1.3 `computeAgeBonus(accountAgeDays)`

```typescript
return Math.min(150, Math.max(0, (accountAgeDays / 365) × 150));
```

| Age (days) | Bonus |
|-----------:|------:|
| 0 | 0 |
| 365 | 150 |
| 730+ | 150 |

### 1.4 `computeRiskPenalty(velocityScore, complianceScore)`

```typescript
velocityPenalty = velocityScore < 40
  ? (40 - velocityScore) / 40 × 50
  : 0
compliancePenalty = complianceScore < 60
  ? (60 - complianceScore) / 60 × 100
  : 0
return velocityPenalty + compliancePenalty
```

See [trust-scoring.md](trust-scoring.md) § 2.5 for the rationale.

### 1.5 `estimateCredit(wallet, amount?)`

Returns the `CreditEstimate` response shape:

```typescript
{
  wallet: string;
  estimatedLimit: number;       // capacity + bonuses - penalty
  risk: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  approved: boolean;            // estimatedLimit >= 50
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

## 2. Underwriting decision engine

`src/underwriting.ts` combines four factors:

| Factor | Weight | Source |
|--------|-------:|--------|
| Trust | 0.35 | `scoreWalletFresh(wallet)` |
| Delegation | 0.25 | `scoreDelegationFresh(wallet)` |
| Sybil | 0.20 | `detectSybilFresh(wallet)` (plus `applySybilPenalty`) |
| Reputation | 0.20 | `computeReputation(wallet)` |

```typescript
compositeScore = trust × 0.35 + delegation × 0.25 + (100 - sybilRisk × 100) × 0.20 + reputation × 0.20
```

> **Important guarantee:** `creditLimit` is **not** in the
> composite score. `creditLimit` is a downstream output (from
> `estimateCredit` and `capToSystemCapacity`) and is reported in
> the `recommendedLimit` field. The composite score reflects
> **trustworthiness**, not capacity.

## 3. Approval logic

```typescript
function decideApproval(compositeScore, sybilRisk, reputation) {
  if (compositeScore < 40) return false;       // score gate
  if (sybilRisk >= 0.7) return false;         // critical sybil gate
  if (reputation < 20) return false;           // reputation gate
  return true;
}
```

| Condition | Threshold | Source |
|-----------|-----------|--------|
| Composite score | ≥ 40 | `src/underwriting.ts:80` |
| Sybil risk | < 0.7 | `src/underwriting.ts:82` |
| Reputation | ≥ 20 | `src/underwriting.ts:84` |

The `confidence ≥ 0.45` gate from the counterparty check also
applies — see [reputation.md](reputation.md).

## 4. Risk classification

```typescript
function classifyUnderwritingRisk(score) {
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

## 5. Recommended limit

When approved, the recommended limit is:

```
recommendedLimit = min(creditLimit, MAX_SYSTEM_EXPOSURE - totalSystemExposure)
```

This is `capToSystemCapacity(creditLimit)`. When the system is
fully saturated, the function returns 0 — a fully-saturated system
denies every new approval regardless of trust.

The cumulative `totalSystemExposure` is incremented by the
recommended limit on each successful underwriting call:

```typescript
addSystemExposure(recommendedLimit);
```

The file `data/system-exposure.json` is rewritten on every change.

## 6. Factor output

The response includes a `factors[]` array:

```typescript
{
  name: 'Trust' | 'Delegation' | 'Sybil' | 'Reputation',
  score: 0-100,
  weight: 0.35 | 0.25 | 0.20 | 0.20,
  contribution: score × weight,
  status: 'positive' | 'neutral' | 'negative',
}
```

`status` is `'positive'` when the contribution is ≥ 50% of the
factor's max (e.g. trust 70 with weight 0.35 → contribution 24.5 →
status `'positive'`), `'negative'` when < 25%, and `'neutral'`
otherwise.

## 7. Response shape

```typescript
{
  wallet: string;
  approved: boolean;
  recommendedLimit: number;        // USDC, capped by system exposure
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  compositeScore: number;          // 0-100
  factors: UnderwritingFactor[];  // 4 entries
  explanation: string[];
}
```

The `compositeScore` is the trust-weighted sum. The
`recommendedLimit` is the credit decision. The two are independent:
a wallet with `compositeScore = 60` (medium trust) can still have
`recommendedLimit = 1000` if the system exposure cap allows.

## 8. Sensitivity analysis

The composite score is most sensitive to:

- **Trust (0.35):** a 10-point trust change yields 3.5 composite
- **Delegation (0.25):** a 10-point change yields 2.5 composite
- **Sybil (0.20):** a 0.1 risk change yields 2.0 composite
- **Reputation (0.20):** a 10-point change yields 2.0 composite

The approval threshold (40) is just above "low trust" (35) and
well above "no delegation / no reputation" (20). A wallet with
no delegation graph and no reputation events must have trust ≥ 60
to be approved.

## 9. False positive / negative analysis

**False positive (approved for a bad wallet):**

- A wallet that has never had a sybil event can still be a sybil
  cluster that simply hasn't been observed. Mitigated by the
  constant-weight formula (Sybil 0.20).
- A wallet that has lots of recent payment events can inflate
  reputation. Mitigated by the F2 endorsement reduction.

**False negative (denied for a good wallet):**

- A long-history wallet with low recent activity scores low on
  Reputation. The owner is encouraged to keep transacting.
- A new wallet with high activity but no delegation history is
  gated by the trust score (40) until it builds a reputation.

## 10. Design decisions

### Why four factors and these weights?

- **Trust 0.35:** the strongest signal of wallet trustworthiness
- **Delegation 0.25:** strong positive signal when depth is
  shallow
- **Sybil 0.20:** a strong negative signal, but we don't want it
  to dominate (a single signal shouldn't deny a wallet)
- **Reputation 0.20:** a complementary signal that captures
  on-chain behaviour

The total is 1.0, so `compositeScore` is on a 0–100 scale.

### Why is creditLimit NOT in the composite?

The composite score represents **trustworthiness** — a
quality score. The credit limit is a **capacity** — a quantity
score. Mixing them would conflate "is this wallet good?" with
"how much should we lend it?" The two are combined in
`recommendedLimit` downstream.

### Why is there a system exposure cap?

A misconfigured underwriting engine could approve unbounded
credit. The cap is the second line of defense behind per-wallet
trust thresholds. See
[../operations/system-exposure.md](../operations/system-exposure.md).

## 11. See also

- [trust-scoring.md](trust-scoring.md) — composite trust score
- [delegation.md](delegation.md) — delegation trust graph
- [sybil-detection.md](sybil-detection.md) — 12 sybil signals
- [reputation.md](reputation.md) — on-chain reputation events
- [../operations/system-exposure.md](../operations/system-exposure.md)
- [../security/threat-model.md](../security/threat-model.md) §
  System exposure cap
