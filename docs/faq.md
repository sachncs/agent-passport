# Frequently Asked Questions

> Couldn't find an answer? Open a
> [Support question](https://github.com/sachn-cs/agent-passport/issues/new?template=question.md)
> or check the [docs/](.) directory.

## General

### What is Agent Passport?

A stateless HTTP API that scores Algorand wallets for trust, delegation
trust, sybil risk, reputation, and creditworthiness — and lets sponsors
publish on-chain delegations. See the [README](../README.md) for the
overview and [docs/ARCHITECTURE.md](ARCHITECTURE.md) for the design.

### Is it production-ready?

Yes. The v0.1.0 release ran a full k6 load test against the public
Algorand testnet — 724,889 requests across four scenarios with 0% errors
at 500 VU and 0.45% at 1000 VU. The detailed production-readiness report
is at [docs/REPORT.md](REPORT.md).

### Why no database?

The service is **fully stateless** — every request fetches data from
Algorand (algod + indexer) and caches it in-memory for 60 seconds. There
is no Postgres, no Redis, no message queue. This makes the service
trivial to scale horizontally and trivial to roll back.

### Why Algorand?

Algorand's sub-5-second finality, low fees, and rich indexer make it
ideal for trust and reputation data. The same design would work on any
chain with an indexer; the trust algorithm is chain-agnostic.

## Deployment

### Testnet vs mainnet — which should I deploy?

Either. The defaults point at the **public AlgoNode testnet**, which is
what most people use to start. For production, point
`ALGOD_URL` and `INDEXER_URL` at a mainnet endpoint — see
[docs/DEPLOYMENT.md](DEPLOYMENT.md) for the full list of options
(AlgoNode, Nodely, BCC, local node) and their latency trade-offs.

### What SLOs should I use?

It depends on your Algorand endpoint:

| Endpoint | SLO file |
|----------|----------|
| Testnet, public mainnet endpoint, hosted provider | `alerts/slo-prod-relaxed.yml` (P95 < 1.5s, 99% availability) |
| Local Algorand node, premium hosted provider | `alerts/slo-prod-strict.yml` (P95 < 500ms, 99.9% availability) |

The relaxed targets are the k6-measured baseline against the public
testnet. The strict targets are achievable with a low-latency endpoint
and are an upgrade path, not a prerequisite.

### Can I deploy without Docker?

Yes — `npm run build && npm start` works on any Node 20 host. Docker is
provided as a convenience, not a requirement.

### How do I run behind a load balancer?

Set `app.set('trust proxy', 1)` is already done, so per-IP rate limiting
sees the real client IP via `X-Forwarded-For`. Configure your LB to send
`X-Forwarded-For` and `X-Forwarded-Proto` headers. For multi-replica
deployments, back the in-memory idempotency store with Redis — see
`src/lib/idempotency.ts` for the interface.

## API

### Why does my first call return 402?

x402 micropayments are off by default. If you set `X402_ENABLED=true`
in `.env`, every premium endpoint will return `402 Payment Required`
with a payment spec, and you must retry with an `x-payment` header
containing a verified on-chain USDC transaction. Most consumers should
**leave x402 off** during development.

See [docs/API.md](API.md) for the full x402 flow.

### What's a valid wallet address?

58 characters, base32, uppercase A–Z and digits 2–7. The regex is
`^[A-Z2-7]{58}$`. All inputs are validated by both the service and the
SDKs.

### Why does `/delegate` return 503?

The on-chain registry contract is not configured. Set
`REGISTRY_APP_ID` (and `OPERATOR_MNEMONIC`) in `.env` after deploying
the contract with `npm run deploy-registry`. Without these, every
on-chain call returns `503 REGISTRY_NOT_CONFIGURED` by design.

### What's the difference between `/score` and `/passport`?

- `GET /score` — composite trust score (0–100) with sub-scores and
  on-chain context. ~100 ms cold, 1 ms cached.
- `GET /passport` — full document including score, delegation,
  reputation, sybil risk, credit, on-chain context, and a
  tamper-evident `checksum`. 1.5–3 s cold, ~1 ms cached.

Use `/score` for high-volume underwriting; use `/passport` for
human-readable, shareable documents.

### Why is my response cached?

The service uses an LRU cache with a 60 s TTL on `/score` and
`/passport`. Mutating endpoints (`/delegate`, `/revoke`,
`/reputation/record`) invalidate the cache for affected wallets.
If you need a fresh value, use a different wallet or wait 60 s.

## Trust scoring

### How is the score computed?

Six weighted sub-scores, summed and clamped to 0–100. See
[docs/TRUST-SCORING.md](TRUST-SCORING.md) for the full algorithm,
weights, and risk-level buckets.

| Component | Weight | What it measures |
|-----------|-------:|------------------|
| Age | 0.20 | Account age (linear + log ramp over 730 days) |
| Sponsor | 0.25 | Average sponsor trust + count bonus |
| Activity | 0.20 | Transaction volume and consistency |
| Risk | 0.15 | Sybil risk penalty |
| Velocity | 0.10 | Spike detection vs historical average |
| Compliance | 0.10 | Sanctions, mixer, scam flag penalties |

### Can a wallet with no history get a high score?

No. New wallets start with low age, activity, and volume scores. The
compliance and velocity sub-scores default to neutral, and the sybil
risk is unknown. The composite will land in the `high` or `critical`
bucket until the wallet has 30+ days of activity.

### How do you prevent sybil attacks?

Multiple layers, all documented in [docs/SECURITY.md](SECURITY.md):

- Sybil detection: clustering, timing regularity, amount fingerprint,
  funding correlation
- Trust amplification guards: quality-weighted sponsor count,
  depth-adjusted trust cap (mitigated against trust inflation)
- Cycle detection: BFS with a visited set to prevent circular
  delegations
- Logarithmic amount scoring: 10K ALGO and 100K ALGO both score 100 —
  whale delegations cannot dominate

### Why are risk levels `low` / `medium` / `high` / `critical`?

These are the four buckets the underwriting decision engine keys off of.
The defaults are:

| Range | Bucket |
|-------|--------|
| 70–100 | `low` |
| 45–69 | `medium` |
| 20–44 | `high` |
| 0–19 | `critical` |

You can fork the algorithm and re-bucket — the SDKs surface the raw
sub-scores.

## Observability

### How do I monitor this in production?

Apply `alerts/prometheus-scrape.yml` to your Prometheus config, apply
`alerts/alertmanager.yml` to your Alertmanager config, and import
`alerts/grafana-dashboard.json` (17 panels) into your Grafana. The full
metric inventory is in [docs/OBSERVABILITY.md](OBSERVABILITY.md).

### What's the difference between `slo-prod-relaxed` and `slo-prod-strict`?

- `slo-prod-relaxed.yml` — targets based on **measured** k6 data
  against the public testnet: P95 < 1.5 s, 99% availability, > 100 rps.
- `slo-prod-strict.yml` — aspirational targets achievable with a
  low-latency Algorand endpoint: P95 < 500 ms, 99.9% availability,
  > 1500 rps.

Pick the one that matches your deployment target.

## Security

### Where do I report a security issue?

**Email** sachncs@gmail.com with `[SECURITY]` in the subject. Do **not**
file a public GitHub issue. See [SECURITY.md](../SECURITY.md) for the
full policy and disclosure timeline.

### How is the operator wallet secured?

The 25-word mnemonic lives in `OPERATOR_MNEMONIC`. Use a secret manager
(Kubernetes Secrets, AWS Secrets Manager, GCP Secret Manager, Vault) —
never commit it. The CI workflow does **not** log or store it.

### What happens if my operator mnemonic leaks?

Rotate immediately. The on-chain registry contract supports
`update_admin` (admin-only) — call it to a new admin wallet, then
re-issue delegations from the new operator. Existing delegations are
immutable; revoke the malicious ones and re-issue.

## Contributing

### How do I contribute?

See [CONTRIBUTING.md](../CONTRIBUTING.md). The TL;DR:

1. Fork the repo, branch from `master`
2. Use [Conventional Commits](https://www.conventionalcommits.org/)
3. Run `npm run lint && npm run typecheck && SKIP_E2E=1 npm test`
4. Open a PR with the [template](../.github/PULL_REQUEST_TEMPLATE.md)
   filled in

### Where do I report a vulnerability in a dependency?

File a [bug report](https://github.com/sachn-cs/agent-passport/issues/new?template=bug_report.md)
linking the GHSA / CVE. Dependabot opens weekly PRs — see
[.github/dependabot.yml](../.github/dependabot.yml).
