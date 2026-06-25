import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

const baseRegistry = new client.Registry();
client.collectDefaultMetrics({ register: baseRegistry, prefix: 'agent_passport_node_' });

class SyncRegistry {
  private readonly inner: client.Registry;

  constructor(inner: client.Registry) {
    this.inner = inner;
  }

  get contentType(): string {
    return this.inner.contentType;
  }

  metrics(): Promise<string> {
    return this.inner.metrics();
  }

  serialize(): string {
    const out: string[] = [];
    for (const metric of this.inner.getMetricsAsArray()) {
      const { name, help, type } = metric;
      out.push(`# HELP ${name} ${help}`);
      out.push(`# TYPE ${name} ${type}`);
      const hashMap = (metric as unknown as { hashMap: Record<string, { value: number; labels?: Record<string, string> }> }).hashMap ?? {};
      for (const entry of Object.values(hashMap)) {
        if (entry.labels && Object.keys(entry.labels).length > 0) {
          const labelStr = Object.entries(entry.labels)
            .map(([k, val]) => `${k}="${String(val).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')}"`)
            .join(',');
          out.push(`${name}{${labelStr}} ${entry.value}`);
        } else {
          out.push(`${name} ${entry.value}`);
        }
      }
    }
    return out.join('\n') + '\n';
  }

  getSingleMetric(name: string): client.Metric | undefined {
    return this.inner.getSingleMetric(name) as client.Metric | undefined;
  }

  registerMetric(metric: client.Metric): void {
    this.inner.registerMetric(metric);
  }

  clear(): void {
    this.inner.clear();
  }
}

export const registry = new SyncRegistry(baseRegistry);

const PREFIX = 'agent_passport_';

export const httpRequestsTotal = new client.Counter({
  name: `${PREFIX}http_requests_total`,
  help: 'Total HTTP requests received',
  labelNames: ['method', 'path', 'status'] as const,
  registers: [baseRegistry],
});

export const httpRequestErrorsTotal = new client.Counter({
  name: `${PREFIX}http_request_errors_total`,
  help: 'Total HTTP requests that returned an error status',
  labelNames: ['method', 'path', 'status', 'error_type'] as const,
  registers: [baseRegistry],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: `${PREFIX}http_request_duration_seconds`,
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [baseRegistry],
});

export const trustScoreGenerationCount = new client.Counter({
  name: `${PREFIX}trust_score_generations_total`,
  help: 'Total trust score generations',
  labelNames: ['risk_level'] as const,
  registers: [baseRegistry],
});

export const trustScoreDurationSeconds = new client.Histogram({
  name: `${PREFIX}trust_score_duration_seconds`,
  help: 'Trust score generation duration in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [baseRegistry],
});

export const graphTraversalDurationSeconds = new client.Histogram({
  name: `${PREFIX}graph_traversal_duration_seconds`,
  help: 'Trust graph traversal duration in seconds',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10],
  registers: [baseRegistry],
});

export const x402PaymentsVerifiedTotal = new client.Counter({
  name: `${PREFIX}x402_payments_verified_total`,
  help: 'Total x402 payments successfully verified',
  labelNames: ['status', 'path'] as const,
  registers: [baseRegistry],
});

export const x402PaymentFailuresTotal = new client.Counter({
  name: `${PREFIX}x402_payment_failures_total`,
  help: 'Total x402 payment verification failures',
  labelNames: ['reason', 'path'] as const,
  registers: [baseRegistry],
});

export const x402ReplayAttemptsTotal = new client.Counter({
  name: `${PREFIX}x402_replay_attempts_total`,
  help: 'Total x402 replay attempts blocked',
  labelNames: ['path'] as const,
  registers: [baseRegistry],
});

export const x402VerificationDurationSeconds = new client.Histogram({
  name: `${PREFIX}x402_verification_duration_seconds`,
  help: 'x402 verification duration in seconds',
  labelNames: ['path'] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2.5],
  registers: [baseRegistry],
});

export const contractEndorsementsTotal = new client.Counter({
  name: `${PREFIX}contract_endorsements_total`,
  help: 'Total on-chain endorsement events',
  registers: [baseRegistry],
});

export const contractRevocationsTotal = new client.Counter({
  name: `${PREFIX}contract_revocations_total`,
  help: 'Total on-chain revocation events',
  registers: [baseRegistry],
});

export const contractDisputesTotal = new client.Counter({
  name: `${PREFIX}contract_disputes_total`,
  help: 'Total on-chain dispute events',
  registers: [baseRegistry],
});

export const contractSuccessEventsTotal = new client.Counter({
  name: `${PREFIX}contract_success_events_total`,
  help: 'Total on-chain success events',
  registers: [baseRegistry],
});

export const processMemoryUsageBytes = new client.Gauge({
  name: `${PREFIX}process_memory_usage_bytes`,
  help: 'Process memory usage in bytes',
  labelNames: ['type'] as const,
  registers: [baseRegistry],
});

export const processUptimeSeconds = new client.Gauge({
  name: `${PREFIX}process_uptime_seconds`,
  help: 'Process uptime in seconds',
  registers: [baseRegistry],
});

export const cacheHitsTotal = new client.Counter({
  name: `${PREFIX}cache_hits_total`,
  help: 'Total cache hits',
  labelNames: ['cache_name'] as const,
  registers: [baseRegistry],
});

export const cacheMissesTotal = new client.Counter({
  name: `${PREFIX}cache_misses_total`,
  help: 'Total cache misses',
  labelNames: ['cache_name'] as const,
  registers: [baseRegistry],
});

export function recordTrustScoreDuration(durationMs: number, riskLevel: string): void {
  trustScoreDurationSeconds.observe({}, durationMs / 1000);
  trustScoreGenerationCount.inc({ risk_level: riskLevel });
}

export function recordGraphTraversal(durationMs: number, _depth: number): void {
  graphTraversalDurationSeconds.observe({}, durationMs / 1000);
}

export function recordX402Verification(durationMs: number, success: boolean, path: string): void {
  x402VerificationDurationSeconds.observe({ path }, durationMs / 1000);
  if (success) {
    x402PaymentsVerifiedTotal.inc({ status: 'success', path });
  } else {
    x402PaymentFailuresTotal.inc({ reason: 'verification_failed', path });
  }
}

export function recordCacheHit(cacheName: string): void {
  cacheHitsTotal.inc({ cache_name: cacheName });
}

export function recordCacheMiss(cacheName: string): void {
  cacheMissesTotal.inc({ cache_name: cacheName });
}

export function recordContractEvent(event: string): void {
  switch (event) {
    case 'endorsement':
      contractEndorsementsTotal.inc();
      break;
    case 'revocation':
      contractRevocationsTotal.inc();
      break;
    case 'dispute':
      contractDisputesTotal.inc();
      break;
    case 'success':
      contractSuccessEventsTotal.inc();
      break;
    default:
      break;
  }
}

export function recordUnderwritingDecision(decision: 'approved' | 'denied'): void {
  const counter = registry.getSingleMetric(`${PREFIX}underwriting_decisions_total`) as client.Counter | undefined;
  if (counter) counter.inc({ decision });
}

export function recordCounterpartyCheck(decision: 'allow' | 'deny'): void {
  const counter = registry.getSingleMetric(`${PREFIX}counterparty_checks_total`) as client.Counter | undefined;
  if (counter) counter.inc({ decision });
}

export function recordIdempotencyConflict(): void {
  const counter = registry.getSingleMetric(`${PREFIX}idempotency_conflicts_total`) as client.Counter | undefined;
  if (counter) counter.inc();
}

export function recordVerifyCheck(flags: Record<string, boolean>): void {
  const counter = registry.getSingleMetric(`${PREFIX}verify_checks_total`) as client.Counter | undefined;
  if (!counter) return;
  for (const [flag, value] of Object.entries(flags)) {
    if (value) counter.inc({ flag, result: 'true' });
    else counter.inc({ flag, result: 'false' });
  }
}

export function recordDiscoverySearch(query: string, resultCount: number): void {
  const counter = registry.getSingleMetric(`${PREFIX}discovery_searches_total`) as client.Counter | undefined;
  if (counter) counter.inc({ query_length: query.length > 0 ? 'non_empty' : 'empty', result_count: String(resultCount) });
}

export function getUniqueWalletCount(): number {
  const metric = registry.getSingleMetric(`${PREFIX}underwriting_decisions_total`) as unknown as { hashMap?: Record<string, { value: number }> } | undefined;
  const hashMap = metric?.hashMap ?? {};
  return Math.floor(Object.values(hashMap).reduce<number>((acc, v) => acc + v.value, 0));
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startNs = process.hrtime.bigint();
  res.on('finish', () => {
    const path = normalizePath(req.route?.path ?? req.path);
    const labels = { method: req.method, path, status: String(res.statusCode) };
    const durationSec = Number(process.hrtime.bigint() - startNs) / 1e9;
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSec);
    if (res.statusCode >= 400) {
      httpRequestErrorsTotal.inc({ ...labels, error_type: res.statusCode >= 500 ? 'server_error' : 'client_error' });
    }
  });
  next();
}

export function metricsEndpoint(_req: Request, res: Response): void {
  res.setHeader('Content-Type', registry.contentType);
  registry.metrics().then((body) => res.send(body)).catch((err) => {
    res.status(500).send(`# error rendering metrics: ${String(err)}`);
  });
}

function normalizePath(p: string): string {
  if (!p) return '/';
  if (p.length > 64) return p.slice(0, 64);
  return p;
}
