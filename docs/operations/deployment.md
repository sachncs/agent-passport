# Deployment

This is the canonical deployment guide. It replaces the legacy
`docs/DEPLOYMENT.md` content (now inlined below with the env-var
table replaced by [environment-variables.md](environment-variables.md)).

## Quick start

```bash
npm install
cp .env.example .env
npm start
```

By default this points at the public Algorand testnet — no setup
beyond the env file is needed.

## Health endpoints

See [../api/health.md](../api/health.md) for the full table. Short
version:

| Endpoint | Purpose | Use for |
|----------|---------|---------|
| `GET /health` | Liveness — always 200 unless process is broken | Kubernetes `livenessProbe` |
| `GET /ready` | Readiness — 200 if Algorand is reachable, 503 if not | Kubernetes `readinessProbe` |
| `GET /health/deep` | Both — includes Algorand status in body, always 200 | Operational dashboards |
| `GET /metrics` | Prometheus metrics | Prometheus scrape |

## Going to production — checklist

### 1. Choose your Algorand network

Pick the deployment target that fits your latency and reliability
requirements:

| Option | When to use | Latency | Setup |
|--------|-------------|---------|-------|
| **Testnet (AlgoNode)** | Dev, staging, low-traffic production, MVP launches | 200-800ms per round-trip | None — defaults are set |
| **Mainnet via public endpoint** | Production with relaxed SLOs (matches testnet numbers) | 200-800ms per round-trip | Update `ALGOD_URL` and `INDEXER_URL` to mainnet |
| **Mainnet via hosted provider** (Nodely, BCC, AlgoNode paid tier) | Production with stricter SLOs and zero node ops | 50-200ms per round-trip | Subscribe to provider, set URLs |
| **Mainnet via local Algorand node** | Production needing the tightest SLOs (500ms P95) | 5-20ms per round-trip | Run your own node — see [Algorand node docs](https://developer.algonand.org/docs/run-a-node/participate/) |

The measured k6 testnet baseline (P95 < 1.5s, 99% availability) is
what you should expect with any of the first three options. The
local-node option is an upgrade path if you need the stricter
`slo-prod-strict` targets (P95 < 500ms, 99.9% availability). See
[observability.md](observability.md) § SLOs.

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
DEPLOYER_MNEMONIC="<25-word-mnemonic>" npm run deploy-registry
DEPLOYER_MNEMONIC="<25-word-mnemonic>" npm run deploy-reputation
```

Each script prints the resulting app ID. Set in `.env`:

```bash
REGISTRY_APP_ID=<app-id>
REPUTATION_APP_ID=<app-id>
OPERATOR_MNEMONIC="<25-word-mnemonic>"
```

The deployer and operator mnemonics are **different** wallets. The
deployer is used only at deploy time; the operator signs runtime
transactions. See
[../security/operator-wallet.md](../security/operator-wallet.md).

### 4. Tune the rate limit

```bash
RATE_LIMIT_MAX=600                    # 600 req/min/IP is the production-tested default
RATE_LIMIT_TRUSTED_IPS="10.0.0.1,10.0.0.2"  # internal services, operator hosts
```

See [rate-limiting.md](rate-limiting.md).

### 5. For multi-replica deployments, back idempotency with Redis

The in-memory idempotency store works for single-replica deployments.
For multi-replica, back it with Redis (SETNX + EX). The interface is
in `src/lib/idempotency.ts`. See
[idempotency.md](idempotency.md) § Multi-replica.

### 6. Provision Prometheus + Alertmanager + Grafana

- Apply `alerts/prometheus-scrape.yml` to your Prometheus config
- Apply `alerts/alertmanager.yml` to your Alertmanager config
- Import `alerts/grafana-dashboard.json` to your Grafana
- Choose the right SLO file:
  - Testnet, public mainnet endpoint, or hosted provider:
    `alerts/slo-prod-relaxed.yml`
  - Local Algorand node: `alerts/slo-prod-strict.yml`

See [observability.md](observability.md) for the full alert inventory.

### 7. Run the load test in your production environment

```bash
cd load-tests
./run-all.sh
```

Compare against the k6 testnet baseline:

| Scenario | VUs | Testnet P95 | Expected prod-strict P95 |
|----------|----:|------------:|------------------------:|
| A (100) | 100 | 1.15s | <500ms |
| B (500) | 500 | 154ms | <750ms |
| C (1000) | 1000 | 2.27s | <1.5s |
| D (sustained) | 12 rps | 133µs | <300ms |

See [load-testing.md](load-testing.md).

### 8. Set up on-call rotation

Against `alerts/escalation-policy.yml` and the 8 runbooks in
`alerts/runbooks/`. See [runbooks.md](runbooks.md) for the index.

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
          value: "https://testnet-api.algonode.cloud:443"
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

## Stateless deployment

- No database required — all data fetched from Algorand per request
  (cached in-memory for 60s — see
  [../architecture/caching.md](../architecture/caching.md))
- Safe to restart at any time
- Multi-replica safe (with the Redis idempotency caveat above)
