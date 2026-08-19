# API Reference

Canonical HTTP reference for the Agent Passport service.

**Base URL:** `http://localhost:3000` (default)

**Conventions**

- All wallet addresses match `^[A-Z2-7]{58}$` (Algorand base32). See
  `src/lib/constants.ts`.
- Successes are JSON. Errors are JSON with
  `{ error: string, code?: string }`.
- Every premium endpoint returns `402 Payment Required` when
  `X402_ENABLED=true`; the body includes the payment spec, and
  clients retry with a verified `x-payment` header.
- Mutating endpoints (`/delegate`, `/revoke`, `/reputation/record`)
  accept the `Idempotency-Key` header. The HMAC auth middleware
  requires a signed request when `HMAC_SECRET` is set.
- All responses carry `X-Request-ID` (UUID).

## Endpoint map

| Endpoint | Method | Auth | x402 | Cache | Doc |
|----------|--------|------|------|-------|-----|
| [`/score`](#get-score) | GET | — | yes (when enabled) | 60s | below |
| [`/delegation`](#get-delegation) | GET | — | yes | — | below |
| [`/counterparty-check`](#post-counterparty-check) | POST | — | yes | — | below |
| [`/credit-estimate`](#post-credit-estimate) | POST | — | yes | — | below |
| [`/sybil-check`](#get-sybil-check) | GET | — | yes | — | below |
| [`/reputation`](#get-reputation) | GET | — | yes | — | below |
| [`/reputation/record`](#post-reputationrecord) | POST | HMAC | yes | invalidates | below |
| [`/underwrite`](#get-underwrite) | GET | — | yes | — | below |
| [`/trust-graph`](#get-trust-graph) | GET | — | yes | — | below |
| [`/passport`](#get-passport) | GET | — | yes | 60s | below |
| [`/verify`](#get-verify) | GET | — | no | 60s | below |
| [`/discovery/search`](#get-discoverysearch) | GET | — | no | — | below |
| [`/delegate`](#post-delegate) | POST | HMAC | yes | invalidates | below |
| [`/revoke`](#post-revoke) | POST | HMAC | yes | invalidates | below |
| [`/health`](#get-health) | GET | — | no | — | [health](#health-readiness-metrics) |
| [`/ready`](#get-ready) | GET | — | no | — | [health](#health-readiness-metrics) |
| [`/health/deep`](#get-healthdeep) | GET | — | no | — | [health](#health-readiness-metrics) |
| [`/registry/status`](#get-registrystatus) | GET | — | no | — | [health](#health-readiness-metrics) |
| [`/metrics`](#get-metrics) | GET | — | no | — | [health](#health-readiness-metrics) |

---

## `GET /score`

Composite trust score (0–100) with five sub-scores.

**Query parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `wallet` | string | yes | Algorand address, 58-char base32 |

**Response 200** — see `TrustScoreResponse` (the algorithm is in
[concepts.md](concepts.md)). Includes `trustScore`, `riskLevel`,
`breakdown`, `onChain`, `explanation`.

**Status codes:** 200, 400, 402, 404, 429, 500

**Caching:** 60 s in `responseCache`. Invalidated on `/delegate`,
`/revoke`, `/reputation/record` for the affected wallet.

---

## `GET /delegation`

Delegation trust score from the sponsor graph BFS.

Same query / status codes as `/score`. Response shape:
`DelegationResponse` — `trustScore`, `riskLevel`, `breakdown`
(depth, sponsor quality, sponsor count, amount), `delegation`
(depth, sponsorCount, isTrustAnchor, trustedAncestors),
`explanation`.

---

## `POST /counterparty-check`

Merchant counterparty check (60% on-chain + 40% delegation).

**Request body**

```json
{ "buyer": "GD64Y..." }
```

**Response 200** — `CounterpartyCheckResponse`:
`allow`, `confidence`, `riskLevel`, `trustScore`, `onChainScore`,
`delegationScore`, `explanation[]`.

---

## `POST /credit-estimate`

Estimate the credit capacity of a wallet.

**Request body**

```json
{ "wallet": "GD64Y...", "amount": 5000 }
```

`amount` is optional. When present, the response includes
`assessedAmount` and a `risk` adjusted to the requested amount.

**Response 200** — `CreditEstimate`: `estimatedLimit`, `risk`,
`confidence`, `approved`, `breakdown`, `explanation[]`.

---

## `GET /sybil-check`

12-signal sybil risk score.

Same query as `/score`. Response: `sybilRisk` (0–1), `riskLevel`,
`confidence`, `signals` (12 fields — 7 wallet-history + 4 graph
+ 1 sub-signal), `clusterSize`, `flaggedWallets[]`, `explanation[]`.

---

## `GET /reputation`

Current reputation for a wallet.

Same query as `/score`. Response: `reputation` (0–100), `riskLevel`,
`confidence`, `breakdown` (per-event counts and amounts), `factors`,
`explanation[]`.

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
| `round` | number | for `dispute` | Round of the disputed transaction |

**Idempotency:** required. `Idempotency-Key` header.

**Side effects**
- Submits a transaction to `reputation.teal` (when `REPUTATION_APP_ID>0`)
- Increments `totalEvents` on-chain
- Invalidates `passport:<wallet>` and `score:<wallet>` in cache

---

## `GET /underwrite`

Composite underwriting decision (Trust 0.35 + Delegation 0.25 +
Sybil 0.20 + Reputation 0.20).

Same query as `/score`. Response: `approved`, `recommendedLimit`
(capped by system exposure), `riskLevel`, `confidence`,
`compositeScore`, `factors[]` (each `{name, score, weight, contribution, status}`),
`explanation[]`, `sanctions?`.

**Side effects** — increments `data/system-exposure.json` by the
recommended limit when approved.

---

## `GET /trust-graph`

Full trust-graph analytics: nodes, edges, exposure by depth, what-ifs.

Same query as `/score`, plus optional `simulateSponsorLost=<wallet>`
to remove a sponsor from the graph and re-compute exposure.

**Cost:** 10+ indexer round-trips. Slowest endpoint in the service.

---

## `GET /passport`

Full passport document.

Same query as `/score`. Response: `wallet`, `generatedAt`,
`blockRound`, `schemaVersion`, `identityStrength`, `trustScore`,
`trustRiskLevel`, `reputation`, `reputationRiskLevel`, `totalEvents`,
`paymentReliability`, `creditLimit`, `creditRisk`, `risk`,
`sybilRisk`, `overallRiskLevel`, `onChain`, `delegation`,
`capabilities`, `dataSources`, `summary`, `explanation`, `checksum`.

**Caching:** 60 s.

---

## `GET /verify`

Lightweight wallet verification — single fast account lookup.

Same query as `/score`. Response: `valid`, `wallet`, `flags`
(`funded`, `active`, `empty`, `lookup_failed`).

**Caching:** 60 s.

---

## `GET /discovery/search`

Bazaar catalog search (single self-listing). Filters by `q`
(substring match on name/description/category/tags) and `limit`
(1–100, default 20).

---

## `POST /delegate`

Submit an on-chain delegation. Requires `REGISTRY_APP_ID>0` and
`OPERATOR_MNEMONIC` set.

**Request body**

```json
{ "sponsor": "SPON...", "agent": "AGEN...", "amount": 1000 }
```

**Idempotency:** required. **Auth:** HMAC if `HMAC_SECRET` is set.

**Status codes:** 201, 400, 401, 402, 409, 429, 500, 503

**Side effects**
- Submits `add_delegation` to `registry.teal`
- Invalidates `score:<sponsor>`, `score:<agent>`,
  `passport:<sponsor>`, `passport:<agent>` in cache

---

## `POST /revoke`

Revoke an on-chain delegation. Same auth and status codes as
`/delegate`.

**Request body**

```json
{ "sponsor": "SPON...", "agent": "AGEN..." }
```

`amount` is not used for revocation; the box is deleted entirely.

---

## Health, readiness, metrics

None of the operational endpoints are rate-limited, none require
payment, and all return JSON except `/metrics` (Prometheus text
format).

### `GET /health` — liveness

Always returns 200 with a static JSON body, unless the process is
severely broken. Used as a Kubernetes `livenessProbe`.

```json
{
  "status": "ok",
  "service": "Agent Passport",
  "version": "0.1.0",
  "network": "testnet",
  "x402": false,
  "timestamp": "2026-06-25T10:00:00.000Z"
}
```

### `GET /ready` — readiness

Pings the configured algod endpoint and returns 200 if reachable,
503 if not. Used as a Kubernetes `readinessProbe`.

```json
{
  "status": "ok",
  "service": "Agent Passport",
  "network": "testnet",
  "timestamp": "2026-06-25T10:00:00.000Z",
  "algorand": {
    "connected": true,
    "round": 52345678
  }
}
```

On failure: HTTP 503 with the same shape and `algorand.connected: false`.

### `GET /health/deep` — informational

Combines `/health` and `/ready` shapes, **but always returns 200**
even when Algorand is down. Used by operational dashboards.

### `GET /registry/status`

Reports whether the on-chain contracts are configured.

```json
{ "configured": true, "appId": 12345 }
```

When `REGISTRY_APP_ID=0`: `{ "configured": false, "appId": 0 }`.

### `GET /metrics`

Prometheus-format metrics. Exempt from rate limiting. Returns
`Content-Type: text/plain; version=0.0.4` per the Prometheus spec.

The full inventory of metrics is documented in
[operations.md](operations.md#metrics). The three families most
operators look at first:

| Metric | What it tells you |
|--------|-------------------|
| `agent_passport_http_requests_total` | Request rate per route + status |
| `agent_passport_http_request_duration_seconds` | Latency distribution per route |
| `agent_passport_http_request_errors_total` | 4xx/5xx rate per route + error_type |

**Scrape config**

```yaml
scrape_configs:
  - job_name: agent-passport
    metrics_path: /metrics
    scrape_interval: 30s
    scrape_timeout: 10s
    static_configs:
      - targets: ['agent-passport:3000']
```

**Kubernetes probe example**

```yaml
livenessProbe:
  httpGet: { path: /health, port: 3000 }
  initialDelaySeconds: 10
  periodSeconds: 30
readinessProbe:
  httpGet: { path: /ready, port: 3000 }
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## Error codes

Every error response has the shape:

```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

`code` is optional and present only on selected errors.

### `400 Bad Request`

Validation failure — the request was understood but a field was
missing, malformed, or out of range.

| Trigger | Example message |
|---------|-----------------|
| Missing query param `wallet` | `Missing required query parameter: wallet` |
| Invalid wallet format | `Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).` |
| Missing body field | `Missing required field: buyer` |
| `amount` is non-numeric or non-positive | `Amount must be a positive finite number.` |
| `sponsor === agent` on `/delegate` | `Sponsor and agent must be different wallets.` |
| Invalid `Idempotency-Key` | `Invalid Idempotency-Key format. Must be 8-255 chars of [A-Za-z0-9_\\-:]` |
| Missing `Idempotency-Key` (on mutating) | `Idempotency-Key header is required for mutating requests` |
| Bad HMAC signature | `Invalid HMAC signature` |

### `401 Unauthorized`

HMAC auth failed or missing. See [security.md](security.md#hmac-auth).

### `402 Payment Required`

`X402_ENABLED=true` and the request did not carry a valid
`x-payment` header. The body includes the `PaymentRequirements`
per the x402 spec.

Enabled on every premium endpoint:
`/score`, `/delegation`, `/counterparty-check`, `/credit-estimate`,
`/sybil-check`, `/reputation`, `/reputation/record`, `/underwrite`,
`/trust-graph`, `/passport`, `/delegate`, `/revoke`.

Never returned by `/health`, `/ready`, `/health/deep`, `/metrics`,
`/registry/status`, `/verify`, `/discovery/search`.

### `404 Not Found`

The wallet is not on the configured Algorand network (or is a
fresh account with no history). Returned by `/score`, `/delegation`,
`/underwrite`, `/trust-graph`, `/passport`, `/sybil-check`,
`/reputation`, `/credit-estimate`, `/verify`.

```json
{ "error": "Wallet not found on testnet" }
```

### `409 Conflict`

`Idempotency-Key` reused with a **different** body. The middleware
hashes the body and returns 409 if the hash differs from the cached
one. Same key with the **same** body returns the cached response
with the `idempotent-replay: true` header.

```json
{ "error": "Idempotency-Key reused with different request body" }
```

### `413 Payload Too Large`

Body parser cap exceeded. `express.json({ limit: '100kb' })`; larger
bodies are rejected with a default `413` from Express.

### `429 Too Many Requests`

Per-IP rate limit exceeded. Headers:

- `X-RateLimit-Limit: 600`
- `X-RateLimit-Remaining: 0`
- `X-RateLimit-Reset: <unix-seconds>`

```json
{ "error": "Too many requests. Try again later." }
```

Bypassed for `/health`, `/ready`, `/health/deep`, `/metrics`,
`/registry/status`, and IPs in `RATE_LIMIT_TRUSTED_IPS`.

### `500 Internal Server Error`

Algorand RPC failure, unhandled exception, or contract submission
error.

```json
{ "error": "Internal server error" }
```

The full error is logged with the `X-Request-ID` for triage. The
rate of `agent_passport_http_request_errors_total{error_type="server_error"}`
is the canary metric.

### `503 Service Unavailable`

- `/delegate` and `/revoke` return `503` with
  `code: "REGISTRY_NOT_CONFIGURED"` when `REGISTRY_APP_ID=0`.
- `/ready` returns `503` when the Algorand endpoint is unreachable.

```json
{ "error": "Delegation registry contract is not configured (REGISTRY_APP_ID=0)", "code": "REGISTRY_NOT_CONFIGURED" }
```

## Specification files

- **OpenAPI 3.0** — [api/openapi.yaml](api/openapi.yaml)
- **Postman collection** — [api/postman-collection.json](api/postman-collection.json)
- **Bazaar metadata** — [bazaar-metadata.json](bazaar-metadata.json)