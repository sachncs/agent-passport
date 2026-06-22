# Security Model

## Overview

Stateless trust scoring service with defense-in-depth input validation and rate limiting.

## Input Validation

### Wallet Address

All wallet addresses are validated with Zod and the regex `^[A-Z2-7]{58}$`:

- Exactly 58 characters
- Uppercase A-Z, digits 2-7 (Algorand base32 encoding)
- Rejects empty, short, long, lowercase, or special-character inputs

### Request Body Limits

- `express.json({ limit: '100kb' })` — prevents payload-based DoS

## Rate Limiting

### Global Rate Limit

- 100 requests per minute per IP (configurable via `express-rate-limit`)
- Applied to all routes

### Per-Wallet Rate Limit

Not implemented — global rate limit only.

## No Payment Security

This service does not implement x402 payments, credit delegation, or any payment flow. All endpoints are free and stateless.

## No Admin Auth

No admin endpoints, no API keys, no admin authentication.

## Network Security

### CORS

- Configurable allowed origins
- Defaults to `http://localhost:3000`

### CSP (Content Security Policy)

- Set via Helmet middleware
- Restrictive defaults

### TLS

- Production deployments should use TLS termination (nginx, cloud LB)
- Helmet middleware sets security headers

## Known Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| **In-memory rate limiter** | Resets on restart, not distributed | Use Redis for production |
| **No HTTPS enforcement** | TLS depends on deployment | Use TLS termination at LB |
| **No authentication** | Any client can query any wallet | Rate limiting, input validation |

## Data Protection

- No PII stored — only Algorand wallet addresses processed
- No database — all data is fetched from Algorand testnet per request
- No logging of sensitive data
- Stack traces logged server-side only
