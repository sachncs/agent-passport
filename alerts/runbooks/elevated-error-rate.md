# Runbook: Elevated Error Rate

**Severity:** P1
**On-call:** platform-oncall

## Alerts

- `ElevatedErrorRate` — error rate > 2% for 5m
- `HighErrorRate` — error rate > 5% for 3m
- `High5xxRate` — 5xx error rate > 1% for 3m

## Diagnosis

```bash
# 1. Which status codes are elevated?
curl -s http://localhost:3000/metrics | grep "agent_passport_http_request_errors_total"

# 2. Which paths?
curl -s http://localhost:3000/metrics | grep 'path=' | head -20

# 3. Recent errors in logs
grep '"level":"error"' /var/log/agent-passport/app.log | tail -50

# 4. Is this correlated with anything else?
# Check deploys, traffic spike, Algorand issues
```

## Common Causes & Fixes

### Cause 1: Recent deploy
**Symptom:** Error rate jumped after a deploy
**Fix:** Roll back the deploy

### Cause 2: Bad input from a specific client
**Symptom:** High 4xx on one path from one IP
**Fix:** Identify client via access logs, notify or rate-limit

### Cause 3: Algorand endpoint intermittent
**Symptom:** 500s on /score, /trust-graph, /underwrite
**Fix:** Switch Algorand endpoint, or wait for recovery

### Cause 4: Idempotency cache memory pressure
**Symptom:** 500s on /delegate, /revoke
**Fix:** Restart; check idempotency store size

### Cause 5: x402 facilitator misbehavior
**Symptom:** 402s being returned as 500s
**Fix:** See x402 runbook

## Post-Incident

- Add regression test for the error path
- Update rate limits if 4xx-driven
- File post-mortem for 5xx-driven
