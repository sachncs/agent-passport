# Passport Document

The **passport document** (`AgentPassport` interface in
`src/passport.ts`) is the most complete artifact the service
produces. It bundles trust, delegation, sybil, reputation, credit,
on-chain context, and a tamper-evident SHA-256 checksum into a
single JSON object returned by `GET /passport`.

## 1. Schema versioning

```typescript
export const PASSPORT_SCHEMA_VERSION = 1;
```

`schemaVersion` is a top-level field on the document. Bumped on
breaking changes to the document shape.

## 2. Field inventory

### 2.1 Identity & trust

| Field | Type | Source |
|-------|------|--------|
| `wallet` | string (58-char base32) | Query param |
| `generatedAt` | string (ISO 8601) | Server time |
| `blockRound` | number | `algod.status().lastRound` |
| `schemaVersion` | number | `PASSPORT_SCHEMA_VERSION` |
| `identityStrength` | number (0–100) | `computeIdentityStrength(...)` |
| `trustScore` | number (0–100) | `scoreWalletFresh(wallet).trustScore` |
| `trustRiskLevel` | enum | `scoreWalletFresh(wallet).riskLevel` |

`identityStrength` is a composite of trust + sybil: a high-trust
wallet with critical sybil risk has low identity strength. See
`src/passport.ts:85`.

### 2.2 Reputation

| Field | Type | Source |
|-------|------|--------|
| `reputation` | number (0–100) | `computeReputation(wallet).reputation` |
| `reputationRiskLevel` | enum | `computeReputation(wallet).riskLevel` |
| `totalEvents` | number | `computeReputation(wallet).totalEvents` |

### 2.3 Payment & credit

| Field | Type | Source |
|-------|------|--------|
| `paymentReliability` | number (0–100) | `computePaymentReliability(...)` |
| `creditLimit` | number (USDC) | `estimateCreditWithTrust(wallet).estimatedLimit` |
| `creditRisk` | enum | `estimateCreditWithTrust(wallet).risk` |

### 2.4 Risk

| Field | Type | Source |
|-------|------|--------|
| `risk` | number (0–100) | Composite risk score |
| `sybilRisk` | number (0–1) | `detectSybilFresh(wallet).sybilRisk` |
| `overallRiskLevel` | enum | Worst of trust, sybil, reputation, credit |

### 2.5 On-chain profile

| Field | Type | Source |
|-------|------|--------|
| `onChain.balanceAlgo` | number (ALGO) | `algod.accountInformation` |
| `onChain.totalTxns` | number | Indexer |
| `onChain.accountAgeDays` | number | Derived from indexer tx history |
| `onChain.assets` | number | `algod.accountInformation.assets.length` |
| `onChain.apps` | number | `algod.accountInformation.createdApps.length` |

### 2.6 Delegation profile

| Field | Type | Source |
|-------|------|--------|
| `delegation.depth` | number (0–7) | `scoreDelegationFresh(wallet).breakdown.depthScore` |
| `delegation.sponsorCount` | number | `scoreDelegationFresh(wallet).breakdown.sponsorCountScore` |
| `delegation.delegatedAmount` | number (microAlgo) | `scoreDelegationFresh(wallet).breakdown.amountScore` |
| `delegation.isTrustAnchor` | boolean | `isTrustAnchor(wallet)` against `registry.teal` |

### 2.7 Capabilities

```typescript
capabilities: {
  trustScoring: boolean;     // trustScore >= 40
  delegation: boolean;        // delegation score > 0
  creditEligible: boolean;     // creditLimit > 0
  sybilClear: boolean;         // sybilRisk < 0.45
  reputationActive: boolean;   // reputation > 0
}
```

These are convenience booleans for clients that want a quick
"can this wallet do X?" check without re-parsing the underlying
scores.

### 2.8 Data provenance

```typescript
dataSources: {
  trust: boolean;      // /score succeeded
  delegation: boolean;  // /delegation succeeded
  credit: boolean;     // /credit-estimate succeeded
  sybil: boolean;      // /sybil-check succeeded
  reputation: boolean; // /reputation succeeded
}
```

A passport can be **partially populated** when one or more
upstream calls fail. The `dataSources` map tells the consumer
which fields are reliable.

### 2.9 Summary

| Field | Type | Source |
|-------|------|--------|
| `summary` | string (1–2 sentences) | Generated from `overallRiskLevel` and top factors |
| `explanation` | string[] | Combined from all five sub-systems |

### 2.10 Integrity

| Field | Type | Source |
|-------|------|--------|
| `checksum` | string (SHA-256 hex) | `computePassportChecksum(passport)` |

## 3. Checksum semantics

`computePassportChecksum(passport)` at `src/passport.ts:200`:

```typescript
const CHECKSUM_FIELDS = [
  'wallet', 'schemaVersion',
  'identityStrength', 'trustScore', 'trustRiskLevel',
  'reputation', 'reputationRiskLevel', 'totalEvents',
  'paymentReliability', 'creditLimit', 'creditRisk',
  'risk', 'sybilRisk', 'overallRiskLevel',
  'onChain', 'delegation', 'capabilities', 'dataSources',
];

const payload = CHECKSUM_FIELDS.map(f => `${f}:${JSON.stringify(passport[f])}`).join('|');
return sha256(payload).digest('hex');
```

**Covered:** every deterministic field.

**Excluded:**

- `generatedAt` (timestamp — would invalidate the checksum on
  every regeneration)
- `explanation` (human-readable, can vary in wording without
  semantic change)
- `summary` (same)
- `blockRound` (varies as new blocks are confirmed)
- `checksum` itself

The checksum is **not** a cryptographic signature; it is a
**content hash** that lets a consumer detect any change to the
covered fields. A different `checksum` for the same `wallet`
indicates that the underlying data has changed.

## 4. Fresh vs cached variants

The passport calls the **fresh** variants of every sub-system:

| Sub-system | Cached | Fresh (used by passport) |
|------------|--------|-------------------------|
| Trust | `scoreWallet(wallet)` | `scoreWalletFresh(wallet)` |
| Delegation | `scoreDelegation(wallet)` | `scoreDelegationFresh(wallet)` |
| Credit | `estimateCredit(wallet)` | `estimateCreditWithTrust(wallet, trustResult)` |
| Sybil | `detectSybil(wallet)` | `detectSybilFresh(wallet)` |
| Reputation | `computeReputation(wallet)` | (already bypasses caches) |

The `*Fresh` functions bypass the per-wallet LRU caches in
`trust-score.ts`, `delegation.ts`, `sybil.ts`, and
`trust-graph.ts`. The **response cache** still applies — repeated
passport requests for the same wallet within 60 s return the
cached passport.

## 5. Data integrity guarantees

From the `P1 FIX` comment at `src/passport.ts:240`:

> **Data integrity guarantees:**
>
> 1. LRU bypass via `*Fresh` variants — every passport reflects
>    on-chain state at the time of generation
> 2. Single `blockRound` — all sub-systems use the same
>    `algod.status().lastRound`
> 3. Deterministic checksum — same `wallet` produces the same
>    `checksum` for the same underlying data
> 4. Data provenance — `dataSources` tells the consumer which
>    fields are reliable

The passport is **idempotent** for a given (wallet, blockRound)
pair, modulo changes in the underlying on-chain state.

## 6. Example passport

```json
{
  "wallet": "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A",
  "generatedAt": "2026-06-25T10:00:00.000Z",
  "blockRound": 52345678,
  "schemaVersion": 1,

  "identityStrength": 78,
  "trustScore": 82,
  "trustRiskLevel": "low",

  "reputation": 65,
  "reputationRiskLevel": "low",
  "totalEvents": 142,

  "paymentReliability": 95,
  "creditLimit": 750,
  "creditRisk": "low",

  "risk": 12,
  "sybilRisk": 0.08,
  "overallRiskLevel": "low",

  "onChain": {
    "balanceAlgo": 45.2,
    "totalTxns": 120,
    "accountAgeDays": 412,
    "assets": 8,
    "apps": 3
  },

  "delegation": {
    "depth": 2,
    "sponsorCount": 3,
    "delegatedAmount": 5000000,
    "isTrustAnchor": false
  },

  "capabilities": {
    "trustScoring": true,
    "delegation": true,
    "creditEligible": true,
    "sybilClear": true,
    "reputationActive": true
  },

  "dataSources": {
    "trust": true,
    "delegation": true,
    "credit": true,
    "sybil": true,
    "reputation": true
  },

  "summary": "Established wallet with strong on-chain history and active reputation. Low risk across all dimensions.",
  "explanation": [
    "1+ year wallet history",
    "120 transactions — active wallet",
    "Balance: 45.20 ALGO — well-funded",
    "8 assets — diverse portfolio",
    "3 sponsors — moderate delegation network"
  ],

  "checksum": "9f8e7d6c5b4a3210fedcba9876543210fedcba9876543210fedcba9876543210"
}
```

## 7. `/passport` vs `/score`

| | `/score` | `/passport` |
|---|----------|-------------|
| Cold latency | ~1.1 s | ~1.5 s |
| Cached latency | 1 ms | 1 ms |
| Algorand calls | 3 | 6–8 |
| Includes | Trust sub-scores, on-chain | Trust + delegation + sybil + reputation + credit + summary + checksum |
| Use for | High-volume underwriting | Human-readable, shareable document |

Use `/score` for high-volume API calls; use `/passport` when
you need a complete picture with a tamper-evident checksum.

## 8. See also

- [trust-scoring.md](trust-scoring.md) — composite trust score
- [delegation.md](delegation.md) — delegation trust graph
- [sybil-detection.md](sybil-detection.md) — 12 sybil signals
- [reputation.md](reputation.md) — on-chain reputation events
- [credit-and-underwriting.md](credit-and-underwriting.md) — credit
  capacity
- [../api/README.md](../api/README.md) § `/passport`
- [../architecture/caching.md](../architecture/caching.md) § Response cache
- [../security/threat-model.md](../security/threat-model.md)
