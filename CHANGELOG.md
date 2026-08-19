# Changelog

All notable changes to **Agent Passport** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Sub-packages have their own changelogs:
>
> - **TypeScript SDK** — [`sdk/CHANGELOG.md`](sdk/CHANGELOG.md)
> - **Python SDK** — [`sdk/python/CHANGELOG.md`](sdk/python/CHANGELOG.md)

## [Unreleased]

### Security (CRITICAL — read before deploying)

These are the production-readiness findings from the v0.1.0 audit
([`docs/reports/production-readiness.md`](docs/reports/production-readiness.md)).
The `0.1.0` tag was **NOT** production-ready; this release is.

- **HMAC-SHA256 auth on state-changing endpoints.** A new
  `src/lib/hmac-auth.ts` middleware is wired after `idempotencyMiddleware`
  and gates `/delegate`, `/revoke`, `/reputation/record`, and
  `/reputation/subscribe`. The canonical string is
  `METHOD\nPATH\nsha256(body)\nTIMESTAMP\nNONCE`, signed with
  `HMAC_SECRET` (≥ 32 chars). Replay window: ±60s. Headers
  required: `X-Auth-Timestamp`, `X-Auth-Nonce`, `X-Auth-KeyId`,
  `X-Auth-Signature`. Public reads and operational endpoints bypass.
- **Idempotency-Key is now mandatory on mutating calls** (was
  auto-generated). A missing key returns `400` instead of silently
  issuing a server-side key. This prevents an unauthenticated
  attacker (combined with the prior bug) from issuing an unbounded
  stream of operator-signed on-chain transactions.
- **Single application of the sybil penalty.** Previously the
  penalty was applied three times across the trust-score,
  Sybil Resistance factor, and credit-limit multiplier — a wallet
  with `sybilRisk=0.5` was penalized in all three. The canonical
  penalty now lives in `computeUnderwritingLimit` in
  `src/underwriting.ts`. Two phantom penalty calls removed.
- **Rate-limit save race fixed.** `saveRateLimitState` used a
  non-atomic `if (inFlightSave) return;` check; two concurrent saves
  could both pass the check and write the older snapshot. Replaced
  with a `writeQueue = Promise.resolve(); writeQueue = writeQueue.then(...)`
  promise-queue mutex. Pattern shared with the new
  `src/lib/system-exposure.ts` and `src/lib/webhooks.ts` persistence
  paths via the new `src/lib/json-store.ts` helper.
- **Operator wallet is initialized at startup.** Previously the
  `OPERATOR_MNEMONIC` was loaded but never used — every `/delegate`,
  `/revoke`, and `/reputation/record` was a silent no-op. The
  `/ready` probe now returns 503 if the operator key is missing.
- **Webhook SSRF protection.** New `validateWebhookUrl` rejects
  loopback / private / link-local hostnames (including AWS
  metadata `169.254.169.254`), userinfo, and fragments. HTTPS
  required in production. Plus per-subscriber HMAC signing on
  webhook deliveries (`X-Webhook-Signature`).
- **Dashboard script moved to `dashboard.js`.** The HTML was inline
  in `public/dashboard.html`; Helmet's default CSP blocked it.
- **CORS allow-headers expanded** to include `Idempotency-Key`,
  `x-payment`, and the `X-Auth-*` family so browser callers of
  state-changing endpoints are not silently rejected by preflight.

### Fixed

- **Idempotency body hash is canonical** (sorted keys), so
  `{"a":1,"b":2}` and `{"b":2,"a":1}` no longer produce 409s.
- **`/underwrite` no longer inflates the system-exposure counter on
  read-only calls** (an attacker hammering the endpoint could starve
  other wallets of the $100k cap).
- **`/reputation/record` now requires a positive `round` for dispute
  events** — without it, `verifyDisputeEvent` accepted any wallet
  pair that had ever transacted. Disputes with `round <= 0` are
  rejected at `recordEvent` time.
- **x402 settlement verification now actually rejects unverified
  payments with 402** instead of logging and proceeding. The
  middleware runs `verifySettlement` synchronously before
  `next()`, and failures bubble up to the client.
- **`/health/deep` and `/ready` both return 503 when the Algorand
  endpoint is unreachable**; the previous `/health` always returned
  200 even when the service was broken.
- **Force-shutdown timer is `.unref()`-ed** so it doesn't keep the
  event loop alive after a successful `server.close()`.
- **k6 scenarios fixed** — they were importing `trustScoreDuration`
  and `ALT_WALLET` (didn't exist); now use `scoreDuration` and
  `VALID_WALLET`.
- **Wallet validation now uses `algosdk.isValidAddress()` for the
  base32 checksum** — typo'd addresses were previously accepted by
  the length-only regex and rejected downstream with a 404.
- **Sybil funding-sources bug** — `fundingSources.set(wallet, ...)`
  was keyed on the literal target wallet, so every counterparty
  lookup returned `undefined` via the `|| 'unknown'` fallback,
  inflating `fundingCorrelation` to ~1.0. Now keyed by `receiver`.
- **Sybil transaction pagination** capped at 10 pages × 100 = 1 000
  txns. Previously, a busy wallet (e.g. exchange hot wallet) caused
  OOM.
- **Compute-amount-score log-floor** — `Math.max(1, algo)` produced
  `log10(2)*25 ≈ 7.5` for `algo=0`. Now returns 0 for `algo <= 0`.
- **README example wallet** corrected from 57 → 58 characters.
- **`.dockerignore`** now excludes `docs/`, `alerts/`, `data/`,
  `load-tests/`, `public/`, `__tests__/`, and `.benchmarks/`.
- **Vitest default config** excludes the e2e suite (which hits live
  testnet) and `benchmark.test.ts`; both remain opt-in via
  `npm run test:integration` and `npm run benchmark`.
- **Vitest 4 mock constructor compatibility** — `vi.fn().mockImplementation(() => ({...}))`
  was treated as a non-constructor; now wrapped as
  `function () { return {...} }` for `new TTLCache()` and
  `new HTTPFacilitatorClient()`.
- **Vitest include test isolation** — `GET /health/deep` test that
  relied on a shared mocked algod now explicitly resets the mock to
  the resolved case in its own `it` block.
- **Tsconfig moduleResolution** for pnpm-hoisted `@types/express-serve-static-core`
  and `@x402/*` types under `moduleResolution: "node"`.

### Added

- **`src/lib/hmac-auth.ts`** — HMAC middleware + `signHmacRequest`
  client helper.
- **`src/lib/json-store.ts`** — shared `queueJsonWrite` /
  `readJsonFile` helper that consolidates the three copies of
  JSON-persistence + write-queue mutex in `security.ts`,
  `system-exposure.ts`, `webhooks.ts`.
- **`src/lib/request-deadline.ts`** — per-request deadline
  middleware that sets `res.locals.deadlineAt` from
  `REQUEST_TIMEOUT_MS` and logs overruns on `res.on('finish')`.
- **19 alert rules** (was 24) — duplicates removed:
  `HighErrorRate`/`ElevatedErrorRate` collapsed;
  `X402PaymentVerificationFailing` + 2 contract-event-stall variants
  consolidated.
- **x402 settlement-failure counter**
  (`agent_passport_x402_settlement_failures_total`) — wired to
  `verifySettlement()` failures.
- **Business metrics declared at module scope** (were previously
  registered lazily via `getSingleMetric(...).inc(...)` and silently
  dropped by prom-client 15):
  - `agent_passport_underwriting_decisions_total{outcome}`
  - `agent_passport_counterparty_checks_total{outcome}`
  - `agent_passport_idempotency_conflicts_total`
  - `agent_passport_verify_checks_total{flag,result}`
  - `agent_passport_discovery_searches_total{query_class,result_count}`
- **`network` label** added to `contract*_total` metrics so
  testnet vs mainnet are distinguishable.
- **Trust-score and graph-traversal duration histograms**
  (`agent_passport_trust_score_duration_seconds`,
  `agent_passport_graph_traversal_duration_seconds`,
  `agent_passport_graph_traversal_depth`) — wired into
  `scoreWalletInternal` and `analyzeTrustGraph`.
- **`status_class` label** on HTTP metrics (`2xx`/`3xx`/`4xx`/`5xx`)
  — the raw `status` label was creating millions of series.
- **`stopIdempotencySweeper()`** — companion to the existing
  `idempotencyStoreSize()`, called from `gracefulShutdown`.
- **CORS `RATE_LIMIT_OVERRIDES` env var** — JSON map for per-endpoint
  caps. Example: `'{"POST /delegate":{"max":5}}'`.
- **`.env.example` documents `PORT`, `NODE_ENV`** and warns to load
  `OPERATOR_MNEMONIC` from a secret manager.
- **Graceful-shutdown lifecycle**: `stopRateLimiter()` clears the
  5-min cleanup interval; `stopDedupCleanup()` clears the reputation
  dedup cleanup. All `setInterval` timers `.unref()`-ed so they
  don't block process exit.
- **Two Grafana SLO profiles** (relaxed + strict) and 8 runbooks
  under `alerts/runbooks/`.

### Performance (operational)

- **Reduced over-fetch in trust score**: 5 sub-score calls run
  in parallel where independent; same as the prior implementation
  but with proper `withTimeout` guarding.
- **`fetchWithTimeout` removed** — `fetch(url, { signal: AbortSignal.timeout(ms) })`
  is the canonical pattern now; 4 call sites updated.
- **Per-route rate-limit overrides** via `RATE_LIMIT_OVERRIDES`
  (JSON) — defaults to 5/min for `/delegate` and `/revoke`,
  30/min for `/underwrite`, 120/min for `/counterparty-check`.
- **Coalesced rate-limit cleanup writes** — only persist if ≥60s
  since last save, not every 5min.

### Web frontend (apps/frontend) — NEW

A complete Vite + React + shadcn/ui frontend covering every API
endpoint. The README now has a "Quick start" section pointing to
the Vite dev server. Each page maps 1:1 to an API route:

- `/` — Home: tool catalog + score-weight preview
- `/score` — Trust Score Explorer
- `/passport` — Full passport doc with tabs (Summary / On-chain /
  Capabilities / Checksum)
- `/underwrite` — Underwriting decision + What-if credit dialog
- `/delegation` — Sponsor tree + simulate-sponsor-loss dialog
- `/sybil` — Radar chart + per-signal bars + flagged wallets
- `/reputation` — Sentiment breakdown + record-event dialog +
  subscribe-webhook dialog
- `/counterparty` — Buyer risk check
- `/endorse` — Endorse/Revoke forms
- `/discovery` — Bazaar search
- `/monitor` — Health/version/metrics summary

**Stack**: Vite 6 + React 19 + TypeScript, shadcn/ui (Card, Button,
Input, Tabs, Dialog, Select, Switch, Tooltip, Alert, Badge, Progress,
Skeleton, Separator), Tailwind CSS v3 (light + dark via class
strategy), TanStack Query, React Router 7, recharts (radar), sonner
(toasts), lucide-react (icons).

**Route-level lazy code splitting** — each page is lazy-loaded with
`React.lazy + Suspense`, so the initial shell only ships
`~123 KB gzipped`. The `sybil` chunk (which pulls in recharts) is
~103 KB gzipped and only downloaded when visiting `/sybil`.

**Multi-stage nginx Dockerfile** (`apps/frontend/Dockerfile`) — Vite build
+ nginx 1.27 serving static files on port 8080. Runs as non-root,
adds defensive security headers (X-Frame-Options, X-Content-Type-Options,
Referrer-Policy), and caches hashed assets aggressively (1 year,
immutable).

**Single-source-of-truth API client** (`apps/frontend/src/lib/api.ts`) —
thin fetch wrapper that:
- Sends `Idempotency-Key` on every mutating request
- Sends `X-Request-ID` for cross-service trace correlation
- Throws `ApiError` with status + requestId on failure

**TypeScript types** are hand-maintained in
`apps/frontend/src/types/api.ts`; the runtime OpenAPI spec at
`/openapi.json` is the source of truth. `pnpm --filter @agent-passport/frontend
run codegen` regenerates this file from the live spec when the
API is running.

**Custom `useWalletQuery` hook** for the per-wallet page boilerplate
that was repeating across 6 pages.

### Refactored

- **Consolidated 3 copies of JSON-persistence + write-queue** into
  `src/lib/json-store.ts`. Net: −75 lines across `security.ts`,
  `system-exposure.ts`, `webhooks.ts`; +75 in the shared helper.
- **Inlined `singleflight.ts`** into `trust-score.ts` (single
  consumer, +5 lines vs 38-line module + 49-line test).
- **Inlined `bazaar.ts`** into `app.ts` (single consumer for one
  route that loads at startup).
- **Trimmed `sanctions.ts`** to only the `MemorySanctionsProvider` —
  `AllowAllProvider`, `BlockAllProvider`, and the
  `SANCTIONS_PROVIDER` env switch were speculative and never wired.
  Kept `setSanctionsProvider()` for test injection.
- **Replaced `fetchWithTimeout` wrapper** with
  `AbortSignal.timeout()` (5 call sites).
- **Dropped unused exports**: `createPassport` (SDK alias for
  `getPassport`, never called), `PaginationOptions`/`Page<T>` (never
  used), `applySybilPenalty` (audit cut), `isValidAlgoAddress`
  (wrapper for `isValidWallet`), `isPastDeadline` (never called),
  `Table`/`Textarea`/`CardFooter`/`SelectGroup` (never imported).
- **Dropped 4 unused Radix packages** from `apps/frontend/package.json`:
  `@radix-ui/react-avatar`, `react-dropdown-menu`, `react-popover`,
  `react-toast` (the UI uses sonner for toasts).
- **Dropped 2 unused UI files**: `apps/frontend/src/components/ui/table.tsx`
  (87 lines) and `textarea.tsx` (19 lines).
- **Replaced 67-line hand-rolled `theme-provider.tsx`** with a thin
  shim over `next-themes` (already a dep).
- **Pnpm workspaces** — converted root to `pnpm-workspace.yaml` so
  `apps/frontend` and `sdk` are workspace packages; `pnpm install` is now
  the canonical install command.

### Audit

- **1569/1569 tests passing** across 58 unit test files.
  Pure-math unit tests for `reputation.ts`, `passport.ts`,
  `sybil.ts`, `credit.ts`, `delegation.ts`, `underwriting.ts`,
  `trust-score.ts`, `counterparty.ts` — coverage of all
  exported and internal math functions.
- **`npm run typecheck`** clean (server + web).
- **`npm run lint`** clean (src/ + apps/frontend/src/).
- **`pnpm build`** clean — 9 lazy-loaded chunks, ~123 KB gzipped shell.
- **Code reductions during refactor** (audit phase): −577 lines,
  −4 dependencies.

### Security disclosure

This release hardens against the threats identified in the
production-readiness audit:

- Wallet-drain via unauthenticated `/delegate` (closed by HMAC +
  mandatory Idempotency-Key)
- Operator mnemonic env-leak (HMS guidance in `security.md#14`)
- SSRF via webhook URL injection (loopback / private IP / AWS
  metadata rejection)
- Sybil-funding-signal false-positive (now reports actual shared
  funders, not "unknown" for everyone)
- Sybil OOM on busy wallets (10-page indexer cap)
- Idempotency body-hash collision on reordered JSON
- Rate-limit save race (now serialized through a promise queue)
- Webhook delivery replay / spoofing (per-subscriber HMAC signature)
- CORS preflight rejection of state-changing browser callers
- Cached passport serving a stale timestamp on cache hits
  (now refreshes `generatedAt` per read)

## [0.1.0] — 2026-06-25

Initial public release. **NOT production-ready** — see
[Unreleased] for the production-readiness fixes shipped after this
tag. The `0.1.0` release is useful for development, evaluation,
and SDK testing, but every state-changing endpoint was effectively
unauthenticated, and `/underwrite` could be DoS'd into filling
the $100k system-exposure cap with read-only calls.

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
    (auto-generated; not mandatory)
  - LRU response cache (60s TTL) for `/score` and `/passport`
- **TypeScript SDK** (`sdk/`, v0.2.0) — 14 methods, 10 typed error classes
- **Python SDK** (`sdk/python/`, v0.2.0) — 14 methods, 10 typed exceptions
- **Observability** (`alerts/`)
  - 24 alert rules in `alert-rules.yml`, plus 12 SLO rules across
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

### Security (v0.1.0 baseline; superseded by [Unreleased])

- Wallet address validation (58-char base32 regex)
- 100 KB body limit, 30 s request timeout
- 600 req/min/IP rate limit with `RATE_LIMIT_TRUSTED_IPS` bypass
- Helmet security headers
- Per-request UUID, surfaced via `X-Request-ID`
- Configurable CORS
- On-chain USDC payment verification for x402

[Unreleased]: https://github.com/sachncs/agent-passport/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sachncs/agent-passport/releases/tag/v0.1.0