# Security

The canonical threat model and security guidance for Agent
Passport. The vulnerability-disclosure policy is at
[`../SECURITY.md`](../SECURITY.md) (root, kept for GitHub UI).

## 1. Trust assumptions

The service **assumes**:

- The Algorand network is the source of truth for all wallet
  state. No wallet-state database is maintained.
- The x402 facilitator is honest. The service verifies payment
  proofs via the facilitator and does not directly query the
  Algorand chain to confirm settlement (settlement verification
  is async and best-effort).
- The operator wallet is the only key with permission to submit
  transactions to `registry.teal` and `reputation.teal`. The
  contracts' `update_admin` method rotates this permission.
- The admin address never leaks the operator mnemonic.

## 2. Defence-in-depth layers

| # | Layer | Detail |
|---|-------|--------|
| 1 | Input validation | § 3 below |
| 2 | Rate limiting | § 4 below |
| 3 | Idempotency | § 5 below |
| 4 | System exposure cap | § 8 below |
| 5 | HMAC auth | § 9 below |
| 6 | x402 payment verification | § 6 below |
| 7 | Smart-contract trust assumptions | § 7 below |

## 3. Input validation

### Wallet address

All wallet addresses validated against `^[A-Z2-7]{58}$` — exactly
58 characters, uppercase A–Z, digits 2–7 (Algorand base32).
Rejects empty, short, long, lowercase, or special-character inputs.
Defined in `src/lib/constants.ts`. The validator `isValidWallet` is
used by every handler that takes a wallet parameter.

### Request body limits

`express.json({ limit: '100kb' })` caps incoming JSON bodies at
100 KB. Requests with a larger body return `413 Payload Too Large`
automatically. This is the **payload-based DoS guard**.

### Request timeout

Every upstream call (`withTimeout` in `src/lib/timeout.ts`) is
bounded by `REQUEST_TIMEOUT_MS` (default 30 000 ms). Express
middlewares set the per-request deadline via
`requestDeadlineMiddleware` so the 30 s budget applies across
fan-out calls.

### Idempotency-Key format

`Idempotency-Key` must be 8–255 chars, `[A-Za-z0-9_\-:]+`. Invalid
keys return `400`. The middleware hashes the body and returns
`409` on key+different-body reuse.

## 4. Rate limiting

- 600 req/min/IP (configurable via `RATE_LIMIT_MAX`)
- Bypass lists: `/health`, `/ready`, `/health/deep`, `/metrics`,
  `/registry/status`, `LOAD_TEST_MODE=1`, `RATE_LIMIT_TRUSTED_IPS`
- Persisted to `data/rate-limit.json`
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
  `X-RateLimit-Reset`
- 429 on overflow

For the full design including the persistence format and the
write-queue mutex, see [operations.md](operations.md#rate-limiting).

## 5. Idempotency

- 24h TTL, 5-min sweeper, 10 000 max store
- Same key + same body → cached response (with `idempotent-replay: true` header)
- Same key + different body → 409
- Multi-replica deployments need Redis

For the full design, see [operations.md](operations.md#idempotency).

## 6. x402 payment verification

Three defenses against replay and double-spending:

1. **`x402Middleware`** returns `402 Payment Required` for premium
   endpoints when x402 is enabled, with the `PaymentRequirements`
   (price, network, payTo) in the body.
2. **On retry** with `x-payment`, the middleware calls
   `facilitatorClient.verify` to confirm the payment proof is
   valid and not a replay.
3. **`settlementVerificationMiddleware`** asynchronously verifies
   the payment was actually settled on-chain by re-querying the
   facilitator. Runs **after** `next()` so it does not block the
   request; failures are logged but do not reject the request
   (x402 already verified the proof).

**Replay protection** lives in the facilitator's `verify` endpoint
(typically by transaction ID). The service does not maintain its
own replay state — the facilitator is the source of truth.

## 7. Smart-contract trust assumptions

- The admin address is the operator wallet. The contract's
  `update_admin` method can rotate this; the service does not
  expose it as an HTTP endpoint.
- Box storage is final. Once a delegation is written, it can be
  revoked (deleted) but not modified.
- The contract code is short enough to audit line by line:
  - `contracts/registry.teal`
  - `contracts/reputation.teal`

The operator's ALGO balance is a runtime concern: every `/delegate`
or `/revoke` call spends a transaction fee. Rate limiting prevents
an attacker from burning the operator's balance faster than
`RATE_LIMIT_MAX` per minute per IP.

## 8. System exposure cap

- `MAX_SYSTEM_EXPOSURE = 100_000` USDC (hard-coded)
- Persisted to `data/system-exposure.json` via `json-store.ts`
  write-queue mutex
- `capToSystemCapacity(limit)` caps the recommended limit to the
  remaining capacity AND the per-wallet share (`MAX_SYSTEM_EXPOSURE / 10`)
- Multi-replica needs Redis (or accept the overshoot)

This is the "bank reserve requirement" — the sum of all approved
credit must not exceed reserves.

## 9. HMAC auth

When `HMAC_SECRET` is set (≥ 32 chars), the service requires
HMAC-SHA256 signed requests on `/delegate`, `/revoke`,
`/reputation/record`, and `/reputation/subscribe`.

**Wire format** (request headers):

| Header | Format |
|--------|--------|
| `X-Auth-Timestamp` | Unix ms (server clock, ±60 s window) |
| `X-Auth-Nonce` | 8-128 chars, client-generated unique per request |
| `X-Auth-KeyId` | Opaque identifier (audit only) |
| `X-Auth-Signature` | `hex(HMAC-SHA256(secret, canonical))` |

**Canonical string** (newline-separated, exact field order):

```
<METHOD>
<PATH>
<sha256-hex(body)>
<timestamp>
<nonce>
```

**Client SDK helper:** `signHmacRequest(secret, method, path, body, keyId, nonce)`
in `src/lib/hmac-auth.ts`.

**Bypass list:** operational endpoints (health, ready, metrics,
openapi, version, dashboard) and public reads (`/score`,
`/delegation`, etc.) — see `HMAC_BYPASS_PATHS` in
`src/lib/hmac-auth.ts`.

## 10. Delegation trust security

### Trust amplification (mitigated)

**Before fix:** A wallet could inflate delegation trust by creating
multiple sybil wallets and delegating to them. The
`sponsorCountScore` gave equal weight to all sponsors regardless of
quality, allowing trust to be "created from nothing."

**Mitigations:**

1. **Quality-weighted sponsor count** (`computeSponsorCountScore(count, avgQuality)`)
   — low-quality sponsors contribute less.
2. **Depth-attenuated trust** — depth 1 → 100, depth 2 → 80, depth 7 → 0.
3. **Sybil detection** — underwriting layer flags clustered wallets
   with high interaction density.

Mathematical guarantee: for d ≥ 1, `delegationTrustScore(A) <
delegationTrustScore(B)` for any A (depth d+1) sponsored by B (depth d)
with the same sponsor quality.

### Circular delegation (mitigated)

BFS with visited set prevents cycles from increasing depth. Each
node is visited exactly once. The on-chain contracts also reject
self-endorsement at `src/registry.ts:63` (sponsor ≠ agent check).

### Depth amplification (mitigated)

Depth score decreases monotonically (100 → 80 → 60 → 40 → 0 at
depth 7). Trust cannot increase through depth alone.

### Whale delegation (mitigated)

Amount score uses log scale (10K ALGO = 100, same as 100K ALGO).
Diminishing returns prevent whale domination.

## 11. CORS

`src/lib/security.ts:corsMiddleware` validates the request
`Origin` header as a **single value**, not a substring. This
prevents `Origin: https://evil.com,https://app.example.com`
style bypasses.

Set `CORS_ALLOWED_ORIGINS` to a comma-separated list of allowed
origins in production. The default is `*`.

## 12. TLS

The service runs plain HTTP behind a TLS terminator. The
Kubernetes manifest should set up an ingress or load balancer
with TLS termination. The service itself does not implement TLS.

## 13. Data protection

- **No PII stored.** Only Algorand wallet addresses processed.
- **No database.** All data is fetched from Algorand per request
  (cached in-memory for 60 s).
- **No logging of sensitive data.** The structured logger emits
  `requestId`, `clientIp`, `method`, `path` — never the wallet
  address in the request path. (Note: the wallet address
  **is** logged inside the `/score` and similar route handlers
  on error, since it's needed for triage.)
- **Stack traces logged server-side only** via `logger.error`.

## 14. Operator wallet

The operator key is the only address with on-chain write
permission. Loading the mnemonic:

```bash
# .env
OPERATOR_MNEMONIC=word1 word2 word3 ... word25

# Or, in production, load from a secret manager and inject:
OPERATOR_MNEMONIC=$(vault read -field=mnemonic secret/agent-passport/operator)
```

The mnemonic is loaded at startup by `initOperatorWallet()`
(`src/lib/operator-wallet.ts`). If the mnemonic is missing or
malformed, `/delegate`, `/revoke`, and `/reputation/record`
silently no-op — `npm run dev` fails the `/ready` probe so the
operator notices immediately.

**KMS guidance:** in production, use AWS KMS / GCP KMS / HashiCorp
Vault to wrap the mnemonic. The service expects the plaintext
mnemonic in `OPERATOR_MNEMONIC`; build a thin wrapper that
fetches and unwraps before `npm start`.

**Rotation:** the smart contracts' `update_admin` method rotates
the admin address. To rotate the operator:

1. Deploy a new `registry.teal` / `reputation.teal` from the new admin
2. Update `REGISTRY_APP_ID` and `REPUTATION_APP_ID` env vars
3. Restart the service

There is no rolling-update path for the on-chain admin; rotation
is a new contract deployment.

## 15. Known limitations

| Limitation | Impact | Mitigation |
|-----------|---------|------------|
| In-memory rate limiter | Resets on restart, not distributed by default | `RATE_LIMIT_PERSISTENCE_PATH`; Redis for multi-replica |
| In-memory idempotency | Lost on restart, not distributed by default | Redis for multi-replica |
| In-memory system exposure | Lost on restart if file is deleted | `EXPOSURE_PERSISTENCE_PATH`; Redis for multi-replica |
| No HTTPS enforcement | TLS depends on deployment | TLS termination at LB |
| No authentication by default | Any client can query any wallet | Rate limiting, input validation; enable HMAC for state-changing |
| No on-chain payment verification | Relies on the x402 facilitator | Choose a reputable facilitator; monitor `x402_payment_failures_total` |
| Public Algorand rate limit | AlgoNode free tier rate-limits at ~1k req/s per IP | Use a paid provider or local node for production |
| Operator mnemonic in env | Plaintext on disk | Use a secret manager (KMS / Vault) |

## 16. Incident response

1. Check the alert in PagerDuty / Slack.
2. Open the runbook listed in the alert rule
   (`alerts/runbooks/<alert-name>.md`).
3. Follow the diagnosis shell snippets.
4. Apply the fix from the matching "Common Cause" section.
5. Update the post-incident checklist.
6. Add a CHANGELOG entry and a regression test.