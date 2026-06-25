# Agent Passport — Load Test Report

**Run date:** YYYY-MM-DD
**Base URL:** http://localhost:3000
**Operator:** <name>
**Build hash:** <git-rev>

## Summary

| Scenario | VUs | P50 (ms) | P95 (ms) | P99 (ms) | Error rate | Throughput | Pass |
|----------|-----|----------|----------|----------|------------|------------|------|
| A (100) | 100 | | | | | | ☐ |
| B (500) | 500 | | | | | | ☐ |
| C (1000) | 1000 | | | | | | ☐ |
| D (sustained) | 12 rps | | | | | | ☐ |

## Scenario A — 100 concurrent users

- **Endpoint mix:** /health, /passport, /underwrite, /counterparty-check, /credit-estimate
- **Passport P95:**
- **Underwriting P95:**
- **Counterparty P95:**
- **Verdict:** ☐ PASS ☐ FAIL

## Scenario B — 500 concurrent users (mixed)

- **Endpoint mix:** Random across /score, /delegation, /passport, /underwrite, /trust-graph, /reputation, /counterparty-check, /credit-estimate
- **Mixed P95:**
- **Graph P95:**
- **Verdict:** ☐ PASS ☐ FAIL

## Scenario C — 1000 concurrent users (stress)

- **Endpoint mix:** /score + /passport burst
- **Burst P95:**
- **5xx count:**
- **Verdict:** ☐ PASS ☐ FAIL

## Scenario D — 10k requests/day sustained

- **Endpoint mix:** /score only
- **Sustained P95:**
- **Verdict:** ☐ PASS ☐ FAIL

## Cache Performance

- `app_cache_hits` rate: __%
- `app_cache_misses` rate: __%

## x402 Verification Latency

- P50: __ms
- P95: __ms
- Failures: __

## Graph Traversal Latency

- P50: __ms
- P95: __ms
- P99: __ms

## Issues Found

- None

## Recommendations

- None

## Final Verdict

☐ READY FOR PRODUCTION
☐ BETA-READY
☐ NOT READY
