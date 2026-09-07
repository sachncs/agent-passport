# Changelog

## 0.2.0 — 2026-06-25

### Added
- New methods: `create_passport()`, `endorse()`, `revoke()`
- Typed exception hierarchy: `ValidationError`, `AuthenticationError`, `PaymentRequiredError`, `NotFoundError`, `RateLimitError`, `IdempotencyError`, `ServerError`, `TimeoutError`, `ConnectionError`
- `idempotency_key` parameter on all mutating calls
- `headers` parameter in client config for custom headers
- `EndorsementRequest` and `RevocationRequest` dataclasses
- `PaymentRequirements` and `PaymentProof` dataclasses
- Test suite (pytest + responses)

### Changed
- Refactored to a package layout (`agent_passport/`)
- All wallet arguments are now validated client-side
- Response errors include the upstream `X-Request-ID` for traceability
- Backwards-compatible alias: `APIError = AgentPassportError`

## 0.1.0 — 2026-06-22

### Added
- Initial release
- Methods: `get_score`, `get_delegation`, `check_counterparty`, `estimate_credit`, `check_sybil`, `get_reputation`, `record_reputation_event`, `underwrite`, `get_trust_graph`, `get_passport`, `health`
- x402 payment callback support
