# Rate Limiting

The service has a per-IP fixed-window rate limiter at
`src/lib/security.ts:68`. Default 600 req/min/IP.

## Defaults

| Setting | Value | Source |
|---------|-------|--------|
| Default `max` | 600 req/min | `src/lib/security.ts:73` |
| Default `windowMs` | 60 000 ms | `src/lib/security.ts:69` |
| Persistence | `data/rate-limit.json` | `src/lib/security.ts:20` |
| Persist cadence | every 100 hits per client | `src/lib/security.ts:120` |
| Background cleanup | every 5 minutes | `src/lib/security.ts:78` |

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `RATE_LIMIT_MAX` | `600` | Override the per-IP limit |
| `RATE_LIMIT_TRUSTED_IPS` | — | Comma-separated IPs exempt from the limit |
| `RATE_LIMIT_PERSISTENCE_PATH` | `data/rate-limit.json` | Where to persist state across restarts |

## Bypass lists

The middleware short-circuits to `next()` in three cases:

1. **Operational endpoints.** `/health`, `/ready`, `/health/deep`,
   `/metrics`, `/registry/status` are never rate-limited.
2. **`LOAD_TEST_MODE=1`.** All rate limiting is disabled (k6 suite
   use; never in production).
3. **Trusted IPs.** Any IP in `RATE_LIMIT_TRUSTED_IPS` (comma-
   separated) bypasses the limit. Use for internal services, the
   operator host, or your monitoring agent.

## Response headers

Every rate-limited response carries three headers:

| Header | Value |
|--------|-------|
| `X-RateLimit-Limit` | The configured `max` (e.g. `600`) |
| `X-RateLimit-Remaining` | `max - count` (clamped to `0`) |
| `X-RateLimit-Reset` | Unix-seconds when the current window expires |

When the limit is exceeded, the response is `429` with body:

```json
{ "error": "Too many requests. Try again later." }
```

## Persistence

The rate-limit state is persisted to
`RATE_LIMIT_PERSISTENCE_PATH` (default `data/rate-limit.json`).
On startup, the file is loaded and only non-expired entries are
restored:

```json
{
  "1.2.3.4":   { "count": 42, "resetAt": 1719325200000 },
  "5.6.7.8":   { "count": 8,  "resetAt": 1719325260000 }
}
```

The file is rewritten on every 100th request per client. This is
**eventually consistent** — a process crash can lose up to 99
requests of state per client. For stricter durability, put the file
on a persistent volume.

## Why 600/min?

The k6 testnet baseline at 1000 VU was 1,829 rps sustained
(observability.md § SLOs). 600/min/IP is **10x the legacy 60/min
default** and matches the production-tested k6 envelope. Increase
further with `RATE_LIMIT_MAX` if you run multi-replica with a
shared ALB that funnels traffic through one egress IP.

## Multi-replica

The middleware holds rate-limit state in process memory. In a
multi-replica deployment each replica enforces the limit
independently. Two options:

1. **Trust the overshoot.** With N replicas, the effective per-IP
   limit is `N × RATE_LIMIT_MAX`. This is usually fine for a
   600/min limit; tighten if you observe abuse.
2. **Back the store with Redis.** Replace the in-memory `Map` with
   a Redis-backed counter (e.g. `INCR` + `EXPIRE`). The
   `RATE_LIMIT_PERSISTENCE_PATH` interface is the seam to swap.

## See also

- [environment-variables.md](environment-variables.md) § Rate limiting
- [../architecture/middleware-stack.md](../architecture/middleware-stack.md) § rateLimiter
- [../api/error-codes.md](../api/error-codes.md) § 429
- [../security/threat-model.md](../security/threat-model.md) § Rate limiting
