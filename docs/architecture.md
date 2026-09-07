# Architecture

System design, middleware stack, request lifecycle, smart contracts,
caching, data flow, and scaling characteristics. The single source
of truth for "how does the service fit together" — the algorithm
details live in [concepts.md](concepts.md).

## 1. System overview

Agent Passport is a **stateless HTTP API** that scores Algorand
wallets for trust, delegation trust, sybil risk, reputation, and
creditworthiness, and exposes two on-chain mutating endpoints
(`/delegate`, `/revoke`) backed by a TEAL stateful contract.

```
┌──────────────┐     ┌────────────────────────────────────────┐     ┌─────────────────────┐
│              │     │  Express on Node 20+ (port 3000)      │     │                     │
│  Client /    │────▶│   - Helmet, CORS, requestId           │────▶│  Algorand           │
│  Agent       │     │   - Rate limit (600/min/IP)           │     │  (algod + indexer)  │
│              │     │   - Metrics, x402, idempotency        │     │                     │
│  SDK (TS)    │     │   - LRU response cache (60s TTL)      │     │  + optional         │
│  SDK (Py)    │     │   - In-memory idempotency store (24h) │     │    registry.teal    │
│              │     │   - HMAC auth (state-changing)        │     │    reputation.teal  │
└──────────────┘     └────────────────────────────────────────┘     └─────────────────────┘
```

**Stateless** — every request fetches data from Algorand and caches
in-memory for 60 s. No database, no Redis, no message queue. Scale
horizontally by adding pods.

## 2. Request lifecycle

A request flows through twelve ordered middlewares plus the route
handler. Each middleware is registered in `src/app.ts`.

| # | Middleware | Purpose | Headers added |
|---|------------|---------|---------------|
| 1 | `app.set('trust proxy', 1)` | Honour `X-Forwarded-For` from one hop of LB | — |
| 2 | `helmet()` | HSTS, X-Content-Type-Options, X-Frame-Options, CSP | `Strict-Transport-Security`, etc. |
| 3 | `requestIdMiddleware` | UUID per request; reads `X-Request-ID` if valid | `X-Request-ID` |
| 4 | `requestLoggingMiddleware` | One JSON log line per request | — |
| 5 | `corsMiddleware({ origin })` | CORS with `*` or allow-list | `Access-Control-*` |
| 6 | `rateLimiter({ windowMs, max })` | 600 req/min/IP; bypasses for ops + trusted IPs | `X-RateLimit-*` |
| 7 | `express.json({ limit: '100kb' })` | JSON body parser, hard 100 KB cap | — |
| 8 | `metricsMiddleware` | Records `http_request_duration_seconds` | — |
| 9 | `requestDeadlineMiddleware` | Sets `res.locals.deadlineAt` from `REQUEST_TIMEOUT_MS` | — |
| 10 | `x402Middleware` | When enabled, requires `x-payment` on premium endpoints | x402 spec |
| 11 | `settlementVerificationMiddleware` | Async verify of payment on-chain | — |
| 12 | `hmacAuth` (if `HMAC_SECRET` set) | HMAC-SHA256 auth on mutating endpoints | — |
| 13 | `idempotencyMiddleware` | `Idempotency-Key` handling for mutating calls | `idempotency-key`, `idempotent-replay` |
| 14 | Route handler | Per-endpoint logic | per-endpoint |

**Operational endpoints** (`/health`, `/ready`, `/health/deep`,
`/metrics`, `/registry/status`) are exempt from rate limiting (step
6) and from payment (step 10).

## 3. Cache and idempotency stores

### Response cache

`src/lib/cache.ts` — `TTLCache<unknown>(maxEntries: 500, ttlMs: 60_000)`.
Caches `/score` and `/passport` for 60 s. Invalidated on `/delegate`,
`/revoke`, `/reputation/record` for the affected wallet.

### Idempotency store

`src/lib/idempotency.ts` — in-memory `Map<key, { bodyHash, status, body, expiresAt }>`.
Default 24 h TTL, 10 000 entry cap, 5-minute sweeper. Body hash uses
canonical JSON (sorted keys) so `{"a":1,"b":2}` and `{"b":2,"a":1}`
produce the same hash.

For multi-replica deployments, back this with Redis. The current
implementation is per-process.

### Rate-limit and system-exposure JSON files

Two single-purpose `data/*.json` files persist across restarts:

- `data/rate-limit.json` — per-IP request counts (resets after 60 s)
- `data/system-exposure.json` — cumulative approved credit per wallet

Both use the shared JSON-file persistence helper
(`src/lib/json-store.ts`) with a write-queue mutex to prevent
concurrent-write races. Multi-replica needs Redis for both.

## 4. Smart contracts

Two TEAL v10 contracts under `contracts/`:

### `registry.teal` — delegation registry

- App ID: `REGISTRY_APP_ID` env var
- Global state: `admin` (operator address)
- Box storage: one box per `(sponsor, agent)` pair, value = `amount`
- Methods:
  - `add_delegation(sponsor, agent, amount)` — creates a box
  - `revoke_delegation(sponsor, agent)` — deletes the box
  - `update_admin(new_admin)` — rotates the operator key
- Update permission: only the `admin` address

### `reputation.teal` — on-chain reputation events

- App ID: `REPUTATION_APP_ID` env var
- Global state: `admin`, `event_count`, per-wallet event counter
- Local state: per-account event log
- Methods:
  - `record_event(wallet, event_type, amount, counterparty)` — appends
  - `update_admin(new_admin)` — rotates the operator key
- Update permission: only the `admin` address

Deploying the contracts: `npm run deploy-registry` and
`npm run deploy-reputation` (uses `DEPLOYER_MNEMONIC`). The runtime
operator wallet (`OPERATOR_MNEMONIC`) is a separate key with
on-chain permission.

## 5. Data flow (request → Algorand → response)

```
client            service                 algod     indexer      contract
  │                  │                       │           │            │
  │─GET /score──▶    │                       │           │            │
  │                  │─status()───────────▶ │           │            │
  │                  │◀─────lastRound───────│           │            │
  │                  │─accountInformation(w)─▶│           │            │
  │                  │◀─────info─────────────│           │            │
  │                  │─────────────────────  │           │            │
  │                  │ (5 sub-scores, parallel calls)    │            │
  │                  │                       │           │            │
  │◀────200 JSON─────│                       │           │            │
```

Trust-score generation fans out 5 sub-score calls (age, activity,
volume, velocity, compliance), each hitting algod once. The
composite is computed in-process. Total: 1 `status()` + 1
`accountInformation()` + 0-25 `txlist`/`txinfo` for delegation,
all in parallel where independent.

## 6. Module reference

| File | Purpose | Public exports |
|------|---------|----------------|
| `src/trust-score.ts` | Composite trust score | `scoreWallet`, `scoreWalletFresh` |
| `src/delegation.ts` | Sponsor graph BFS | `scoreDelegation`, `scoreDelegationFresh` |
| `src/sybil.ts` | 12 sybil signals | `detectSybil`, `detectSybilFresh` |
| `src/reputation.ts` | Event log + score | `computeReputation`, `recordEvent` |
| `src/credit.ts` | Capacity estimate | `estimateCredit`, `estimateCreditWithTrust` |
| `src/underwriting.ts` | Decision engine | `underwrite` |
| `src/passport.ts` | Full document | `generatePassport` |
| `src/trust-graph.ts` | Graph analytics | `analyzeTrustGraph`, `simulateSponsorLoss` |
| `src/counterparty.ts` | Buyer risk check | `checkCounterparty` |
| `src/registry.ts` | On-chain delegate | `delegate`, `revoke` |
| `src/lib/cache.ts` | LRU TTL cache | `TTLCache` |
| `src/lib/idempotency.ts` | Idempotency-Key | `idempotencyMiddleware` |
| `src/lib/security.ts` | CORS, rate limit, HMAC | `corsMiddleware`, `rateLimiter`, `hmacAuth` |
| `src/lib/metrics.ts` | Prometheus | `metricsMiddleware` |
| `src/lib/x402.ts` | x402 payment | `x402Middleware` |
| `src/lib/hmac-auth.ts` | HMAC auth | `hmacAuth` |
| `src/lib/operator-wallet.ts` | Operator wallet init | `initOperatorWallet` |
| `src/lib/system-exposure.ts` | $100k cap | `addSystemExposure`, `capToSystemCapacity` |
| `src/lib/webhooks.ts` | Subscriber registry | `addSubscriber`, `fireWebhook` |
| `src/lib/sanctions.ts` | Deny-list provider | `getSanctionsProvider`, `checkSanctions` |
| `src/lib/timeout.ts` | `withTimeout` | `withTimeout` |
| `src/lib/json-store.ts` | JSON-file persistence | `queueJsonWrite`, `readJsonFile` |
| `src/lib/request-deadline.ts` | Per-request deadline | `requestDeadlineMiddleware` |
| `src/lib/graph.ts` | Sybil graph signals | (private) |
| `src/lib/build-info.ts` | Version metadata | `buildInfo`, `packageVersion` |

## 7. Scaling characteristics

| Resource | Bound | Notes |
|----------|-------|-------|
| Memory | O(active wallets in 60s window × cache entry size) | `TTLCache` caps at 500 entries |
| Algorand RPC | 1 round-trip per sub-score + 1 for status | Indexed per wallet; cache mitigates |
| Multi-replica | Each replica is independent | Idempotency + rate-limit + exposure need Redis for cross-replica consistency |
| Cold start | ~1s to import + 0 external calls | No DB to warm |
| Graceful shutdown | 10s forced exit after `SIGTERM` | `metricsCollectors`, `idempotencySweeper`, `rateLimitTimer` all stop |

For horizontal scaling:

1. Add a load balancer that forwards `X-Forwarded-For` (already
   trusted via `app.set('trust proxy', 1)`).
2. Back the rate-limit map, idempotency store, and system-exposure
   ledger with Redis. The `src/lib/json-store.ts` interface is
   designed to be drop-in replaceable.
3. Configure your orchestrator's `readinessProbe` to `/ready` and
   `livenessProbe` to `/health`.