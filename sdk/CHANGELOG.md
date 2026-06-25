# Changelog

## 0.2.0 — 2026-06-25

### Added
- New methods: `createPassport()`, `endorse()`, `revoke()`
- Typed error hierarchy: `ValidationError`, `AuthenticationError`, `PaymentRequiredError`, `NotFoundError`, `RateLimitError`, `IdempotencyError`, `ServerError`, `TimeoutError`, `ConnectionError`
- `idempotencyKey` option on all mutating calls
- `headers` option in `AgentPassportConfig` for custom headers
- User-Agent header on all requests
- Custom `User-Agent` per request
- Exposed retry behavior via static `errorFromResponse` for advanced use
- New exports: `PaymentRequirements`, `PaymentProof`, `EndorsementRequest/Response`, `RevocationRequest/Response`
- Test suite (22 tests) with mocked fetch

### Changed
- Bumped default retries to 3 and timeout to 30s
- All wallet arguments are now validated client-side
- Response errors include the upstream `x-request-id` for traceability
- Refactored to separate `errors.ts`, `types.ts`, `retry.ts` modules for tree-shaking

### Fixed
- Exponential backoff with jitter on retries
- AbortController correctly clears timeouts on success
- RateLimitError parses `Retry-After` header

## 0.1.0 — 2026-06-22

### Added
- Initial release
- Methods: `getScore`, `getDelegation`, `checkCounterparty`, `estimateCredit`, `checkSybil`, `getReputation`, `recordReputationEvent`, `underwrite`, `getTrustGraph`, `getPassport`, `health`
- x402 payment callback support
