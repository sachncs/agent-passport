# Scripts

The `scripts/` directory contains nine CLI tools, each wired to a
`package.json` script. They are intended for local development,
operational tasks (deployment, scoring, reputation recording), and
test fixtures.

## Environment

Every script reads `.env` via `dotenv.config()` at the top (where
needed). The service is not running while these scripts execute;
they call Algorand directly via the `algosdk` SDK.

## Conventions

- All scripts print to stdout; non-zero exit codes signal failure.
- All scripts validate wallet addresses against
  `^[A-Z2-7]{58}$` before use.
- All scripts are written in TypeScript and run via
  `npx tsx <script-path>`.

## Reference

| Script | `package.json` | Purpose |
|--------|---------------|---------|
| [`score.ts`](#scorets) | `npm run score` | Compute trust score for a wallet |
| [`delegate.ts`](#delegatets) | `npm run delegate` | On-chain delegation (requires operator) |
| [`check-counterparty.ts`](#check-counterpartyts) | `npm run check-counterparty` | Counterparty check |
| [`check-sybil.ts`](#check-sybilts) | `npm run check-sybil` | Sybil risk for a wallet |
| [`check-reputation.ts`](#check-reputationts) | `npm run check-reputation` | Reputation for a wallet |
| [`estimate-credit.ts`](#estimate-creditts) | `npm run estimate-credit` | Credit capacity |
| [`record-reputation.ts`](#record-reputationts) | `npm run record-reputation` | Record a reputation event |
| [`deploy-registry.ts`](#deploy-registryts) | `npm run deploy-registry` | Deploy `registry.teal` |
| [`deploy-reputation.ts`](#deploy-reputationts) | `npm run deploy-reputation` | Deploy `reputation.teal` |

---

### `score.ts`

Compute and print the trust score for a single wallet.

**Usage:**

```bash
npx tsx scripts/score.ts <WALLET_ADDRESS>
```

**Example:**

```bash
npx tsx scripts/score.ts GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A
```

**Output:** A boxed ASCII report with the score, risk level,
approved flag, recommended limit, on-chain data, score breakdown,
and explanation.

**Env vars:** none required (uses defaults from `src/config.ts`).

---

### `delegate.ts`

Submit an on-chain delegation.

**Usage:**

```bash
npx tsx scripts/delegate.ts <SPONSOR> <AGENT> <AMOUNT>
```

**Example:**

```bash
OPERATOR_MNEMONIC="word1 word2 ... word25" \
REGISTRY_APP_ID=12345 \
npx tsx scripts/delegate.ts \
  GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A \
  ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW234 \
  1000
```

**Env vars:** `OPERATOR_MNEMONIC`, `REGISTRY_APP_ID`, `ALGOD_URL`,
`ALGOD_TOKEN`.

---

### `check-counterparty.ts`

Run a counterparty check.

**Usage:**

```bash
npx tsx scripts/check-counterparty.ts <WALLET_ADDRESS>
```

**Output:** `allow`, `confidence`, `riskLevel`, `trustScore`,
`onChainScore`, `delegationScore`, `explanation`.

---

### `check-sybil.ts`

Run a sybil check.

**Usage:**

```bash
npx tsx scripts/check-sybil.ts <WALLET_ADDRESS>
```

**Output:** `sybilRisk`, `riskLevel`, `confidence`, `clusterSize`,
all 12 signal values, `flaggedWallets`, `explanation`.

---

### `check-reputation.ts`

Read a wallet's reputation.

**Usage:**

```bash
npx tsx scripts/check-reputation.ts <WALLET_ADDRESS>
```

**Output:** `reputation`, `riskLevel`, `confidence`, `totalEvents`,
per-event counts and amounts.

---

### `estimate-credit.ts`

Estimate a wallet's credit capacity.

**Usage:**

```bash
npx tsx scripts/estimate-credit.ts <WALLET_ADDRESS> [AMOUNT]
```

**Output:** `estimatedLimit`, `risk`, `confidence`, `approved`,
`breakdown`, `explanation`.

---

### `record-reputation.ts`

Record a reputation event on-chain.

**Usage:**

```bash
npx tsx scripts/record-reputation.ts <WALLET> <EVENT_TYPE> [AMOUNT] [COUNTERPARTY]
```

**Event types:** `payment`, `purchase`, `dispute`, `refund`,
`endorsement`, `service`.

**Example:**

```bash
OPERATOR_MNEMONIC="..." REPUTATION_APP_ID=67890 \
npx tsx scripts/record-reputation.ts \
  GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A \
  payment 100
```

---

### `deploy-registry.ts`

Compile and deploy `registry.teal` to the configured Algorand
network.

**Usage:**

```bash
DEPLOYER_MNEMONIC="<25-word testnet mnemonic>" npm run deploy-registry
```

**What it does:**

1. Reads `DEPLOYER_MNEMONIC` from the env (must hold ≥ 0.1 ALGO)
2. Reads `contracts/registry.teal`
3. Compiles via `algod.compile` (no local TEAL evaluator needed)
4. Submits `makeApplicationCreateTxnFromObject` with
   `numGlobalByteSlices: 1` (admin), `numGlobalInts: 1`
   (total_delegations)
5. Funds the contract account with 0.1 ALGO for MBR
6. Prints the resulting app ID

**Output:**

```
Deployer: GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A
Balance: 1.2345 ALGO
Compiling TEAL...
Deploying Delegation Registry...
Transaction: ABC123...
Registry deployed!
  App ID:    12345
  App Addr:  ABCXYZ...
  Network:   testnet

Add to .env:
  REGISTRY_APP_ID=12345
```

**Env vars:** `DEPLOYER_MNEMONIC` (required), `ALGOD_URL`,
`ALGOD_TOKEN`.

> The `DEPLOYER_MNEMONIC` is **not** used by the running service.
> The service uses `OPERATOR_MNEMONIC` to sign runtime transactions.
> The two mnemonics should be different wallets.

---

### `deploy-reputation.ts`

Compile and deploy `reputation.teal`.

**Usage:**

```bash
DEPLOYER_MNEMONIC="<25-word testnet mnemonic>" npm run deploy-reputation
```

Same flow as `deploy-registry.ts`, but for `reputation.teal`.
Produces `REPUTATION_APP_ID`.

## Adding a new script

1. Create `scripts/<name>.ts`
2. Wire it to `package.json` under `"scripts"`
3. Document it in this file (add a section following the existing
   pattern)
4. Add a CHANGELOG entry under `[Unreleased]`
