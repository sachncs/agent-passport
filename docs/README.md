# Agent Passport Documentation

Welcome to the Agent Passport documentation. This directory is the **single
source of truth** for architecture, algorithms, operational guidance, and
contributor knowledge. The README at the repo root is a 60-second
overview; everything else lives here.

## Start here

| If you are… | Read |
|---|---|
| New to the project | [introduction/overview.md](introduction/overview.md) → [introduction/getting-started.md](introduction/getting-started.md) |
| Evaluating it for production | [introduction/faq.md](introduction/faq.md) → [operations/deployment.md](operations/deployment.md) → [reports/production-readiness.md](reports/production-readiness.md) |
| Integrating it into your app | [api/README.md](api/README.md) → [api/openapi.yaml](api/openapi.yaml) → [development/sdk-typescript.md](development/sdk-typescript.md) or [development/sdk-python.md](development/sdk-python.md) |
| Understanding the trust math | [concepts/trust-scoring.md](concepts/trust-scoring.md) → [concepts/delegation.md](concepts/delegation.md) → [concepts/sybil-detection.md](concepts/sybil-detection.md) → [concepts/credit-and-underwriting.md](concepts/credit-and-underwriting.md) |
| Operating it on Algorand | [architecture/smart-contracts.md](architecture/smart-contracts.md) → [operations/deployment.md](operations/deployment.md) → [security/operator-wallet.md](security/operator-wallet.md) |
| Operating it in production | [operations/observability.md](operations/observability.md) → [operations/runbooks.md](operations/runbooks.md) |
| Reviewing security | [security/threat-model.md](security/threat-model.md) → [security/operator-wallet.md](security/operator-wallet.md) |
| Contributing | [../CONTRIBUTING.md](../CONTRIBUTING.md) → [development/testing.md](development/testing.md) → [development/scripts.md](development/scripts.md) → [development/contracts.md](development/contracts.md) |

## Sections

### [Introduction](introduction/)

- [overview.md](introduction/overview.md) — what Agent Passport is, who it
  is for, and the high-level architecture
- [getting-started.md](introduction/getting-started.md) — install, run, make
  your first API call, install an SDK
- [faq.md](introduction/faq.md) — frequently asked questions across
  general, deployment, API, trust scoring, observability, security, and
  contributing topics

### [Architecture](architecture/)

- [system-design.md](architecture/system-design.md) — full system design
  (replaces the old `docs/ARCHITECTURE.md` stand-in)
- [middleware-stack.md](architecture/middleware-stack.md) — every
  middleware, in order, with its purpose and env vars
- [smart-contracts.md](architecture/smart-contracts.md) — the two TEAL
  contracts, their global state, box layout, and methods
- [caching.md](architecture/caching.md) — the LRU response cache, the
  per-wallet caches, and the idempotency store
- [data-flow.md](architecture/data-flow.md) — request → Algorand →
  response sequence diagrams
- [module-reference.md](architecture/module-reference.md) — one section
  per `src/*.ts` file

### [API](api/)

- [README.md](api/README.md) — full HTTP reference (replaces the old
  `docs/API.md` stand-in)
- [openapi.yaml](api/openapi.yaml) — OpenAPI 3.0 spec
- [postman-collection.json](api/postman-collection.json) — Postman
  collection
- [error-codes.md](api/error-codes.md) — every error response code with
  shape and meaning
- [health.md](api/health.md) — `/health`, `/ready`, `/health/deep`,
  `/registry/status`, `/metrics`
- [../bazaar-metadata.json](bazaar-metadata.json) — service registry
  metadata for the x402 Bazaar

### [Operations](operations/)

- [deployment.md](operations/deployment.md) — production deployment
  checklist, Kubernetes example, network options
- [environment-variables.md](operations/environment-variables.md) —
  the canonical env-var table
- [observability.md](operations/observability.md) — metrics inventory,
  SLOs, scrape config, alert-to-runbook map
- [load-testing.md](operations/load-testing.md) — k6 suite, scenarios,
  pass thresholds
- [rate-limiting.md](operations/rate-limiting.md) — 600/min default,
  bypass lists, persistence
- [idempotency.md](operations/idempotency.md) — `Idempotency-Key`
  middleware, 24h TTL, conflict semantics
- [system-exposure.md](operations/system-exposure.md) — `MAX_SYSTEM_EXPOSURE`,
  `EXPOSURE_PERSISTENCE_PATH`, `capToSystemCapacity`
- [runbooks.md](operations/runbooks.md) — index of the 8 alert runbooks
  under `alerts/runbooks/`
- [graceful-shutdown.md](operations/graceful-shutdown.md) — `SIGTERM` /
  `SIGINT` flow, 10s forced exit, metrics collector lifecycle

### [Security](security/)

- [threat-model.md](security/threat-model.md) — current threat model
  (replaces the old `docs/SECURITY.md` stand-in)
- [operator-wallet.md](security/operator-wallet.md) — `OPERATOR_MNEMONIC`
  loading, `initOperatorWallet`, KMS guidance
- [sanctions-integration.md](security/sanctions-integration.md) —
  future-feature guide for Chainalysis / Elliptic / OFAC integration
- [../SECURITY.md](../SECURITY.md) — vulnerability disclosure policy
  (root, kept for GitHub UI)

### [Concepts](concepts/)

- [trust-scoring.md](concepts/trust-scoring.md) — the composite trust
  score, sub-scores, risk classification, recommended limit
- [delegation.md](concepts/delegation.md) — delegation trust graph,
  depth cap, cycle detection
- [sybil-detection.md](concepts/sybil-detection.md) — 12 sybil signals
  with math, thresholds, and complexity
- [reputation.md](concepts/reputation.md) — on-chain reputation events,
  F1–F8 defenses, event dedup, cycle detection
- [credit-and-underwriting.md](concepts/credit-and-underwriting.md) —
  credit capacity, underwriting decision engine, system exposure cap
- [passport-document.md](concepts/passport-document.md) — the passport
  schema, checksum semantics, fresh vs cached variants

### [Development](development/)

- [scripts.md](development/scripts.md) — every `scripts/*.ts` CLI
- [sdk-typescript.md](development/sdk-typescript.md) — TypeScript SDK
  reference
- [sdk-python.md](development/sdk-python.md) — Python SDK reference
- [contracts.md](development/contracts.md) — TEAL authoring guide
- [testing.md](development/testing.md) — vitest layout, integration
  suite opt-in, coverage thresholds

### [Reports](reports/)

- [production-readiness.md](reports/production-readiness.md) — current
  self-audit
- [load-test-2026-06-25.md](reports/load-test-2026-06-25.md) — most
  recent load-test result

## Project-wide documents (kept at the repo root)

- [../README.md](../README.md) — project landing page (60-second
  overview, badges, install)
- [../CHANGELOG.md](../CHANGELOG.md) — release notes
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — contribution guide
- [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) — community standards
- [../SECURITY.md](../SECURITY.md) — vulnerability disclosure policy
- [../LICENSE](../LICENSE) — MIT license

## Conventions

- All file names are **lowercase kebab-case**.
- Code blocks carry a language tag (`ts`, `bash`, `json`, `yaml`, `teal`).
- Section anchors follow GitHub's auto-generated slug rules.
- Internal links are always **relative**, never absolute.
- Each page has a one-sentence purpose at the top so the index can be
  regenerated from it.
