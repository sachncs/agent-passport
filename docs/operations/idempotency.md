# Idempotency

The `Idempotency-Key` middleware (`src/lib/idempotency.ts:111`) makes
mutating calls safe to retry. It applies only to non-`GET` / non-
`HEAD` / non-`OPTIONS` requests; safe methods pass through with no
key required.

## What it does

For each request with a valid `Idempotency-Key` header:

1. **Look up the key** in the in-memory store.
2. **On hit + same body hash** → return the cached response with
   `idempotent-replay: true`.
3. **On hit + different body hash** → return `409 Idempotency-Key
   reused with different request body` and record a metric.
4. **On miss** → generate a key (if none provided), set up the
   middleware to capture the response, call `next()`.

## Header format

```
Idempotency-Key: <8-255 chars, [A-Za-z0-9_\-:]+>
```

- 8–255 characters
- Allowed: ASCII letters, digits, underscore, hyphen, colon
- Anything else returns `400 Invalid Idempotency-Key format`

If the header is missing, the middleware generates a server-side
key in the form `srv_<16-hex>` and surfaces it in the response
header `idempotency-key`. The generated key is **not** stored
unless the response is 2xx — failed requests are retryable with
the same key without a 409.

## Body hashing

Body hash is `sha256(JSON.stringify(body))`. Same key + same body
→ cached response. Same key + different body → 409.

## Configuration

The middleware is configured entirely in code. There is no env var.

| Setting | Value | Source |
|---------|-------|--------|
| Key length | 8–255 chars | `src/lib/idempotency.ts:5-7` |
| Key pattern | `^[A-Za-z0-9_\-:]+$` | `src/lib/idempotency.ts:7` |
| Default TTL | 24 h | `src/lib/idempotency.ts:8` |
| Sweeper interval | 5 min | `src/lib/idempotency.ts:9` |
| Max store size | 10 000 | `src/lib/idempotency.ts:10` |
| Cached status range | 200-299 only | `src/lib/idempotency.ts:147` |

## In-memory store

`Map<string, IdempotencyRecord>` at `src/lib/idempotency.ts:21`.
Each record is:

```typescript
interface IdempotencyRecord {
  key: string;
  bodyHash: string;     // sha256 hex
  status: number;       // HTTP status code (200-299)
  body: unknown;        // Response body
  createdAt: number;    // Unix ms
  expiresAt: number;    // Unix ms (createdAt + 24h)
}
```

The sweeper (`startSweeper` at `src/lib/idempotency.ts:32`) runs
every 5 minutes:

- Removes any record where `expiresAt <= now`.
- If the store is over `MAX_STORE_SIZE = 10 000`, evicts the
  oldest keys in insertion order (FIFO overflow).

The store is **not** persisted to disk. A process restart loses
all in-flight idempotency state. Clients that retry with the same
key after a server restart will re-execute the request.

## Metrics

| Metric | Type | Labels | When |
|--------|------|--------|------|
| `agent_passport_idempotency_hits_total` | counter | `path` | Replay served from cache |
| `agent_passport_idempotency_conflicts_total` | counter | `path` | Same key, different body — 409 |

## API

| Endpoint | `Idempotency-Key` recommended? | Notes |
|----------|-------------------------------|-------|
| `POST /delegate` | Yes | On-chain call — network fee on every retry |
| `POST /revoke` | Yes | On-chain call |
| `POST /reputation/record` | Yes | On-chain call |
| `POST /counterparty-check` | No | Idempotent by nature (read-only) |
| `POST /credit-estimate` | No | Idempotent by nature |
| `GET /score`, `GET /passport`, etc. | N/A | GETs are not idempotency-protected |

## Multi-replica

The store is in-memory per replica. In a multi-replica deployment
two replicas do not share state, so:

- The first replica to see a key caches it; the other replicas
  have no record of it. A retry that hits a different replica
  re-executes the request.
- The same key, on different replicas, does not produce a 409.

**For multi-replica, back the store with Redis.** A common
implementation: `SET key bodyHash EX 86400 NX` to claim the key,
then `GET` to check on subsequent requests. The interface in
`src/lib/idempotency.ts` is the seam to swap.

## See also

- [environment-variables.md](environment-variables.md) § Idempotency
- [../architecture/middleware-stack.md](../architecture/middleware-stack.md) § idempotencyMiddleware
- [../api/error-codes.md](../api/error-codes.md) § 409
- [../security/threat-model.md](../security/threat-model.md) § Idempotency
