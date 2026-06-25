# Runbook: x402 Payment Verification Failing

**Severity:** P0
**On-call:** payments-oncall

## Alert

`X402PaymentVerificationFailing` — payment failure rate > 10% for 2m+

## Diagnosis

```bash
# 1. Check facilitator URL
echo $X402_FACILITATOR_URL

# 2. Can we reach the facilitator?
curl -i $X402_FACILITATOR_URL/verify -X POST -d '{}' -H "Content-Type: application/json"

# 3. Recent x402 errors in logs
grep -i "x402\|payment.*fail" /var/log/agent-passport/error.log | tail -50

# 4. Check the metric breakdown
curl -s http://localhost:3000/metrics | grep x402_payment_failures_total
```

## Common Causes & Fixes

### Cause 1: x402 facilitator down
**Symptom:** `X402_FACILITATOR_URL` unreachable
**Fix:**
1. Check https://x402.org status
2. If custom facilitator, verify it's healthy
3. If intermittent, increase retry/timeout

### Cause 2: x402_ENABLED misconfigured
**Symptom:** Logs show `X402_ENABLED=false` but requests are reaching the middleware
**Fix:** Set `X402_ENABLED=true` and `X402_PAYMENT_RECIPIENT=<wallet>` in production

### Cause 3: Settlement vs verification mismatch
**Symptom:** `agent_passport_x402_settlement_failures_total` high
**Fix:** Run `verifySettlement()` against the failing transactions; check Algorand indexer

### Cause 4: Replay attack flood
**Symptom:** `agent_passport_x402_replay_attempts_total` spiking
**Fix:**
1. Check `X402ReplayAttempt` alert for correlated spike
2. IP-block the source if confirmed attack
3. Increase `x402` idempotency TTL

## Post-Incident

- Identify root cause (facilitator, config, attack)
- If facilitator outage: implement fallback facilitator
- If attack: file abuse report with payment network
