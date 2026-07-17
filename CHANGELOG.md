# Changelog

All notable changes to **Agent Passport** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Sub-packages have their own changelogs:
>
> - **TypeScript SDK** — [`sdk/CHANGELOG.md`](sdk/CHANGELOG.md)
> - **Python SDK** — [`sdk/python/CHANGELOG.md`](sdk/python/CHANGELOG.md)

## [Unreleased]

### Fixed

- Wallet validation now uses `algosdk.isValidAddress()` for the base32
  checksum, not just the length regex — typo'd addresses were previously
  accepted by the validator and rejected downstream with a 404.
- `/underwrite` no longer inflates the system-exposure counter on
  read-only calls (an attacker hammering the endpoint could starve
  other wallets of the $100k cap).
- `/reputation/record` now requires a positive `round` for dispute
  events — without it, `verifyDisputeEvent` accepted any wallet pair
  that had ever transacted.
- x402 settlement verification now actually rejects unverified payments
  with a 402 instead of logging and proceeding.
- `/health/deep` and `/ready` both return 503 when the Algorand endpoint
  is unreachable; the previous `/health` always returned 200.
- Dockerfile `HEALTHCHECK` now hits `/ready` (the actual readiness
  probe) instead of `/health` (always-200 liveness).
- Operator wallet is initialized at startup; previously it sat in env
  without being loaded, so every `/delegate`, `/revoke`, and
  `/reputation/record` call was a silent no-op even with
  `OPERATOR_MNEMONIC` set.
- Idempotency body hash is now canonical (sorted keys), so
  `{"a":1,"b":2}` and `{"b":2,"a":1}` no longer produce 409s.
- Force-shutdown timer is `.unref()`-ed so it doesn't keep the event
  loop alive after a successful `server.close()`.
- k6 scenarios fixed: were importing `trustScoreDuration` and
  `ALT_WALLET` (didn't exist); now use `scoreDuration` and `VALID_WALLET`.
- README example wallet corrected from 57 → 58 characters (now passes
  the validator); same fix in `docs/`, `sdk/`, and the bug-report
  template.
- README API table rewritten to match actual routes (`/score`,
  `/passport`, `/underwrite`, `/counterparty-check`, `/credit-estimate`,
  `/sybil-check`, `/reputation`, `/reputation/record`, `/delegation`,
  `/trust-graph`, `/delegate`, `/revoke`, `/verify`, `/discovery/search`,
  `/health`, `/ready`, `/metrics`, `/registry/status`).
- `package.json` ships `types` (the SDK was getting no .d.ts).
- CI pins Node to `20.18.0` and k6 to `0.50.0` for reproducible runs,
  and adds a coverage gate that fails the build below the declared
  thresholds.
- `.dockerignore` now excludes `docs/`, `alerts/`, `data/`,
  `load-tests/`, `public/`, `__tests__/`, and `.benchmarks/`.
- Vitest default config excludes the e2e suite (which hits live
  testnet) and `benchmark.test.ts` (which hits live testnet for
  1000 iterations); both remain opt-in via `npm run test:integration`
  and `npm run benchmark`.

### Added

- `agent_passport_x402_settlement_failures_total` counter — wired to
  `verifySettlement()` and used by the new `X402SettlementVerification`
  alert (see `alerts/alert-rules.yml`).
- `agent_passport_underwriting_decisions_total`,
  `agent_passport_counterparty_checks_total`,
  `agent_passport_idempotency_conflicts_total`,
  `agent_passport_verify_checks_total`,
  `agent_passport_discovery_searches_total` — were previously registered
  lazily via `getSingleMetric(...).inc(...)` and silently dropped by
  prom-client 15; now declared at module scope.
- `status_class` label (`2xx`/`3xx`/`4xx`/`5xx`) on HTTP metrics — the
  raw `status` label was creating millions of series.
- `HighClientErrorRate` and `ContractIndexingFailure` alerts tuned
  against real measurement data; duplicates (`HighErrorRate` /
  `ElevatedErrorRate`) removed.
- `idempotencyStoreSize()` already existed; added
  `stopIdempotencySweeper()` for graceful shutdown.
- `.env.example` now documents `PORT` and `NODE_ENV`, and warns to load
  `OPERATOR_MNEMONIC` from a secret manager.

## [0.1.0] — 2026-06-25

Initial public release of the Agent Passport service.

### Added

- **Service** (`src/`): stateless Express API on Node 20+
  - Trust score, delegation trust, counterparty check, credit estimate,
    sybil detection, reputation, underwriting, trust graph analytics,
    full passport document generation
  - On-chain `/delegate` and `/revoke` endpoints backed by a TEAL
    registry contract (`contracts/registry.teal`)
  - Optional x402 micropayment middleware
  - 38 Prometheus metrics exposed at `/metrics`
  - Idempotency-Key middleware for safe retries on mutating calls
  - LRU response cache (60s TTL) for `/score` and `/passport`
- **TypeScript SDK** (`sdk/`, v0.2.0) — 14 methods, 10 typed error classes
- **Python SDK** (`sdk/python/`, v0.2.0) — 14 methods, 10 typed exceptions
- **Observability** (`alerts/`)
  - 21 alert rules in `alert-rules.yml`, plus 12 SLO rules across
    `slo-prod-relaxed.yml` and `slo-prod-strict.yml`
  - 17-panel Grafana dashboard JSON
  - 8 runbooks for incident response
  - Prometheus scrape config, Alertmanager routing, escalation policy
- **Load tests** (`load-tests/`) — 4 k6 scenarios (100/500/1000 VU +
  sustained) executed against the public Algorand testnet
- **Docs** (`docs/`)
  - `ARCHITECTURE.md`, `API.md`, `DEPLOYMENT.md`, `OBSERVABILITY.md`,
    `TRUST-SCORING.md`, `SECURITY.md`, `SANCTIONS-INTEGRATION.md`
  - `openapi.yaml` (OpenAPI 3.0), `postman-collection.json`,
    `bazaar-metadata.json`
- **CI** (`.github/workflows/ci.yml`) — install, lint, typecheck, test,
  build, and tagged-release load-test smoke
- **Docker** (`Dockerfile`) — multi-stage, non-root, healthcheck-enabled

### Security

- Wallet address validation (58-char base32 regex)
- 100 KB body limit, 30 s request timeout
- 600 req/min/IP rate limit with `RATE_LIMIT_TRUSTED_IPS` bypass
- Helmet security headers
- Per-request UUID, surfaced via `X-Request-ID`
- Configurable CORS
- On-chain USDC payment verification for x402

[Unreleased]: https://github.com/sachncs/agent-passport/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sachncs/agent-passport/releases/tag/v0.1.0
