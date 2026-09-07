# Agent Passport Documentation

Single source of truth for architecture, algorithms, operations, and
contributing. Six files (plus the OpenAPI spec, Postman collection,
and Bazaar metadata under `api/`).

> **Just want to run it?** Skip to the root
> [README.md](../README.md) → "Installation" → "Quick start".

## Files

| File | What's in it | Read when… |
|------|--------------|-------------|
| [architecture.md](architecture.md) | System design, middleware stack, request lifecycle, smart contracts, caching, data flow, scaling | Onboarding a new contributor; reviewing the system before deploying |
| [api.md](api.md) | HTTP endpoint reference, error codes, health/readiness, x402 pricing | Integrating via curl, Postman, or an SDK |
| [api/openapi.yaml](api/openapi.yaml) | OpenAPI 3.0 spec — every route, request body, and response schema | Generating a typed client (openapi-generator, openapi-typescript) |
| [concepts.md](concepts.md) | Trust scoring, delegation graph, sybil detection, reputation, credit/underwriting, passport document | Reviewing the algorithms; debugging a wrong score; understanding the math |
| [security.md](security.md) | Threat model, defence-in-depth layers, attack surface, mitigations | Reviewing for a production deployment; threat-modelling a new feature |
| [operations.md](operations.md) | Environment variables, deployment, observability (metrics/SLOs/alerts), rate limiting, idempotency, system exposure cap, graceful shutdown, load testing | Operating the service in any environment |

## Root-level files

These are at the repo root for GitHub-UI reasons (badges, security
advisories, contribution flow). The docs directory stays focused on
the **canonical reference**.

- [../README.md](../README.md) — project landing page, install, quick start
- [../CHANGELOG.md](../CHANGELOG.md) — release notes
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — how to contribute
- [../SECURITY.md](../SECURITY.md) — vulnerability disclosure policy
- [../LICENSE](../LICENSE) — MIT
- [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) — community standards

## Source-of-truth principle

Every number, threshold, and default in these docs is verified
against the code on every PR. The CI gate fails if:

- A new env var in `.env.example` is missing from `operations.md`
- A new endpoint in `src/app.ts` is missing from `api.md`
- A new metric in `src/lib/metrics.ts` is missing from `operations.md`
- A new test file in `src/__tests__/` is missing from `concepts.md`

This keeps the docs honest. A wrong doc is worse than no doc.
