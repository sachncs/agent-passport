# Smart Contracts

Agent Passport ships with two Algorand stateful contracts that
back the on-chain mutating endpoints. Both are written in TEAL
(`#pragma version 10`) and compiled at deploy time by
`scripts/deploy-registry.ts` and `scripts/deploy-reputation.ts`.

## 1. `contracts/registry.teal` — Delegation Registry

Tracks trust-delegation relationships. Used by `/delegate` and
`/revoke`. Source: [`../../contracts/registry.teal`](../../contracts/registry.teal).

### Global state

| Key | Type | Set on | Purpose |
|-----|------|--------|---------|
| `admin` | bytes (address) | create | Admin address; can call `update_admin` |
| `total_delegations` | uint64 | each `add_delegation` | Active-delegation counter |

### Box storage

| Key | Value | Notes |
|-----|-------|-------|
| `"del:" + delegator (32 bytes) + delegatee (32 bytes)` | `amount (8 bytes, uint64) + timestamp (8 bytes, uint64)` | 16 bytes per box |

### Methods

| Method | App args | Foreign accounts | Effect |
|--------|----------|-----------------|--------|
| `add_delegation` | `["add_delegation", encodeUint64(amount)]` | `[delegatee]` | Sets/overwrites the `del:` box; increments `total_delegations` |
| `revoke_delegation` | `["revoke_delegation"]` | `[delegatee]` | Deletes the `del:` box; decrements `total_delegations` |
| `check_delegation` | `["check_delegation", encodeUint64(delegator), encodeUint64(delegatee)]` | — | Read-only existence check |
| `get_delegations` | `["get_delegations", encodeUint64(wallet)]` | — | Returns count of outgoing delegations |
| `update_admin` | `["update_admin", encodeUint64(new_admin)]` | — | Admin-only rotation |

### Wire encoding (`src/registry.ts:86-90`)

```typescript
const appArgs: Uint8Array[] = [
  new TextEncoder().encode('add_delegation'),
  algosdk.encodeUint64(Math.floor(amount)),
];
const accounts = [agent];
```

The `accounts` array tells the contract which wallets the inner
boxes can reference — Algorand's box-storage foreign-array mechanism.

## 2. `contracts/reputation.teal` — Reputation Layer

Records observable behaviour events per wallet. Used by
`/reputation/record`. Source:
[`../../contracts/reputation.teal`](../../contracts/reputation.teal).

### Global state

| Key | Type | Set on | Purpose |
|-----|------|--------|---------|
| `admin` | bytes (address) | create | Admin address |
| `total_events` | uint64 | each `record` | Total event count |

### Box storage (per wallet + event type)

| Key | Value | Notes |
|-----|-------|-------|
| `"rep:" + wallet (32 bytes) + ":" + eventTypeChar (1 byte)` | `count (8 bytes, uint64) + total_amount (8 bytes, uint64)` | 16 bytes per box |

### Event-type character codes

| `EventType` | On-chain char |
|-------------|---------------|
| `payment` | `p` |
| `purchase` | `u` |
| `dispute` | `d` |
| `refund` | `r` |
| `endorsement` | `e` |
| `service` | `s` |

These codes are defined in `src/reputation.ts:14-22` as
`EVENT_TYPE_MAP`. The map is single-source-of-truth for the
on-chain encoding.

### Methods

| Method | App args | Effect |
|--------|----------|--------|
| `record` | `["record", encodeUint64(wallet), eventTypeChar, encodeUint64(amount)]` | Increments the per-(wallet, eventType) box; increments `total_events` |

## 3. Deploying the contracts

`scripts/deploy-registry.ts` and `scripts/deploy-reputation.ts`
compile the TEAL and submit the create transaction.

```bash
# Requires ≥0.1 ALGO in the deployer wallet.
DEPLOYER_MNEMONIC="<25-word testnet mnemonic>" npm run deploy-registry
DEPLOYER_MNEMONIC="<25-word testnet mnemonic>" npm run deploy-reputation
```

Each script:
1. Reads the TEAL source from `contracts/`
2. Compiles via `algod.compile` (no local TEAL evaluator needed)
3. Sends a `makeApplicationCreateTxnFromObject` with the correct
   `numGlobalByteSlices` / `numGlobalInts` and zero locals
4. Funds the resulting app account with 0.1 ALGO for MBR
5. Prints the new app ID — set as `REGISTRY_APP_ID` /
   `REPUTATION_APP_ID`

The deployer mnemonic is **never** used by the running service. The
service uses `OPERATOR_MNEMONIC` (a different wallet) to sign
runtime transactions.

## 4. Operating-mode degradation

When `REGISTRY_APP_ID=0` (the default in `.env.example`):

- Every `/delegate` and `/revoke` request returns
  `503 REGISTRY_NOT_CONFIGURED`
- `/registry/status` returns `{ "configured": false, "appId": 0 }`
- The service is fully usable for read-only endpoints

This is by design — it lets operators stand up the API without
deploying the contracts, and lets developers run the service
end-to-end on testnet without funding the operator wallet.

## 5. Admin rotation

The on-chain `update_admin` method rotates the admin address. The
service does **not** expose this; it must be called directly via
the Algorand SDK or a tool like `goal app call`.

```python
# Pseudocode
algod.send_transaction(...)
algod.wait_for_confirmation(...)
# Set OPERATOR_MNEMONIC to the new admin's mnemonic
# Restart the service
```

Existing delegations are **immutable** once written. To "move" a
delegation, revoke from the old pair and add a new pair.

## 6. TEAL authoring notes

- Use `#pragma version 10` for `v10` semantics.
- `txn ApplicationID == 0` branches to `handle_create` for app
  initialization.
- `txn OnCompletion == NoOp` branches to `handle_noop` for method
  dispatch.
- The first app arg is the method name (string). Subsequent args
  are `uint64`s encoded via `btoi` after a length check.
- All writes go through box-storage primitives
  (`box_create`, `box_put`, `box_del`).

## 7. Security assumptions

- The admin address never leaks the operator mnemonic.
- The deployer mnemonic is used only at deploy time and discarded.
- The service is rate-limited and idempotency-protected; an attacker
  cannot burn the operator's ALGO balance faster than `RATE_LIMIT_MAX`
  per minute.
- The contract code is short enough to audit line by line — see
  `contracts/registry.teal` (356 lines) and
  `contracts/reputation.teal` (259 lines).
- The contract is admin-only for `update_admin`; read methods
  (`check_delegation`, `get_delegations`) are public.

See [../security/threat-model.md](../security/threat-model.md) for
the full threat model.
