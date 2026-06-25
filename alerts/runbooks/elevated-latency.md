# Runbook: Elevated Latency

**Severity:** P1
**On-call:** platform-oncall

## Alerts

- `ElevatedLatencyP95` — P95 > 2s for 5m
- `ElevatedLatencyP99` — P99 > 5s for 5m
- `SLOLatencyP95FastBurn` — SLO burn rate triggered
- `HighTrustScoreLatency` — Trust score P95 > 1s for 5m
- `HighGraphTraversalLatency` — Graph P95 > 2s for 5m

## Diagnosis

```bash
# 1. Which endpoint is slow?
curl -s http://localhost:3000/metrics | grep "agent_passport_http_request_duration_seconds_bucket" | head -30

# 2. Is the slowdown on the service or on Algorand?
# Check p50 (Algorand-independent) vs p95 (likely Algorand-dependent)
curl -s http://localhost:3000/metrics | grep "agent_passport_trust_score_duration_seconds"

# 3. Is the cache cold?
curl -s http://localhost:3000/metrics | grep "agent_passport_cache"

# 4. Algorand indexer health
curl -sf https://testnet-idx.algonode.cloud:443/v2/transactions?limit=1 | head -c 100
```

## Common Causes & Fixes

### Cause 1: Algorand testnet slowdown
**Symptom:** All Algorand-touching endpoints slow (score, delegation, trust-graph)
**Fix:** This is upstream; wait for testnet recovery or switch to mainnet-equivalent indexer

### Cause 2: Cache cold-start after restart
**Symptom:** First requests after deploy are slow, then improve
**Fix:** Warm the cache by replaying a known set of wallets

### Cause 3: Memory pressure causing GC pauses
**Symptom:** `agent_passport_process_memory_usage_bytes{type="heapUsed"}` high, latency jitter
**Fix:** Restart to recover; investigate memory leak

### Cause 4: Rate limit 429s inflating latency
**Symptom:** `agent_passport_http_request_errors_total{error_type="client_error"}` spiking on the slow endpoint
**Fix:** Increase rate limit or scale horizontally

### Cause 5: Hot wallet (a single wallet being queried millions of times)
**Symptom:** One `path` label dominates; `agent_passport_trust_score_generations_total{risk_level="low"}` spiking
**Fix:** Add per-wallet rate limit; investigate client behavior

## Post-Incident

- Establish new latency baseline
- If Algorand-dependent, document acceptable floor
- If code-related, add regression test
