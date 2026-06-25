# Runbook: Unusual Graph Growth

**Severity:** P2
**On-call:** platform-oncall

## Alert

`UnusualGraphGrowth` — `rate(agent_passport_graph_traversal_depth_sum[1h]) > 50` for 30m+

## Diagnosis

The service has **no admin endpoints**. All diagnosis goes through the public API
and Prometheus metrics.

```bash
# 1. Inspect a wallet's trust graph
curl -s "http://localhost:3000/trust-graph?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A" | jq

# 2. Per-depth wallet count (from the response)
curl -s "http://localhost:3000/trust-graph?wallet=<WALLET>" | jq '.exposureByDepth'

# 3. Cross-check the on-chain contract state
curl -s "http://localhost:3000/registry/status"

# 4. Inspect Prometheus graph metrics
curl -s http://localhost:3000/metrics | grep agent_passport_graph_traversal
```

## Common Causes & Fixes

### Cause 1: Legitimate adoption
**Symptom:** New wallets entering the trust network; depth distribution is
broad and shallow.
**Fix:** No action; document growth in capacity planning.

### Cause 2: Sybil cluster forming
**Symptom:** Many wallets created in a short window, all delegating to each
other; `agent_passport_sybil_risk` gauge for the affected wallets is high;
`/sybil-check?wallet=...` returns `riskLevel: "high"`.
**Fix:** Investigate the cluster via `/trust-graph?wallet=<suspicious-wallet>`.
Document the wallet set, escalate to the security team, and consider
adding a detection rule.

### Cause 3: Cycle attempt
**Symptom:** `agent_passport_contract_endorsements_total` and
`contract_revocations_total` both spiking in lockstep.
**Fix:** Check `src/reputation.ts` cycle-detection logs. Cycles should be
auto-rejected by the in-memory BFS with a visited set.

### Cause 4: Memory pressure
**Symptom:** `agent_passport_cache_size{cache_name="trust-graph-account-info"}`
growing unbounded; `cache_evictions_total` rate also high.
**Fix:** The LRU cache is bounded (200 entries, 60s TTL). If the metric shows
unbounded growth, file a bug with the trace.

## Post-Incident

- Review delegation policies
- If sybil: blacklist the cluster and add a detection rule
- If legitimate: document growth in capacity planning
