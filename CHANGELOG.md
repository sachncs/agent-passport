# Changelog

All notable changes to **Agent Passport** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Sub-packages have their own changelogs:
>
> - **TypeScript SDK** — [`sdk/CHANGELOG.md`](sdk/CHANGELOG.md)
> - **Python SDK** — [`sdk/python/CHANGELOG.md`](sdk/python/CHANGELOG.md)

## [Unreleased]

### Added

- Top-level open-source governance files: `LICENSE`, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`
- `.editorconfig` and `.gitattributes` for cross-IDE consistency
- GitHub community files: `ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`,
  `dependabot.yml`
- `docs/getting-started.md` and `docs/faq.md`

### Changed

- Expanded `.gitignore` with OS, IDE, Python, and load-test artifacts
- `package.json`, `sdk/package.json`, and `sdk/python/pyproject.toml` now
  declare `repository`, `homepage`, `bugs`, `keywords`, and `author`
- `docs/openapi.yaml` repo URL aligned to `sachncs/agent-passport`
- `README.md` reorganised: added badges, Features, Tech Stack, and Roadmap
  sections; relative links to all docs; cross-references CONTRIBUTING,
  CODE_OF_CONDUCT, and SECURITY

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
  - 20 alert rules, 24 SLO rules across `slo-prod-relaxed.yml` and
    `slo-prod-strict.yml`
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
