# Security Policy

## Supported Versions

The Agent Passport team releases security patches for the following versions:

| Version | Supported          |
|---------|--------------------|
| `0.1.x` | :white_check_mark: Yes (current) |
| `< 0.1` | :x: No             |

Until the project reaches `1.0.0`, only the latest minor release line receives
security fixes. Critical CVEs may be back-ported to the previous minor at the
maintainers' discretion — open an issue to request a back-port.

## Reporting a Vulnerability

**Please do not file public GitHub issues for security vulnerabilities.**

Report privately via one of the following channels:

- **Email:** sachncs@gmail.com
- **Subject line prefix:** `[SECURITY]`

Include as much of the following as you can:

- Description of the vulnerability and its impact
- Reproduction steps (proof-of-concept code or curl commands welcome)
- Affected version(s) and commit SHA(s)
- Deployment target (testnet / mainnet, AlgoNode / local node)
- Any known workarounds

We will:

1. Acknowledge receipt within **3 business days**
2. Triage and confirm the report within **7 business days**
3. Coordinate disclosure timing with the reporter
4. Publish a security advisory (CVE if applicable) once a fix is released

## Response Expectations

| Severity | First response | Patch target |
|----------|----------------|--------------|
| Critical | 1 business day | 7 days       |
| High     | 3 business days | 30 days     |
| Medium   | 7 business days | 90 days     |
| Low      | 14 business days | Next release |

The project follows [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure):
please give us a reasonable window to patch before public disclosure.

## Disclosure Policy

- We follow [GitHub Security Advisories](https://github.com/sachn-cs/agent-passport/security/advisories)
  for publishing vulnerabilities and CVEs.
- Embargoed details are shared with reporters and downstream operators on a
  need-to-know basis.
- Hall-of-fame credit is given to reporters who follow the responsible
  disclosure process and request it.

## Security Best Practices for Operators

- **Always set `OPERATOR_MNEMONIC`** via a secret manager (AWS Secrets Manager,
  GCP Secret Manager, HashiCorp Vault, Kubernetes Secrets, etc.) — never
  commit it. The mnemonic authorises on-chain `/delegate` and `/revoke`
  operations.
- **Restrict CORS** to known origins in production
  (`CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com`).
- **Tighten rate limits** with `RATE_LIMIT_MAX` and use
  `RATE_LIMIT_TRUSTED_IPS` to exempt internal services.
- **Enable HTTPS** at the load balancer or ingress — the service itself runs
  plain HTTP behind a TLS terminator.
- **Back idempotency with Redis** for multi-replica deployments (the
  in-memory store does not share state across pods). See
  `src/lib/idempotency.ts` for the interface.
- **Rotate operator wallets** periodically and on any suspected compromise.
- **Use a private Algorand endpoint** (hosted provider or local node) for
  mainnet production traffic — the public AlgoNode free tier is fine for
  testnet and dev, but it is rate-limited and not appropriate for SLO-driven
  production workloads.
- **Monitor alerts:** apply `alerts/prometheus-scrape.yml` and either
  `alerts/slo-prod-relaxed.yml` (testnet, public mainnet endpoint) or
  `alerts/slo-prod-strict.yml` (low-latency endpoint) — whichever matches
  your deployment target.
- **Audit logs:** ship `LOG_FILE` to a centralised log store; the structured
  JSON logger emits request IDs that you can correlate across services.
- **Verify x402 settlement** in your integration test suite — never trust a
  200 response without re-checking the on-chain transaction.

## Threat Model

The full threat model — trust amplification, circular delegation, depth
amplification, whale delegation, replay attacks, payment verification,
rate limiting, idempotency, system exposure cap — is documented in
[docs/security/threat-model.md](docs/security/threat-model.md). If you
are deploying Agent Passport in a security-sensitive context, read it
first.

## Dependencies

We monitor dependencies with [Dependabot](.github/dependabot.yml) (weekly
updates, security severity upgrades triggered immediately). Run
`npm audit` locally to check for known vulnerabilities; CI runs
`npm audit --audit-level=high` on every push.

## Acknowledgements

We are grateful to security researchers and operators who report issues
responsibly. Reporters who follow the disclosure process and request
attribution will be credited in the corresponding GitHub Security Advisory.
