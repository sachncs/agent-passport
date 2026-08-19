# Changelog

All notable changes to **Agent Passport** are documented in this file.

> **Latest**: the v0.1.0 release was **not** production-ready. The
> `[Unreleased]` section below ships the production-readiness fix set
> (HMAC auth, mandatory Idempotency-Key, single-application of the
> sybil penalty, race-free persistence, web dashboard x402 fix,
> dependency cleanup) plus a complete frontend redesign using the
> official [shadcn/ui](https://ui.shadcn.com/docs/components) recipe.
> Treat the v0.1.0 tag as a dev preview.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Sub-packages have their own changelogs:
>
> - **TypeScript SDK** — [`sdk/CHANGELOG.md`](sdk/CHANGELOG.md)
> - **Python SDK** — [`sdk/python/CHANGELOG.md`](sdk/python/CHANGELOG.md)

## [Unreleased]

### Web frontend (frontend/) — Next.js 16 + shadcn/ui v4 + tests

Migrated the frontend to fully conform with the
[Next.js 16 project structure](https://nextjs.org/docs/app/getting-started/project-structure)
and the current [shadcn/ui](https://ui.shadcn.com/docs/components)
recipe. Supersedes the previous "REDESIGN" section below.

#### Rendering & framework

- **Removed `output: "export"`** from `next.config.ts`. The previous
  static export contradicted the per-page `force-dynamic` exports and
  prevented use of `loading.tsx`, `proxy.ts`, and other Next.js 16
  conventions. The app now builds as full SSR with prerendered
  static pages.
- **Dropped `export const dynamic = "force-dynamic"`** from every
  `page.tsx` and `not-found.tsx`. With client-side data fetching
  via React Query, server components can prerender statically.
- **Added `app/loading.tsx`** (Suspense fallback using shadcn
  `Card` + `Skeleton`).
- **Added `app/error.tsx`** (Client Component error boundary using
  shadcn `Alert` + `Button`, exposes `reset()`).
- **Added `app/global-error.tsx`** with own `<html>`/`<body>` per
  Next.js 16 docs, catches root-layout crashes.
- **Added `proxy.ts`** (replaces the deprecated `middleware.ts`
  in Next.js 16). Trusts an incoming `X-Request-ID` if it looks
  like a token, otherwise generates a fresh one; attaches it to
  both downstream request headers and response headers. Matcher
  excludes `_next/static`, `_next/image`, `favicon.ico`, and image
  assets.

#### Theme persistence

- **Replaced the cosmetic theme toggle** with a real persisted
  theme via `next-themes`. The previous TopBar toggle updated a
  local `useState` that no DOM code read — the `dark` class on
  `<html>` was hardcoded in `layout.tsx` so light mode never
  activated. Now:
  - `next-themes` (`ThemeProvider` wrapper at
    `src/components/theme-provider.tsx`) writes the theme to
    `localStorage` with `attribute="class"` and `enableSystem`.
  - `layout.tsx` adds `suppressHydrationWarning` on `<html>` and
    drops the hardcoded `dark` class.
  - `TopBar` calls `setTheme()` from `useTheme()` and renders
    via a `mounted` flag to avoid SSR/CSR icon mismatch.

#### shadcn/ui full suite

- **Installed the full shadcn/ui v4 component set** (base-nova
  style, `@base-ui/react` primitives) via `pnpm dlx shadcn@latest add`:
  accordion, alert-dialog, avatar, breadcrumb, chart, checkbox,
  collapsible, combobox, command, context-menu, drawer, dropdown-menu,
  empty, field, hover-card, input-group, input-otp, menubar,
  navigation-menu, pagination, popover, radio-group, scroll-area,
  sheet, sidebar, sonner, spinner, table, toggle, toggle-group.
  Pulls in `cmdk`, `input-otp`, `recharts`, `sonner` as runtime
  deps.
- **Replaced the hand-rolled `Sidebar`** with the official shadcn
  `Sidebar` component: collapsible icon-only mode, responsive
  mobile drawer, cookie-persisted open/closed state, and `b`
  keyboard shortcut to toggle. New `useIsMobile` hook.
- **Mounted Sonner `<Toaster />`** in the root layout (top-right)
  for API feedback. Pages can now call `toast.success / error()`.
- **Created `AppBreadcrumb`** at `src/components/breadcrumb.tsx`
  using shadcn `Breadcrumb`. Renders a route-aware nav indicator
  from the current `usePathname()`. Mounted at the top of `TopBar`.
- **Rewrote `src/components/page-header.tsx`** helpers to use
  shadcn `Empty`, `Spinner`, and `Alert` (`ErrorBlock` is now a
  destructive `Alert`; `EmptyState` uses the shadcn `Empty`
  compound).

#### shadcn v4 API migration

- **Replaced `asChild` pattern with `render` prop.** The shadcn v4
  base-nova components use base-ui's `useRender` hook with a
  `render` prop instead of the Radix-style `asChild` boolean.
  Migrated `BreadcrumbLink`, `SidebarMenuButton`, and `Button` in
  the `not-found` page.
- **Made form pages client components.** `counterparty`,
  `discovery`, `endorse`, and `monitor` `page.tsx` files were
  using `useState`/`useEffect` without a `"use client"` directive —
  they were being treated as server components, which broke the
  build under full SSR. Added the directive.
- **Wrapped `TopBar` in `<Suspense>`** in the root layout because
  it uses `useSearchParams()` for wallet-search init; the prerender
  of `/_not-found` needs a Suspense boundary around any component
  that calls `useSearchParams`, per the Next.js 16 csr-bailout rule.

#### Test infrastructure

- **Added Vitest + Testing Library + MSW.** Was previously zero
  frontend tests. New `vitest.config.ts` (jsdom env, `@/` alias,
  v8 coverage with sensible excludes), `src/test-setup.ts`
  (jest-dom matchers + matchMedia polyfill + `crypto.randomUUID`
  shim + `NEXT_PUBLIC_API_BASE_URL` default for MSW), and scripts
  `test`, `test:watch`, `test:ui`, `test:coverage`, `typecheck`.
- **Wrote 58 tests across 12 files**:
  - `src/lib/utils.test.ts` (5) — `cn()` helper
  - `src/lib/wallet.test.ts` (8) — `isValidWallet` (length,
    case, character set, type guards, regex shape)
  - `src/lib/api.test.ts` (5) — MSW-driven: `X-Request-ID`,
    query encoding, POST `Idempotency-Key`, `ApiError` on non-2xx,
    fallback to `HTTP <status>` on non-JSON bodies
  - `src/components/page-header.test.tsx` (8) — `PageHeader`,
    `EmptyState`, `LoadingBlock`, `ErrorBlock`,
    `WalletRequiredAlert`
  - `src/components/breadcrumb.test.tsx` (5) — `AppBreadcrumb`
    path resolution for /, known segments, multi-segment paths,
    unknown-segment fallback
  - `src/components/topbar.test.tsx` (4) — render + theme toggle
  - `src/components/sidebar.test.tsx` (6) — brand, all 11 nav
    items, active state, nested-path matching, `/` exclusive
    highlight, footer link
  - `src/components/home-page.test.tsx` (3) — brand, tool
    grid, route links
  - `src/app/score/trust-score-client.test.tsx` (4) —
    `WalletRequiredAlert`, loading, success, error
  - `src/app/counterparty/page.test.tsx` (4) — render,
    validation, allow, deny/error
  - `src/app/not-found.test.tsx` (2) — heading + back link
  - `src/app/error.test.tsx` (4) — title, message, fallback,
    reset click, no-digest
- **Fixed `pnpm-workspace.yaml`** to point at the new
  `frontend/` path (was still `apps/*` after the rename in
  commit `6a08afb`). Without this, `node_modules/.pnpm/` symlinks
  resolved to the wrong directory and Vitest couldn't resolve
  `lucide-react`.

#### Documentation

- **Updated root `README.md`** to reference the actual frontend
  (Next.js 16 + shadcn/ui v4 + Tailwind v4 + TanStack React Query)
  in the project-structure tree and tech-stack table. Added a
  "Frontend development" section with install/dev/build/test
  commands and the `page.tsx` + `*-client.tsx` convention.
- **Replaced `frontend/README.md`** create-next-app boilerplate
  with real documentation: stack, directory layout, scripts,
  environment variables, conventions (no `force-dynamic`, shadcn
  in `src/components/ui/`, MSW in tests), and how to add a page
  or component.

### Web frontend (apps/frontend) — REDESIGN (superseded)

> **Superseded by the "Next.js 16 + shadcn/ui v4 + tests" section
> above.** The shadcn/ui v4 base-nova style uses `@base-ui/react`
> with a `useRender` `render` prop instead of Radix + `asChild` +
> `forwardRef`. The previous primitives have been replaced.

The previous UI was a hand-rolled mix of utilities and ad-hoc Radix
wrappers. Replaced with the official [shadcn/ui](https://ui.shadcn.com/docs/components)
recipe end-to-end.

- **Every UI primitive** (Alert, Badge, Button, Card, Dialog, Input,
  Label, Progress, Select, Separator, Skeleton, Tabs, Textarea,
  Tooltip) implemented as the canonical 2024 shadcn/ui source:
  `cva` for variants, Radix for the headless logic, `forwardRef`
  for refs, `tailwind-merge` for class merging.
- **Per-tool pages** (home, trust-score, passport, underwrite,
  delegation, sybil, reputation, counterparty, endorse, discovery,
  monitor, 404) rewritten using a common widget set:
  `PageHeader`, `EmptyState`, `LoadingBlock`, `ErrorBlock`,
  `RiskBadge`, `ScoreBar`, `KV`, `ExplanationList`, `WalletLabel`.
- **Layout**: persistent left sidebar (11 nav items) + top bar
  with wallet search input + theme toggle. Health pill in the
  sidebar footer polls `/health` every 30 s.
- **Routing**: lazy + Suspense per page; new `/404` route.
- **Theme**: `next-themes` handles the dark/light class swap on
  `<html>` (sun/moon toggle in the top bar).
- **API client** (`src/lib/api.ts`): typed fetch wrapper that sends
  `X-Request-ID` on every request, attaches `Idempotency-Key` on
  mutating calls, and surfaces typed `ApiError` with status +
  requestId.
- **Per-wallet `useWalletQuery` hook**: encapsulates the
  `useState` + `useQuery` + URL-param-initial-wallet pattern that
  every page repeated. Reads `?wallet=...` from the URL on first
  load for deep-linking.
- **Replaces the old `apps/web`** directory: 39 docs files were
  renamed to `apps/frontend`; `@agent-passport/web` package renamed
  to `@agent-passport/frontend`. Old name preserved in
  `pnpm-lock.yaml` history only.

Build output: 14 lazy-loaded chunks, main shell ~99 KB gzipped,
biggest (`/sybil` with recharts) ~103 KB gzipped.

### Removed dependencies (broken upstream package)

The `@x402/core`, `@x402/evm`, and `@x402/express` packages were
broken in every published version at the time of upgrade (2.20,
2.21, 2.22). All three ship a chunked `x402Client-*.mjs` module
referenced by their `.d.mts` declaration files but never
generated as a runtime artifact, causing
`ERR_MODULE_NOT_FOUND` on every process start.

- Replaced the runtime x402 implementation in `src/lib/x402.ts`
  with a native module that:
  - Returns `402 Payment Required` with a `PaymentRequirements`
    body for missing `x-payment` headers
  - Calls the facilitator's `POST /verify` endpoint for present
    `x-payment` headers
  - Returns `502` for facilitator unavailability
  - 402 with `reason` on verification failure
- Body shape matches the previous package's `PaymentRequirements`
  so existing SDK clients work unchanged.
- Removed `@x402/core`, `@x402/evm`, `@x402/express` from
  `package.json` and `pnpm-lock.yaml`. 3 fewer dependencies,
  ~0.7 MB smaller install.

### Fixed

- **`__dirname` is not defined in ESM** in `src/lib/build-info.ts`
  (caused a crash-on-startup that masked the x402 module-not-found
  error). Replaced with `fileURLToPath(import.meta.url)` +
  `dirname()`.
- **Test mocks** for x402 rewritten to use `vi.spyOn(globalThis,
  'fetch')` instead of the now-removed `@x402/*` package mocks.

## [Unreleased] — previous work

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