# Runbooks

Index of the 8 alert runbooks under `alerts/runbooks/`. Each
runbook has the same structure: severity, on-call rotation, alert
name, diagnosis shell snippets, common causes with symptom/fix
pairs, and a post-incident checklist.

## Index

| Runbook | Severity | Alert(s) | Path |
|---------|----------|----------|------|
| Agent Passport API Down | P0 | `AgentPassportAPIDown`, `AlgorandDependencyDown` | [../../alerts/runbooks/agent-passport-api-down.md](../../alerts/runbooks/agent-passport-api-down.md) |
| x402 Payment Verification Failure | P0 | `X402PaymentVerificationFailing` | [../../alerts/runbooks/x402-verification-failure.md](../../alerts/runbooks/x402-verification-failure.md) |
| Contract Indexing Failure | P0/P1 | `ContractIndexingFailure`, `ContractEventStall` | [../../alerts/runbooks/contract-indexing-failure.md](../../alerts/runbooks/contract-indexing-failure.md) |
| Elevated Error Rate | P1 | `HighErrorRate`, `ElevatedErrorRate`, `High5xxRate` | [../../alerts/runbooks/elevated-error-rate.md](../../alerts/runbooks/elevated-error-rate.md) |
| Elevated Latency | P1 | `ElevatedLatencyP95`, `ElevatedLatencyP99` | [../../alerts/runbooks/elevated-latency.md](../../alerts/runbooks/elevated-latency.md) |
| Replay Attack Spike | P1 | `ReplayAttackSpike` | [../../alerts/runbooks/replay-attack-spike.md](../../alerts/runbooks/replay-attack-spike.md) |
| Unusual Traffic | P2 | `UnusualTrafficPattern` | [../../alerts/runbooks/unusual-traffic.md](../../alerts/runbooks/unusual-traffic.md) |
| Unusual Graph Growth | P2 | `UnusualGraphGrowth` | [../../alerts/runbooks/graph-growth.md](../../alerts/runbooks/graph-growth.md) |

## On-call rotation

See `alerts/escalation-policy.yml` for the PagerDuty / Slack
routing.

## Alert-to-runbook mapping

The full mapping is in [observability.md](observability.md) §
Alert-to-Runbook Map. Alert rules are in `alerts/alert-rules.yml`
and reference each runbook by relative path.

## How to add a new runbook

1. Add a new file under `alerts/runbooks/<name>.md` with the
   standard structure (severity, on-call, alert, diagnosis, common
   causes, post-incident).
2. Add a new alert rule to `alerts/alert-rules.yml` with the
   `runbook_url` annotation pointing at the new file.
3. Add an entry to the index table above.
4. Add an entry to [observability.md](observability.md) §
   Alert-to-Runbook Map.
5. Run `npm run lint && npm test` and the markdown-link CI check.
