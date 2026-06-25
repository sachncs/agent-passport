# Runbook: Contract Indexing Failure

**Severity:** P0 (initial), P1 (stall detected)
**On-call:** blockchain-oncall

## Alerts

- `ContractIndexingFailure` — dispute rate elevated, may indicate stalled indexing
- `ContractEventStall` — no contract events for 4+ hours

## Diagnosis

```bash
# 1. Are REGISTRY_APP_ID and REPUTATION_APP_ID set?
echo "Registry: $REGISTRY_APP_ID, Reputation: $REPUTATION_APP_ID"

# 2. Can we reach the contracts?
curl -s $ALGOD_URL/v2/applications/$REGISTRY_APP_ID | head -c 500

# 3. Check operator wallet
echo "Operator: $(curl -s $ALGOD_URL/v2/accounts/$OPERATOR_ADDRESS | jq '.amount') microAlgo"

# 4. Check the metric
curl -s http://localhost:3000/metrics | grep -E "contract_event_stall|contract_"
```

## Common Causes & Fixes

### Cause 1: Contract app IDs are 0
**Symptom:** `REGISTRY_APP_ID=0` in env, /delegate returns 503
**Fix:** Deploy contracts with `npm run deploy-registry` and `npm run deploy-reputation`, set the IDs in env

### Cause 2: Operator wallet unfunded
**Symptom:** `submitApplicationCall` returns null, log shows "insufficient funds"
**Fix:** Fund the operator wallet with at least 1 ALGO (covers thousands of transactions)

### Cause 3: Algorand network issue
**Symptom:** `algod.status()` errors, indexer timeouts
**Fix:** See runbook for Algorand dependency

### Cause 4: Box storage quota exceeded
**Symptom:** Transaction fails with "box size limit"
**Fix:** Prune old entries, redesign box key

## Post-Incident

- Audit `audit-log` for missed contract events
- Backfill missing data if recoverable
- Update capacity planning
