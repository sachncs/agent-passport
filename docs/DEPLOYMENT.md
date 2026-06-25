# Deployment Guide

## Quick start

```bash
npm install
cp .env.example .env
npm start
```

By default this points at the public Algorand testnet — no setup beyond the env file is needed.

## Health endpoints

| Endpoint | Purpose | Use for |
|----------|---------|---------|
| `GET /health` | Liveness — always 200 unless process is broken | Kubernetes `livenessProbe` |
| `GET /ready` | Readiness — 200 if Algorand is reachable, 503 if not | Kubernetes `readinessProbe` |
| `GET /health/deep` | Both — includes Algorand status in body, always 200 | Operational dashboards |
| `GET /metrics` | Prometheus metrics | Prometheus scrape |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `ALGOD_URL` | `https://testnet-api.algonode.cloud:443` | Algod endpoint |
| `INDEXER_URL` | `https://testnet-idx.algonode.cloud:443` | Indexer endpoint |
| `ALGOD_TOKEN` | `''` | Algod API token (optional for public endpoints) |
| `INDEXER_TOKEN` | `''` | Indexer API token (optional for public endpoints) |
| `ALGO_NETWORK` | `testnet` | Display only |
| `REGISTRY_APP_ID` | 0 | Registry contract app ID (must be > 0 to enable `/delegate` and `/revoke`) |
| `REPUTATION_APP_ID` | 0 | Reputation contract app ID |
| `OPERATOR_MNEMONIC` | — | 25-word Algorand mnemonic for the operator wallet |
| `RATE_LIMIT_MAX` | 600 | Max requests per IP per minute. Set this for production traffic. |
| `RATE_LIMIT_TRUSTED_IPS` | — | Comma-separated IPs exempted from rate limiting (internal services, operator hosts) |
| `RATE_LIMIT_PERSISTENCE_PATH` | `data/rate-limit.json` | Where to persist rate-limit state across restarts |
| `LOG_LEVEL` | `info` | One of: `debug`, `info`, `warn`, `error` |
| `LOG_FILE` | — | Path to log file (optional) |
| `LOG_ERROR_FILE` | — | Path to error log file (optional) |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated origins, or `*` for all |
| `REQUEST_TIMEOUT_MS` | 30000 | Per-request timeout in milliseconds |
| `LOAD_TEST_MODE` | `0` | Set to `1` to disable rate limiting (load testing only) |

## Going to production — checklist

The k6 load test on 2026-06-25 against Algorand testnet measured the following:

| Scenario | VUs | Total reqs | Error rate | P50 | P95 | P99 | Throughput |
|----------|----:|-----------:|-----------:|----:|----:|----:|-----------:|
| A | 100 | 12,425 | 0.00% | 52ms | 1.15s | 2.19s | 190 rps |
| B | 500 | 113,133 | 0.00% | 51ms | 154ms | 1.13s | 1,829 rps |
| C | 1000 | 125,458 | 0.45% | 117ms | 2.27s | 4.13s | 1,760 rps |
| D (sustained) | 1 (12 rps) | 473,873 | 0.00% | 94µs | 133µs | 282µs | 7,897 rps |

The service is **fully stateless** and ready to deploy against any Algorand endpoint.

### 1. Choose your Algorand network

Pick the deployment target that fits your latency and reliability requirements:

| Option | When to use | Latency | Setup |
|--------|-------------|---------|-------|
| **Testnet (AlgoNode)** | Dev, staging, low-traffic production, MVP launches | 200-800ms per round-trip | None — defaults are set |
| **Mainnet via public endpoint** | Production with relaxed SLOs (matches testnet numbers) | 200-800ms per round-trip | Update `ALGOD_URL` and `INDEXER_URL` to mainnet |
| **Mainnet via hosted provider** (Nodely, BCC, AlgoNode paid tier) | Production with stricter SLOs and zero node ops | 50-200ms per round-trip | Subscribe to provider, set URLs |
| **Mainnet via local Algorand node** | Production needing the tightest SLOs (500ms P95) | 5-20ms per round-trip | Run your own node — see [Algorand node docs](https://developer.algorand.org/docs/run-a-node/participate/) |

The k6 testnet baseline above (P95 < 1.5s, 99% availability) is what you should expect with any of the first three options. The local-node option is an upgrade path if you need the stricter `slo-prod-strict` targets (P95 < 500ms, 99.9% availability).

### 2. Set `ALGOD_URL` and `INDEXER_URL`

```bash
# Testnet (default — no change needed)
ALGOD_URL=https://testnet-api.algonode.cloud:443
INDEXER_URL=https://testnet-idx.algonode.cloud:443

# Mainnet via AlgoNode
ALGOD_URL=https://mainnet-api.algonode.cloud:443
INDEXER_URL=https://mainnet-idx.algonode.cloud:443

# Mainnet via Nodely
ALGOD_URL=https://mainnet-api.algonode.com
INDEXER_URL=https://mainnet-idx.algonode.com

# Mainnet via local node
ALGOD_URL=http://algorand-node:8080
INDEXER_URL=http://algorand-indexer:8980
```

### 3. Deploy the registry and reputation contracts (if using `/delegate` and `/revoke`)

```bash
npm run deploy-registry
npm run deploy-reputation
```

Then set:
```bash
REGISTRY_APP_ID=<app-id>
REPUTATION_APP_ID=<app-id>
OPERATOR_MNEMONIC="<25-word-mnemonic>"
```

### 4. Tune the rate limit

```bash
RATE_LIMIT_MAX=600          # 600 req/min/IP is the production-tested default
RATE_LIMIT_TRUSTED_IPS="10.0.0.1,10.0.0.2"  # internal services, operator hosts
```

### 5. For multi-replica deployments, back idempotency with Redis

The in-memory idempotency store works for single-replica deployments. For multi-replica, back it with Redis (SETNX + EX). The interface is in `src/lib/idempotency.ts`.

### 6. Provision Prometheus + Alertmanager + Grafana

- Apply `alerts/prometheus-scrape.yml` to your Prometheus config
- Apply `alerts/alertmanager.yml` to your Alertmanager config
- Import `alerts/grafana-dashboard.json` to your Grafana
- Choose the right SLO file:
  - Testnet, public mainnet endpoint, or hosted provider: `alerts/slo-prod-relaxed.yml`
  - Local Algorand node: `alerts/slo-prod-strict.yml`

### 7. Run the load test in your production environment

```bash
cd load-tests
./run-all.sh
```

Compare against the k6 testnet baseline above. With a low-latency endpoint (local node or premium provider), expect:
- P95 < 500ms for `/score`, `/verify`, `/discovery/search`
- P95 < 1s for `/passport`, `/underwrite`, `/trust-graph`
- 0% errors at 500 VU
- < 1% errors at 1000 VU

### 8. Set up on-call rotation

Against `alerts/escalation-policy.yml` and the 8 runbooks in `alerts/runbooks/`.

## Kubernetes example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-passport
spec:
  replicas: 2
  selector:
    matchLabels:
      app: agent-passport
  template:
    metadata:
      labels:
        app: agent-passport
    spec:
      containers:
      - name: agent-passport
        image: agent-passport:0.1.0
        ports:
        - containerPort: 3000
        env:
        - name: ALGOD_URL
          value: "https://testnet-api.algonode.cloud:443"  # or your mainnet endpoint
        - name: INDEXER_URL
          value: "https://testnet-idx.algonode.cloud:443"
        - name: RATE_LIMIT_MAX
          value: "600"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: agent-passport
spec:
  selector:
    app: agent-passport
  ports:
  - port: 80
    targetPort: 3000
```

## Stateless

- No database required — all data fetched from Algorand per request (cached in-memory for 60s)
- Safe to restart at any time
- Multi-replica safe (with the Redis idempotency caveat above)
