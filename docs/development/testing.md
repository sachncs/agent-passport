# Testing

The project uses **Vitest** as the test runner. The test layout is
`src/**/*.test.ts` plus a separate `src/__tests__/e2e/` directory
for end-to-end flow tests.

## Quick reference

| Command | What it does |
|---------|--------------|
| `npm test` | All unit tests (excludes `*-integration.test.ts` by default) |
| `npm run test:integration` | Integration suite — live Algorand testnet round-trips |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest with v8 coverage report |
| `SKIP_E2E=1 npm test` | Legacy alias for `npm test` (the E2E suite is now opt-in via `test:integration`) |

## Test layout

```
src/
├── __tests__/                     # 1 145 unit tests (default `npm test`)
│   ├── api.test.ts
│   ├── benchmark.test.ts
│   ├── counterparty.test.ts
│   ├── credit-capacity-audit.test.ts
│   ├── credit.test.ts
│   ├── delegation.test.ts
│   ├── edge-cases.test.ts
│   ├── graph-audit.test.ts
│   ├── graph.test.ts
│   ├── metrics.test.ts
│   ├── passport-audit.test.ts
│   ├── passport.test.ts
│   ├── registry.test.ts
│   ├── reputation-audit.test.ts
│   ├── sybil-adversarial.test.ts
│   ├── sybil.test.ts
│   ├── trust-graph.test.ts
│   ├── trust-score.test.ts
│   ├── underwriting.test.ts
│   ├── delegation-integration.test.ts          # live testnet
│   ├── counterparty-integration.test.ts        # live testnet
│   ├── credit-integration.test.ts             # live testnet
│   ├── trust-score-integration.test.ts         # live testnet
│   ├── trust-graph-integration.test.ts         # live testnet
│   ├── sybil-integration.test.ts               # live testnet
│   ├── reputation-integration.test.ts          # live testnet
│   ├── underwriting-integration.test.ts         # live testnet
│   ├── passport-integration.test.ts            # live testnet
│   └── e2e/
│       ├── _fixtures.ts
│       ├── full-flows.test.ts
│       ├── security.test.ts
│       └── idempotency-unit.test.ts
└── lib/
    ├── __tests__/
    │   ├── cache.test.ts
    │   ├── logger.test.ts
    │   ├── security.test.ts
    │   └── timeout.test.ts
    ├── … (no other tests in this directory)
```

## Unit tests vs integration tests

The vitest config (`vitest.config.ts`) excludes files matching
`**/*-integration.test.ts` from the default `npm test` run.
Integration tests:

- Hit the **public Algorand testnet** (or a configurable endpoint)
- Use a real test wallet (`GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A`)
- Take 1–5 s per test (vs < 10 ms for unit tests)
- Are subject to rate limiting — running 8 files in parallel can
  trigger `429 Too Many Requests` from AlgoNode's free tier

To run the full suite (unit + integration):

```bash
npm run test:integration
```

## E2E tests

`src/__tests__/e2e/` contains 17 flow-level tests. They use
[`supertest`](https://github.com/ladjs/supertest) to spin up the
Express app in-process and exercise the routes end-to-end. The E2E
suite:

- Runs entirely in-process (no real Algorand RPCs)
- Uses mocks for `scoreWallet`, `scoreDelegation`, `detectSybil`,
  etc. (the route handlers' upstream calls)
- Validates response shapes, status codes, and headers
- Covers 17 flows from `/score` to `/verify` to `/delegate` to
  `/discovery/search`

`npm test` runs the E2E suite by default. `SKIP_E2E=1` is
accepted as a legacy alias but is a no-op since the E2E suite is
unit-style (mocked).

## Coverage

`npm run test:coverage` produces a coverage report under
`coverage/`. The thresholds are configured in
`vitest.config.ts`:

| Metric | Threshold |
|--------|----------:|
| Statements | 80% |
| Branches | 70% |
| Functions | 80% |
| Lines | 80% |

Coverage below the threshold fails CI.

## What to test

### For new code

- All new pure functions need unit tests (collocated with the
  source: `src/foo.ts` + `src/__tests__/foo.test.ts` or
  `src/foo.test.ts` for simple modules).
- Bug fixes need a **regression test** that fails before the fix
  and passes after.

### For new HTTP routes

- Add a route in `src/app.ts`
- Add a section in [../api/README.md](../api/README.md)
- Add the route to `docs/api/openapi.yaml`
- Add a request to `docs/api/postman-collection.json`
- If the route is mutating, add an E2E test in
  `src/__tests__/e2e/full-flows.test.ts`
- If the route is mutating on-chain, add a section in
  [../development/contracts.md](../development/contracts.md) if
  the contract changes

### For new metrics

- Add a metric to `src/lib/metrics.ts`
- Add it to [../operations/observability.md](../operations/observability.md)
- If it has alert implications, add an alert rule and a runbook

### For new env vars

- Add to `src/config.ts`
- Add to `.env.example`
- Add to [../operations/environment-variables.md](../operations/environment-variables.md)
- Add a unit test for the default and the override

## Test isolation

The vitest config does not run tests in parallel by default for
integration tests. Unit tests are parallel-safe. The E2E suite
spins up its own Express app per `describe` block and tears it
down after each block.

The `load-tests/` directory uses k6 and is **not** part of the
Vitest suite. See [../operations/load-testing.md](../operations/load-testing.md).

## See also

- [../operations/load-testing.md](../operations/load-testing.md) —
  k6 suite
- [../architecture/module-reference.md](../architecture/module-reference.md) —
  one section per `src/*.ts` file
- [../concepts/](../concepts/) — pure-math functions are tested
  alongside their source
