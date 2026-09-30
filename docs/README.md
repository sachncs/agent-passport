# Agent Passport Documentation

Source-backed documentation for the v1.0 OSS release. Start with a task path,
then use the reference documents for implementation and operations detail.

> **Just want to run it?** Skip to the root
> Start with the [project overview](../README.md), then follow the quickstart.

## Start here

| Goal | Read |
|------|------|
| Run locally | [Root quick start](../README.md#quick-start) |
| Five-minute setup | [Quickstart](quickstart.md) |
| Call the API | [API reference](api.md), [OpenAPI contract](api/openapi.yaml) |
| Install an SDK | [SDK guide](sdk.md), [TypeScript package](../sdk/README.md), [Python package](../sdk/python/README.md) |
| Understand decisions | [Concepts](concepts.md), [Known limitations](known-limitations.md) |
| Deploy and operate | [Operations](operations.md), [Architecture](architecture.md) |
| Self-host it | [Self-hosting](self-hosting.md) |
| Review security | [Security](security.md), [Known limitations](known-limitations.md) |
| Contribute or release | [Contributing](../CONTRIBUTING.md), [Support policy](support-policy.md), [Release checklist](release-checklist.md) |

## Documentation map

| Guide | What's in it | Read when… |
|------|--------------|-------------|
| [Architecture guide](architecture.md) | System design, middleware stack, request lifecycle, smart contracts, caching, data flow, scaling | Onboarding a new contributor; reviewing the system before deploying |
| [API reference](api.md) | HTTP endpoint reference, error codes, health/readiness, x402 pricing | Integrating via curl, Postman, or an SDK |
| [OpenAPI contract](api/openapi.yaml) | OpenAPI 3.0 spec — every route, request body, and response schema | Generating a typed client (openapi-generator, openapi-typescript) |
| [Algorithm and scoring reference](concepts.md) | Trust scoring, delegation graph, Sybil detection, reputation, credit/underwriting, passport document | Reviewing the algorithms; debugging a wrong score; understanding the math |
| [Security guide](security.md) | Threat model, defence-in-depth layers, attack surface, mitigations | Reviewing for a production deployment; threat-modelling a new feature |
| [Operations guide](operations.md) | Environment variables, deployment, observability (metrics/SLOs/alerts), rate limiting, idempotency, system exposure cap, graceful shutdown, load testing | Operating the service in any environment |
| [Known limitations](known-limitations.md) | Public decision, runtime, and hosted-service boundaries | Evaluating the system for production use |
| [Support policy](support-policy.md) | Community support and compatibility expectations | Adopting the project or opening an issue |
| [Release checklist](release-checklist.md) | The v1.0 release gate | Cutting a release |
| [Quickstart](quickstart.md) | Five-minute local setup and first request | Running the project for the first time |
| [SDK guide](sdk.md) | TypeScript and Python installation and integration guidance | Adding Agent Passport to an application |
| [Self-hosting guide](self-hosting.md) | Production environment, Docker, probes, and replica boundaries | Deploying the service |

## Root-level files

These are at the repo root for GitHub-UI reasons (badges, security
advisories, contribution flow). The docs directory stays focused on
the **canonical reference**.

- [Project overview](../README.md) — project landing page, install, quick start
- [Release notes](../CHANGELOG.md) — version history
- [Contributing](../CONTRIBUTING.md) — how to contribute
- [Security disclosure](../SECURITY.md) — vulnerability disclosure policy
- [License](../LICENSE) — MIT
- [Community standards](../CODE_OF_CONDUCT.md) — community standards

## Source-of-truth principle

Every number, threshold, and default in these docs is verified
against the code on every PR. The CI gate fails if:

- A new environment variable in `.env.example` is missing from the operations guide
- A new endpoint in `src/app.ts` is missing from the API reference
- A new metric in `src/lib/metrics.ts` is missing from the observability guide
- A new test file in `src/__tests__/` is missing from the algorithm reference

This keeps the docs honest. A wrong doc is worse than no doc.
