# Module Reference

One section per `src/*.ts` file. Public symbols are listed under
each; internal helpers are not.

## `src/index.ts`

Bootstrap and graceful shutdown.

| Symbol | Visibility | Purpose |
|--------|------------|---------|
| `main()` | internal | `dotenv.config()` → `config` → `app.listen(PORT)` |
| `gracefulShutdown(signal)` | internal | Drains `server.close()` with 10s forced exit |

Handlers:

- `process.on('SIGTERM', ...)` → `gracefulShutdown('SIGTERM')`
- `process.on('SIGINT', ...)` → `gracefulShutdown('SIGINT')`
- `process.on('unhandledRejection', ...)` → log only
- `process.on('uncaughtException', ...)` → `process.exit(1)`

See [../operations/graceful-shutdown.md](../operations/graceful-shutdown.md).

## `src/app.ts`

Express app, routes, and middleware order.

| Symbol | Visibility | Purpose |
|--------|------------|---------|
| `app` | exported (used by tests and `index.ts`) | The Express instance |
| `responseCache` | exported | The 500-entry, 60s TTL LRU response cache |
| 19 route handlers | internal | See [../api/README.md](../api/README.md) |

## `src/config.ts`

Env-var parsing and validation.

| Symbol | Type | Purpose |
|--------|------|---------|
| `config` | const object | Parsed env vars (typed) |
| `safeParseInt` | internal | Defensive `parseInt` with fallback |
| `requireEnv` | internal | Throw if a required var is unset (currently unused) |
| `validateConfig` | internal | Cross-field validation (x402 recipient when x402 enabled) |

The `config` object is the **only** thing the rest of the codebase
should read env vars through.

## `src/trust-score.ts`

Composite trust score (0–100) with 5 sub-scores.

Public symbols (excerpt):

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `WalletTrustScore` | interface | Response shape |
| `scoreWallet(wallet)` | `Promise<WalletTrustScore \| null>` | Cached variant (uses LRU) |
| `scoreWalletFresh(wallet)` | `Promise<WalletTrustScore \| null>` | Bypasses LRU; used by `/passport` |
| `computeAgeScore(days)` | `(number) => number` | Linear+log ramp over 730 days |
| `computeActivityScore(txns, days, assets)` | `(number, number, number) => number` | Frequency + age + diversity |
| `computeVolumeScore(balanceMicroAlgo, txns)` | `(number, number) => number` | Log balance + tx count |
| `computeVelocityScore(txns, days)` | `(number, number) => number` | Bot/spam penalty |
| `computeComplianceScore(balanceMicroAlgo, txns)` | `(number, number) => number` | Sanctions + risk penalty |
| `applySybilPenalty(score, sybilRisk)` | `(number, number) => number` | Two-tier sybil penalty |
| `applyFreshWalletCap(score, accountAgeDays)` | `(number, number) => number` | 30-day minimum trust cap |
| `classifyRisk(score)` | `(number) => 'low'\|'medium'\|'high'\|'critical'` | 4-bucket risk |
| `computeRecommendedLimit(score)` | `(number) => number` | Tiered USDC limit |

See [../concepts/trust-scoring.md](../concepts/trust-scoring.md) for
the math.

## `src/delegation.ts`

Delegation trust graph.

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `DelegationTrustScore` | interface | Response shape |
| `scoreDelegation(wallet)` | cached | Used by `/delegation` |
| `scoreDelegationFresh(wallet)` | bypass | Used by `/passport` |
| `computeDelegationTrustScore(breakdown)` | pure | Weighted combination |
| `computeDepthScore(depth)` | pure | 100 → 0 at depth 7 |
| `computeSponsorQualityScore(avg)` | pure | Quality-weighted |
| `computeSponsorCountScore(count, avgQuality)` | pure | Quality-aware |
| `computeAmountScore(amountMicroAlgo)` | pure | Log scale |
| `clearDelegationCache()` | exported | Test helper |

See [../concepts/delegation.md](../concepts/delegation.md).

## `src/sybil.ts`

Sybil detection (12 signals).

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `SybilResult` | interface | Response shape |
| `detectSybil(wallet)` | cached | Used by `/sybil-check` |
| `detectSybilFresh(wallet)` | bypass | Used by `/passport` |
| 12 `compute*` functions | pure | One per signal |

See [../concepts/sybil-detection.md](../concepts/sybil-detection.md).

## `src/credit.ts`

Credit capacity estimation.

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `CreditEstimate` | interface | Response shape |
| `estimateCredit(wallet, amount?)` | `Promise<CreditEstimate \| null>` | Used by `/credit-estimate` |
| `estimateCreditWithTrust(wallet)` | `Promise<CreditEstimate \| null>` | Used by `/underwrite` and `/passport` |
| `computeBalanceCapacity(balanceAlgo)` | pure | Capacity from balance |
| `computeActivityBonus(totalTxns)` | pure | Capacity from activity |
| `computeAgeBonus(accountAgeDays)` | pure | Capacity from age |
| `computeRiskPenalty(velocity, compliance)` | pure | Penalty for low scores |
| `computeEstimatedLimit(breakdown)` | pure | Final limit |

## `src/underwriting.ts`

Decision engine (4 factors, 0.35/0.25/0.20/0.20).

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `UnderwritingDecision` | interface | Response shape |
| `UnderwritingFactor` | interface | Per-factor breakdown |
| `underwrite(wallet)` | `Promise<UnderwritingDecision \| null>` | The composite decision |
| `computeCompositeScore(factors)` | pure | Weighted sum |
| `decideApproval(composite, sybilRisk, reputation)` | pure | Approve / deny |
| `classifyUnderwritingRisk(score)` | pure | 4-bucket risk |

Also re-exports the system-exposure helpers (see
[../operations/system-exposure.md](../operations/system-exposure.md)).

See [../concepts/credit-and-underwriting.md](../concepts/credit-and-underwriting.md).

## `src/reputation.ts`

On-chain reputation events.

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `EventType` | type union | 6 event types |
| `EVENT_TYPES` | const array | Iteration |
| `EVENT_TYPE_MAP` | const object | Event → on-chain char |
| `EVENT_WEIGHTS` | const object | Per-event reputation weight |
| `recordEvent(input)` | `Promise<{ ok, txId?, error? }>` | Public entry point |
| `computeReputation(wallet)` | `Promise<ReputationResult>` | Pure read |
| `verifyCounterparty(counterparty)` | internal | F1 — counterparty existence |
| `verifyDisputeEvent(wallet, counterparty, round)` | internal | F5 — on-chain relationship |
| `verifySelfReportedEvent(wallet, type)` | internal | Self-report verification |

See [../concepts/reputation.md](../concepts/reputation.md).

## `src/passport.ts`

Passport document generation.

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `AgentPassport` | interface | Document shape |
| `PASSPORT_SCHEMA_VERSION` | const `1` | Bumped on breaking changes |
| `generatePassport(wallet)` | `Promise<AgentPassport \| null>` | The bundle |
| `computeIdentityStrength(...)` | internal | Composite of trust + sybil |
| `computePassportChecksum(passport)` | internal | SHA-256 over deterministic fields |

See [../concepts/passport-document.md](../concepts/passport-document.md).

## `src/trust-graph.ts`

Trust graph analytics, exposure, what-ifs.

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `TrustGraphResult` | interface | Response shape |
| `analyzeTrustGraph(wallet)` | `Promise<TrustGraphResult \| null>` | The full graph + exposure + what-ifs |

The BFS traversal uses `MAX_BRANCHING_FACTOR = 10` per node.

## `src/counterparty.ts`

Merchant counterparty check.

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `CounterpartyResult` | interface | Response shape |
| `checkCounterparty(buyer)` | `Promise<CounterpartyResult \| null>` | 60% on-chain + 40% delegation |
| `computeCombinedScore(onChain, delegation)` | pure | 60/40 weighted |
| `computeConfidence(combinedScore)` | pure | Tiered |
| `decideApproval(combined, confidence)` | pure | Approve / deny |

## `src/registry.ts`

On-chain `/delegate` and `/revoke` adapter.

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `RegistryNotConfiguredError` | class | Thrown when `REGISTRY_APP_ID=0` |
| `RegistryValidationError` | class | Thrown for bad input |
| `DelegationResult` | interface | Response shape |
| `RevocationResult` | interface | Response shape |
| `delegate(sponsor, agent, amount)` | `Promise<DelegationResult>` | Submit `add_delegation` |
| `revoke(sponsor, agent)` | `Promise<RevocationResult>` | Submit `revoke_delegation` |
| `isRegistryConfigured()` | `() => boolean` | Used by `/registry/status` |

See [../architecture/smart-contracts.md](../architecture/smart-contracts.md).

## `src/lib/algorand-client.ts`

Single shared `algod` SDK client.

```typescript
export const algod = new algosdk.Algodv2(config.algodToken, config.algodUrl);
```

All other modules import this constant — they do not construct their
own clients.

## `src/lib/cache.ts`

The `LRUCache<T>` class.

See [caching.md](caching.md) for the full design. The class
exposes `get`, `set`, `has`, `delete`, `clear`, `getStats`, and
`size`.

## `src/lib/constants.ts`

Wallet regex, network constants, and x402 pricing.

| Symbol | Value | Purpose |
|--------|-------|---------|
| `WALLET_REGEX` | `/^[A-Z2-7]{58}$/` | Algorand address format |
| `isValidWallet(wallet)` | `(string) => boolean` | Validator |
| `MICRO_ALGO` | `1_000_000` | Algo → microAlgo |
| `ALGO_DECIMALS` | `6` | On-chain decimals |
| `SECONDS_PER_BLOCK` | `3.3` | Testnet/mainnet block time |
| `SECONDS_PER_DAY` | `86_400` | For age calculations |
| `TESTNET_GENESIS_ROUND` | `64_600_000` | Testnet genesis |
| `MAX_ROUNDS_LOOKBACK` | `1_000_000` | Cap for indexer queries |
| `X402_PRICING` | const object | Per-endpoint USDC price |

## `src/lib/graph.ts`

Pure-math graph algorithms (4 sybil signals).

Public symbols (all pure, no I/O):

| Symbol | Complexity | Purpose |
|--------|-----------|---------|
| `buildAdjacencyList(transactions)` | `O(E)` | Map from address to set of neighbours |
| `computeClusteringCoefficient(...)` | `O(k²)` per node | V2: tightly-interconnected neighbours |
| `computeHubScore(adj, node)` | `O(1)` | V4: central hub detection |
| `computeIntermediateDensity(adj, node)` | `O(k² × d)` | V6: 2-hop intermediary density |
| `bfs(adj, root, maxDepth)` | `O(V+E)` | Index-based dequeue BFS |
| `findConnectedComponents(adj, nodes)` | `O(V_sub + E_sub)` | Constrained BFS |
| `computeTemporalCorrelation(...)` | `O(V² × R)` | V8: round-time clustering |
| `computeGraphSignals(transactions, nodes)` | composite | The 4-signal batch |

## `src/lib/idempotency.ts`

`Idempotency-Key` middleware and store.

See [../operations/idempotency.md](../operations/idempotency.md) for
the full design. Public symbols:

| Symbol | Purpose |
|--------|---------|
| `IdempotencyRecord` | interface — the stored shape |
| `idempotencyMiddleware` | Express middleware |
| `isValidIdempotencyKey(key)` | Validator |
| `generateServerKey()` | `srv_<16-hex>` fallback |
| `hashBody(body)` | SHA-256 of JSON |
| `getIdempotencyRecord(key)` | Read |
| `setIdempotencyRecord(...)` | Write |
| `clearIdempotencyStore()` | Test helper |
| `idempotencyStoreSize()` | Test helper |

## `src/lib/logger.ts`

Structured JSON logger.

| Function | Purpose |
|----------|---------|
| `logger.debug(msg, meta?)` | Only at LOG_LEVEL=debug |
| `logger.info(msg, meta?)` | Informational |
| `logger.warn(msg, meta?)` | Recoverable issue |
| `logger.error(msg, meta?)` | Error — also written to `LOG_ERROR_FILE` if set |

Log lines are JSON: `{ level, message, timestamp, requestId?, action?, error?, meta? }`.

## `src/lib/metrics.ts`

The 38 Prometheus metrics + Express middleware.

Public symbols (excerpt):

| Symbol | Purpose |
|--------|---------|
| `metricsMiddleware` | Records one observation per request |
| `metricsEndpoint` | The `/metrics` handler |
| `recordUnderwritingDecision(outcome)` | Counter |
| `recordCounterpartyCheck(outcome)` | Counter |
| `recordIdempotencyConflict()` | Counter |
| `recordVerifyCheck(flags)` | Counter (label `flag` ∈ funded/active/empty/lookup_failed) |
| `recordDiscoverySearch(query, resultCount)` | Counter |
| `recordContractEvent(type)` | Counter (endorsement, revocation, dispute, success) |
| ~30 more `record*` and getter functions | Per-metric |

See [../operations/observability.md](../operations/observability.md) for
the full inventory.

## `src/lib/metrics-collectors.ts`

Process / uptime gauges.

| Symbol | Purpose |
|--------|---------|
| `startMetricsCollectors()` | Start the 15s interval timer |
| `stopMetricsCollectors()` | Stop on signal |

Exports:
- `processMemoryUsageBytes` (rss, heapTotal, heapUsed, external, arrayBuffers)
- `processUptimeSeconds`

## `src/lib/operator-wallet.ts`

Operator wallet init + transaction submission.

| Symbol | Purpose |
|--------|---------|
| `initOperatorWallet()` | One-time, on startup |
| `getOperatorAccount()` | For advanced callers |
| `getOperatorAddress()` | For logging |
| `submitApplicationCall(appIndex, appArgs, accounts)` | Sign and send |

See [../security/operator-wallet.md](../security/operator-wallet.md).

## `src/lib/security.ts`

Rate limit, CORS, requestId, request logging.

| Symbol | Purpose |
|--------|---------|
| `rateLimiter(opts)` | The 600/min/IP limiter |
| `resetRateLimiter()` | Test helper |
| `corsMiddleware(opts)` | CORS with origin validation |
| `requestIdMiddleware` | UUID per request |
| `requestLoggingMiddleware` | Structured log line |

See [../operations/rate-limiting.md](../operations/rate-limiting.md).

## `src/lib/system-exposure.ts`

`MAX_SYSTEM_EXPOSURE = 100_000` and the cap math.

| Symbol | Purpose |
|--------|---------|
| `MAX_SYSTEM_EXPOSURE` | `100_000` USDC |
| `getSystemExposure()` | Current total |
| `addSystemExposure(amount)` | Add + persist + notify |
| `resetSystemExposure()` | Test helper |
| `setSystemExposure(amount)` | Restore from disk |
| `capToSystemCapacity(recommendedLimit)` | The cap math |
| `onExposureChange(listener)` | Subscribe to changes |

See [../operations/system-exposure.md](../operations/system-exposure.md).

## `src/lib/timeout.ts`

`withTimeout` and `fetchWithTimeout`.

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `withTimeout<T>(promise, ms?, label?)` | `Promise<T>` | Promise race against a timeout |
| `fetchWithTimeout(url, opts?)` | `Promise<Response>` | Fetch with `AbortController` |

Default timeout is 10 000 ms.

## `src/lib/x402.ts`

x402 middleware + settlement verification.

| Symbol | Purpose |
|--------|---------|
| `x402Middleware` | The paywall (off by default) |
| `settlementVerificationMiddleware` | Asynchronous on-chain check |
| `verifySettlement(payload, requirements)` | Programmatic verify |

See [middleware-stack.md](middleware-stack.md) § x402.
