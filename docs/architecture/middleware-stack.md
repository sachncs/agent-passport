# Middleware Stack

Every middleware in the service, in registration order, with purpose,
env vars, response headers, and Prometheus metric names. See
[system-design.md](system-design.md) § Middleware Stack for the
registration-order table.

Middleware is registered in `src/app.ts`. Each is implemented either
inline or in `src/lib/security.ts`, `src/lib/metrics.ts`,
`src/lib/x402.ts`, or `src/lib/idempotency.ts`.

## 1. `app.set('trust proxy', 1)`

Tells Express to honour `X-Forwarded-For` from **one hop** of load
balancer. The per-IP rate limiter uses `req.ip`, which now reflects
the real client behind a reverse proxy.

- **Env vars:** none
- **Response headers:** none
- **Metrics:** none

## 2. `helmet()`

Sets the standard security headers (HSTS, `X-Content-Type-Options`,
`X-Frame-Options`, default CSP, etc.). The CSP is restrictive by
default — `default-src 'self'`. If you serve a browser-side dashboard
you may need to relax it.

- **Env vars:** none
- **Response headers:** `Strict-Transport-Security`, `X-Content-Type-Options`,
  `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy`,
  `X-DNS-Prefetch-Control`, `X-Download-Options`, `X-Permitted-Cross-Domain-Policies`
- **Metrics:** none

## 3. `requestIdMiddleware` (`src/lib/security.ts:171`)

Generates or accepts a UUID per request. The request ID is:
- Read from the `X-Request-ID` header (if it matches the UUID
  regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`)
- Otherwise generated via `crypto.randomUUID()`
- Surfaced to the client in the `X-Request-ID` response header
- Attached to `req.requestId` for downstream middleware
- Logged by the request-logging middleware

- **Env vars:** none
- **Response headers:** `X-Request-ID`
- **Metrics:** none (logging-only)

## 4. `requestLoggingMiddleware` (`src/lib/security.ts:191`)

Logs one structured JSON line per request:

```json
{"level":"info","message":"Request received","timestamp":"...","requestId":"...","clientIp":"...","method":"GET","path":"/score"}
```

- **Env vars:** `LOG_LEVEL`, `LOG_FILE`, `LOG_ERROR_FILE`
- **Response headers:** none
- **Metrics:** none

## 5. `corsMiddleware({ origin })` (`src/lib/security.ts:137`)

Sets CORS headers. `origin` defaults to `*`. When set to a
comma-separated list, the middleware **validates the request
`Origin` header as a single value**, not a substring — preventing
`Origin: https://evil.com,https://app.example.com` style bypasses.

- **Env vars:** `CORS_ALLOWED_ORIGINS`
- **Response headers:** `Access-Control-Allow-Origin`, `Vary: Origin`,
  `Access-Control-Allow-Methods: GET, POST, OPTIONS`,
  `Access-Control-Allow-Headers: Content-Type, Authorization, X-Request-ID`,
  `Access-Control-Max-Age: 86400`
- **Metrics:** none

## 6. `rateLimiter({ windowMs, max })` (`src/lib/security.ts:68`)

Per-IP fixed-window rate limiter. Default 600 req/min. Bypasses:

- `/health`, `/ready`, `/health/deep`, `/metrics`, `/registry/status`
  (operational endpoints)
- `LOAD_TEST_MODE=1` (load testing only — never in production)
- IPs in `RATE_LIMIT_TRUSTED_IPS` (comma-separated)

State is persisted to `data/rate-limit.json` every 100 hits per
client. On startup, non-expired entries are restored.

- **Env vars:** `RATE_LIMIT_MAX`, `RATE_LIMIT_TRUSTED_IPS`,
  `RATE_LIMIT_PERSISTENCE_PATH`
- **Response headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
  `X-RateLimit-Reset`
- **Error response:** `429 Too many requests. Try again later.`
- **Metrics:** none direct (rate-limit state lives in the JSON file)

See [../operations/rate-limiting.md](../operations/rate-limiting.md)
for the full design.

## 7. `express.json({ limit: '100kb' })`

JSON body parser with a hard 100 KB cap. Requests with a larger body
return `413 Payload Too Large` automatically. This is the
**payload-based DoS guard**.

- **Env vars:** none (limit is hard-coded)
- **Response headers:** none
- **Metrics:** none

## 8. `metricsMiddleware` (`src/lib/metrics.ts`)

Records one `agent_passport_http_request_duration_seconds` histogram
observation per request, with `method`, `path` (normalized to the
route template — **never** the raw `req.path`, which can contain a
wallet address), and `status` labels. Increments
`agent_passport_http_requests_total` and (for 4xx/5xx)
`agent_passport_http_request_errors_total{error_type=...}`.

`/metrics` is registered as a route handler **after** the middleware,
but it is exempt from rate limiting (see #6).

- **Env vars:** none
- **Response headers:** none (writes metrics)
- **Metrics:** `agent_passport_http_requests_total`,
  `agent_passport_http_request_duration_seconds`,
  `agent_passport_http_request_errors_total`

## 9. `x402Middleware` (`src/lib/x402.ts:47`)

When `X402_ENABLED=true`, this middleware returns `402 Payment
Required` for every premium endpoint with a payment spec, then
verifies the `x-payment` header against the configured facilitator
on retry. The spec is built from `X402_PRICING` in
`src/lib/constants.ts:14`. When disabled, this middleware is a
no-op `next()`.

- **Env vars:** `X402_ENABLED`, `X402_FACILITATOR_URL`,
  `X402_PAYMENT_RECIPIENT`, `X402_NETWORK`
- **Response headers:** on 402, the standard x402 spec headers
  (`X-PAYMENT-REQUIRED`, payment requirements JSON)
- **Metrics:** `agent_passport_x402_payments_verified_total`,
  `agent_passport_x402_payment_failures_total`,
  `agent_passport_x402_replay_attempts_total`,
  `agent_passport_x402_settlement_failures_total`,
  `agent_passport_x402_verification_duration_seconds`

## 10. `settlementVerificationMiddleware` (`src/lib/x402.ts:97`)

After x402 accepts a payment, this middleware **asynchronously**
verifies that the payment was settled on-chain by querying the
facilitator (`verifySettlement` at `src/lib/x402.ts:57`). The
verification runs **after** `next()` so it does not block the
request; failures are logged but do not reject the request, because
the x402 middleware already verified the payment proof.

- **Env vars:** same as #9
- **Response headers:** none
- **Metrics:** `agent_passport_x402_settlement_failures_total`

## 11. `idempotencyMiddleware` (`src/lib/idempotency.ts:111`)

`Idempotency-Key` handling. See
[../operations/idempotency.md](../operations/idempotency.md) for the
full design. For mutating calls only — `GET`, `HEAD`, and `OPTIONS`
are passed through.

- **Env vars:** none (limits are hard-coded: 8-255 char key, 24h TTL,
  10k max store, 5-min sweeper)
- **Response headers:** `idempotency-key` (always),
  `idempotent-replay: true` (on hit)
- **Error response:** `400` for invalid key format, `409` for
  key reused with a different body
- **Metrics:** `agent_passport_idempotency_hits_total`,
  `agent_passport_idempotency_conflicts_total`

## 12. Route handlers

See [../api/README.md](../api/README.md) for the full reference.
