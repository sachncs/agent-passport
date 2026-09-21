# Public experience redesign — working evidence ledger

Status: in progress. This is an implementation checklist, not a completion report.
Baseline inspected: `cf5d168`. The attached user brief remains the full scope;
none of its requested surfaces or verification gates are waived here.

## Delivery scope

- [ ] Finish repository-wide inspection, including tests, contracts, SDKs,
  console routes, configuration, operations, deployment, and current public site.
- [ ] Replace the landing narrative with wallet → evidence → decision → action.
  Cover all 39 requested narrative sections, consolidating only where the full
  information remains accessible.
- [ ] Build a coherent design system and refine the existing geometric mark.
- [ ] Build interactive verdict, trust model, delegation graph, sybil matrix,
  underwriting, passport, architecture, payment, and operational diagrams.
- [ ] Build a proper static documentation experience with source-backed
  algorithms, endpoint reference, SDK examples, configuration, and operations.
- [ ] Bring the operational console into the same brand family while preserving
  its live-backend boundary and all existing routes.
- [ ] Add accurate metadata, social image, favicon, robots, and sitemap.
- [ ] Verify installation, typechecking, lint, relevant tests, production builds,
  production previews, all six requested viewport widths, keyboard behavior,
  reduced motion, contrast, links, snippets, copy buttons, and interactions.
- [ ] Complete the brief's 41-item technical-claim audit against implementation.

## Deployment boundary

`site/` is Astro static output. `.github/workflows/site.yml` installs and builds
it and uploads `site/dist` to GitHub Pages. `site/astro.config.mjs` sets
`/agent-passport` as the base. Preserve this deployment. `frontend/` is the
separate Next.js console and must not become a dependency of the landing bundle.
Read `frontend/AGENTS.md` and the installed Next.js guides before console edits.

## Verified findings so far

### HTTP surface

`src/app.ts` declares 26 explicit method/path handlers, including the root
descriptor, legacy dashboard, and operational endpoints. Static middleware at
`/static` is separate. Do not call these “26 public unauthenticated APIs.”

| Method | Paths |
| --- | --- |
| GET | `/score`, `/delegation`, `/sybil-check`, `/reputation`, `/underwrite`, `/trust-graph`, `/registry/status`, `/passport`, `/verify`, `/discovery/search`, `/metrics`, `/version`, `/openapi.json`, `/reputation/subscribers`, `/dashboard`, `/`, `/health`, `/ready`, `/health/deep` |
| POST | `/counterparty-check`, `/credit-estimate`, `/reputation/record`, `/delegate`, `/revoke`, `/reputation/subscribe` |
| DELETE | `/reputation/subscribe/:id` |

The endpoint reference must derive the method/path inventory from source and
compare both OpenAPI surfaces. Per-route purpose, authentication, payment,
idempotency, and side effects still need a generated reference and verification.

### Trust computation

Source: `src/trust-score.ts`.

- Weights: age 20%, activity 25%, volume 20%, velocity 15%, compliance 20%.
- Weighted result clamped 0–100 and rounded to one decimal.
- Inactivity adjustment: 180-day grace, 365-day half-life, multiplier floor 0.30.
  Adjusted result rounded to one decimal.
- Age below 30 days caps the adjusted score at 30, not 40.
- Risk: low ≥70, medium ≥45, high ≥20, critical below 20.
- `approved` is score ≥40, distinct from the medium-risk boundary.
- Velocity is a stepped function: daily rate >100 →0, >50 →20, >20 →40,
  >5 →60, >1 →80, otherwise 100; zero days returns 0.
- “Compliance” subtracts a rounded balance penalty below 1 ALGO (up to 40)
  and a logarithmic transaction-count penalty (up to 50) from 100, then clamps.
  It is not regulatory screening.
- Recommended score limit is score/100 ×500 ×tier, with tiers 1.5 at ≥80,
  1.2 at ≥60, 1 at ≥40, otherwise 0.7. Do not reuse the docs' fixed-limit table.
- `docs/concepts.md` has conflicting velocity, compliance, fresh-wallet, and
  limit descriptions. Do not publish it unchanged as the new model reference.

### Credit and underwriting

Sources: `src/credit.ts`, `src/underwriting.ts`, `src/lib/system-exposure.ts`.

- Credit capacity sums balance (0.5×ALGO balance, max 1000), activity
  (2×transactions, max 200), age (150×days/365, max 150), minus velocity and
  compliance penalties. Final capacity capped at 1350. No delegation collateral.
- Underwriting factors: trust 35%, delegation 25%, inverted sybil risk 20%,
  reputation 20%. Credit capacity is the base for the limit, not a fifth factor.
- Boolean approval denies sybil risk ≥0.70, composite <30, or reputation <10
  together with composite <50. The deny-list result must also be `allowed`.
  No APPROVE/LIMIT/DENY enum and no confidence gate in this implementation.
- Limit multiplies capacity by (0.5 + composite/100), (1 −0.7×sybil risk),
  and (1 +0.3×reputation/100), then clamps to 1350.
- `GET /underwrite` can reserve cumulative local exposure. It bypasses HMAC
  and GET bypasses idempotency. Do not describe every GET as side-effect-free.
- System cap is 100000; per-wallet cumulative cap is 10000. These are software
  safeguards, not funds held or supplied. Zero remaining capacity can coexist
  with `approved: true` and `recommendedLimit: 0`.
- Exposure persists to `EXPOSURE_PERSISTENCE_PATH` or
  `data/system-exposure.json`; local disk is not a shared multi-replica ledger.

### Security and payments

Sources: `src/app.ts`, `src/lib/hmac-auth.ts`, `src/lib/idempotency.ts`,
`src/lib/x402.ts`, `src/lib/constants.ts`, `src/lib/sanctions.ts`.

- HMAC is conditional on configuration and uses a path bypass list. Root and
  registry status are not in that bypass list; subscriber listing is protected.
- The signing implementation uses HMAC-SHA256 with an empty key for the body
  digest, despite its comment saying plain SHA-256. JSON object keys are sorted
  recursively. Canonical request includes method, path without query, body
  digest, timestamp, nonce, separated by newlines.
- Timestamp skew and nonce length are checked. No consumed-nonce store exists
  in this middleware. Do not claim single-use nonce enforcement.
- Idempotency keys are required for all non-GET/HEAD/OPTIONS requests, including
  the analytical POSTs. Successful JSON responses are stored for 24 hours in a
  process-local map. Keys are not scoped by method/path/principal. Middleware
  runs before HMAC. Do not claim globally safe exactly-once execution.
- x402 is optional; its middleware also needs a recipient. Ten paths are priced
  in `X402_PRICING`. Proofs go to the configured facilitator's `/verify`.
  A verified request skips the subsequent settlement verifier. No local consumed
  payment ledger exists here. On-chain settlement/replay claims must explain
  the facilitator dependency; they are not established by this service alone.
- The shipped sanctions provider is a memory deny-list, empty by default and
  extended with `SANCTIONS_EXTRA_DENY`. No external sanctions adapter is wired.

### Passport, sybil, and observability findings

- `computePassportChecksum` in `src/passport.ts` hashes selected deterministic
  fields. Its contract explicitly excludes `generatedAt` and `explanation`.
  It is not an identity signature. Complete schema audit is still pending.
- `computeSybilRisk` in `src/sybil.ts` weights 11 inputs: creation clustering
  .20, interaction density .15, balance similarity .10, circular activity .05,
  timing regularity .08, amount fingerprint .05, funding correlation .02,
  neighborhood clustering .10, hub score .08, intermediate density .10,
  temporal correlation .07. The docs' “12 signals” cannot be copied as-is.
  Inspect extraction and graph sub-signals before final presentation.
- Sybil risk thresholds: medium ≥.25, high ≥.45, critical ≥.70.
- Alert source includes commented-out rules. Count parsed active rules, not
  occurrences of `alert:`. Grafana JSON wraps the dashboard; inspect its
  `dashboard.panels`, not a presumed top-level `panels`.

## Public-site implementation completed in this pass

- Added `scripts/site-inventory.ts`, a source-derived route/environment/console/
  observability inventory. Its current output is checked in at
  `docs/reports/site-inventory.json`: 26 declared handlers, 25 checked-in
  OpenAPI operations, 18 active alert rules, 16 Grafana panels, and 12 console
  page routes. The generator deliberately labels itself as an inventory rather
  than a runtime security certification.
- Reworked the landing page's hero, capability framing, verdict demo, trust,
  delegation, sybil, security, SDK, operations, and adoption copy to remove
  fabricated hosted API, latency, signature, replay, sanctions, attenuation,
  and endpoint-count claims. Demonstration values are labeled as illustrative.
- Added a base-path-safe `/agent-passport/docs/` documentation index with source
  links and a limitation boundary, plus `robots.txt`. The Astro deployment
  remains static and separate from the Next.js console. The docs surface now
  renders first-party static pages for the overview, concepts, API, architecture,
  operations, security, and OpenAPI contract; the index and footer no longer
  send documentation readers to the repository as the primary destination.
- `npm run check --prefix site` and `npm run build --prefix site` pass. The build
  emits the home page and docs page under Astro's `/agent-passport` base and
  includes sitemap output.

## Verification completed after the implementation pass

- `npm run typecheck` passes for the API and Next.js workspace.
- `npm run lint` passes for the API.
- `npm test -- --run` passes: 44 files, 1,589 tests.
- `npm test --workspace=@agent-passport/web -- --run` passes: 13 files, 62 tests.
- `npx next build --webpack` passes for the console. The default Turbopack build
  is blocked in this managed environment when it tries to bind a worker port;
  the initial build also attempted unavailable Google Fonts, so the console now
  uses local/system font fallbacks rather than a network fetch.
- The static preview server could not bind a local port in this sandbox, so HTTP
  smoke requests and browser viewport inspection remain unavailable here.

## Remaining verification

The full brief is broader than this pass. Browser-based viewport inspection,
keyboard/reduced-motion/contrast audits, copy-button and interaction checks,
the complete 41-item claim audit, root/frontend typechecks, relevant tests, and
production preview inspection remain outstanding. Do not mark the redesign goal
complete until those checks and any resulting fixes are performed.

## Second product-composition pass

The landing page was subsequently rebuilt around the narrower product brief in
commit `fa0d7dd`: the hero now leads with “Know which agents to trust,” uses a
single agent trust profile as the primary visual metaphor, and keeps Algorand
below the product promise. The homepage now contains a compact proof strip,
unknown → evidence → decision transformation, three differentiated capability
visuals, a four-step workflow, one developer example, security evidence, and one
final conversion moment. The old repeated feature grids and competing plan/API
CTAs are no longer mounted by `src/pages/index.astro`.

`npm run check --prefix site` and `npm run build --prefix site` pass after this
composition pass. Playwright verification now covers the built static preview at
390px and 1440px widths: the base-path docs links resolve to `/agent-passport/docs/`,
the trust-profile anchor is present, the demo wallet input refreshes the displayed
identity and status, and the Python code tab updates its response and
`aria-selected` state. Responsive checks also cover 768px and 1024px widths.
Desktop and mobile screenshots were captured during the check. The preview is
served over IPv6 because local IPv4 binding is blocked in this environment.
