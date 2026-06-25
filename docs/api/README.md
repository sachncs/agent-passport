# API Reference

This is the canonical HTTP reference for the Agent Passport service.
It replaces the legacy `docs/API.md` stand-in.

**Base URL:** `http://localhost:3000` (default)

**Conventions**

- All wallet addresses must match `^[A-Z2-7]{58}$` (Algorand
  base32). See `src/lib/constants.ts`.
- Successful responses are JSON. Error responses are JSON with
  `{ error: string, code?: string }`. See
  [error-codes.md](error-codes.md).
- Every premium endpoint returns `402 Payment Required` when
  `X402_ENABLED=true`. The body includes the payment spec; clients
  must retry with a verified `x-payment` header.
- Mutating endpoints (`/delegate`, `/revoke`, `/reputation/record`)
  accept the `Idempotency-Key` header. See
  [../operations/idempotency.md](../operations/idempotency.md).
- All responses carry `X-Request-ID` (UUID). See
  [../architecture/middleware-stack.md](../architecture/middleware-stack.md) § requestId.

## Endpoint Map

| Endpoint | Method | Auth | x402 | Cache | Doc |
|----------|--------|------|------|-------|-----|
| [`/score`](#get-score) | GET | — | yes (when enabled) | 60s | below |
| [`/delegation`](#get-delegation) | GET | — | yes | — | below |
| [`/counterparty-check`](#post-counterparty-check) | POST | — | yes | — | below |
| [`/credit-estimate`](#post-credit-estimate) | POST | — | yes | — | below |
| [`/sybil-check`](#get-sybil-check) | GET | — | yes | — | below |
| [`/reputation`](#get-reputation) | GET | — | yes | — | below |
| [`/reputation/record`](#post-reputationrecord) | POST | — | yes | — | below |
| [`/underwrite`](#get-underwrite) | GET | — | yes | — | below |
| [`/trust-graph`](#get-trust-graph) | GET | — | yes | — | below |
| [`/passport`](#get-passport) | GET | — | yes | 60s | below |
| [`/verify`](#get-verify) | GET | — | no | 60s | below |
| [`/discovery/search`](#get-discoverysearch) | GET | — | no | — | below |
| [`/delegate`](#post-delegate) | POST | operator | yes | invalidates | below |
| [`/revoke`](#post-revoke) | POST | operator | yes | invalidates | below |
| [`/health`](#get-health) | GET | — | no | — | [health.md](health.md) |
| [`/ready`](#get-ready) | GET | — | no | — | [health.md](health.md) |
| [`/health/deep`](#get-healthdeep) | GET | — | no | — | [health.md](health.md) |
| [`/registry/status`](#get-registrystatus) | GET | — | no | — | [health.md](health.md) |
| [`/metrics`](#get-metrics) | GET | — | no | — | [health.md](health.md) |

---

## `GET /score`

Compute the composite trust score for an Algorand wallet.

**Query parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `wallet` | string | yes | Algorand address, 58-char base32 |

**Response 200** — see `WalletTrustScore` in
[`../concepts/trust-scoring.md`](../concepts/trust-scoring.md). Includes
`trustScore` (0–100), `riskLevel`, `breakdown`, `onChain`, `explanation`.

**Status codes**

- `200` — success
- `400` — missing or invalid `wallet`
- `402` — x402 payment required (when enabled)
- `404` — wallet not found on the configured Algorand network
- `429` — rate limit exceeded
- `500` — Algorand API failure

**Caching:** 60 s in `responseCache`. Invalidated on
`/delegate`, `/revoke`, `/reputation/record` for the affected wallet.

---

## `GET /delegation`

Compute the delegation trust score.

**Query parameters** — same as `/score`.

**Response 200** — see `DelegationTrustScore` in
[`../concepts/delegation.md`](../concepts/delegation.md). Includes
`trustScore`, `riskLevel`, `breakdown` (depth, sponsor quality,
sponsor count, amount), `delegation` (depth, sponsorCount,
isTrustAnchor, trustedAncestors), `explanation`.

**Status codes** — same as `/score`.

---

## `POST /counterparty-check`

Merchant counterparty check (60% on-chain + 40% delegation).

**Request body**

```json
{ "buyer": "GD64Y..." }
```

**Response 200**

```json
{
  "allow": true,
  "confidence": 0.85,
  "riskLevel": "low",
  "trustScore": 72,
  "onChainScore": 75,
  "delegationScore": 65,
  "explanation": ["Strong on-chain history", "Well-sponsored", ...]
}
```

**Status codes** — same as `/score` plus `400` for missing `buyer`.

---

## `POST /credit-estimate`

Estimate the credit capacity of a wallet.

**Request body**

```json
{ "wallet": "GD64Y...", "amount": 5000 }
```

`amount` is optional. When present, the response includes
`assessedAmount` and a `risk` adjusted to the requested amount.

**Response 200** — see `CreditEstimate`. Includes `estimatedLimit`,
`risk`, `confidence`, `approved`, `breakdown`, `explanation`.

---

## `GET /sybil-check`

Compute the sybil risk for a wallet.

**Query parameters** — same as `/score`.

**Response 200** — see `SybilResult` in
[`../concepts/sybil-detection.md`](../concepts/sybil-detection.md).
Includes `sybilRisk` (0–1), `riskLevel`, `confidence`, `signals` (12
signals), `clusterSize`, `flaggedWallets`, `explanation`.

---

## `GET /reputation`

Get the current reputation for a wallet.

**Query parameters** — same as `/score`.

**Response 200** — includes `reputation` (0–100), `riskLevel`,
`confidence`, `totalEvents`, per-event counts and amounts, `factors`,
`explanation`.

---

## `POST /reputation/record`

Record an on-chain reputation event.

**Request body**

```json
{
  "wallet": "GD64Y...",
  "eventType": "payment",
  "amount": 100,
  "counterparty": "ABCDE..."
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `wallet` | string | yes | Subject wallet |
| `eventType` | enum | yes | `payment`, `purchase`, `dispute`, `refund`, `endorsement`, `service` |
| `amount` | number | no | Amount in USDC |
| `counterparty` | string | no | Required for `dispute` and `endorsement` |

**Idempotency:** strongly recommended. The `Idempotency-Key` header
makes the call safe to retry.

**Status codes** — same as `/score` plus `400` for missing/invalid
fields.

**Side effects**

- Submits a transaction to `reputation.teal` (when
  `REPUTATION_APP_ID>0`)
- Increments `totalEvents` on-chain
- Invalidates `passport:<wallet>` and `score:<wallet>` in the
  response cache

---

## `GET /underwrite`

Composite underwriting decision (Trust 0.35 + Delegation 0.25 +
Sybil 0.20 + Reputation 0.20).

**Query parameters** — same as `/score`.

**Response 200** — see `UnderwritingDecision` in
[`../concepts/credit-and-underwriting.md`](../concepts/credit-and-underwriting.md).
Includes `approved`, `recommendedLimit` (capped by system exposure),
`riskLevel`, `confidence`, `compositeScore`, `factors[]`,
`explanation`.

**Side effects** — increments `data/system-exposure.json` by the
recommended limit when approved.

---

## `GET /trust-graph`

Full trust-graph analytics: nodes, edges, exposure by depth,
what-ifs.

**Query parameters** — same as `/score`.

**Response 200** — see `TrustGraphResult`. Includes `nodes`,
`edges`, `exposureAnalysis`, `whatIfs[]`, `summary`, `explanation`.

**Cost:** 10+ indexer round-trips. Slowest endpoint in the service.

---

## `GET /passport`

Full passport document for a wallet.

**Query parameters** — same as `/score`.

**Response 200** — see `AgentPassport` in
[`../concepts/passport-document.md`](../concepts/passport-document.md).
Includes `identityStrength`, `trustScore`, `trustRiskLevel`,
`reputation`, `paymentReliability`, `creditLimit`, `risk`,
`sybilRisk`, `overallRiskLevel`, `onChain`, `delegation`,
`capabilities`, `dataSources`, `summary`, `explanation`, `checksum`.

**Caching:** 60 s in `responseCache`.

---

## `GET /verify`

Lightweight wallet verification — single fast account lookup with
naive flag heuristics.

**Query parameters** — same as `/score`.

**Response 200**

```json
{
  "valid": true,
  "wallet": "GD64Y...",
  "flags": {
    "funded": true,
    "active": true,
    "empty": false,
    "lookup_failed": false
  }
}
```

| Flag | Meaning |
|------|---------|
| `funded` | `info.amount > 0` |
| `active` | opted into ≥1 app or asset |
| `empty` | `info.amount === 0` |
| `lookup_failed` | algod `accountInformation` failed |

When the wallet fails format validation, `valid: false` and
`flags: {}` are returned.

**Caching:** 60 s in `responseCache`.

---

## `GET /discovery/search`

Static Bazaar catalog search. The catalog is hard-coded in
`src/app.ts:414-438`; the `/discovery/search` route filters it by
`q` (substring match on name/description/category/tags) and `limit`
(1–100, default 20).

**Query parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | no | Free-text query |
| `limit` | integer | no | Max results, 1–100, default 20 |

**Response 200**

```json
{
  "query": "trust",
  "total": 1,
  "results": [
    {
      "id": "agent-passport",
      "type": "service",
      "category": "trust",
      "name": "Agent Passport",
      ...
    }
  ]
}
```

---

## `POST /delegate`

Submit an on-chain delegation. Requires `REGISTRY_APP_ID>0` and
`OPERATOR_MNEMONIC` set.

**Request body**

```json
{ "sponsor": "SPON...", "agent": "AGEN...", "amount": 1000 }
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `sponsor` | string | yes | Delegator (must be 58-char base32) |
| `agent` | string | yes | Delegatee (must be 58-char base32, ≠ sponsor) |
| `amount` | number | yes | Positive finite number, in microUSDC |

**Idempotency:** recommended.

**Status codes**

- `201` — created
- `400` — invalid input
- `402` — x402 payment required (when enabled)
- `409` — idempotency conflict (different body, same key)
- `429` — rate limit exceeded
- `500` — Algorand API failure
- `503` — `REGISTRY_NOT_CONFIGURED` (REGISTRY_APP_ID=0)

**Side effects**

- Submits `add_delegation` to `registry.teal`
- Invalidates `score:<sponsor>`, `score:<agent>`,
  `passport:<sponsor>`, `passport:<agent>`

---

## `POST /revoke`

Revoke an on-chain delegation. Same requirements and status codes
as `/delegate`.

**Request body**

```json
{ "sponsor": "SPON...", "agent": "AGEN..." }
```

`amount` is not used for revocation; the box is deleted entirely.

---

## Health, readiness, metrics

See [health.md](health.md) for the operational endpoints.

## Specification files

- OpenAPI 3.0 — [openapi.yaml](openapi.yaml)
- Postman collection — [postman-collection.json](postman-collection.json)
- Bazaar metadata — [../bazaar-metadata.json](../bazaar-metadata.json)
