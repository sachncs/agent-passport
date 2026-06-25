# Health, Readiness, and Metrics

The service exposes five operational endpoints. None of them are
rate-limited, none require payment, and all return JSON except
`/metrics` (Prometheus text format).

## `GET /health` — liveness

Always returns 200 with a static JSON body, **unless the process is
severely broken**. Used as a Kubernetes `livenessProbe`.

```json
{
  "status": "ok",
  "service": "Agent Passport",
  "version": "0.1.0",
  "network": "testnet",
  "x402": false,
  "timestamp": "2026-06-25T10:00:00.000Z"
}
```

## `GET /ready` — readiness

Pings the configured algod endpoint and returns 200 if reachable,
503 if not. Used as a Kubernetes `readinessProbe`.

```json
{
  "status": "ok",
  "service": "Agent Passport",
  "network": "testnet",
  "timestamp": "2026-06-25T10:00:00.000Z",
  "algorand": {
    "connected": true,
    "round": 52345678
  }
}
```

On failure:

```json
{
  "status": "degraded",
  "service": "Agent Passport",
  ...
  "algorand": {
    "connected": false,
    "error": "URLTokenBaseHTTPError: ..."
  }
}
```

…with HTTP status `503`.

## `GET /health/deep` — informational

Combines `/health` and `/ready` shapes **but always returns 200**,
even when Algorand is down. The Algorand status is informational.
Used by operational dashboards.

## `GET /registry/status`

Reports whether the on-chain contracts are configured.

```json
{ "configured": true, "appId": 12345 }
```

When `REGISTRY_APP_ID=0` (default in `.env.example`):

```json
{ "configured": false, "appId": 0 }
```

## `GET /metrics`

Prometheus-format metrics. Exempt from rate limiting. Returns
`Content-Type: text/plain; version=0.0.4` per the Prometheus
specification.

The full inventory of 38 metrics is documented in
[`../operations/observability.md`](../operations/observability.md).
The three families most operators look at first:

| Metric | What it tells you |
|--------|-------------------|
| `agent_passport_http_requests_total` | Request rate per route + status |
| `agent_passport_http_request_duration_seconds` | Latency distribution per route |
| `agent_passport_http_request_errors_total` | 4xx/5xx rate per route + error_type |

Scrape config:

```yaml
scrape_configs:
  - job_name: agent-passport
    metrics_path: /metrics
    scrape_interval: 30s
    scrape_timeout: 10s
    static_configs:
      - targets: ['agent-passport:3000']
```

## Kubernetes probe example

```yaml
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
```

See the full Kubernetes manifest in
[`../operations/deployment.md`](../operations/deployment.md).

## See also

- [`api/README.md`](README.md) — endpoint reference
- [`../operations/observability.md`](../operations/observability.md) —
  full metrics inventory, SLOs, alert map
- [`api/error-codes.md`](error-codes.md) — `503` from `/ready`
