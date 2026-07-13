<p align="center">
  <h1 align="center">Agent Passport</h1>
  <p align="center">Stateless, pay-per-query trust and underwriting API for AI agents on Algorand.</p>
  <p align="center">
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
    <a href=".github/workflows/ci.yml"><img src="https://img.shields.io/badge/build-passing-brightgreen" alt="Build"></a>
    <a href="package.json"><img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version"></a>
    <a href="package.json"><img src="https://img.shields.io/badge/node-%E2%89%A520-339933" alt="Node"></a>
    <a href="tsconfig.json"><img src="https://img.shields.io/badge/TypeScript-strict-3178C6" alt="TypeScript"></a>
    <a href="https://developer.algorand.org"><img src="https://img.shields.io/badge/Algorand-testnet%20%7C%20mainnet-000000" alt="Algorand"></a>
    <a href="https://x402.org"><img src="https://img.shields.io/badge/x402-payment--enabled-FF6B6B" alt="x402"></a>
    <a href="#development"><img src="https://img.shields.io/badge/tests-1%2C145%20unit%20passing-brightgreen" alt="Tests"></a>
    <a href="https://github.com/sachncs/agent-passport/stargazers"><img src="https://img.shields.io/github/stars/sachncs/agent-passport?style=social" alt="Stars"></a>
  </p>
</p>

A stateless trust-scoring API at `http://localhost:3000`, pointed at the public
Algorand testnet. No database, no wallet, no signup —
`npm install && cp .env.example .env && npm start` and you have
trust scoring, delegation, credit, sybil detection, reputation,
underwriting, and passport generation for any Algorand wallet.

Full documentation: **[docs/README.md](docs/README.md)** — single source of
truth for architecture, algorithms, operations, and contributing.

---

## Features

- **Composite trust score (0–100)** — explainable sub-scores (age, activity,
  volume, velocity, compliance). See
  [docs/concepts/trust-scoring.md](docs/concepts/trust-scoring.md).
- **Delegated trust graph** — cycle detection, depth attenuation, and
  quality-weighted sponsor counts. See
  [docs/concepts/delegation.md](docs/concepts/delegation.md).
- **Underwriting decisions** — credit capacity estimation, default
  propagation, $100k system exposure cap. See
  [docs/concepts/credit-and-underwriting.md](docs/concepts/credit-and-underwriting.md).
- **Sybil detection** — 12 signals (clustering, timing, amount fingerprint,
  funding correlation, balance similarity, interaction density, circular
  activity, plus 4 graph-traversal signals). See
  [docs/concepts/sybil-detection.md](docs/concepts/sybil-detection.md).
- **On-chain reputation events** — `registry.teal` and `reputation.teal`
  Algorand contracts. See
  [docs/architecture/smart-contracts.md](docs/architecture/smart-contracts.md).
- **Optional x402 micropayments** — pay-per-query in USDC, settled
  on-chain, with replay protection.
- **Stateless service** — every request fetches from Algorand and caches
  in-memory for 60 s. No database, no message queue, no shared state.
  Scale horizontally by adding pods.
- **Production-grade observability** — 38 Prometheus metrics, 24+ alert
  rules, 17-panel Grafana dashboard, 8 runbooks, two SLO profiles. See
  [docs/operations/observability.md](docs/operations/observability.md).
- **First-class SDKs** — TypeScript (`@agent-passport/sdk`) and Python
  (`agent-passport-sdk`), both with typed errors, idempotency helpers,
  and x402 payment callbacks. See
  [docs/development/sdk-typescript.md](docs/development/sdk-typescript.md)
  and [docs/development/sdk-python.md](docs/development/sdk-python.md).
- **Security hardened** — Helmet headers, 600 req/min/IP rate limit, CORS,
  100 KB body limit, 30 s request timeout, per-request UUID,
  `Idempotency-Key` middleware, on-chain payment verification. See
  [docs/security/threat-model.md](docs/security/threat-model.md).

---

## Installation

### From source

```bash
git clone https://github.com/sachncs/agent-passport.git
cd agent-passport
npm install
cp .env.example .env
npm start
```

By default this points at the public Algorand testnet — no setup beyond the
env file is needed. Server runs at `http://localhost:3000`.

### With hot reload

```bash
npm run dev
```

### From Docker

```bash
docker build -t agent-passport:0.1.0 .
docker run --rm -p 3000:3000 --env-file .env agent-passport:0.1.0
```

For production deployment, see
[docs/operations/deployment.md](docs/operations/deployment.md).

---

## Quick Start

### 1. Confirm the service is up

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"Agent Passport", ...}
```

### 2. Make your first call

```bash
# Trust score
curl -s "http://localhost:3000/score?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX" | jq

# Full passport document
curl -s "http://localhost:3000/passport?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX" | jq

# Underwriting decision
curl -s "http://localhost:3000/underwrite?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX" | jq
```

A 5-minute walkthrough is in
[docs/introduction/getting-started.md](docs/introduction/getting-started.md).

### 3. Use an SDK

```bash
# TypeScript
npm install @agent-passport/sdk
```

```typescript
import { AgentPassportClient } from '@agent-passport/sdk';

// Connect to a local service
const client = new AgentPassportClient({ baseUrl: 'http://localhost:3000' });

// Fetch a trust score
const score = await client.getScore('GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX');
console.log(score.trustScore, score.riskLevel);
```

```bash
# Python
pip install agent-passport-sdk
```

```python
from agent_passport import AgentPassportClient

client = AgentPassportClient(base_url="http://localhost:3000")
print(client.get_score("GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX"))
```

Full SDK reference:
[docs/development/sdk-typescript.md](docs/development/sdk-typescript.md)
and [docs/development/sdk-python.md](docs/development/sdk-python.md).

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to
`.env` and edit as needed. **Never commit `.env`** — it is in
`.gitignore`.

The canonical env-var table (every var, every default, every scope) is
at [docs/operations/environment-variables.md](docs/operations/environment-variables.md).

### Service

| Variable             | Purpose                              |
|----------------------|--------------------------------------|
| `PORT`               | HTTP listen port (default `3000`)    |
| `LOG_LEVEL`          | Pino log level                       |
| `LOG_FILE`           | Combined log file path               |
| `LOG_ERROR_FILE`     | Error-only log file path             |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS allow-list    |

### Algorand

| Variable        | Purpose                                |
|-----------------|----------------------------------------|
| `ALGOD_URL`     | algod node endpoint                    |
| `ALGOD_TOKEN`   | algod API token                        |
| `INDEXER_URL`   | Algorand indexer endpoint              |
| `INDEXER_TOKEN` | Indexer API token                      |
| `ALGO_NETWORK`  | `testnet` or `mainnet`                 |

### Smart contracts

| Variable             | Purpose                            |
|----------------------|------------------------------------|
| `REGISTRY_APP_ID`    | Delegation registry app id         |
| `REPUTATION_APP_ID`  | Reputation events app id           |
| `OPERATOR_MNEMONIC`  | Operator wallet mnemonic           |
| `DEPLOYER_MNEMONIC`  | Contract deployer mnemonic         |

### x402 payments

| Variable                  | Purpose                       |
|---------------------------|-------------------------------|
| `X402_ENABLED`            | Enable pay-per-query (default `false`) |
| `X402_FACILITATOR_URL`    | x402 facilitator endpoint     |
| `X402_PAYMENT_RECIPIENT`  | USDC recipient address        |
| `X402_NETWORK`            | `algorand-testnet` / `-mainnet` |

### Rate limiting & system exposure

| Variable                       | Purpose                                   |
|--------------------------------|-------------------------------------------|
| `RATE_LIMIT_MAX`               | Requests/minute per IP                    |
| `RATE_LIMIT_TRUSTED_IPS`       | Comma-separated bypass list               |
| `RATE_LIMIT_PERSISTENCE_PATH`  | Persisted rate-limit state file           |
| `EXPOSURE_PERSISTENCE_PATH`    | Persisted system-exposure ledger          |

### Timeouts & load

| Variable             | Purpose                                   |
|----------------------|-------------------------------------------|
| `REQUEST_TIMEOUT_MS` | Per-request timeout (default `30000`)    |
| `LOAD_TEST_MODE`     | Bypass rate limits for load tests         |

---

## Project Structure

```
agent-passport/
├── src/                    # Service source (Express + lib/)
│   ├── app.ts              # Express app, all 19 routes, middleware order
│   ├── index.ts            # Bootstrap and graceful shutdown
│   ├── config.ts           # Env-var parsing and validation
│   ├── trust-score.ts      # Composite trust score (5 sub-scores)
│   ├── delegation.ts       # Delegation trust graph
│   ├── sybil.ts            # Sybil detection (7 wallet-history signals)
│   ├── credit.ts           # Credit capacity estimation
│   ├── underwriting.ts     # Decision engine (4 factors + system exposure)
│   ├── reputation.ts       # On-chain reputation events
│   ├── passport.ts         # Passport document generation + checksum
│   ├── trust-graph.ts      # Trust graph analytics, exposure, what-ifs
│   ├── counterparty.ts     # Merchant counterparty check
│   ├── registry.ts         # On-chain delegate + revoke
│   ├── __tests__/          # 1 145 unit tests + 8 integration tests
│   └── lib/                # 13 helper modules (cache, idempotency, x402, …)
├── sdk/                    # TypeScript + Python SDKs
│   ├── src/                # TypeScript SDK
│   ├── CHANGELOG.md
│   └── python/             # Python SDK
│       ├── agent_passport/
│       └── CHANGELOG.md
├── contracts/              # Algorand TEAL contracts
│   ├── registry.teal       # Delegation registry
│   └── reputation.teal     # Reputation events
├── scripts/                # 9 operational CLIs
├── docs/                   # Full documentation (see docs/README.md)
├── alerts/                 # Prometheus / Alertmanager / Grafana / runbooks
├── load-tests/             # k6 scenarios + helpers
├── public/                 # Static dashboard HTML
├── data/                   # Runtime persistence (gitignored)
└── dist/                   # Build output (gitignored)
```

---

## Tech Stack

| Category       | Technology                                       |
|----------------|--------------------------------------------------|
| Runtime        | Node.js ≥ 20                                     |
| Language       | TypeScript (strict mode)                         |
| Framework      | [Express 5](https://expressjs.com)               |
| Security       | [Helmet](https://helmetjs.github.io), CORS, custom rate limiter with persistent state |
| Validation     | [Zod](https://zod.dev)                           |
| Algorand       | [algosdk](https://github.com/algorand/js-algorand-sdk) |
| Payments       | [x402](https://x402.org) (`@x402/core`, `@x402/express`) |
| Metrics        | [prom-client](https://github.com/siimon/prom-client) |
| Tests          | [Vitest](https://vitest.dev), [Supertest](https://github.com/ladjs/supertest) |
| Lint           | [ESLint](https://eslint.org) (flat config)       |
| Container      | Docker (multi-stage, non-root, healthcheck)      |
| SDK — TS       | TypeScript 6, native `fetch`, `zod`              |
| SDK — Python   | Python 3.9+, `requests`, dataclasses, type hints |
| Contracts      | [TEAL](https://developer.algorand.org/docs/get-details/dapps/avm/teal/) (Algorand v10) |
| Observability  | Prometheus, Alertmanager, Grafana JSON (17 panels), [k6](https://k6.io) |

---

## Roadmap

- **v0.1.0** (shipped) — stateless trust scoring, TypeScript + Python SDKs,
  on-chain delegation registry, x402 pay-per-query, Prometheus metrics +
  Alertmanager rules + Grafana dashboard, k6 load tests, production
  deployment guide, idempotency middleware (24 h TTL, body-hash dedup,
  409 on mismatch), system exposure cap ($100k USDC, persisted),
  operator wallet + KMS guidance.
- **v0.2.0** (next) — sanctions screening provider integration
  (Chainalysis / Elliptic) — see
  [docs/security/sanctions-integration.md](docs/security/sanctions-integration.md),
  Redis-backed idempotency store for multi-replica deployments, webhook
  subscriptions for reputation event consumers.
- **Backlog** — gRPC interface alongside HTTP, multi-chain adapters
  (Ethereum, Solana), public Bazaar listing & discoverability metadata,
  Helm chart for one-command Kubernetes deployment, OpenAPI → SDK code
  generation (release-please automation).

Have an idea? [Open a feature request](https://github.com/sachncs/agent-passport/issues/new?template=feature_request.md).

---

## Development

```bash
npm run dev              # Start with hot reload
npm run build            # Build TypeScript
npm run typecheck        # Type checking
npm test                 # All unit tests (1 145 passing)
npm run test:integration # Live testnet integration suite
npm run lint             # ESLint
```

### SDK development

```bash
cd sdk
npm install
npm test
npm run build
```

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
LOAD_TEST_MODE=1 ./run-all.sh
```

See [docs/operations/load-testing.md](docs/operations/load-testing.md)
for thresholds and output interpretation.

### Code Style

- Line length: 100 (ESLint default)
- Quotes: double (`"`)
- Formatting: ESLint (`eslint src/`)
- Type hints: required on all public signatures (`strict` TypeScript)
- No dead code, no commented-out code in `src/`

### Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add x402 idempotency middleware
fix: clamp sybil cluster score to [0,100]
docs: document sanctions-integration flow
refactor: extract exposure ledger persistence
test: add adversarial sybil cluster fixtures
chore: bump @x402/core to 2.18.0
```

---

## Deployment

The service is **production-ready** and fully stateless. See
[docs/operations/deployment.md](docs/operations/deployment.md) for the
full checklist.

The default deployment works against the public Algorand testnet out of
the box. To deploy to mainnet, update `ALGOD_URL` and `INDEXER_URL` to a
mainnet endpoint (AlgoNode, a hosted provider, or your own node). For
tighter SLOs (P95 < 500 ms), use a low-latency endpoint.

---

## Observability

38 Prometheus metrics exposed at `/metrics`. Full inventory in
[docs/operations/observability.md](docs/operations/observability.md).
Two SLO profiles:

- `alerts/slo-prod-relaxed.yml` — default (P95<1.5s, 99% availability)
- `alerts/slo-prod-strict.yml` — aspirational (P95<500ms, 99.9% availability)

Grafana dashboard JSON in `alerts/grafana-dashboard.json` (17 panels).

---

## Documentation

The full documentation is at **[docs/README.md](docs/README.md)** and is
organised by audience:

- **New?** → [docs/introduction/overview.md](docs/introduction/overview.md)
- **Integrating?** → [docs/api/README.md](docs/api/README.md) +
  [docs/development/sdk-typescript.md](docs/development/sdk-typescript.md)
- **Operating?** → [docs/operations/deployment.md](docs/operations/deployment.md)
  + [docs/operations/observability.md](docs/operations/observability.md)
- **Reviewing security?** → [docs/security/threat-model.md](docs/security/threat-model.md)
- **Contributing?** → [CONTRIBUTING.md](CONTRIBUTING.md) +
  [docs/development/testing.md](docs/development/testing.md)

---

## Contributing

Contributions are welcome! See
[CONTRIBUTING.md](CONTRIBUTING.md) for the process, coding standards,
and Conventional Commits workflow. Bug reports and feature requests use
the [issue templates](.github/ISSUE_TEMPLATE/).

## Code of Conduct

This project follows the
[Contributor Covenant v2.1](CODE_OF_CONDUCT.md). By participating, you
are expected to uphold this code. Report unacceptable behaviour to
**sachncs@gmail.com**.

## Security

Please do **not** file security vulnerabilities as public GitHub
issues. See [SECURITY.md](SECURITY.md) for the disclosure policy and
contact information. The full threat model is in
[docs/security/threat-model.md](docs/security/threat-model.md).

## FAQ

Common questions are answered in
[docs/introduction/faq.md](docs/introduction/faq.md) and
[docs/introduction/getting-started.md](docs/introduction/getting-started.md).

## License

[MIT](LICENSE) © 2026 Sachin.