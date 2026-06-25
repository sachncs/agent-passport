# Operator Wallet

The **operator wallet** is a pre-funded Algorand account that signs
and submits transactions for `/delegate`, `/revoke`, and
`/reputation/record`. It is distinct from the **deployer wallet**
used by the deploy scripts (see
[../architecture/smart-contracts.md](../architecture/smart-contracts.md)).

## Configuration

| Env var | Required | Description |
|---------|----------|-------------|
| `OPERATOR_MNEMONIC` | Yes (for on-chain calls) | 25-word Algorand mnemonic |
| `REGISTRY_APP_ID` | Yes (for `/delegate`, `/revoke`) | App ID of `registry.teal` |
| `REPUTATION_APP_ID` | Yes (for `/reputation/record` on-chain writes) | App ID of `reputation.teal` |

When `OPERATOR_MNEMONIC` is unset, `initOperatorWallet` logs a
warning and returns `false`. The on-chain endpoints continue to
work, but the runtime will log "Operator wallet not initialized —
cannot submit transaction" for every call. Set the mnemonic (or
accept the warning) before deploying.

## Lifecycle

`initOperatorWallet()` (`src/lib/operator-wallet.ts:29`) is called
once at service startup (via `src/app.ts` or `src/index.ts`). It:

1. Reads `process.env.OPERATOR_MNEMONIC`
2. Validates it is 25 words
3. Calls `algosdk.mnemonicToSecretKey` to derive the address +
   secret key
4. Logs the address (one-time, at info level)
5. Stores the account in module-level `operatorAccount`

The account is held **only in memory** and is never logged or
serialised after init.

## Transaction submission

`submitApplicationCall(appIndex, appArgs, accounts)` at
`src/lib/operator-wallet.ts:75`:

1. Gets the current `getTransactionParams` from algod (10s timeout)
2. Builds an `ApplicationCallTxn` with `OnApplicationComplete.NoOpOC`
3. Signs with the operator's secret key
4. Submits via `sendRawTransaction` (10s timeout)
5. Returns the `txid` on success, `null` on failure

The full sequence is documented in
[../architecture/data-flow.md](../architecture/data-flow.md) § 4.
`POST /delegate`.

## Funding requirement

Every `/delegate`, `/revoke`, and `/reputation/record` call
spends **1000 microAlgo** (0.001 ALGO) on transaction fees. The
operator wallet must hold a balance that comfortably supports the
expected request volume. Rule of thumb:

```
operator_balance >= RATE_LIMIT_MAX * 0.001 ALGO * 60 minutes
```

For the default 600 req/min, that is `600 × 0.001 × 60 = 36 ALGO`
per hour of peak traffic. Refill as needed.

## KMS / secret-manager integration

**In production, the mnemonic must not be in `.env` on disk.** Use a
secret manager:

| Provider | How to surface the secret to the pod |
|----------|--------------------------------------|
| AWS Secrets Manager | Inject via the AWS Secrets Manager CSI driver as a volume, or use IRSA + a sidecar |
| GCP Secret Manager | Inject via the GCP Secret Manager CSI driver, or workload identity |
| HashiCorp Vault | Inject via the Vault Agent sidecar |
| Kubernetes | `Secret` resource, mounted as a volume; rotate via the secrets-manager controller |

A common pattern:

```yaml
env:
  - name: OPERATOR_MNEMONIC
    valueFrom:
      secretKeyRef:
        name: agent-passport-secrets
        key: operator-mnemonic
```

## Rotation

The on-chain contracts support `update_admin(new_admin)`. To
rotate the operator:

1. Fund a new operator wallet.
2. Call `update_admin(new_admin)` against `registry.teal` and
   `reputation.teal` directly (the service does not expose this).
3. Set `OPERATOR_MNEMONIC` to the new mnemonic.
4. Restart the service.

Existing delegations and reputation events are **immutable** — they
are not affected by the rotation. To re-issue a delegation from
the new operator, the old pair must be revoked and a new pair
added.

## What happens if the mnemonic leaks

1. **Immediately** fund a new operator wallet and call
   `update_admin` on both contracts.
2. Restart the service with the new mnemonic.
3. Identify leaked delegations via the on-chain box storage (or
   the indexer) and revoke them.
4. Re-issue delegations from the new operator as needed.
5. Audit recent on-chain activity for unauthorized
   `/reputation/record` calls.
6. File a security incident report. The CI workflow does **not**
   log or store the mnemonic, so a leak is a deployment-side
   problem.

## See also

- [../architecture/smart-contracts.md](../architecture/smart-contracts.md)
- [../../SECURITY.md](../../SECURITY.md) — vulnerability disclosure
- [threat-model.md](threat-model.md) § Operator mnemonic in env
- [../operations/environment-variables.md](../operations/environment-variables.md) § Smart contracts
