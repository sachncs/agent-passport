# Environment Variables

The canonical env-var table. Every variable the service reads is
listed here, sourced from `.env.example` and `src/config.ts`.

If you add a new env var, update this page, `.env.example`, and
`src/config.ts` together. The CI check on this doc fails if a var
in `.env.example` is missing from this page.

## How to set them

Copy `.env.example` to `.env` and edit. The service calls
`dotenv.config()` on startup (`src/index.ts:2`) so `.env` is loaded
automatically.

## Service

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | int | `3000` | HTTP listen port |
| `NODE_ENV` | enum | `development` | Set to `production` to disable metrics collectors in tests |
| `LOG_LEVEL` | enum | `info` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_FILE` | path | — | JSON log file (optional) |
| `LOG_ERROR_FILE` | path | — | Error-only log file (optional) |
| `CORS_ALLOWED_ORIGINS` | string | `*` | Comma-separated origins, or `*` |

## Algorand

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ALGOD_URL` | URL | `https://testnet-api.algonode.cloud:443` | algod v2 endpoint |
| `ALGOD_TOKEN` | string | `""` | API token (AlgoNode free tier does not require one) |
| `INDEXER_URL` | URL | `https://testnet-idx.algonode.cloud:443` | Indexer v2 endpoint |
| `INDEXER_TOKEN` | string | `""` | API token |
| `ALGO_NETWORK` | string | `testnet` | Display only |

For mainnet endpoints, see
[deployment.md](deployment.md#1-choose-your-algorand-network).

## Smart contracts

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REGISTRY_APP_ID` | int | `0` | App ID of `registry.teal`. Set to `0` to disable `/delegate` and `/revoke` |
| `REPUTATION_APP_ID` | int | `0` | App ID of `reputation.teal`. Set to `0` to disable `/reputation/record` on-chain writes |
| `OPERATOR_MNEMONIC` | string | — | 25-word Algorand mnemonic for the runtime operator wallet |
| `DEPLOYER_MNEMONIC` | string | — | 25-word mnemonic used **only** by `scripts/deploy-registry.ts` and `scripts/deploy-reputation.ts` |

See [../architecture/smart-contracts.md](../architecture/smart-contracts.md) § Deploying the contracts and
[../security/operator-wallet.md](../security/operator-wallet.md) for the operator-wallet guidance.

## x402

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `X402_ENABLED` | bool | `false` | When `true`, every premium endpoint requires an `x-payment` header |
| `X402_FACILITATOR_URL` | URL | `https://x402.org/facilitator` | x402 facilitator endpoint |
| `X402_PAYMENT_RECIPIENT` | string | — | Algorand address that receives USDC payments (**required** when x402 is enabled) |
| `X402_NETWORK` | string | `eip155:84532` | x402 network identifier (chain:ID format) |

See [../architecture/middleware-stack.md](../architecture/middleware-stack.md) § x402 for the full flow.

## Rate limiting

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RATE_LIMIT_MAX` | int | `600` | Per-IP requests per minute |
| `RATE_LIMIT_TRUSTED_IPS` | string | — | Comma-separated IPs exempt from the limit |
| `RATE_LIMIT_PERSISTENCE_PATH` | path | `data/rate-limit.json` | Where to persist state across restarts |

See [rate-limiting.md](rate-limiting.md) for the full design.

## Idempotency

The idempotency store is configured entirely in code (no env vars):

| Setting | Value | Source |
|---------|-------|--------|
| `Idempotency-Key` length | 8–255 chars, `[A-Za-z0-9_\-:]+` | `src/lib/idempotency.ts:5-7` |
| Default TTL | 24 hours | `src/lib/idempotency.ts:8` |
| Sweeper interval | 5 minutes | `src/lib/idempotency.ts:9` |
| Max store size | 10 000 entries | `src/lib/idempotency.ts:10` |

For multi-replica deployments, see
[idempotency.md](idempotency.md) § Multi-replica.

## System exposure cap

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `EXPOSURE_PERSISTENCE_PATH` | path | `data/system-exposure.json` | Where to persist cumulative system exposure |

The cap itself (`MAX_SYSTEM_EXPOSURE = 100_000` USDC) is
hard-coded. See [system-exposure.md](system-exposure.md).

## Request timeout

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REQUEST_TIMEOUT_MS` | int | `30000` | Per-request timeout for upstream Algorand / x402 calls |
| `LOAD_TEST_MODE` | bool | `0` | Set to `1` to **disable rate limiting** (load testing only — never in production) |

`withTimeout` and `fetchWithTimeout` in
`src/lib/timeout.ts` use this value.

## Constants (hard-coded, no env var)

These live in `src/lib/constants.ts` and are not configurable:

| Constant | Value | Purpose |
|----------|-------|---------|
| `WALLET_REGEX` | `/^[A-Z2-7]{58}$/` | Algorand address validator |
| `MICRO_ALGO` | `1_000_000` | Algo → microAlgo |
| `SECONDS_PER_BLOCK` | `3.3` | Average Algorand block time |
| `TESTNET_GENESIS_ROUND` | `64_600_000` | Testnet genesis round |
| `MAX_ROUNDS_LOOKBACK` | `1_000_000` | Cap for indexer queries |
| `MAX_SYSTEM_EXPOSURE` | `100_000` | Underwriting cap (USDC) |

## x402 pricing (`X402_PRICING` in `src/lib/constants.ts`)

| Endpoint | Price (USDC) |
|----------|--------------|
| `/score` | 0.001 |
| `/delegation` | 0.001 |
| `/counterparty-check` | 0.002 |
| `/credit-estimate` | 0.002 |
| `/sybil-check` | 0.003 |
| `/reputation` | 0.001 |
| `/reputation/record` | 0.005 |
| `/underwrite` | 0.01 |
| `/trust-graph` | 0.005 |
| `/passport` | 0.005 |
