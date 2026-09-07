# Scripts

CLI tools for scoring, credit, sybil detection, reputation, and deployment.

## Quick Reference

| Script | npm script | Purpose |
|--------|-----------|---------|
| `score.ts` | `npm run score` | Trust score for a wallet |
| `delegate.ts` | `npm run delegate` | Delegation chain trust |
| `check-counterparty.ts` | `npm run check-counterparty` | Allow/deny decision for a buyer |
| `estimate-credit.ts` | `npm run estimate-credit` | Credit limit estimate |
| `check-sybil.ts` | `npm run check-sybil` | Sybil cluster detection |
| `check-reputation.ts` | `npm run check-reputation` | Reputation score from events |
| `record-reputation.ts` | `npm run record-reputation` | Record a reputation event |
| `deploy-registry.ts` | `npm run deploy-registry` | Deploy delegation registry contract |
| `deploy-reputation.ts` | `npm run deploy-reputation` | Deploy reputation contract |
| `ci/check-md-links.mjs` | `node scripts/ci/check-md-links.mjs` | Validate markdown links in CI |

---

## Details

### score.ts

**Usage:** `npm run score -- <WALLET>`

**Env vars:** None

**Example output:**
```
  Score:     72
  Level:     medium
  Approved:  YES
  Limit:     $45.00
```

Computes an on-chain trust score from balance, activity, volume, velocity, and compliance signals.

### delegate.ts

**Usage:** `npm run delegate -- <WALLET>`

**Env vars:** None

**Example output:**
```
  Score:     65
  Depth:     2 hops
  Sponsor:   3
  Quality:   82%
```

Scores trust inherited through a delegation chain (sponsor → sponsor → ... → wallet).

### check-counterparty.ts

**Usage:** `npm run check-counterparty -- <WALLET>`

**Env vars:** None

**Example output:**
```
  Allow:     YES
  Confidence: 88%
  Risk:      low
  Trust:     75
```

Combines on-chain and delegation scores into an allow/deny decision for a buyer wallet.

### estimate-credit.ts

**Usage:** `npm run estimate-credit -- <WALLET> [AMOUNT]`

**Env vars:** None

**Example output:**
```
  Limit:      $120.00
  Risk:       low
  Confidence: 82%
  Approved:   YES
```

Estimates a credit limit from balance, activity, age, delegation, and risk.

### check-sybil.ts

**Usage:** `npm run check-sybil -- <WALLET>`

**Env vars:** None

**Example output:**
```
  Sybil Risk:  0.12
  Risk Level:  low
  Cluster Size: 1 wallets
```

Detects sybil clusters via creation clustering, interaction density, balance similarity, and circular activity.

### check-reputation.ts

**Usage:** `npm run check-reputation -- <WALLET>`

**Env vars:** None

**Example output:**
```
  Reputation: 85
  Risk Level: low
  Confidence: 90%
  Payments:   12
  Disputes:   0
```

Computes a reputation score from recorded on-chain events (payments, purchases, disputes, endorsements).

### record-reputation.ts

**Usage:** `npm run record-reputation -- <WALLET> <EVENT_TYPE> [AMOUNT] [COUNTERPARTY]`

**Env vars:** None

**Event types:** `payment`, `purchase`, `dispute`, `refund`, `endorsement`, `service`

**Example output:**
```
  Event:     payment
  Amount:    1000000 microAlgo (1.0000 ALGO)
  Round:     42000000
```

Records a reputation event for a wallet on-chain.

### deploy-registry.ts

**Usage:** `npm run deploy-registry`

**Env vars:** `DEPLOYER_MNEMONIC` (required), `ALGOD_URL` (optional, default: testnet), `ALGOD_TOKEN` (optional)

**Example output:**
```
  App ID:    12345678
  App Addr:  ABCDEF...XYZ
  Network:   testnet
```

Deploys the Delegation Registry smart contract to Algorand testnet and funds it.

### deploy-reputation.ts

**Usage:** `npm run deploy-reputation`

**Env vars:** `DEPLOYER_MNEMONIC` (required), `ALGOD_URL` (optional, default: testnet), `ALGOD_TOKEN` (optional)

**Example output:**
```
  App ID:    87654321
  App Addr:  ZYX...FED
  Network:   testnet
```

Deploys the Reputation smart contract to Algorand testnet and funds it.

### ci/check-md-links.mjs

**Usage:** `node scripts/ci/check-md-links.mjs`

**Env vars:** None

**Example output:**
```
[check-md-links] OK — checked 5 files, 0 broken links.
```

Walks all `*.md` files, validates relative links and `#anchor` references. Exits 1 on broken links. Runs in CI.
