# Contributing to Agent Passport

Thank you for your interest in contributing to **Agent Passport** — the
stateless trust scoring service for AI agents on Algorand. Whether you are
fixing a typo, improving documentation, reporting a bug, or proposing a new
feature, your help is welcome.

This document explains how to set up a local development environment, follow
the project's coding conventions, and submit a high-quality pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Get Help](#how-to-get-help)
- [How to Report a Bug](#how-to-report-a-bug)
- [How to Suggest a Feature](#how-to-suggest-a-feature)
- [Development Setup](#development-setup)
- [Project Layout](#project-layout)
- [Coding Standards](#coding-standards)
- [Commit Conventions](#commit-conventions)
- [Branch Naming](#branch-naming)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation Expectations](#documentation-expectations)
- [Release Process](#release-process)

## Code of Conduct

This project and everyone participating in it is governed by the
[Contributor Covenant v2.1](CODE_OF_CONDUCT.md). By participating, you are
expected to uphold this code. Please report unacceptable behavior to
**sachncs@gmail.com**.

## How to Get Help

- **Bug or feature request?** Open a [GitHub issue](https://github.com/sachncs/agent-passport/issues).
- **Security vulnerability?** See [SECURITY.md](SECURITY.md) — do **not** file
  a public issue.
- **General question?** Open a GitHub Discussion (if enabled) or a
  `question`-labelled issue.

## How to Report a Bug

Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) issue template and
include:

- A clear, descriptive title
- Exact steps to reproduce (curl commands are best)
- Observed vs expected behaviour
- Service version, commit SHA, deployment target (testnet/mainnet, AlgoNode,
  local node), and `node` version
- Relevant logs, request IDs (`X-Request-ID` header), or screenshots
- Whether you can reproduce against the public testnet (helps us triage)

## How to Suggest a Feature

Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template
and describe:

- The problem you are trying to solve
- The proposed solution and any alternatives you considered
- Whether the change is backwards-compatible
- Any new metric, alert, or SLO implications

## Development Setup

### Prerequisites

- **Node.js** ≥ 20.0.0
- **npm** ≥ 10 (bundled with Node 20)
- **Python** ≥ 3.9 (only required for Python SDK work)
- **k6** ≥ 0.50 (only required for load testing)
- An Algorand endpoint — the public AlgoNode testnet works out of the box
  (`ALGOD_URL`/`INDEXER_URL` defaults in `.env.example`)

### Clone & Install

```bash
git clone https://github.com/sachncs/agent-passport.git
cd agent-passport
cp .env.example .env
npm install
```

### Run the Service

```bash
# Development with hot reload
npm run dev

# Production-style run
npm run build
npm start
```

The service listens on `http://localhost:3000` by default. Hit
`/health` to confirm liveness.

### Run the TypeScript SDK Locally

```bash
cd sdk
npm install
npm test
npm run build
```

### Run the Python SDK Locally

```bash
cd sdk/python
pip install -e ".[dev]"
python -m pytest tests/
```

### Skip Live Testnet Tests

Most tests are pure unit tests and run offline. The E2E suite (140 tests)
hits the public Algorand testnet — skip them locally if you have no network
or want a fast feedback loop:

```bash
SKIP_E2E=1 npm test
```

## Project Layout

```
agent-passport/
├── src/                # Service source (Express app + lib/)
├── sdk/                # TypeScript + Python SDKs
├── contracts/          # Algorand TEAL contracts
├── scripts/            # Operational CLIs (deploy, score, delegate, …)
├── docs/               # Architecture, API, security, deployment, …
├── alerts/             # Prometheus / Alertmanager / Grafana / runbooks
├── load-tests/         # k6 scenarios + results
├── public/             # Static dashboard HTML
├── data/               # Runtime persistence (gitignored)
└── dist/               # Build output (gitignored)
```

See the [README](README.md) and [docs/README.md](docs/README.md)
for more detail.

## Coding Standards

### General

- **TypeScript:** `strict: true`. No `any` unless justified with a comment.
- **ESLint:** The repo ships with `eslint.config.js` (flat config). Run
  `npm run lint` and fix all warnings before opening a PR.
- **Formatting:** 2-space indent, LF line endings, final newline.
  `.editorconfig` enforces this — please configure your editor to honour it.
- **Comments:** Do **not** add new comments unless they explain *why* — code
  should explain *what*. Existing comments are an exception.
- **TODOs:** Do not introduce `TODO`/`FIXME`/`XXX`/`HACK` markers in code.
  Open an issue instead and link it from the PR description.
- **Logging:** Use the structured logger (`src/lib/logger.ts`). Never
  `console.log` in production code paths.

### TypeScript Style

- Prefer `unknown` over `any` for catch blocks and boundary types.
- Use `const` by default; `let` only when reassignment is necessary.
- Use named exports, except for SDK entry points (e.g.
  `AgentPassportClient` default export).
- Validate all external input with Zod schemas (`zod`) — never trust
  `req.body` or `process.env` directly.

### Python Style

- Follow PEP 8; 4-space indent.
- Public functions and methods get docstrings.
- Type hints on all new public functions.
- Match the existing layout in `sdk/python/agent_passport/`.

### Tests

- All new logic must be covered by unit tests.
- Bug fixes must include a regression test that fails before the fix.
- Integration and E2E tests should be deterministic — never depend on the
  state of a specific wallet on the live testnet.
- Coverage thresholds are enforced in `vitest.config.ts` (statements 80%,
  branches 70%, functions 80%, lines 80%) — keep your patch above them.

## Commit Conventions

This project follows [Conventional Commits 1.0.0](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>)<!:> <short summary>

<optional body — wrap at 72 columns>

<optional footer — references, breaking changes>
```

### Allowed Types

| Type       | Purpose |
|------------|---------|
| `feat`     | New user-facing feature |
| `fix`      | Bug fix |
| `docs`     | Documentation only (no code change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement |
| `test`     | Add or fix tests only |
| `build`    | Build system, CI, or dependency changes |
| `chore`    | Tooling, formatting, or non-production changes |
| `revert`   | Reverts a previous commit |

### Scopes

Common scopes: `api`, `sdk`, `ts-sdk`, `py-sdk`, `trust`, `delegation`,
`reputation`, `underwriting`, `sybil`, `registry`, `x402`, `metrics`,
`security`, `docs`, `ci`, `deps`, `contracts`.

### Examples

```
feat(api): add /verify and /discovery/search routes
fix(metrics): reset request path to canonical form before labelling
docs: document prod-relaxed vs prod-strict SLO split
refactor(sdk): split AgentPassportClient into errors/types/retry modules
test(e2e): cover x402 replay protection and idempotency cache
chore(deps): bump algosdk to 3.2.0
```

### Breaking Changes

Mark with `!` after the type/scope and explain in the footer:

```
feat(api)!: rename /counterparty-check response field `allow` to `decision`

BREAKING CHANGE: clients must read `decision` (boolean) instead of `allow`.
Migration: replace `.allow` with `.decision` in client code; semver-major bump.
```

## Branch Naming

- `feat/<short-slug>` — new features
- `fix/<short-slug>` — bug fixes
- `docs/<short-slug>` — documentation only
- `refactor/<short-slug>` — refactors
- `test/<short-slug>` — test-only changes
- `chore/<short-slug>` — tooling / CI / dependencies

Slugs are lowercase, hyphenated, and descriptive (e.g.
`feat/payment-idempotency`, `fix/registry-underflow`).

## Pull Request Process

1. **Fork** the repository and create a branch from `master`.
2. **Keep PRs small and focused.** One logical change per PR.
3. **Write tests** for the change and ensure they pass locally:
   ```bash
   npm run lint
   npm run typecheck
   SKIP_E2E=1 npm test
   ```
4. **Update documentation** — README, docs/, JSDoc, OpenAPI, or SDK
   reference as needed for the change.
5. **Fill out the PR template** (`.github/PULL_REQUEST_TEMPLATE.md`):
   - Link the issue with `Fixes #123` or `Refs #123`.
   - Summarise the change in 1–3 bullet points.
   - Describe the testing you performed.
   - Tick the checklist.
6. **Pass CI.** All status checks must be green before review.
7. **Reviewer expectations:** expect at least one approval from a
   maintainer. Address review comments with new commits (do not force-push
   during review).
8. **Squash-merge** is the default. Commit history is preserved in the
   squash message.

## Testing

| Command | What it does |
|---------|--------------|
| `npm test` | All Vitest suites, including E2E (skippable with `SKIP_E2E=1`) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest with v8 coverage report |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run lint` | ESLint over `src/` |
| `npm run benchmark` | Performance benchmark for scoring pipeline |
| `cd sdk && npm test` | TypeScript SDK tests (22 tests) |
| `cd sdk/python && pytest` | Python SDK tests (32 tests) |
| `cd load-tests && ./run-all.sh` | k6 load tests (requires k6 + running service) |

## Documentation Expectations

- Public APIs in `src/app.ts` and any new route must be reflected in
  `docs/api/openapi.yaml` and the [Postman collection](docs/api/postman-collection.json).
- New SDK methods require an entry in
  [docs/development/sdk-typescript.md](docs/development/sdk-typescript.md)
  (TS) or [docs/development/sdk-python.md](docs/development/sdk-python.md)
  (Python) and a CHANGELOG entry.
- New environment variables must be added to `.env.example` **and**
  [docs/operations/environment-variables.md](docs/operations/environment-variables.md).
- New Prometheus metrics must be documented in
  [docs/operations/observability.md](docs/operations/observability.md)
  with label cardinality guidance.
- New alerts must include a runbook under `alerts/runbooks/` and an entry
  in [docs/operations/runbooks.md](docs/operations/runbooks.md).

## Release Process

1. Maintainer bumps the version in `package.json` and all sub-packages
   (`sdk/package.json`, `sdk/python/pyproject.toml`).
2. CHANGELOG entries are added in the relevant packages.
3. A signed, annotated tag of the form `vX.Y.Z` is pushed.
4. The CI `load-test-smoke` job runs against the tag.
5. SDKs are published to npm and PyPI by the maintainer.
6. A GitHub release is created with release notes summarising the diff.

---

Thanks again for contributing. If you have any questions, open a
[discussion](https://github.com/sachncs/agent-passport/discussions) or reach
out at **sachncs@gmail.com**.
