# Runbook: Replay Attack Spike

**Severity:** P1
**On-call:** security-oncall

## Alert

`ReplayAttackSpike` — `agent_passport_x402_replay_attempts_total` rate > 0.05 for 2m+

## Diagnosis

```bash
# 1. Confirm the spike
curl -s http://localhost:3000/metrics | grep x402_replay_attempts_total

# 2. Source IPs
grep -i "replay" /var/log/agent-passport/app.log | awk '{print $NF}' | sort | uniq -c | sort -rn | head

# 3. Token values being replayed
grep -i "replay" /var/log/agent-passport/app.log | tail -20

# 4. Recent traffic pattern
curl -s http://localhost:3000/metrics | grep http_requests_total | tail -20
```

## Common Causes & Fixes

### Cause 1: Misconfigured client retrying the same payment
**Symptom:** Single IP, single payment token
**Fix:** Notify the client, ask them to use `Idempotency-Key` for retries

### Cause 2: Active attack
**Symptom:** Multiple IPs, varied tokens, high rate
**Fix:**
1. Add the IPs to a blocklist at the load balancer
2. Increase idempotency cache TTL
3. File abuse report with payment network
4. Consider requiring `Idempotency-Key` on all paid endpoints (future enhancement)

### Cause 3: Legitimate retries during network blip
**Symptom:** Spike followed by self-resolution
**Fix:** No action; educate clients

## Post-Incident

- Add automated IP blocklist if attack is sustained
- Review x402 idempotency key handling
- Document client retry patterns
