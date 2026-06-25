# Data Flow

Sequence diagrams for the four most representative endpoints.

## 1. `GET /score?wallet=X`

```mermaid
sequenceDiagram
  participant C as Client
  participant M as Express middleware
  participant R as Route handler
  participant Cache as responseCache
  participant TS as trust-score.ts
  participant Algod as algod v2
  participant Idxr as Indexer v2

  C->>M: GET /score?wallet=X
  M->>R: (after helmet, requestId, CORS,<br/>rateLimit, json, metrics, x402, settlement, idempotency)
  R->>Cache: get('score:X')
  alt cache hit
    Cache-->>R: cached result
    R-->>C: 200 + JSON
  else cache miss
    R->>TS: scoreWallet(X)
    TS->>Algod: accountInformation(X)
    Algod-->>TS: Account
    TS->>Algod: status()
    Algod-->>TS: NodeStatusResponse (lastRound)
    TS->>Idxr: /v2/accounts/X/transactions?limit=100
    Idxr-->>TS: { transactions[], next-token }
    Note over TS: compute 5 sub-scores<br/>(age, activity, volume,<br/>velocity, compliance)
    TS-->>R: WalletTrustScore
    R->>Cache: set('score:X', result, 60_000)
    R-->>C: 200 + JSON
  end
```

**Algorand round-trips:** 2 (algod) + 1 (indexer) = 3.
**Cache TTL:** 60 s.

## 2. `GET /passport?wallet=X`

The passport fan-out is the most I/O-heavy path. It calls five
sub-systems and bypasses the per-wallet LRU caches for guaranteed
freshness.

```mermaid
sequenceDiagram
  participant C as Client
  participant R as Route handler
  participant Cache as responseCache
  participant TS as scoreWalletFresh
  participant DG as scoreDelegationFresh
  participant CR as estimateCreditWithTrust
  participant SY as detectSybilFresh
  participant RP as computeReputation
  participant Algod as algod
  participant Idxr as Indexer

  C->>R: GET /passport?wallet=X
  R->>Cache: get('passport:X')
  alt cache hit
    Cache-->>R: cached
    R-->>C: 200 + JSON
  else cache miss
    par parallel fan-out
      R->>TS: scoreWalletFresh(X)
      TS->>Algod: accountInformation
      TS->>Idxr: transactions
    and
      R->>DG: scoreDelegationFresh(X)
      DG->>Idxr: /v2/accounts/X/transactions?tx-type=axfer
    and
      R->>CR: estimateCreditWithTrust(X)
      CR->>Algod: accountInformation (reused)
    and
      R->>SY: detectSybilFresh(X)
      SY->>Idxr: /v2/accounts/X/transactions (paginated)
    and
      R->>RP: computeReputation(X)
      RP->>Algod: accountInformation (reused)
    end
    R->>R: assemble passport,<br/>compute checksum
    R->>Cache: set('passport:X', result, 60_000)
    R-->>C: 200 + JSON
  end
```

**Algorand round-trips:** 2 (algod) + 4-6 (indexer, paginated) = 6-8.
**Cache TTL:** 60 s. The response cache short-circuits repeat
requests entirely.

The passport document carries a tamper-evident SHA-256
`checksum` field — see [../concepts/passport-document.md](../concepts/passport-document.md).

## 3. `GET /underwrite?wallet=X`

```mermaid
sequenceDiagram
  participant C as Client
  participant R as Route handler
  participant UW as underwriting.ts
  participant TS as trust-score.ts
  participant DG as delegation.ts
  participant CR as credit.ts
  participant SY as sybil.ts
  participant SE as system-exposure.ts

  C->>R: GET /underwrite?wallet=X
  R->>UW: underwrite(X)
  UW->>SE: getSystemExposure()
  SE-->>UW: current total
  UW->>TS: scoreWalletFresh(X) (Trust 0.35)
  UW->>DG: scoreDelegationFresh(X) (Delegation 0.25)
  UW->>SY: detectSybilFresh(X) (Sybil 0.20, also applySybilPenalty)
  UW->>CR: estimateCreditWithTrust(X, trustResult) (Reputation 0.20)
  Note over UW: compositeScore = Σ factor × weight<br/>approved = compositeScore ≥ 40<br/>recommendedLimit = capToSystemCapacity(...)
  UW->>SE: addSystemExposure(recommendedLimit)
  alt approved
    UW-->>R: { approved: true, recommendedLimit, factors, ... }
  else denied
    UW-->>R: { approved: false, recommendedLimit: 0, ... }
  end
  R-->>C: 200 + JSON
```

**Algorand round-trips:** 2 (algod) + 4-6 (indexer) = 6-8.
**State writes:** `data/system-exposure.json` (synchronous).

The underwriting decision uses the **non-fresh** variants in
`underwrite()` (`scoreWallet`, `scoreDelegation`, `detectSybil`)
plus `estimateCreditWithTrust` — see
[../concepts/credit-and-underwriting.md](../concepts/credit-and-underwriting.md).

## 4. `POST /delegate`

```mermaid
sequenceDiagram
  participant C as Client
  participant R as Route handler
  participant Reg as registry.ts
  participant OW as operator-wallet.ts
  participant Algod as algod
  participant Chain as registry.teal

  C->>R: POST /delegate {sponsor, agent, amount}
  R->>R: validate args (regex, sponsor≠agent, amount>0)
  R->>Reg: delegate(sponsor, agent, amount)
  Reg->>Reg: validateArgs
  alt REGISTRY_APP_ID = 0
    Reg-->>R: RegistryNotConfiguredError
    R-->>C: 503 REGISTRY_NOT_CONFIGURED
  else configured
    Reg->>OW: submitApplicationCall(REGISTRY_APP_ID, appArgs, [agent])
    OW->>Algod: getTransactionParams()
    Algod-->>OW: suggested params
    OW->>Algod: makeApplicationCallTxnFromObject + sign + sendRawTransaction
    Algod->>Chain: application call (add_delegation)
    Chain->>Chain: write/overwrite "del:" box<br/>increment total_delegations
    Chain-->>Algod: tx confirmed
    Algod-->>OW: { txid }
    OW-->>Reg: txid
    Reg->>R: { txId, sponsor, agent, amount, round: 0, timestamp }
    R->>R: responseCache.delete(<br/>'score:'+sponsor, 'score:'+agent,<br/>'passport:'+sponsor, 'passport:'+agent)
    R-->>C: 201 + JSON
  end
```

**Algorand round-trips:** 2 (algod) + 1 (stateful call) = 3.
**Idempotency:** `Idempotency-Key` header recommended; replays
return the cached response within 24 h.

See [../architecture/smart-contracts.md](../architecture/smart-contracts.md)
for the on-chain encoding details.
