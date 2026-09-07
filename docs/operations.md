# Operations

How to run, deploy, monitor, and shut down the Agent Passport
service. Source-of-truth for: environment variables, deployment,
observability (metrics, SLOs, alerts, runbooks), rate limiting,
idempotency, system-exposure cap, graceful shutdown, and load
testing.

## 1. Environment variables

The canonical env-var table. Every variable the service reads is
listed here, sourced from `.env.example` and `src/config.ts`. If
you add a new env var, update this page, `.env.example`, and
`src/config.ts` together.

Copy `.env.example` to `.env` and edit. The service calls
`dotenv.config()` on startup so `.env` is loaded automatically.

### Service

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | int | `3000` | HTTP listen port |
| `NODE_ENV` | enum | `development` | Set to `production` to disable metrics collectors in tests |
| `LOG_LEVEL` | enum | `info` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_FILE` | path | — | JSON log file (optional) |
| `LOG_ERROR_FILE` | path | — | Error-only log file (optional) |
| `CORS_ALLOWED_ORIGINS` | string | `*` | Comma-separated origins, or `*` |
| `REQUEST_TIMEOUT_MS` | int | `10000` | Per-request Algorand/x402 timeout |

### Algorand

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ALGOD_URL` | URL | `https://testnet-api.algonode.cloud:443` | algod v2 endpoint |
| `ALGOD_TOKEN` | string | `""` | API token (AlgoNode free tier does not require one) |
| `INDEXER_URL` | URL | `https://testnet-idx.algonode.cloud:443` | Indexer v2 endpoint |
| `INDEXER_TOKEN` | string | `""` | API token |
| `ALGO_NETWORK` | string | `testnet` | Display only |

For mainnet, point at AlgoNode mainnet, a hosted provider (Nodely,
BCC), or your own node. See § 4 for latency trade-offs.

### Smart contracts

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REGISTRY_APP_ID` | int | `0` | App ID of `registry.teal`. Set to `0` to disable `/delegate` and `/revoke` |
| `REPUTATION_APP_ID` | int | `0` | App ID of `reputation.teal`. Set to `0` to disable `/reputation/record` on-chain writes |
| `OPERATOR_MNEMONIC` | string | — | 25-word Algorand mnemonic for the runtime operator wallet |
| `DEPLOYER_MNEMONIC` | string | — | 25-word mnemonic used only by the deploy scripts |

See [security.md](security.md#operator-wallet) for the operator
mnemonic handling and KMS guidance.

### x402

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `X402_ENABLED` | bool | `false` | When `true`, every premium endpoint requires an `x-payment` header |
| `X402_FACILITATOR_URL` | URL | `https://x402.org/facilitator` | x402 facilitator endpoint |
| `X402_PAYMENT_RECIPIENT` | string | — | Algorand address that receives USDC payments (required when x402 is enabled) |
| `X402_NETWORK` | string | `eip155:84532` | x402 network identifier (chain:ID format) |

### Rate limiting

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RATE_LIMIT_MAX` | int | `600` | Per-IP requests per minute |
| `RATE_LIMIT_TRUSTED_IPS` | string | — | Comma-separated IPs exempt from the limit |
| `RATE_LIMIT_PERSISTENCE_PATH` | path | `data/rate-limit.json` | Where to persist state across restarts |
| `RATE_LIMIT_OVERRIDES` | JSON | — | Per-endpoint override, e.g. `'{"POST /delegate":{"max":5}}'` |

### Persistence

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `EXPOSURE_PERSISTENCE_PATH` | path | `data/system-exposure.json` | Where to persist cumulative system exposure |
| `WEBHOOKS_PERSISTENCE_PATH` | path | `data/webhooks.json` | Where to persist webhook subscribers |

### Idempotency

The idempotency store is configured entirely in code (no env vars):

| Setting | Value | Source |
|---------|-------|--------|
| `Idempotency-Key` length | 8–255 chars, `[A-Za-z0-9_\-:]+` | `src/lib/idempotency.ts:5-7` |
| Default TTL | 24 hours | `src/lib/idempotency.ts:8` |
| Sweeper interval | 5 minutes | `src/lib/idempotency.ts:9` |
| Max store size | 10 000 | `src/lib/idempotency.ts:10` |

### Auth (HMAC)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `HMAC_SECRET` | string | — | If set (≥ 32 chars), state-changing endpoints require HMAC-SHA256 auth |
| `HMAC_TIMESTAMP_SKEW_MS` | int | `60000` | Max clock skew between client and server |

### Sanctions

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SANCTIONS_EXTRA_DENY` | string | — | Comma-separated wallets to add to the default deny list |

### System exposure cap (hard-coded)

| Constant | Value | Source |
|----------|-------|--------|
| `MAX_SYSTEM_EXPOSURE` | `100_000` USDC | `src/lib/system-exposure.ts:23` |
| `MAX_WALLET_SHARE` | `10_000` USDC (10% of total) | `src/lib/system-exposure.ts:24` |

### Constants (hard-coded, no env var)

| Constant | Value | Purpose |
|----------|-------|---------|
| `WALLET_REGEX` | `/^[A-Z2-7]{58}$/` | Algorand address validator |
| `MICRO_ALGO` | `1_000_000` | Algo → microAlgo |
| `SECONDS_PER_BLOCK` | `3.3` | Average Algorand block time |
| `TESTNET_GENESIS_ROUND` | `64_600_000` | Testnet genesis round |
| `MAX_ROUNDS_LOOKBACK` | `1_000_000` | Cap for indexer queries |

### x402 pricing (`X402_PRICING` in `src/lib/constants.ts`)

| Endpoint | Price (USDC) |
|----------|--------------|
| `/score` | 0.001 |
| `/delegation` | 0.001 |
| `/counterparty-check` | 0.002 |
| `/credit-estimate` | 0.002 |
| `/sybil-check` | 0.003 |
| `/reputation` | 0.001 |
| `/reputation/record` | 0.005 |
| `/underwrite` | 0.01 |
| `/trust-graph` | 0.005 |
| `/passport` | 0.005 |

## 2. Rate limiting

Per-IP fixed-window rate limiter at `src/lib/security.ts`. Default
600 req/min/IP.

### Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `RATE_LIMIT_MAX` | `600` | Override the per-IP limit |
| `RATE_LIMIT_TRUSTED_IPS` | — | Comma-separated IPs exempt from the limit |
| `RATE_LIMIT_PERSISTENCE_PATH` | `data/rate-limit.json` | Where to persist state across restarts |
| `RATE_LIMIT_OVERRIDES` | — | Per-endpoint override as JSON |

### Bypass lists

The middleware short-circuits to `next()` in three cases:

1. **Operational endpoints.** `/health`, `/ready`, `/health/deep`,
   `/metrics`, `/registry/status` are never rate-limited.
2. **`LOAD_TEST_MODE=1`.** All rate limiting is disabled (k6 suite
   use; never in production).
3. **Trusted IPs.** Any IP in `RATE_LIMIT_TRUSTED_IPS` bypasses the
   limit. Use for internal services, the operator host, or your
   monitoring agent.

### Response headers

| Header | Value |
|--------|-------|
| `X-RateLimit-Limit` | The configured `max` (e.g. `600`) |
| `X-RateLimit-Remaining` | `max - count` (clamped to `0`) |
| `X-RateLimit-Reset` | Unix-seconds when the current window expires |

When the limit is exceeded, the response is `429` with body:

```json
{ "error": "Too many requests. Try again later." }
```

State is persisted to `data/rate-limit.json` via the shared
`json-store.ts` write-queue mutex (race-free on concurrent saves).

## 3. Idempotency

The `Idempotency-Key` middleware (`src/lib/idempotency.ts`) makes
mutating calls safe to retry. It applies only to non-`GET` / non-
`HEAD` / non-`OPTIONS` requests; safe methods pass through with no
key required.

### Flow

For each request with a valid `Idempotency-Key` header:

1. **Look up the key** in the in-memory store.
2. **On hit + same body hash** → return the cached response with
   `idempotent-replay: true`.
3. **On hit + different body hash** → return `409 Idempotency-Key
   reused with different request body` and record a metric.
4. **On miss** → require the client to send an `Idempotency-Key` (the
   middleware no longer auto-generates one). The request is
   processed and the response cached.

### Header format

```
Idempotency-Key: <8-255 chars, [A-Za-z0-9_\-:]+>
```

- 8–255 characters
- Allowed: ASCII letters, digits, underscore, hyphen, colon
- Anything else returns `400 Invalid Idempotency-Key format`
- **Required** on `POST /delegate`, `POST /revoke`, and
  `POST /reputation/record` — missing key returns `400`

### Body hashing

Body hash is `sha256(canonicalJson(body))` where `canonicalJson`
sorts keys recursively. So `{"a":1,"b":2}` and `{"b":2,"a":1}`
produce the same digest. Same key + same body → cached response.
Same key + different body → 409.

### In-memory store

`Map<string, IdempotencyRecord>` at `src/lib/idempotency.ts:21`.
Each record:

```typescript
interface IdempotencyRecord {
  key: string;
  bodyHash: string;     // sha256 hex
  status: number;       // HTTP status code (200-299)
  body: unknown;        // Response body
  createdAt: number;    // Unix ms
  expiresAt: number;    // Unix ms (createdAt + 24h)
}
```

The sweeper runs every 5 minutes:

- Removes any record where `expiresAt <= now`
- If the store is over `MAX_STORE_SIZE = 10 000`, evicts the
  oldest keys in insertion order (FIFO overflow)

The store is **not** persisted to disk. A process restart loses
all in-flight idempotency state. Clients that retry with the same
key after a server restart will re-execute the request.

### Metrics

| Metric | Type | Labels | When |
|--------|------|--------|------|
| `agent_passport_idempotency_hits_total` | counter | `path` | Replay served from cache |
| `agent_passport_idempotency_conflicts_total` | counter | `path` | Same key, different body — 409 |

### Endpoints requiring Idempotency-Key

| Endpoint | Required? | Notes |
|----------|-----------|-------|
| `POST /delegate` | Yes | On-chain call — network fee on every retry |
| `POST /revoke` | Yes | On-chain call |
| `POST /reputation/record` | Yes | On-chain call |
| `POST /counterparty-check` | No | Idempotent by nature (read-only) |
| `POST /credit-estimate` | No | Idempotent by nature |
| `GET /score`, `GET /passport`, etc. | N/A | GETs are not idempotency-protected |

### Multi-replica

For deployments with > 1 replica, back the idempotency store
with Redis. The `Idempotency-Key` contract guarantees at-most-once
execution; without a shared store, two replicas can both serve
the same key and both execute the underlying operation.

## 4. Deployment

### Quick start

```bash
npm install
cp .env.example .env
npm start
```

By default this points at the public Algorand testnet — no setup
beyond the env file is needed.

### Going to production — checklist

#### 1. Choose your Algorand network

| Option | When to use | Latency | Setup |
|--------|-------------|---------|-------|
| **Testnet (AlgoNode)** | Dev, staging, low-traffic production, MVP launches | 200-800ms per round-trip | None — defaults are set |
| **Mainnet via public endpoint** | Production with relaxed SLOs (matches testnet numbers) | 200-800ms per round-trip | Update `ALGOD_URL` and `INDEXER_URL` to mainnet |
| **Mainnet via hosted provider** (Nodely, BCC, AlgoNode paid tier) | Production with stricter SLOs and zero node ops | 50-200ms per round-trip | Subscribe to provider, set URLs |
| **Mainnet via local Algorand node** | Production needing the tightest SLOs (500ms P95) | 5-20ms per round-trip | Run your own node — see [Algorand node docs](https://developer.algorand.org/docs/run-a-node/participate/) |

The measured k6 testnet baseline (P95 < 1.5s, 99% availability) is
what you should expect with any of the first three options. The
local-node option is an upgrade path if you need the stricter
`prod-strict` SLOs (P95 < 500ms, 99.9% availability). See § 7.

#### 2. Set `ALGOD_URL` and `INDEXER_URL`

```bash
# Testnet (default — no change needed)
ALGOD_URL=https://testnet-api.algonode.cloud:443
INDEXER_URL=https://testnet-idx.algonode.cloud:443

# Mainnet via AlgoNode
ALGOD_URL=https://mainnet-api.algonode.cloud:443
INDEXER_URL=https://mainnet-idx.algonode.cloud:443
```

#### 3. Set the operator mnemonic

```bash
OPERATOR_MNEMONIC="word1 word2 ... word25"
```

Or load from a secret manager at startup. See
[security.md](security.md#operator-wallet) for KMS guidance.

#### 4. Set `HMAC_SECRET` (recommended for production)

```bash
HMAC_SECRET="$(openssl rand -hex 32)"   # 64 hex chars = 256 bits
```

Any state-changing endpoint will then require HMAC-SHA256
authentication. Public reads and the operational endpoints
remain unauthenticated. See [security.md](security.md#hmac-auth).

#### 5. Build the Docker image

```bash
docker build -t agent-passport:0.1.0 .
docker run --rm -p 3000:3000 --env-file .env agent-passport:0.1.0
```

The Dockerfile is multi-stage, runs as non-root, includes a
healthcheck, and uses tini as PID 1 for proper signal forwarding.

#### 6. Kubernetes probe example

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

## 5. Observability

The service exposes Prometheus-format metrics at `GET /metrics`.
This endpoint is:

- **Exempt from rate limiting** (operational)
- **Always returns 200** unless the process is severely broken
- **Refreshes process gauges** on every scrape (memory, CPU, uptime)

### Metric inventory

#### API metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_http_requests_total` | counter | `method`, `path`, `status_class` | Total HTTP requests |
| `agent_passport_http_request_duration_seconds` | histogram | `method`, `path`, `status_class` | Request duration in seconds |
| `agent_passport_http_request_errors_total` | counter | `method`, `path`, `status_class`, `error_type` | 4xx/5xx errors |

`status_class` is `2xx`/`3xx`/`4xx`/`5xx` (not the raw status code)
to bound label cardinality. Buckets for
`http_request_duration_seconds`: 0.005, 0.01, 0.025, 0.05, 0.1,
0.25, 0.5, 1, 2.5, 5, 10.

#### Trust engine metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_trust_score_generations_total` | counter | `risk_level` | Trust score computations, by risk bucket |
| `agent_passport_trust_score_duration_seconds` | histogram | — | Trust score computation duration |
| `agent_passport_graph_traversal_duration_seconds` | histogram | — | Graph traversal duration |
| `agent_passport_graph_traversal_depth` | histogram | — | Graph traversal depth (hops) |
| `agent_passport_graph_traversal_depth_sum` | counter | — | Cumulative graph traversal depth |

#### x402 payment metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_x402_payments_verified_total` | counter | `status`, `path` | Successful verifications |
| `agent_passport_x402_payment_failures_total` | counter | `reason`, `path` | Failed verifications |
| `agent_passport_x402_replay_attempts_total` | counter | `path` | Replay attack attempts |
| `agent_passport_x402_settlement_failures_total` | counter | `reason` | Settlement failures |
| `agent_passport_x402_verification_duration_seconds` | histogram | — | Verification latency |

#### Contract metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_contract_endorsements_total` | counter | `network` | On-chain endorsements |
| `agent_passport_contract_revocations_total` | counter | `network` | On-chain revocations |
| `agent_passport_contract_disputes_total` | counter | `network` | On-chain disputes |
| `agent_passport_contract_success_events_total` | counter | `network` | On-chain success events |
| `agent_passport_contract_event_stall_seconds` | gauge | — | Seconds since last contract event |

#### Cache metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_cache_hits_total` | counter | `cache_name` | Cache hits |
| `agent_passport_cache_misses_total` | counter | `cache_name` | Cache misses |
| `agent_passport_cache_evictions_total` | counter | `cache_name` | Cache evictions |
| `agent_passport_cache_size` | gauge | `cache_name` | Current cache size |

#### Business metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_passports_generated_total` | counter | — | Total passports generated |
| `agent_passport_paid_requests_total` | counter | `path` | x402-paid requests |
| `agent_passport_unique_wallets` | gauge | — | Distinct wallets seen since process start |
| `agent_passport_trust_checks_total` | counter | `type` | Trust check operations |
| `agent_passport_underwriting_decisions_total` | counter | `outcome` (approved, denied) | Underwriting outcomes |
| `agent_passport_counterparty_checks_total` | counter | `outcome` (allow, deny) | Counterparty check outcomes |
| `agent_passport_verify_checks_total` | counter | `flag`, `result` | Per-flag /verify outcomes |
| `agent_passport_discovery_searches_total` | counter | `query_class`, `result_count` | /discovery/search calls |
| `agent_passport_idempotency_hits_total` | counter | `path` | Replays served from idempotency cache |
| `agent_passport_idempotency_conflicts_total` | counter | `path` | Same key, different body — 409 |

#### Infrastructure metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_process_cpu_usage_seconds_total` | gauge | — | Process CPU time in seconds |
| `agent_passport_process_cpu_usage_ratio` | gauge | — | Process CPU as ratio of one core (0-1) |
| `agent_passport_process_memory_usage_bytes` | gauge | `type` | Process memory (rss, heapUsed, heapTotal, external, arrayBuffers) |
| `agent_passport_process_uptime_seconds` | gauge | — | Process uptime in seconds |
| `agent_passport_system_memory_bytes` | gauge | `type` (total, free, used) | Host memory |
| `agent_passport_system_load_average` | gauge | `window` (1m, 5m, 15m) | Host load average |

### Label cardinality rules

To keep Prometheus healthy:

- `path` is normalized to the route template — never use the raw
  `req.path` which can include wallet addresses
- `method` is `GET`/`POST`/etc. (bounded)
- `status_class` is `2xx`/`3xx`/`4xx`/`5xx` (bounded)
- `wallet` is **never** a label — use `unique_wallets` gauge
- `error_type` is `client_error`/`server_error` (bounded)
- `outcome` is `approved`/`denied` or `allow`/`deny` (bounded)
- `risk_level` is `low`/`medium`/`high`/`critical` (bounded)
- `network` is `testnet`/`mainnet` (bounded)
- `flag` is `funded`/`active`/`empty`/`lookup_failed` (bounded)

### Scrape configuration

```yaml
scrape_configs:
  - job_name: agent-passport
    metrics_path: /metrics
    scrape_interval: 30s
    scrape_timeout: 10s
    static_configs:
      - targets: ['agent-passport:3000']
```

## 6. SLOs

The SLO files are split by deployment target:

| Deployment | SLO File | Use for |
|------------|---------|---------|
| Testnet, public mainnet endpoint, or any deployment using a public Algorand endpoint | `alerts/slo-prod-relaxed.yml` | Default — recommended for most deployments |
| Mainnet via local Algorand node or premium hosted provider with low latency | `alerts/slo-prod-strict.yml` | For deployments needing 500ms P95 |

### Prod-relaxed SLOs (default, measured)

Based on the k6 load test run against the public Algorand testnet
(AlgoNode free tier):

| SLO | Prod-relaxed target | Measured baseline | 30d window |
|-----|---------------------|-------------------|------------|
| Availability | 99.0% | 99.55% under 1000 VU | yes |
| Latency P95 | < 1.5s | 1.15s (100 VU), 2.27s (1000 VU) | yes |
| Latency P99 | < 3.0s | 2.19s (100 VU), 4.13s (1000 VU) | yes |
| Throughput | > 100 rps | 1,829 rps sustained (500 VU) | rolling 5m |

The prod-relaxed SLOs are realistic for any deployment using a
public Algorand endpoint because:

- AlgoNode's free tier rate-limits at ~1,000 req/s per IP, which
  produces natural 429s
- Round-trips to a remote indexer/algod add 200-800ms latency per
  call
- `/underwrite` makes 4-5 Algorand round-trips, so its P95 is
  bounded by `5 × 800ms = 4s` in the worst case

### Prod-strict SLOs (aspirational)

| SLO | Prod-strict target | Notes |
|-----|-------------------|-------|
| Availability | 99.9% over 30d | Achievable with low-latency Algorand endpoint |
| Latency P95 | < 500ms over 30d | Achievable with a local node, premium hosted provider, or geographic co-location |
| Latency P99 | < 1.5s over 30d | |
| Throughput | > 1,500 rps | Measured under cache-friendly load |

**How to hit the prod-strict targets**: any combination of:

- Local Algorand node (drops per-round-trip from 200-800ms to 5-20ms
  — the single biggest lever)
- Premium hosted mainnet provider (Nodely, BCC, AlgoNode paid tier)
- Geographic co-location with an Algorand relay

The prod-relaxed targets are real, measured, and production-grade.
Switch to prod-strict only if you need 500ms P95 and are willing to
operate the infrastructure for it.

### Per-endpoint latency projections

| Endpoint | Testnet P95 (measured) | Prod-strict P95 (projected) | Algorand calls |
|----------|------------------------|------------------------------|----------------|
| `/score` | 1.1s | 200ms | 2-3 |
| `/delegation` | 1.5s | 300ms | 3-4 |
| `/passport` (cached) | 2.4ms | <5ms | 0 |
| `/passport` (cold) | 1.5s | 400ms | 6-8 |
| `/underwrite` | 2.2s | 500ms | 8-12 |
| `/trust-graph` | 2.0s | 600ms | 10+ |
| `/credit-estimate` | 1.5s | 350ms | 4-5 |
| `/counterparty-check` | 1.1s | 300ms | 3-4 |
| `/reputation` | 1.0s | 250ms | 2 |
| `/verify` | <10ms | <10ms | 0 (cache hit) |
| `/discovery/search` | <5ms | <5ms | 0 (in-memory) |

## 7. Alert-to-runbook map

| Alert | Runbook |
|-------|---------|
| `AgentPassportAPIDown` | `alerts/runbooks/agent-passport-api-down.md` |
| `AlgorandDependencyDown` | `alerts/runbooks/agent-passport-api-down.md` |
| `X402PaymentVerificationFailing` | `alerts/runbooks/x402-verification-failure.md` |
| `ContractIndexingFailure` | `alerts/runbooks/contract-indexing-failure.md` |
| `ContractEventStall` | `alerts/runbooks/contract-indexing-failure.md` |
| `HighErrorRate` | `alerts/runbooks/elevated-error-rate.md` |
| `High5xxRate` | `alerts/runbooks/elevated-error-rate.md` |
| `ElevatedErrorRate` | `alerts/runbooks/elevated-error-rate.md` |
| `ElevatedLatencyP95` | `alerts/runbooks/elevated-latency.md` |
| `ElevatedLatencyP99` | `alerts/runbooks/elevated-latency.md` |
| `ReplayAttackSpike` | `alerts/runbooks/replay-attack-spike.md` |
| `UnusualTrafficPattern` | `alerts/runbooks/unusual-traffic.md` |
| `UnusualGraphGrowth` | `alerts/runbooks/graph-growth.md` |

Runbooks live in `alerts/runbooks/<name>.md`.

## 8. Dashboard

The Grafana dashboard JSON is at `alerts/grafana-dashboard.json`. It
includes:

- API Request Rate (overall and per-endpoint)
- API Latency (P50/P95/P99)
- Error Rate
- Trust Score Latency
- Graph Traversal Latency
- x402 Payments (verified/failures/replay)
- Contract Events (endorsements/revocations/disputes/success)
- Process Memory (heap/RSS)
- Process Uptime
- Passports Generated
- Unique Wallets
- Cache Performance (hits/misses/evictions)

## 9. System exposure cap

- `MAX_SYSTEM_EXPOSURE = 100_000` USDC (hard-coded)
- Per-wallet cap: `MAX_SYSTEM_EXPOSURE / 10 = 10_000` USDC
- Persisted to `data/system-exposure.json` via `json-store.ts`
  write-queue mutex
- `capToSystemCapacity(wallet, limit)` returns `min(limit,
  globalRemaining, walletRemaining)` — the final amount reserved

Multi-replica needs Redis (or accept the overshoot) — the JSON file
is per-process.

## 10. Load testing

k6 suite under `load-tests/`. Run via:

```bash
brew install k6
cd load-tests
LOAD_TEST_MODE=1 ./run-all.sh
```

Four scenarios: 100 VU, 500 VU, 1000 VU, and sustained 12 rps. The
sustained scenario is a smoke test that always passes; the VU
scenarios require a local Algorand node to hit P95 < 1.5s.

Thresholds:

- Error rate: < 1%
- P95 latency: < 1.5s (prod-relaxed), < 500ms (prod-strict)
- Throughput: documented per scenario

## 11. Graceful shutdown

The service registers signal handlers in `src/index.ts:38-46` and a
matching cleanup hook in `src/app.ts`.

### Signal handlers

| Signal | Handler | Effect |
|--------|---------|--------|
| `SIGTERM` | `gracefulShutdown('SIGTERM')` | Drain in-flight HTTP, force exit after 10s |
| `SIGINT` | `gracefulShutdown('SIGINT')` | Same as `SIGTERM` |
| `unhandledRejection` | log | Log only — does not exit |
| `uncaughtException` | log + `process.exit(1)` | Log and exit immediately |

### Shutdown flow for `SIGTERM` / `SIGINT`

1. Log "Received SIGTERM/SIGINT, shutting down gracefully".
2. Call `server.close()` — Express stops accepting new connections
   and drains in-flight requests.
3. Set a 10-second `setTimeout` — if `server.close()` does not
   complete, log "Forced shutdown after timeout" and call
   `process.exit(1)`.
4. On `server.close()` callback, log "HTTP server closed" and call
   `process.exit(0)`.

### Resources stopped on shutdown

`stopMetricsCollectors` — clears the 15s `setInterval` for
process gauges. `stopRateLimiter` — clears the 5-min cleanup
interval. `stopIdempotencySweeper` — clears the 5-min idempotency
sweeper. `stopDedupCleanup` — clears the reputation dedup cleanup.
`closeLoggerStreams` — closes the log file streams.

All `setInterval` timers are `.unref()`-ed so they do not block
process exit on their own.

### Kubernetes shutdown order

Kubernetes sends `SIGTERM` first, then `SIGKILL` after
`terminationGracePeriodSeconds` (default 30s). Configure the pod:

```yaml
terminationGracePeriodSeconds: 30
```

to give the service time to drain. The 10s `setTimeout` in
`gracefulShutdown` is the inner bound; the 30s K8s limit is the
outer bound.