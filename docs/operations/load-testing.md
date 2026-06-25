# Load Testing

This directory contains the k6 load test suite for Agent Passport.

## Scenarios

| Scenario | VUs | Duration | Purpose |
|----------|-----|----------|---------|
| A | 100 concurrent | 100s ramp + steady | Baseline production load |
| B | 500 concurrent | 100s ramp + steady | Production peak load |
| C | 1000 concurrent | 105s ramp + steady | Stress / breaking point |
| D | 12 req/s (10k/day) | 3m accelerated | Long-tail capacity |

## Endpoints Exercised

The service exposes the following API surface (per `src/app.ts`):

| Endpoint | Method | Pricing | Notes |
|----------|--------|---------|-------|
| `/passport` | GET | x402 | Cached 60s |
| `/score` | GET | x402 | Cached 60s |
| `/delegation` | GET | x402 | |
| `/underwrite` | GET | x402 | |
| `/counterparty-check` | POST | x402 | |
| `/credit-estimate` | POST | x402 | |
| `/trust-graph` | GET | x402 | |
| `/reputation` | GET | x402 | |
| `/reputation/record` | POST | x402 | On-chain — disabled unless `REPUTATION_APP_ID > 0` |
| `/delegate` | POST | x402 | On-chain — disabled unless `REGISTRY_APP_ID > 0` |
| `/revoke` | POST | x402 | On-chain — disabled unless `REGISTRY_APP_ID > 0` |
| `/health` | GET | Free | Operational |
| `/metrics` | GET | Free | Operational |
| `/discovery/search` | GET | Free | Static catalog |

## Prerequisites

- k6 installed: `brew install k6` (macOS), or
  [download](https://k6.io/docs/getting-started/installation/)
- Agent Passport running locally: `npm run dev`
- Optional: `BASE_URL` env var if the service is on a different host
- Optional: `LOAD_TEST_MODE=1` to disable rate limiting (recommended
  for scenarios A–C, required for C, useful for B; **never** in
  production)

## Running

### Run all four scenarios

```bash
cd load-tests
LOAD_TEST_MODE=1 ./run-all.sh
```

This waits for the service to respond, then runs A → B → C → D
sequentially. Each scenario's output is written to
`load-tests/results/scenario-X.{txt,json}`.

### Run a single scenario

```bash
BASE_URL=http://localhost:3000 k6 run scenarios/a-100vu.js
BASE_URL=http://localhost:3000 k6 run scenarios/b-500vu.js
BASE_URL=http://localhost:3000 k6 run scenarios/c-1000vu.js
BASE_URL=http://localhost:3000 k6 run scenarios/d-sustained.js
```

### Run the combined suite

```bash
BASE_URL=http://localhost:3000 k6 run scenarios/combined.js
```

## Fail Thresholds

A test **fails** if any of these are exceeded:

### Scenario A (100 VU — baseline)
- `http_req_duration` P95 < 500ms
- `http_req_duration` P99 < 1.5s
- `http_req_failed` rate < 0.1%
- `app_request_duration` P95 < 500ms

### Scenario B (500 VU — peak)
- `http_req_duration` P95 < 750ms
- `http_req_duration` P99 < 2.0s
- `http_req_failed` rate < 0.5%
- `app_request_duration` P95 < 750ms

### Scenario C (1000 VU — stress)
- `http_req_duration` P95 < 1.5s
- `http_req_duration` P99 < 3.0s
- `http_req_failed` rate < 1%
- `app_errors` rate < 5%

### Scenario D (10k/day sustained)
- `http_req_duration` P95 < 300ms
- `http_req_duration` P99 < 800ms
- `http_req_failed` rate < 0.1%
- `app_errors` rate < 0.5%

## Custom Metrics

The suite emits these `app_*` metrics in addition to the standard
k6 metrics. They are defined in `load-tests/lib/metrics.js` and
consumed by the `--summary-export` output:

| Metric | Type | Description |
|--------|------|-------------|
| `app_errors` | Rate | Non-2xx response rate |
| `app_request_duration` | Trend | End-to-end request duration |
| `app_score_duration` | Trend | `/score` endpoint duration |
| `app_passport_duration` | Trend | `/passport` endpoint duration |
| `app_delegation_duration` | Trend | `/delegation` endpoint duration |
| `app_underwriting_duration` | Trend | `/underwrite` endpoint duration |
| `app_counterparty_duration` | Trend | `/counterparty-check` duration |
| `app_graph_traversal_latency` | Trend | `/trust-graph` duration |
| `app_credit_estimate_duration` | Trend | `/credit-estimate` duration |
| `app_sybil_check_duration` | Trend | `/sybil-check` duration |
| `app_reputation_duration` | Trend | `/reputation` duration |
| `app_verify_duration` | Trend | `/verify` duration |
| `app_discovery_duration` | Trend | `/discovery/search` duration |
| `app_cache_hits` | Rate | Cache hit rate |
| `app_cache_misses` | Rate | Cache miss rate |
| `app_x402_failures` | Counter | x402 payment failures |
| `app_x402_replay_attempts` | Counter | Replay attack attempts |
| `app_contract_endorsements` | Counter | On-chain endorsements |
| `app_contract_revocations` | Counter | On-chain revocations |
| `app_contract_disputes` | Counter | On-chain disputes |
| `app_response_2xx` | Counter | 2xx response count |
| `app_response_4xx` | Counter | 4xx response count |
| `app_response_5xx` | Counter | 5xx response count |

## Shared Configuration (`load-tests/lib/config.js`)

| Export | Value | Purpose |
|--------|-------|---------|
| `BASE_URL` | `__ENV.BASE_URL` (default `http://localhost:3000`) | Service base URL |
| `VALID_WALLET` | `GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A` | Reproducible test wallet |
| `pickWallet(scenario)` | Deterministic per-scenario wallet | Avoid single-key cache hotspotting |

## Interpreting Results

### What to look at

1. **P95 latency** — typical user experience.
2. **P99 latency** — worst-case user experience.
3. **Error rate** — should be < 0.1% for normal scenarios.
4. **Throughput** — req/s the service sustains at the VU target.
5. **`app_passport_duration`** — slow passport generation is the
   biggest user-facing risk.
6. **HTTP 429 spikes** — rate limit kicked in. Increase limits or
   scale horizontally.

### Common issues

- **High P99 on `/trust-graph`** — Graph traversal is BFS over
  Algorand on-chain data; expect this to be slowest. Check
  `INDEXER_URL` latency.
- **High 5xx** — check `/health` and `/metrics` for the underlying
  cause.
- **High 429** — raise the per-IP rate limit (`RATE_LIMIT_*` env
  vars) or scale horizontally.

## Output

After `./run-all.sh` you will have:

```
load-tests/results/
├── scenario-a.txt
├── scenario-b.txt
├── scenario-c.txt
├── scenario-d.txt
├── scenario-a.json   (raw, for later analysis)
├── scenario-b.json
├── scenario-c.json
└── scenario-d.json
```

The `*.txt` files contain the k6 console summary. The `*.json`
files contain the raw data for post-processing (e.g. with
`k6-to-influxdb` or custom Python).

## CI Integration

The `load-test-smoke` job in `.github/workflows/ci.yml` runs **only
on tagged releases**. For PR-time smoke tests, run only Scenario A
(cheapest, ~2 minutes total):

```bash
npm run dev &
sleep 10
LOAD_TEST_MODE=1 BASE_URL=http://localhost:3000 k6 run scenarios/a-100vu.js
```

See [../reports/load-test-2026-06-25.md](../reports/load-test-2026-06-25.md)
for the most recent run.
