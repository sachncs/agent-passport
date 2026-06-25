# Agent Passport: Delegated Trust Infrastructure

A stateless, pay-per-query trust and underwriting API for AI agents, using
delegated-underwriting and x402 micropayments on Algorand.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](.github/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](package.json)
[![Node ≥ 20](https://img.shields.io/badge/node-%E2%89%A520-339933.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](tsconfig.json)
[![Algorand](https://img.shields.io/badge/Algorand-testnet%20%7C%20mainnet-000000.svg)](https://developer.algorand.org)
[![x402](https://img.shields.io/badge/x402-payment--enabled-FF6B6B.svg)](https://x402.org)
[![Tests](https://img.shields.io/badge/tests-1%2C206%20passing-brightgreen.svg)](#development)
[![Stars](https://img.shields.io/github/stars/sachn-cs/agent-passport?style=social)](https://github.com/sachn-cs/agent-passport/stargazers)

> **TL;DR** — `npm install && cp .env.example .env && npm start` and you have
> a trust-scoring API at `http://localhost:3000`, pointed at the public
> Algorand testnet. No database, no wallet, no signup.

---

## Features

- **Composite trust score (0–100)** with explainable sub-scores: age, sponsor
  quality, activity, sybil risk, velocity, compliance
- **Delegated trust graph** with cycle detection, depth attenuation, and
  quality-weighted sponsor counts
- **Underwriting decisions** with credit capacity estimation, default
  propagation, and 10% earned-credit rewards
- **Sybil detection** across 7 heuristics: clustering, timing, amount
  fingerprint, funding correlation, balance similarity, interaction
  density, circular activity
- **On-chain reputation events** recorded via the
  [`registry.teal`](contracts/registry.teal) and
  [`reputation.teal`](contracts/reputation.teal) Algorand contracts
- **Optional x402 micropayments** — pay-per-query in USDC, settled
  on-chain, with replay protection
- **Stateless service** — every request fetches data from Algorand and
  caches it in-memory for 60s. No database, no message queue, no shared
  state. Scale horizontally by adding pods.
- **Production-grade observability** — 38 Prometheus metrics, 24+ alert
  rules, 17-panel Grafana dashboard, 8 runbooks, two SLO profiles
  (`slo-prod-relaxed`, `slo-prod-strict`)
- **First-class SDKs** — TypeScript (`@agent-passport/sdk`) and Python
  (`agent-passport-sdk`), both with typed errors, idempotency helpers,
  and x402 payment callbacks
- **Security hardened** — Helmet headers, 600 req/min/IP rate limit,
  CORS, 100 KB body limit, 30 s request timeout, per-request UUID,
  `Idempotency-Key` middleware, on-chain payment verification

---

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [x402 Payment Flow](#x402-payment-flow)
- [Trust Scoring](#trust-scoring)
- [Sponsor Graph](#sponsor-graph)
- [Security](#security)
- [Development](#development)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)
- [Deployment](#deployment)
- [Observability](#observability)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [Security](#security-1)
- [FAQ](#faq)
- [License](#license)

---

## Installation

```bash
git clone https://github.com/sachn-cs/agent-passport.git
cd agent-passport
npm install
cp .env.example .env
npm start
```

By default this points at the public Algorand testnet — no setup beyond the
env file is needed. Server runs at `http://localhost:3000`.

For development with hot reload:

```bash
npm run dev
```

For Docker:

```bash
docker build -t agent-passport:0.1.0 .
docker run --rm -p 3000:3000 --env-file .env agent-passport:0.1.0
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Kubernetes, multi-replica,
and observability setup.

## Usage

### 1. Confirm the service is up

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"Agent Passport", ...}
```

### 2. Score a wallet

```bash
curl -s "http://localhost:3000/score?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX" | jq
```

```json
{
  "wallet": "GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX",
  "trustScore": 78,
  "riskLevel": "low",
  "approved": true,
  "recommendedLimit": 585,
  "breakdown": { "ageScore": 82, "activityScore": 65, "...": "..." },
  "explanation": ["1+ year wallet history", "..."]
}
```

### 3. Generate a full passport

```bash
curl -s "http://localhost:3000/passport?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX" | jq
```

### 4. Make an underwriting decision

```bash
curl -s "http://localhost:3000/underwrite?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX" | jq
```

### 5. Use the TypeScript SDK

```bash
npm install @agent-passport/sdk
```

```typescript
import { AgentPassportClient } from '@agent-passport/sdk';

const client = new AgentPassportClient({ baseUrl: 'http://localhost:3000' });
const score = await client.getScore('GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX');
console.log(score.trustScore, score.riskLevel);
```

### 6. Use the Python SDK

```bash
pip install agent-passport-sdk
```

```python
from agent_passport import AgentPassportClient

client = AgentPassportClient(base_url="http://localhost:3000")
score = client.get_score("GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX")
print(score["trustScore"], score["riskLevel"])
```

A complete walkthrough is in [docs/getting-started.md](docs/getting-started.md).

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env`
and edit as needed. **Never commit `.env`** — it is already in `.gitignore`.

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `ALGOD_URL` | `https://testnet-api.algonode.cloud:443` | Algod endpoint (testnet, mainnet, or local) |
| `INDEXER_URL` | `https://testnet-idx.algonode.cloud:443` | Indexer endpoint |
| `ALGOD_TOKEN` | `''` | Algod API token (for non-public endpoints) |
| `INDEXER_TOKEN` | `''` | Indexer API token (for non-public endpoints) |
| `ALGO_NETWORK` | `testnet` | Display only — for documentation and metrics labels |

### On-chain

| Variable | Default | Description |
|----------|---------|-------------|
| `REGISTRY_APP_ID` | `0` | Registry contract app ID. Must be > 0 to enable `/delegate` and `/revoke` |
| `REPUTATION_APP_ID` | `0` | Reputation contract app ID |
| `OPERATOR_MNEMONIC` | — | 25-word Algorand mnemonic for the operator wallet. **Use a secret manager; never commit** |

### x402 Monetization

| Variable | Default | Description |
|----------|---------|-------------|
| `X402_ENABLED` | `false` | Set to `true` to require x402 payment on premium endpoints |
| `X402_FACILITATOR_URL` | `https://x402.org/facilitator` | x402 facilitator |
| `X402_PAYMENT_RECIPIENT` | — | Algorand address that receives USDC payments (required when `X402_ENABLED=true`) |
| `X402_NETWORK` | `eip155:84532` | x402 network identifier |

### Traffic & security

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_MAX` | `600` | Max requests per IP per minute |
| `RATE_LIMIT_TRUSTED_IPS` | — | Comma-separated IPs exempted from rate limiting (internal services, operator hosts) |
| `RATE_LIMIT_PERSISTENCE_PATH` | `data/rate-limit.json` | Where to persist rate-limit state across restarts |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated origins, or `*` for all |
| `REQUEST_TIMEOUT_MS` | `30000` | Per-request timeout in milliseconds |
| `LOAD_TEST_MODE` | `0` | Set to `1` to disable rate limiting (load testing only — **never** in production) |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_FILE` | — | Path to log file (optional) |
| `LOG_ERROR_FILE` | — | Path to error log file (optional) |

See [.env.example](.env.example) for the full file with comments.

## Project Structure

```
src/
├── index.ts                    # Express server entry point
├── app.ts                      # Express app, middleware stack, all routes
├── config.ts                   # Environment variable parsing
├── trust-score.ts              # Trust score computation
├── delegation.ts               # Delegation trust scoring
├── counterparty.ts             # Counterparty check
├── credit.ts                   # Credit capacity estimation
├── sybil.ts                    # Sybil detection
├── reputation.ts               # Reputation event recording
├── underwriting.ts             # Underwriting decision
├── trust-graph.ts              # Trust graph analytics
├── passport.ts                 # Agent Passport document generation
├── registry.ts                 # On-chain delegation/revocation service
├── __tests__/                  # Test suites (1012 tests)
│   ├── e2e/                    # E2E test suite (140 tests, 17 flows)
│   ├── registry.test.ts
│   ├── metrics.test.ts
│   ├── *.test.ts               # Service-level tests
│   └── lib/                    # lib/ test suite
├── lib/
│   ├── algorand-client.ts      # Algorand algod singleton
│   ├── cache.ts                # LRU cache with TTL
│   ├── constants.ts            # Wallet regex, pricing, time constants
│   ├── graph.ts                # Cycle detection, BFS traversal
│   ├── idempotency.ts          # Idempotency-Key middleware
│   ├── logger.ts               # Structured JSON logging
│   ├── metrics.ts              # Prometheus registry + 38 metrics
│   ├── metrics-collectors.ts   # Background CPU/mem/load collectors
│   ├── operator-wallet.ts      # On-chain transaction signing
│   ├── security.ts             # Rate limiter, CORS, request ID
│   ├── system-exposure.ts      # Cumulative credit exposure
│   ├── timeout.ts              # Promise/fetch timeout helpers
│   └── x402.ts                 # x402 payment middleware + settlement
sdk/
├── src/                        # TypeScript SDK
│   ├── index.ts                # AgentPassportClient
│   ├── errors.ts               # 10 typed error classes
│   ├── types.ts                # Response type definitions
│   ├── retry.ts                # Exponential backoff
│   └── __tests__/              # 22 tests
├── python/                     # Python SDK
│   └── agent_passport/         # Package layout
│       ├── client.py
│       ├── errors.py
│       ├── types.py
│       ├── retry.py
│       └── tests/              # 32 tests
load-tests/                     # k6 load test suite
├── scenarios/                   # 4 k6 scenarios + combined
├── lib/                         # k6 helpers
├── results/                     # k6 output (full-{a,b,c,d}.txt + .json)
├── EXECUTION.md                 # Run instructions
└── REPORT.template.md
alerts/                         # Prometheus + Alertmanager config
├── alert-rules.yml             # 20 alert rules
├── slo-prod-relaxed.yml        # Default SLOs (testnet/hosted)
├── slo-prod-strict.yml         # Aspirational SLOs (low-latency)
├── grafana-dashboard.json      # 17 panels
├── alertmanager.yml            # Receiver routing
├── runbooks/                    # 8 runbooks
├── prometheus-scrape.yml       # Scrape config
└── escalation-policy.yml
docs/                           # Documentation
├── getting-started.md          # 5-minute onboarding
├── ARCHITECTURE.md             # System design
├── API.md                      # API reference
├── SECURITY.md                 # Security model
├── TRUST-SCORING.md            # Trust algorithm
├── DEPLOYMENT.md               # Production deployment guide
├── OBSERVABILITY.md            # Metrics, SLOs, alerts
├── openapi.yaml                # OpenAPI 3.0 spec
├── postman-collection.json     # Postman collection
├── bazaar-metadata.json        # Bazaar discovery metadata
├── SANCTIONS-INTEGRATION.md    # Sanctions screening providers
├── faq.md                      # Frequently asked questions
└── REPORT.md                   # Production-readiness audit
contracts/                      # Algorand TEAL contracts
├── registry.teal               # Delegation registry
└── reputation.teal             # Reputation events
```

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Merchant /  │────▶│  Agent Passport  │────▶│  Algorand    │
│  AI Agent    │     │  API (Express)   │     │  (any)       │
└──────────────┘     └────────┬─────────┘     └──────────────┘
                              │
                     ┌────────▼─────────┐
                     │  /metrics         │
                     │  Prometheus       │
                     └──────────────────┘
```

Fully stateless — no database, no message queue. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design.

## API Endpoints

### Premium (x402 Payment Required when `X402_ENABLED=true`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/passport?wallet=...` | Full trust profile with scores, risk level, and explanations |
| `GET` | `/score?wallet=...` | Trust score only |
| `GET` | `/delegation?wallet=...` | Delegation trust |
| `GET` | `/underwrite?wallet=...` | Credit decision with capacity and default analysis |
| `GET` | `/trust-graph?wallet=...` | Trust graph analytics |
| `GET` | `/sybil-check?wallet=...` | Sybil risk analysis |
| `GET` | `/reputation?wallet=...` | Reputation lookup |
| `POST` | `/counterparty-check` | Merchant-facing trust lookup |
| `POST` | `/credit-estimate` | Credit capacity estimation |
| `POST` | `/reputation/record` | Record a reputation event |
| `POST` | `/delegate` | Sponsor delegates credit to agent (on-chain) |
| `POST` | `/revoke` | Revoke a delegation (on-chain) |

### Free

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/verify?wallet=...` | Lightweight wallet validity check with on-chain flags (funded, active) |
| `GET` | `/discovery/search?q=trust&limit=20` | Bazaar service discovery — search by name, description, category, or tag |
| `GET` | `/health` | Liveness probe — always 200 unless the process is broken |
| `GET` | `/ready` | Readiness probe — 200 if Algorand reachable, 503 if not |
| `GET` | `/health/deep` | Health with Algorand status in body (always 200) |
| `GET` | `/metrics` | Prometheus metrics (operational) |
| `GET` | `/registry/status` | On-chain registry configuration status |

See [docs/API.md](docs/API.md) and [docs/openapi.yaml](docs/openapi.yaml) for
complete request/response schemas.

## x402 Payment Flow

```
Client                Server                 Algorand
  │                     │                       │
  │  GET /passport      │                       │
  │────────────────────▶│                       │
  │                     │                       │
  │  402 + requirements │                       │
  │◀────────────────────│                       │
  │                     │                       │
  │  [Pay USDC to payTo]│                       │
  │────────────────────────────────────────────▶│
  │                     │                       │
  │  GET /passport      │                       │
  │  + x-payment        │                       │
  │────────────────────▶│  Verify on-chain      │
  │                     │──────────────────────▶│
  │                     │◀──────────────────────│
  │  200 + trust profile│                       │
  │◀────────────────────│
```

The `x-payment` header format:

```
x-payment: <paymentToken> <transactionId> [network]
```

## Trust Scoring

Composite score from weighted sub-scores:

| Component | Weight | Description |
|-----------|-------:|-------------|
| Age | 0.20 | Linear + logarithmic ramp over 730 days |
| Sponsor | 0.25 | Average sponsor trust score + count bonus |
| Activity | 0.20 | Transaction volume and consistency |
| Risk | 0.15 | Sybil risk penalty |
| Velocity | 0.10 | Spike detection vs historical average |
| Compliance | 0.10 | Sanctions, mixer, scam flag penalties |

| Risk Level | Score Range |
|------------|-------------|
| `low` | 70-100 |
| `medium` | 45-69 |
| `high` | 20-44 |
| `critical` | 0-19 |

See [docs/TRUST-SCORING.md](docs/TRUST-SCORING.md) for algorithm details.

## Sponsor Graph

```
SEED_A (budget: 10000) ──3000──▶ SPONSOR_X ──500──▶ AGENT_Z
                                        └──300──▶ AGENT_W
SEED_B (budget: 5000)  ──2000──▶ SPONSOR_Y ────400──▶ AGENT_V
                                        └──200──▶ AGENT_Z
```

**Credit Capacity:** `baseBudget + earnedCredit + incoming - outgoing`

**Default Propagation:** Losses distribute proportionally up the sponsor chain.

**Earned Credit:** Grows at 10% of repayments, capped at 5x base + incoming.

## Security

- **Payment verification** — on-chain USDC transfer confirmation
- **Caller identity** — payer derived from verified transaction sender
- **Idempotency** — `Idempotency-Key` header for safe retries of mutating calls
- **Authorization** — `/delegate` and `/revoke` restricted to the configured operator wallet
- **Rate limiting** — 600 req/min/IP by default, with `RATE_LIMIT_TRUSTED_IPS` bypass for internal services
- **Input validation** — base32 wallet regex, 100KB body limit, 30s request timeout
- **Helmet** — standard security headers (HSTS, X-Content-Type-Options, X-Frame-Options)
- **Request ID propagation** — every request gets a UUID, returned via `X-Request-ID` header
- **CORS** — configurable via `CORS_ALLOWED_ORIGINS`
- **Fraud detection** — velocity, sybil clustering, sanctions proximity (in trust scoring)

See [docs/SECURITY.md](docs/SECURITY.md) for the full threat model.

## Development

```bash
npm run dev              # Start with hot reload
npm run build            # Build TypeScript
npm run typecheck        # Type checking
npm test                 # Run all tests (1,206 passing)
SKIP_E2E=1 npm test      # Skip E2E tests that hit the real testnet
npm run lint             # ESLint
npm run benchmark        # Performance benchmark
```

### TypeScript SDK

```bash
cd sdk
npm install
npm test
npm run build
```

### Python SDK

```bash
cd sdk/python
pip install -e ".[dev]"
pytest
```

### Load tests

```bash
brew install k6         # macOS
npm run dev &           # in another terminal
cd load-tests
./run-all.sh
```

See [load-tests/EXECUTION.md](load-tests/EXECUTION.md) for thresholds and
output interpretation.

## Tech Stack

### Service

- **Runtime:** Node.js ≥ 20
- **Language:** TypeScript (strict mode)
- **Framework:** [Express 4](https://expressjs.com)
- **Security:** [Helmet](https://helmetjs.github.io), CORS, custom rate
  limiter with persistent state
- **Validation:** [Zod](https://zod.dev)
- **Algorand:** [algosdk](https://github.com/algorand/js-algorand-sdk)
- **Payments:** [x402](https://x402.org) (`@x402/core`, `@x402/express`)
- **Metrics:** [prom-client](https://github.com/siimon/prom-client)
- **Tests:** [Vitest](https://vitest.dev), [Supertest](https://github.com/ladjs/supertest)
- **Lint:** [ESLint](https://eslint.org) (flat config)
- **Container:** Docker (multi-stage, non-root, healthcheck)

### SDKs

- **TypeScript:** TypeScript 5.6, native `fetch`, no runtime dependencies
  beyond `zod`
- **Python:** Python 3.9+, `requests`, dataclasses, type hints

### Smart contracts

- **Language:** [TEAL](https://developer.algorand.org/docs/get-details/dapps/avm/teal/)
  (Algorand v10)

### Observability

- **Metrics:** Prometheus (`/metrics`)
- **Alerts:** Prometheus alert rules, Alertmanager routing
- **Dashboards:** Grafana JSON (17 panels)
- **Load testing:** [k6](https://k6.io)

## Roadmap

- [x] Stateless trust scoring service (v0.1.0)
- [x] TypeScript SDK with typed errors, retries, idempotency
- [x] Python SDK with the same surface
- [x] On-chain delegation registry (TEAL contract)
- [x] x402 pay-per-query integration
- [x] Prometheus metrics + Alertmanager rules + Grafana dashboard
- [x] k6 load tests against the public testnet (724,889 requests, 4 scenarios)
- [x] Production deployment guide (Kubernetes, env tuning, SLOs)
- [ ] Sanctions screening provider integration (Chainalysis / Elliptic) — see [docs/SANCTIONS-INTEGRATION.md](docs/SANCTIONS-INTEGRATION.md)
- [ ] Redis-backed idempotency store for multi-replica deployments
- [ ] Webhook subscriptions for reputation event consumers
- [ ] gRPC interface alongside HTTP
- [ ] Multi-chain adapters (Ethereum, Solana)
- [ ] Public Bazaar listing & discoverability metadata
- [ ] Helm chart for one-command Kubernetes deployment
- [ ] OpenAPI → SDK code generation (release-please automation)

Have an idea? [Open a feature request](https://github.com/sachn-cs/agent-passport/issues/new?template=feature_request.md).

## Deployment

The service is **production-ready** and fully stateless. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full checklist.

**TL;DR**: the default deployment works against the public Algorand testnet
out of the box. To deploy to mainnet, update `ALGOD_URL` and `INDEXER_URL`
to a mainnet endpoint (AlgoNode, a hosted provider, or your own node). For
tighter SLOs (P95 < 500ms), use a low-latency endpoint.

The k6 load test on 2026-06-25 against testnet measured:
- 0% errors at 100 VU and 500 VU
- 0.45% errors at 1000 VU (Algorand testnet rate-limiting, not service bugs)
- 1,829 rps sustained at 500 VU
- P95 < 1.5s for cache-friendly endpoints

## Observability

38 Prometheus metrics exposed at `/metrics` including:
- HTTP request count, latency, error rate (per method/path/status)
- Trust score computation latency, graph traversal latency
- x402 payment verification, replay attempts, settlement failures
- Contract event counters (endorsements, revocations, disputes, success events)
- Process CPU, memory, uptime
- Cache hits, misses, evictions, size
- Business metrics (passports generated, paid requests, unique wallets, trust checks)

SLO files in `alerts/`:
- `slo-prod-relaxed.yml` — default (P95<1.5s, 99% availability) — works for
  testnet and any public Algorand endpoint
- `slo-prod-strict.yml` — aspirational (P95<500ms, 99.9% availability) —
  requires a low-latency endpoint

Grafana dashboard JSON in `alerts/grafana-dashboard.json` (17 panels).

See [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) for the full metric
inventory, label cardinality rules, and alert-to-runbook map.

## Contributing

Contributions are welcome! Please read
[CONTRIBUTING.md](CONTRIBUTING.md) for the process, coding standards, and
Conventional Commits workflow. Bug reports and feature requests use the
[issue templates](.github/ISSUE_TEMPLATE/).

## Code of Conduct

This project follows the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code. Report
unacceptable behaviour to **sachncs@gmail.com**.

## Security

Please do **not** file security vulnerabilities as public GitHub issues.
See [SECURITY.md](SECURITY.md) for the disclosure policy and contact
information. The full threat model is in
[docs/SECURITY.md](docs/SECURITY.md).

## FAQ

Common questions — testnet vs mainnet, x402, idempotency, rate limits,
contract deployment, and SLO selection — are answered in
[docs/faq.md](docs/faq.md).

## cURL Examples

```bash
# Trust profile (returns 402 first if x402 is enabled)
curl -i "http://localhost:3000/passport?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX"

# After paying, retry with payment header
curl -H "x-payment: <token> <txnId>" \
  "http://localhost:3000/passport?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX"

# Trust score
curl "http://localhost:3000/score?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX"

# Underwriting decision
curl "http://localhost:3000/underwrite?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX"

# Delegate credit (requires REGISTRY_APP_ID > 0)
curl -X POST http://localhost:3000/delegate \
  -H "Content-Type: application/json" \
  -d '{"sponsor":"SPONSOR_ADDRESS","agent":"AGENT_ADDRESS","amount":500}'

# Lightweight wallet check (free, no payment)
curl "http://localhost:3000/verify?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX"

# Bazaar discovery — search registered services
curl "http://localhost:3000/discovery/search?q=trust&limit=20"

# Health checks
curl http://localhost:3000/health       # liveness
curl http://localhost:3000/ready        # readiness (200 or 503)
curl http://localhost:3000/health/deep  # full status

# Prometheus metrics
curl http://localhost:3000/metrics
```

## License

[MIT](LICENSE) — Copyright © 2026 Sachin.
