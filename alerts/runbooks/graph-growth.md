# Runbook: Unusual Graph Growth

**Severity:** P2
**On-call:** platform-oncall

## Alert

`UnusualGraphGrowth` — graph traversal depth sum rate > 50/h for 30m+

## Diagnosis

```bash
# 1. Inspect the graph
curl -s "http://localhost:3000/admin/graph" -H "X-Admin-API-Key: $ADMIN_API_KEY" | jq '.edges | length'
curl -s "http://localhost:3000/admin/graph" -H "X-Admin-API-Key: $ADMIN_API_KEY" | jq '.nodes | length'

# 2. Per-wallet depth
curl -s "http://localhost:3000/admin/graph" -H "X-Admin-API-Key: $ADMIN_API_KEY" | jq '.nodes | group_by(.depth) | map({depth: .[0].depth, count: length})'

# 3. Recent delegations
curl -s "http://localhost:3000/admin/delegations" -H "X-Admin-API-Key: $ADMIN_API_KEY" | jq '.[-5:]'
```

## Common Causes & Fixes

### Cause 1: Legitimate adoption
**Symptom:** New wallets entering the trust network
**Fix:** No action; document growth in capacity planning

### Cause 2: Sybil cluster forming
**Symptom:** Many wallets created in a short window, all delegating to each other
**Fix:** Run fraud check: `POST /admin/fraud-check/<wallet>`; blacklist if confirmed

### Cause 3: Cycle attempt
**Symptom:** `agent_passport_contract_endorsements_total` and `contract_revocations_total` both spiking
**Fix:** Check `src/reputation.ts` cycle detection logs; should be auto-rejected

### Cause 4: Memory pressure
**Symptom:** Graph cache size growing unbounded
**Fix:** Check LRU cache eviction rate in `agent_passport_cache_evictions_total`

## Post-Incident

- Review delegation policies
- If sybil: blacklist and add detection rule
- If legitimate: document growth
