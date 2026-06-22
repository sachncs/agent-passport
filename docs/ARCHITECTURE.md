# Architecture

## System Overview

Trust Scoring Service is a stateless Express API that computes wallet trust scores from Algorand testnet data. No database, no Redis, no persistent state.

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Client /    │────▶│  Express (port 3000) │────▶│  Algorand Testnet│
│  Agent       │     │                     │     │  (algod + idx)   │
└──────────────┘     └─────────────────────┘     └──────────────────┘
```

## Request Lifecycle

```
Client                  Server                  Algorand Testnet
  │                       │                          │
  │  GET /score?wallet=X  │                          │
  │──────────────────────▶│                          │
  │                       │  accountInformation(X)   │
  │                       │─────────────────────────▶│
  │                       │◀─────────────────────────│
  │                       │                          │
  │                       │  GET /v2/accounts/X/     │
  │                       │    transactions?limit=500│
  │                       │─────────────────────────▶│
  │                       │◀─────────────────────────│
  │                       │                          │
  │                       │  [compute trust score]   │
  │  200 + trust score    │                          │
  │◀──────────────────────│                          │
```

## Components

### Middleware Stack

```
Request
  │
  ▼
Helmet (security headers)
  │
  ▼
CORS
  │
  ▼
express.json (100kb limit)
  │
  ▼
Morgan (HTTP logging)
  │
  ▼
Global Rate Limiter (100 req/min)
  │
  ▼
Route Handler
```

### Data Fetching

Two Algorand data sources:

| Source | URL | Data |
|--------|-----|------|
| Algod | `https://testnet-api.algonode.cloud:443` | Account balance, asset count, app count, created round |
| Indexer | `https://testnet-idx.algonode.cloud:443` | Transaction history (last 500 txns) |

Both are read-only. No write operations to Algorand.

### Trust Score Computation

All scoring is pure math — no external calls, no database lookups:

1. Fetch account info + transaction history in parallel
2. Compute 5 sub-scores (age, activity, volume, velocity, compliance)
3. Compute weighted composite trust score
4. Classify risk level and recommended limit
5. Generate human-readable explanation

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server |
| `algosdk` | Algorand SDK (algod client) |
| `helmet` | Security headers |
| `cors` | Cross-origin requests |
| `morgan` | HTTP logging |
| `express-rate-limit` | Global rate limiting |
| `zod` | Input validation |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `ALGOD_URL` | `https://testnet-api.algonode.cloud:443` | Algod endpoint |
| `INDEXER_URL` | `https://testnet-idx.algonode.cloud:443` | Indexer endpoint |
| `ALGOD_TOKEN` | `''` | Algod API token |
| `INDEXER_TOKEN` | `''` | Indexer API token |

## Scaling

- **Horizontal**: Stateless servers behind load balancer
- **No shared state**: Each request is independent
- **No database**: All data comes from Algorand testnet
- **Rate limiting**: In-memory per-IP (resets on restart)
