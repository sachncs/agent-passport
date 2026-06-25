# Error Codes

Every error response from the service has the shape:

```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

`code` is optional and present only on selected errors.

## `400 Bad Request`

Validation failure. The request was understood, but a field was
missing, malformed, or out of range.

| Trigger | Example message |
|---------|-----------------|
| Missing query param `wallet` | `Missing required query parameter: wallet` |
| Invalid wallet format | `Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).` |
| Missing body field | `Missing required field: buyer` |
| `amount` is non-numeric or non-positive | `Amount must be a positive finite number.` |
| `sponsor === agent` on `/delegate` | `Sponsor and agent must be different wallets.` |
| Invalid `Idempotency-Key` | `Invalid Idempotency-Key format. Must be 8-255 chars of [A-Za-z0-9_\\-:]` |

## `402 Payment Required`

x402 is enabled (`X402_ENABLED=true`) and the request did not carry
a valid `x-payment` header. The response body includes the
`PaymentRequirements` per the x402 spec. Clients must construct a
USDC payment, sign it, and retry with `x-payment: <base64-of-tx>`.

This response is enabled on every premium endpoint:

`/score`, `/delegation`, `/counterparty-check`, `/credit-estimate`,
`/sybil-check`, `/reputation`, `/reputation/record`, `/underwrite`,
`/trust-graph`, `/passport`, `/delegate`, `/revoke`.

It is **never** returned by `/health`, `/ready`, `/health/deep`,
`/metrics`, `/registry/status`, `/verify`, `/discovery/search`.

See [../architecture/middleware-stack.md](../architecture/middleware-stack.md)
§ x402 for the full flow.

## `404 Not Found`

| Endpoint | Trigger |
|----------|---------|
| `/score`, `/delegation`, `/underwrite`, `/trust-graph`, `/passport`, `/sybil-check`, `/reputation`, `/credit-estimate`, `/verify` | The wallet is not on the configured Algorand network (or is a fresh account with no history) |

```json
{ "error": "Wallet not found on testnet" }
```

## `409 Conflict`

`Idempotency-Key` reused with a **different** body. The middleware
hashes the body and returns 409 if the hash differs from the cached
one.

```json
{ "error": "Idempotency-Key reused with different request body" }
```

The same key with the **same** body returns the cached response with
the `idempotent-replay: true` header. See
[../operations/idempotency.md](../operations/idempotency.md).

## `413 Payload Too Large`

Body parser cap exceeded. The service uses `express.json({ limit:
'100kb' })`; larger bodies are rejected with a default `413` from
Express.

## `429 Too Many Requests`

Per-IP rate limit exceeded. Headers:

- `X-RateLimit-Limit: 600`
- `X-RateLimit-Remaining: 0`
- `X-RateLimit-Reset: <unix-seconds>`

```json
{ "error": "Too many requests. Try again later." }
```

Bypassed for `/health`, `/ready`, `/health/deep`, `/metrics`,
`/registry/status`, and IPs in `RATE_LIMIT_TRUSTED_IPS`. See
[../operations/rate-limiting.md](../operations/rate-limiting.md).

## `500 Internal Server Error`

Algorand RPC failure, unhandled exception, or contract submission
error.

```json
{ "error": "Internal server error" }
```

The full error is logged with the `X-Request-ID` for triage. The
rate of `agent_passport_http_request_errors_total{error_type="server_error"}`
is the canary metric.

## `503 Service Unavailable`

`/delegate` and `/revoke` return `503` with `code:
"REGISTRY_NOT_CONFIGURED"` when `REGISTRY_APP_ID=0`.

```json
{ "error": "Delegation registry contract is not configured (REGISTRY_APP_ID=0)", "code": "REGISTRY_NOT_CONFIGURED" }
```

`/ready` returns `503` (with a JSON body) when the Algorand
endpoint is unreachable. See [health.md](health.md) § `/ready`.

## See also

- [`api/README.md`](README.md) — endpoint reference
- [`api/health.md`](health.md) — `/health`, `/ready`, `/metrics`
- [../operations/idempotency.md](../operations/idempotency.md) —
  Idempotency-Key semantics
- [../operations/rate-limiting.md](../operations/rate-limiting.md) —
  Rate limit headers and bypasses
