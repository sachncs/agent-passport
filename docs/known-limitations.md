# Known limitations

Agent Passport v1.0 is release-grade open-source infrastructure, not a hosted
identity, credit, or sanctions provider. These boundaries are part of the
public contract.

## Decision boundaries

- A score is an application signal derived from observable Algorand activity;
  it does not prove a human or legal identity.
- `complianceScore` is a behavior and account-state heuristic. It is not a
  regulatory sanctions determination.
- Passport checksums provide deterministic integrity for selected fields; they
  are not signatures and do not establish ownership.
- Sybil and underwriting results are deterministic heuristics. Combine them
  with application-specific policy and review.

## Runtime boundaries

- Read caches and several state stores are process-local unless an operator
  configures the documented persistence or shared-state adapter.
- Idempotency and exposure protections are not a globally coordinated ledger
  in a multi-replica deployment without shared storage.
- x402 verification depends on the configured facilitator. The service does
  not independently provide a universal consumed-payment ledger.
- The default sanctions provider is an in-memory deny-list and is empty unless
  configured. External sanctions data is not bundled.
- Public Algorand availability, indexer completeness, and node latency remain
  upstream dependencies.

## Explicitly out of scope for v1.0

- Hosted multi-tenant SaaS accounts and billing.
- Managed authentication, organization roles, and audit retention.
- Guarantees of approval, repayment, safety, or future agent behavior.
- A claim that all payment, nonce, or replay protections are globally
  single-use across replicas.

See [security](security.md), [architecture](architecture.md), and
[operations](operations.md) for deployment controls and mitigations.
