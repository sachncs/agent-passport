# Caching

The service has three distinct caches, each with different scope,
eviction, and invalidation semantics. They are not interchangeable.

## 1. Response cache (`src/app.ts:27`)

The primary cache. Holds the JSON response bodies for `/score`,
`/passport`, and `/verify`.

```typescript
export const responseCache = new LRUCache<unknown>(500, 60_000);
```

| Property | Value |
|----------|-------|
| Max entries | 500 |
| TTL | 60 000 ms (60 s) |
| Backing class | `src/lib/cache.ts` `LRUCache<T>` |
| Key namespaces | `score:<wallet>`, `passport:<wallet>`, `verify:<wallet>` |
| Eviction | LRU — oldest entry removed when max size is hit |
| Invalidation | **Explicit** via `responseCache.delete(key)` after a mutating call |

### Invalidation triggers

| Mutating call | Invalidated keys |
|---------------|------------------|
| `POST /delegate` | `score:<sponsor>`, `score:<agent>`, `passport:<sponsor>`, `passport:<agent>` |
| `POST /revoke` | same as `/delegate` |
| `POST /reputation/record` | `passport:<wallet>`, `score:<wallet>` |

Invalidation is in-memory and immediate. There is no event bus — a
multi-replica deployment must either share the cache via Redis
(future work) or accept eventual consistency.

### Why 500 entries?

500 × 60 s covers the 600 req/min rate limit × a few seconds of
in-flight requests without thrashing. Larger values would help
popular wallets but waste memory; smaller values would not amortise
the 60 s TTL across the typical k6 burst.

## 2. Per-wallet account-info caches

`trust-score.ts`, `sybil.ts`, `trust-graph.ts`, and `delegation.ts`
each maintain their own `LRUCache<AccountInfo>` of size 200, TTL 60s,
keyed by wallet address. These cache the **algod `accountInformation`
response** so a single `/passport` request that internally calls
trust-score, sybil, delegation, and reputation does not fetch the
account data four times.

```typescript
// src/trust-score.ts:244
const accountInfoCache = new LRUCache<AccountInfo>(200, 60_000);
```

Each module exposes a `*Fresh` function that **bypasses** its
account-info cache (`scoreWalletFresh`, `scoreDelegationFresh`,
`detectSybilFresh`). The `/passport` route uses these; `/score`,
`/delegation`, `/sybil-check` use the cached variants.

| Property | Value |
|----------|-------|
| Max entries | 200 per cache |
| TTL | 60 000 ms |
| Invalidation | TTL only (no explicit invalidation) |
| Purpose | Amortise `accountInformation` across multi-source calls |

## 3. Idempotency store (`src/lib/idempotency.ts:21`)

Maps `Idempotency-Key` → `{ status, body, bodyHash, createdAt,
expiresAt }`. Used to make mutating calls (`/delegate`, `/revoke`,
`/reputation/record`) safely retryable.

| Property | Value |
|----------|-------|
| Max entries | 10 000 |
| TTL | 24 h (default) |
| Sweeper | Every 5 min |
| Overflow eviction | FIFO of oldest keys |
| Invalidation | TTL only |

`Hash` is `sha256(JSON.stringify(body))`. Same key + same body →
cached response. Same key + **different** body → `409 Idempotency-Key
reused with different request body`.

See [../operations/idempotency.md](../operations/idempotency.md) for
the full design.

## 4. The LRU implementation (`src/lib/cache.ts`)

```typescript
export class LRUCache<T> {
  constructor(maxSize: number = 100, ttlMs: number = 60_000) {}
  get(key: string): T | undefined
  set(key: string, value: T, ttlMs?: number): void
  has(key: string): boolean
  delete(key: string): boolean
  clear(): void
  getStats(): CacheStats  // { hits, misses, evictions, size }
}
```

Implementation notes:

- Uses `Map<string, CacheEntry<T>>`. On `get`, the key is
  deleted and re-`set` to move it to the "most recent" position.
- On `set`, if the key already exists it is replaced (not double-
  counted). If the store is full, the **first** key in the Map
  iteration order (the oldest) is evicted.
- TTL is enforced **lazily on `get`**. There is no background
  sweeper — expired entries are removed on next access. This is
  fine for the service's request rate but means a cache that
  receives no traffic will retain expired entries indefinitely.

## 5. Metrics

Every cache emits its own `agent_passport_cache_*` metric family:

| Metric | Type | Labels | Source |
|--------|------|--------|--------|
| `agent_passport_cache_hits_total` | counter | `cache_name` | `responseCache.getStats()` |
| `agent_passport_cache_misses_total` | counter | `cache_name` | `responseCache.getStats()` |
| `agent_passport_cache_evictions_total` | counter | `cache_name` | `responseCache.getStats()` |
| `agent_passport_cache_size` | gauge | `cache_name` | `responseCache.getStats()` |

`cache_name` is the metric value used to register the cache —
currently only `response_cache`. (Per-wallet account-info caches do
not currently emit metrics; this is a known gap.)

## 6. What is **not** cached

- **Indexer responses.** Every request that uses the indexer
  re-fetches the latest transactions. The indexer has its own
  cache in front of the Algorand node, and the staleness of
  "what counts as a sponsor" matters for trust decisions.
- **Graph traversals.** Trust-graph analytics re-traverse the
  on-chain graph per request. Caching graph state would require
  invalidation on every `/delegate` and `/revoke`.
- **Auth/session state.** The service has no sessions, so there
  is nothing to cache here.

## 7. Cache-warming and cold-start behaviour

On a cold start:

- The response cache is empty — the first request to any wallet
  is a cache miss.
- The per-wallet account-info caches are empty — first request
  is a cache miss.
- The idempotency store is empty — every key is fresh.

After 60 s of warm traffic, all three caches are at their working
size. The first request after a deploy or restart will be slower
than steady-state by exactly one Algorand round-trip per upstream
call.
