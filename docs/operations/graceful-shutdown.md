# Graceful Shutdown

The service registers signal handlers in `src/index.ts:38-46` and a
matching cleanup hook in `src/app.ts:530-534`.

## Signal handlers (`src/index.ts`)

| Signal | Handler | Effect |
|--------|---------|--------|
| `SIGTERM` | `gracefulShutdown('SIGTERM')` | Drain in-flight HTTP, force exit after 10s |
| `SIGINT` | `gracefulShutdown('SIGINT')` | Same as `SIGTERM` |
| `unhandledRejection` | log | Log only — does **not** exit |
| `uncaughtException` | log + `process.exit(1)` | Log and exit immediately |

The flow for `SIGTERM` / `SIGINT`:

1. Log "Received SIGTERM/SIGINT, shutting down gracefully".
2. Call `server.close()` — Express stops accepting new connections
   and drains in-flight requests.
3. Set a 10-second `setTimeout` — if `server.close()` does not
   complete, log "Forced shutdown after timeout" and call
   `process.exit(1)`.
4. On `server.close()` callback, log "HTTP server closed" and call
   `process.exit(0)`.

## Metrics collector lifecycle (`src/app.ts:530-534`)

```typescript
if (process.env.NODE_ENV !== 'test') {
  startMetricsCollectors();
  process.once('SIGTERM', () => { stopMetricsCollectors(); });
  process.once('SIGINT', () => { stopMetricsCollectors(); });
}
```

`startMetricsCollectors` (in `src/lib/metrics-collectors.ts:21`)
starts a 15-second `setInterval` that updates the
`agent_passport_process_memory_usage_bytes` and
`agent_passport_process_uptime_seconds` gauges. The interval
timer is `.unref()`-ed so it does not block process exit on its
own.

`stopMetricsCollectors` (line 33) clears the interval and nulls the
reference. It is wired to fire **once** per signal so a double-
SIGTERM is a no-op.

The `if (NODE_ENV !== 'test')` guard prevents the interval from
spamming test runs.

## Shutdown order in Kubernetes

When a pod is terminated (e.g. `kubectl delete pod`), the kubelet
sends `SIGTERM` and waits up to `terminationGracePeriodSeconds`
(default 30) before escalating to `SIGKILL`.

The service's 10-second forced exit happens **before** the 30-second
grace period expires, so Kubernetes will see a clean exit code 0
or 1 — not a SIGKILL.

To extend the graceful window, change the `setTimeout(..., 10000)`
in `src/index.ts:29`. Note: longer than 30 seconds risks SIGKILL.

## What does NOT happen on shutdown

- The rate-limit and system-exposure files are **not** flushed —
  they are written synchronously on every change, so the file on
  disk is always current.
- The idempotency store is **not** persisted — it is in-memory.
  A restart loses all in-flight state.
- The response cache is **not** persisted — it is in-memory. A
  restart means a cache-cold first request for every wallet.
- LRU caches in `trust-score.ts`, `sybil.ts`, `delegation.ts`,
  `trust-graph.ts` are **not** persisted — they are in-memory.

## Health checks during shutdown

`/health` returns 200 with the process-level "ok" body, even while
the service is draining. The Kubernetes `livenessProbe` will not
restart the pod during shutdown.

`/ready` returns 200 if the algod endpoint is reachable. The
Kubernetes `readinessProbe` will mark the pod as NotReady **after**
the kubelet sends SIGTERM (because the kubelet's preStop hook
typically runs first). The endpoint is removed from the Service
load-balancer before SIGTERM, so in-flight requests drain to
healthy pods.

## See also

- [../architecture/system-design.md](../architecture/system-design.md) § Configuration Bootstrap and Graceful Shutdown
- [../architecture/module-reference.md](../architecture/module-reference.md) § `src/index.ts`
