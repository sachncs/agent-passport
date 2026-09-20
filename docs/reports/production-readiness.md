# Production-readiness review

The current production-readiness guidance lives in the canonical architecture,
security, operations, and API documents. This page is the stable link target
for historical release notes and is intentionally not a second source of
operational truth.

On-chain migration note: the current registry client uses `Accounts[0]` for
the agent, `Accounts[1]` for the sponsor, and an explicit deterministic box
reference. Operators upgrading an older deployment should redeploy or run a
reviewed migration before changing `REGISTRY_APP_ID`.

- [Operations](../operations.md)
- [Security](../security.md)
- [Architecture](../architecture.md)
- [API reference](../api.md)
