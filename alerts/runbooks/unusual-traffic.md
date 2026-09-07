# Runbook: Unusual Traffic Pattern

**Severity:** P2
**On-call:** platform-oncall

## Alert

`UnusualTrafficPattern` — request rate > 100 req/s for 10m+

## Diagnosis

```bash
# 1. Is this organic growth or a spike?
curl -s http://localhost:3000/metrics | grep agent_passport_http_requests_total | head

# 2. Per-endpoint breakdown
curl -s http://localhost:3000/metrics | grep "agent_passport_http_requests_total{" | head -20

# 3. Source IPs
tail -1000 /var/log/agent-passport/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head

# 4. Is the service keeping up?
curl -s http://localhost:3000/metrics | grep -E "request_duration_seconds_count|http_req"
```

## Common Causes & Fixes

### Cause 1: Successful marketing / launch
**Symptom:** Distributed IPs, varied endpoints, organic shape
**Fix:** Scale horizontally; celebrate

### Cause 2: Bot/scraper
**Symptom:** Few IPs, high rate, single endpoint
**Fix:** Add bot detection; rate-limit

### Cause 3: Buggy client
**Symptom:** Single IP, tight retry loop
**Fix:** Notify client; rate-limit

## Post-Incident

- Update capacity planning
- Consider adding per-IP rate limits
