# Deployment Guide

## Prerequisites

- Node.js >= 20.0.0
- Algorand testnet access (public endpoints, no API key required)

## Setup

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Server runs at `http://localhost:3000`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `ALGOD_URL` | `https://testnet-api.algonode.cloud:443` | Algod endpoint |
| `INDEXER_URL` | `https://testnet-idx.algonode.cloud:443` | Indexer endpoint |
| `ALGOD_TOKEN` | `''` | Algod API token (optional for public endpoints) |
| `INDEXER_TOKEN` | `''` | Indexer API token (optional for public endpoints) |

## Health Check

```bash
curl http://localhost:3000/health
```

## Trust Score

```bash
curl "http://localhost:3000/score?wallet=<58_CHAR_BASE32_ADDRESS>"
```

## No Database Required

- No Prisma, no migrations, no seed scripts
- No Redis, no external caches
- All data fetched from Algorand testnet per request
- Fully stateless — safe to restart at any time
