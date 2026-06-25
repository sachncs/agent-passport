# Threat Model

This is the canonical threat model for the Agent Passport service.
It replaces the legacy `docs/SECURITY.md` stand-in, which described
a pre-x402, pre-contracts, pre-SDK version of the service.

The vulnerability-disclosure policy lives in
[`../../SECURITY.md`](../../SECURITY.md) (root, kept for GitHub UI).

## 1. Trust assumptions

The service **assumes**:

- The Algorand network is the source of truth for all wallet
  state. The service does not maintain its own wallet state
  database.
- The x402 facilitator is honest. The service verifies payment
  proofs via the facilitator and does not directly query the
  Algorand chain to confirm settlement (settlement verification
  is async and best-effort).
- The operator wallet is the only key with permission to submit
  transactions to `registry.teal` and `reputation.teal`. The
  contracts' `update_admin` method rotates this permission.
- The admin address never leaks the operator mnemonic.

## 2. Defence-in-depth layers

The service has six independent security layers. Each is documented
in detail in its own page.

| # | Layer | Page |
|---|-------|------|
| 1 | Input validation | [§ Input validation](#3-input-validation) below |
| 2 | Rate limiting | [../operations/rate-limiting.md](../operations/rate-limiting.md) |
| 3 | Idempotency | [../operations/idempotency.md](../operations/idempotency.md) |
| 4 | System exposure cap | [../operations/system-exposure.md](../operations/system-exposure.md) |
| 5 | x402 payment verification | [§ x402](#6-x402-payment-verification) below |
| 6 | Smart-contract trust assumptions | [../architecture/smart-contracts.md](../architecture/smart-contracts.md) |

## 3. Input validation

### Wallet address

All wallet addresses are validated against `^[A-Z2-7]{58}$`:

- Exactly 58 characters
- Uppercase A–Z, digits 2–7 (Algorand base32 encoding)
- Rejects empty, short, long, lowercase, or special-character inputs

Defined in `src/lib/constants.ts:1`. The validator
`isValidWallet` is used by every handler that takes a wallet
parameter.

### Request body limits

`express.json({ limit: '100kb' })` (`src/app.ts:42`) caps incoming
JSON bodies at 100 KB. Requests with a larger body return `413
Payload Too Large` automatically. This is the **payload-based DoS
guard**.

### Request timeout

Every upstream call (`withTimeout`, `fetchWithTimeout` in
`src/lib/timeout.ts`) is bounded by `REQUEST_TIMEOUT_MS` (default
30 000 ms).

### Idempotency-Key format

`Idempotency-Key` must be 8–255 chars, `[A-Za-z0-9_\-:]+`. Invalid
keys return `400`. The middleware hashes the body and returns
`409` on key+different-body reuse.

## 4. Rate limiting

See [../operations/rate-limiting.md](../operations/rate-limiting.md)
for the full design. Short version:

- 600 req/min/IP (configurable via `RATE_LIMIT_MAX`)
- Bypass lists: `/health`, `/ready`, `/health/deep`, `/metrics`,
  `/registry/status`, `LOAD_TEST_MODE=1`, `RATE_LIMIT_TRUSTED_IPS`
- Persisted to `data/rate-limit.json`
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
  `X-RateLimit-Reset`

## 5. Idempotency

See [../operations/idempotency.md](../operations/idempotency.md)
for the full design. Short version:

- 24h TTL, 5-min sweeper, 10 000 max store
- Same key + same body → cached response
- Same key + different body → 409
- Multi-replica deployments need Redis (see § Multi-replica)

## 6. x402 payment verification

The x402 flow has three defenses against replay and double-
spending:

1. **`x402Middleware`** (`src/lib/x402.ts:47`) — returns `402
   Payment Required` for premium endpoints when x402 is enabled.
   The body includes the `PaymentRequirements` (price, network,
   payTo).
2. **On retry** with `x-payment`, the middleware calls
   `facilitatorClient.verify` to confirm the payment proof is
   valid and not a replay.
3. **`settlementVerificationMiddleware`** (`src/lib/x402.ts:97`) —
   asynchronously verifies that the payment was actually settled
   on-chain by re-querying the facilitator. Runs **after**
   `next()` so it does not block the request; failures are logged
   but do not reject the request, because the x402 middleware
   already verified the proof.

### Replay protection

The facilitator's `verify` endpoint tracks used proofs (typically
by transaction ID). The service does not maintain its own replay
state — the facilitator is the source of truth.

### Metrics

- `agent_passport_x402_payments_verified_total` (counter)
- `agent_passport_x402_payment_failures_total` (counter)
- `agent_passport_x402_replay_attempts_total` (counter)
- `agent_passport_x402_settlement_failures_total` (counter)
- `agent_passport_x402_verification_duration_seconds` (histogram)

## 7. Smart-contract trust assumptions

The on-chain contracts make the following trust assumptions:

- The admin address is the operator wallet. The contract's
  `update_admin` method can rotate this; the service does not
  expose it as an HTTP endpoint.
- Box storage is final. Once a delegation is written, it can be
  revoked (deleted) but not modified.
- The contract code is short enough to audit line by line:
  - `contracts/registry.teal` (356 lines)
  - `contracts/reputation.teal` (259 lines)

The operator's ALGO balance is a runtime concern: every `/delegate`
or `/revoke` call spends a transaction fee. Rate limiting prevents
an attacker from burning the operator's balance faster than
`RATE_LIMIT_MAX` per minute per IP.

## 8. System exposure cap

See [../operations/system-exposure.md](../operations/system-exposure.md).
Short version:

- `MAX_SYSTEM_EXPOSURE = 100_000` USDC (hard-coded)
- Persisted to `data/system-exposure.json`
- `capToSystemCapacity(limit)` caps the recommended limit to the
  remaining capacity
- Multi-replica needs Redis (or accept the overshoot)

This is the "bank reserve requirement" — the sum of all approved
credit must not exceed reserves.

## 9. Delegation trust security

### Trust amplification vulnerability (mitigated)

**Before fix:** A wallet could inflate delegation trust by creating
multiple sybil wallets and delegating to them. The `sponsorCountScore`
gave equal weight to all sponsors regardless of quality, allowing
trust to be "created from nothing."

**Attack scenario:**

1. Attacker creates 5 wallets with 0 trust
2. Attacker delegates to all 5
3. Before fix: delegation trust = 43 (from depthScore=80, countScore=100)
4. After fix: delegation trust ≤ 0 (quality-weighted count +
   depth-adjusted cap)

**Mitigations applied:**

1. **Quality-weighted sponsor count:**
   `computeSponsorCountScore(count, avgQuality)` — low-quality
   sponsors contribute less
2. **Depth-adjusted trust cap:**
   `delegationTrustScore ≤ max(sponsorTrust) - depth × 20` — trust
   attenuates with graph distance, preventing relative amplification
3. **Sybil detection:** Underwriting layer flags clustered wallets
   with high interaction density

**Mathematical proof of depth amplification prevention:**

- For wallets A (depth d+1) and B (depth d) with same sponsor
  quality Q:
- Raw difference: `Raw_A - Raw_B = -7 + 0.12Q ≤ 5`
- Cap_A = Q - (d+1)×20, Cap_B = Q - d×20
- For d ≥ 1: Cap_A = Q - 40 < Q - 7 ≤ trustScore(B)
- Therefore trustScore(A) < trustScore(B) ✓

### Circular delegation (mitigated)

**Attack:** A → B → C → A to inflate depth or count.

**Mitigation:** BFS with visited set prevents cycles from
increasing depth. Each node is visited exactly once.

### Depth amplification (mitigated)

**Attack:** Chain of sponsors to inflate depth score.

**Mitigation:** Depth score decreases monotonically (100 → 80 → 60
→ 40 → 0 at depth 7). Trust cannot increase through depth alone.

### Whale delegation (mitigated)

**Attack:** Single massive delegation to inflate amount score.

**Mitigation:** Amount score uses log scale (10K ALGO = 100, same
as 100K ALGO). Diminishing returns prevent whale domination.

## 10. CORS

`src/lib/security.ts:137` — the `corsMiddleware` validates the
request `Origin` header as a **single value**, not a substring.
This prevents `Origin: https://evil.com,https://app.example.com`
style bypasses.

Set `CORS_ALLOWED_ORIGINS` to a comma-separated list of allowed
origins in production. The default is `*`.

## 11. TLS

The service runs plain HTTP behind a TLS terminator. The Helm /
Kubernetes manifest should set up an ingress or load balancer with
TLS termination. The service itself does not implement TLS.

## 12. Data protection

- **No PII stored.** Only Algorand wallet addresses processed.
- **No database.** All data is fetched from Algorand per request
  (cached in-memory for 60 s).
- **No logging of sensitive data.** The structured logger emits
  `requestId`, `clientIp`, `method`, `path` — never the wallet
  address in the request path.
- **Stack traces logged server-side only** via `logger.error`.

## 13. Known limitations

| Limitation | Impact | Mitigation |
|-----------|---------|------------|
| In-memory rate limiter | Resets on restart, not distributed by default | `RATE_LIMIT_PERSISTENCE_PATH`; Redis for multi-replica |
| In-memory idempotency | Lost on restart, not distributed by default | Redis for multi-replica |
| In-memory system exposure | Lost on restart if file is deleted | `EXPOSURE_PERSISTENCE_PATH`; Redis for multi-replica |
| No HTTPS enforcement | TLS depends on deployment | TLS termination at LB |
| No authentication | Any client can query any wallet | Rate limiting, input validation |
| No on-chain payment verification | Relies on the x402 facilitator | Choose a reputable facilitator; monitor `x402_payment_failures_total` |
| Public Algorand rate limit | AlgoNode free tier rate-limits at ~1k req/s per IP | Use a paid provider or local node for production |
| Operator mnemonic in env | Plaintext on disk | Use a secret manager (KMS / Vault) |

## 14. Incident response

1. Check the alert in PagerDuty / Slack.
2. Open the runbook listed in the alert rule.
3. Follow the diagnosis shell snippets.
4. Apply the fix from the matching "Common Cause".
5. Update the post-incident checklist.
6. Add a CHANGELOG entry and a regression test.

See [../operations/runbooks.md](../operations/runbooks.md) for the
index.
