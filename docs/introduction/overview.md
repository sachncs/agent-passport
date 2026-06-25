# Overview

Agent Passport is a **stateless, pay-per-query trust and underwriting
API for AI agents**, using delegated-underwriting and x402 micropayments
on Algorand. It scores Algorand wallets for trust, delegation trust,
sybil risk, reputation, and creditworthiness, and lets sponsors publish
on-chain delegations that count toward an agent's trust score.

> **60-second summary.** `npm install && cp .env.example .env && npm
> start` gives you a trust-scoring API at `http://localhost:3000`,
> pointed at the public Algorand testnet. No database, no wallet, no
> signup. See [getting-started.md](getting-started.md) for the 5-minute
> tour.

## Who is this for

- **AI-agent developers** who need a portable trust signal they can
  attach to wallets their agents interact with.
- **Bazaar / marketplace operators** that need a counterparty check
  before settling x402 payments.
- **Underwriters** that need a fast, explainable credit decision backed
  by on-chain data.
- **Sponsor networks** that want to publish on-chain trust delegations
  programmatically.

## What you get

- **Composite trust score (0–100)** with explainable sub-scores: age,
  activity, volume, velocity, compliance.
- **Delegated trust graph** with cycle detection, depth attenuation,
  and quality-weighted sponsor counts.
- **Sybil detection** across 12 signals (clustering, timing, amount
  fingerprint, funding correlation, balance similarity, interaction
  density, circular activity, plus 4 graph-traversal signals).
- **On-chain reputation events** via the `registry.teal` and
  `reputation.teal` Algorand contracts.
- **Optional x402 micropayments** — pay-per-query in USDC, settled
  on-chain, with replay protection.
- **Underwriting decisions** with credit capacity estimation, default
  propagation, and a system-wide exposure cap.
- **Production-grade observability** — 38 Prometheus metrics, 24+
  alert rules, 17-panel Grafana dashboard, 8 runbooks, two SLO
  profiles.
- **First-class SDKs** — TypeScript (`@agent-passport/sdk`) and Python
  (`agent-passport-sdk`), both with typed errors, idempotency helpers,
  and x402 payment callbacks.
- **Security hardened** — Helmet headers, 600 req/min/IP rate limit,
  CORS, 100 KB body limit, 30 s request timeout, per-request UUID,
  `Idempotency-Key` middleware, on-chain payment verification.

## High-level architecture

```
┌──────────────┐     ┌────────────────────────────────────────┐     ┌─────────────────────┐
│              │     │  Express on Node 20+ (port 3000)      │     │                     │
│  Client /    │────▶│   - Helmet, CORS, requestId           │────▶│  Algorand           │
│  Agent       │     │   - Rate limit (600/min/IP)           │     │  (algod + indexer)  │
│              │     │   - Metrics, x402, idempotency        │     │                     │
│  SDK (TS)    │     │   - LRU response cache (60s TTL)      │     │  + optional         │
│  SDK (Py)    │     │   - In-memory idempotency store (24h) │     │    registry.teal    │
│              │     │   - 38 Prometheus metrics             │     │    reputation.teal  │
└──────────────┘     └────────────────────────────────────────┘     └─────────────────────┘
```

The service is **fully stateless** — every request fetches data from
Algorand and caches it in-memory for 60 seconds. There is no database,
no Redis, no message queue. Scale horizontally by adding pods.

## How the pieces fit

| Concept | Page |
|---|---|
| How the score is computed | [../concepts/trust-scoring.md](../concepts/trust-scoring.md) |
| How delegation trust works | [../concepts/delegation.md](../concepts/delegation.md) |
| How sybil detection works | [../concepts/sybil-detection.md](../concepts/sybil-detection.md) |
| How reputation events work | [../concepts/reputation.md](../concepts/reputation.md) |
| How credit and underwriting work | [../concepts/credit-and-underwriting.md](../concepts/credit-and-underwriting.md) |
| What a passport document contains | [../concepts/passport-document.md](../concepts/passport-document.md) |
| The HTTP surface | [../api/README.md](../api/README.md) |
| The TEAL contracts | [../architecture/smart-contracts.md](../architecture/smart-contracts.md) |
| How to operate it | [../operations/deployment.md](../operations/deployment.md) |
| How to monitor it | [../operations/observability.md](../operations/observability.md) |
| How to secure it | [../security/threat-model.md](../security/threat-model.md) |

## What this is **not**

- **Not a wallet.** Agent Passport does not custody or transfer funds.
- **Not a KYC/AML provider.** It exposes trust signals derived from
  on-chain history; legal compliance is the operator's responsibility.
  See [../security/sanctions-integration.md](../security/sanctions-integration.md)
  for future integration guidance.
- **Not a database.** The service holds no persistent state except
  the rate-limit map and the system-exposure cap, both of which are
  JSON files under `data/`.
- **Not a shared service.** Each deployment is independent; multi-
  tenant trust is not supported.
