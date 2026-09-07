# Runbook: Agent Passport API Down

**Severity:** P0
**On-call:** platform-oncall
**PagerDuty service:** agent-passport-critical

## Alert

`AgentPassportAPIDown` — `up{job="agent-passport"} == 0` for 1m+

## Diagnosis

```bash
# 1. Is the process running?
ps aux | grep -E "node.*agent-passport|tsx.*src/index" | grep -v grep

# 2. Check logs
journalctl -u agent-passport --since "10 minutes ago" | tail -200

# 3. Is the port open?
ss -tlnp | grep 3000

# 4. Can we curl /health from the same host?
curl -i http://localhost:3000/health
```

## Common Causes & Fixes

### Cause 1: Process crashed
**Symptom:** `ps` returns no process, journalctl shows stack trace
**Fix:**
```bash
systemctl restart agent-passport
# or
docker compose restart agent-passport
```

### Cause 2: Out of memory
**Symptom:** `dmesg` shows OOM killer, `agent_passport_process_memory_usage_bytes{type="rss"}` spiked before crash
**Fix:**
1. Increase memory limit (Kubernetes: `resources.limits.memory`)
2. Investigate memory leak with `node --inspect` + heap snapshot
3. Restart and monitor

### Cause 3: Algorand dependency unreachable
**Symptom:** `/health` returns 503 with `algorand.connected: false`
**Fix:**
1. Check AlgoNode status: https://status.algonode.cloud/
2. If `ALGOD_URL` is set to a custom endpoint, verify connectivity
3. Switch to AlgoNode: `ALGOD_URL=https://testnet-api.algonode.cloud:443`

### Cause 4: Port conflict
**Symptom:** Logs show `EADDRINUSE`
**Fix:** `lsof -i :3000` then `kill <pid>`, or change `PORT` env var

## Post-Incident

- File a post-mortem within 48h
- Update runbook with new findings
- Add regression test if root cause was a code defect
