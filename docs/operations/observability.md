# Observability

This document describes the production observability surface for
Agent Passport: metrics emitted, label cardinality rules, SLOs,
alert-to-runbook mapping, and scrape configuration.

## 1. Metrics Endpoint

The service exposes Prometheus-format metrics at `GET /metrics`.
This endpoint is:

- **Exempt from rate limiting** (operational)
- **Always returns 200** unless the process is severely broken
- **Refreshes process gauges** on every scrape (memory, CPU, uptime)

```
curl http://localhost:3000/metrics
```

## 2. Metric Inventory

### 2.1 API Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_http_requests_total` | counter | `method`, `path`, `status` | Total HTTP requests |
| `agent_passport_http_request_duration_seconds` | histogram | `method`, `path`, `status` | Request duration in seconds |
| `agent_passport_http_request_errors_total` | counter | `method`, `path`, `status`, `error_type` | 4xx/5xx errors |

Buckets for `http_request_duration_seconds`: 0.005, 0.01, 0.025,
0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10

### 2.2 Trust Engine Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_trust_score_generations_total` | counter | `risk_level` | Trust score computations, by risk bucket |
| `agent_passport_trust_score_duration_seconds` | histogram | — | Trust score computation duration |
| `agent_passport_graph_traversal_duration_seconds` | histogram | — | Graph traversal duration |
| `agent_passport_graph_traversal_depth` | histogram | — | Graph traversal depth (hops) |
| `agent_passport_graph_traversal_depth_sum` | counter | — | Cumulative graph traversal depth (used by `UnusualGraphGrowth` alert) |

### 2.3 x402 Payment Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_x402_payments_verified_total` | counter | `status`, `path` | Successful verifications |
| `agent_passport_x402_payment_failures_total` | counter | `reason`, `path` | Failed verifications |
| `agent_passport_x402_replay_attempts_total` | counter | `path` | Replay attack attempts |
| `agent_passport_x402_settlement_failures_total` | counter | `reason` | Settlement failures |
| `agent_passport_x402_verification_duration_seconds` | histogram | — | Verification latency |

### 2.4 Contract Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_contract_endorsements_total` | counter | — | On-chain endorsements |
| `agent_passport_contract_revocations_total` | counter | — | On-chain revocations |
| `agent_passport_contract_disputes_total` | counter | — | On-chain disputes |
| `agent_passport_contract_success_events_total` | counter | — | On-chain success events |
| `agent_passport_contract_event_stall_seconds` | gauge | — | Seconds since last contract event |

### 2.5 Infrastructure Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_process_cpu_usage_seconds_total` | gauge | — | Process CPU time in seconds |
| `agent_passport_process_cpu_usage_ratio` | gauge | — | Process CPU as ratio of one core (0-1) |
| `agent_passport_process_memory_usage_bytes` | gauge | `type` (rss, heapUsed, heapTotal, external, arrayBuffers) | Process memory |
| `agent_passport_process_uptime_seconds` | gauge | — | Process uptime in seconds |
| `agent_passport_system_memory_bytes` | gauge | `type` (total, free, used) | Host memory |
| `agent_passport_system_load_average` | gauge | `window` (1m, 5m, 15m) | Host load average |
| `agent_passport_cache_hits_total` | counter | `cache_name` | Cache hits |
| `agent_passport_cache_misses_total` | counter | `cache_name` | Cache misses |
| `agent_passport_cache_evictions_total` | counter | `cache_name` | Cache evictions |
| `agent_passport_cache_size` | gauge | `cache_name` | Current cache size |

### 2.6 Business Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_passports_generated_total` | counter | — | Total passports generated |
| `agent_passport_paid_requests_total` | counter | `path` | x402-paid requests |
| `agent_passport_unique_wallets` | gauge | — | Distinct wallets seen since process start |
| `agent_passport_trust_checks_total` | counter | `type` (score, delegation, sybil-check, reputation) | Trust check operations |
| `agent_passport_underwriting_decisions_total` | counter | `outcome` (approved, denied) | Underwriting outcomes |
| `agent_passport_counterparty_checks_total` | counter | `outcome` (allow, deny) | Counterparty check outcomes |

### 2.7 Idempotency Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `agent_passport_idempotency_hits_total` | counter | `path` | Replays served from idempotency cache |
| `agent_passport_idempotency_conflicts_total` | counter | `path` | Same key, different body — 409 returned |

## 3. Label Cardinality Rules

To keep Prometheus healthy, follow these rules:

- `path` is normalized in the middleware (`/score`, `/passport`, etc.)
  — never use the raw `req.path` which can include wallet addresses
- `method` is `GET` or `POST` (or others, but bounded)
- `status` is the HTTP status code as string (`200`, `404`, `500`, etc.)
  — bounded
- `wallet` is **never** a label. Use `unique_wallets` gauge for
  distinct count
- `error_type` is `client_error` or `server_error` — bounded
- `outcome` is `approved`/`denied` or `allow`/`deny` — bounded
- `risk_level` is `low`/`medium`/`high`/`critical` — bounded

## 4. SLOs

The SLO files are split by deployment target:

| Deployment | SLO File | Use for |
|------------|---------|---------|
| Testnet, public mainnet endpoint, or any deployment using a public Algorand endpoint | `alerts/slo-prod-relaxed.yml` | Default — recommended for most deployments |
| Mainnet via local Algorand node or premium hosted provider with low latency | `alerts/slo-prod-strict.yml` | For deployments needing 500ms P95 |
| (this is just an index) | `alerts/slo.yml` | Pointer to the right file |

### Prod-relaxed SLOs (default, measured)

Based on the k6 load test run on 2026-06-25 against the public
Algorand testnet (AlgoNode free tier):

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

Based on the k6 testnet data + low-latency estimate:

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

## 5. Scrape Configuration

```yaml
scrape_configs:
  - job_name: agent-passport
    metrics_path: /metrics
    scrape_interval: 30s
    scrape_timeout: 10s
    static_configs:
      - targets: ['agent-passport:3000']
```

## 6. Alert-to-Runbook Map

| Alert | Runbook |
|-------|---------|
| `AgentPassportAPIDown` | [../../alerts/runbooks/agent-passport-api-down.md](../../alerts/runbooks/agent-passport-api-down.md) |
| `X402PaymentVerificationFailing` | [../../alerts/runbooks/x402-verification-failure.md](../../alerts/runbooks/x402-verification-failure.md) |
| `ContractIndexingFailure` | [../../alerts/runbooks/contract-indexing-failure.md](../../alerts/runbooks/contract-indexing-failure.md) |
| `HighErrorRate` | [../../alerts/runbooks/elevated-error-rate.md](../../alerts/runbooks/elevated-error-rate.md) |
| `ElevatedLatencyP95` | [../../alerts/runbooks/elevated-latency.md](../../alerts/runbooks/elevated-latency.md) |
| `ElevatedLatencyP99` | [../../alerts/runbooks/elevated-latency.md](../../alerts/runbooks/elevated-latency.md) |
| `ElevatedErrorRate` | [../../alerts/runbooks/elevated-error-rate.md](../../alerts/runbooks/elevated-error-rate.md) |
| `ReplayAttackSpike` | [../../alerts/runbooks/replay-attack-spike.md](../../alerts/runbooks/replay-attack-spike.md) |
| `UnusualTrafficPattern` | [../../alerts/runbooks/unusual-traffic.md](../../alerts/runbooks/unusual-traffic.md) |
| `UnusualGraphGrowth` | [../../alerts/runbooks/graph-growth.md](../../alerts/runbooks/graph-growth.md) |
| `High5xxRate` | [../../alerts/runbooks/elevated-error-rate.md](../../alerts/runbooks/elevated-error-rate.md) |
| `AlgorandDependencyDown` | [../../alerts/runbooks/agent-passport-api-down.md](../../alerts/runbooks/agent-passport-api-down.md) |
| `ContractEventStall` | [../../alerts/runbooks/contract-indexing-failure.md](../../alerts/runbooks/contract-indexing-failure.md) |

See [runbooks.md](runbooks.md) for the full index.

## 7. Dashboard

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
