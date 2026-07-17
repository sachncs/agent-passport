---
name: Bug report
about: Report incorrect behaviour, a crash, or an unexpected result
title: "[Bug]: "
labels: ["bug", "triage"]
assignees: []
---

<!-- Thank you for filing a bug. Please fill in as much of this template as
     you can — incomplete reports take much longer to triage. -->

### Summary

A one- or two-sentence description of the bug.

### Reproduction Steps

```bash
# Minimal curl / SDK snippet that reproduces the issue
curl -i "http://localhost:3000/score?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"
```

### Expected Behaviour

What you expected to happen.

### Actual Behaviour

What actually happened. Include the full response body, status code, and any
`X-Request-ID` header value if available.

### Environment

- **Service version / commit SHA:** (e.g. `0.1.0` / `f0153ed`)
- **Deployment target:** (testnet / mainnet, AlgoNode / Nodely / local node)
- **Node.js version:** (`node --version`)
- **OS:** (e.g. macOS 14.4, Ubuntu 22.04)
- **x402 enabled?** (yes / no)
- **Rate limit in use:** (`RATE_LIMIT_MAX` value, if customised)

### Logs / Screenshots

Paste relevant log lines (with request IDs) or attach a screenshot.

### Checklist

- [ ] I have searched [existing issues](https://github.com/sachncs/agent-passport/issues?q=is%3Aissue)
      for duplicates.
- [ ] I can reproduce the issue against the public Algorand testnet with the
      default `.env.example`.
- [ ] I have included the `X-Request-ID` from a failing response (if any).
- [ ] I am not reporting a security vulnerability — that goes to
      [SECURITY.md](../../SECURITY.md) via email.
