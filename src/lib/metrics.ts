import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

const baseRegistry = new client.Registry();
client.collectDefaultMetrics({ register: baseRegistry, prefix: 'agent_passport_node_' });

export const registry = baseRegistry;

const PREFIX = 'agent_passport_';

// ── HTTP metrics ────────────────────────────────────────────────

export const httpRequestsTotal = new client.Counter({
  name: `${PREFIX}http_requests_total`,
  help: 'Total HTTP requests received',
  labelNames: ['method', 'path', 'status_class'] as const,
  registers: [baseRegistry],
});

export const httpRequestErrorsTotal = new client.Counter({
  name: `${PREFIX}http_request_errors_total`,
  help: 'Total HTTP requests that returned an error status',
  labelNames: ['method', 'path', 'status_class', 'error_type'] as const,
  registers: [baseRegistry],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: `${PREFIX}http_request_duration_seconds`,
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_class'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [baseRegistry],
});

// ── Trust scoring metrics ───────────────────────────────────────

export const trustScoreGenerationCount = new client.Counter({
  name: `${PREFIX}trust_score_generations_total`,
  help: 'Total trust score generations',
  labelNames: ['risk_level'] as const,
  registers: [baseRegistry],
});

export const trustScoreDurationSeconds = new client.Histogram({
  name: `${PREFIX}trust_score_duration_seconds`,
  help: 'Trust score generation duration in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [baseRegistry],
});

export const graphTraversalDurationSeconds = new client.Histogram({
  name: `${PREFIX}graph_traversal_duration_seconds`,
  help: 'Trust graph traversal duration in seconds',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10],
  registers: [baseRegistry],
});

// ── x402 metrics ────────────────────────────────────────────────

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

export const x402SettlementFailuresTotal = new client.Counter({
  name: `${PREFIX}x402_settlement_failures_total`,
  help: 'Total x402 on-chain settlement verification failures',
  labelNames: ['reason'] as const,
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

// ── Smart-contract metrics ──────────────────────────────────────

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

// ── Process / runtime metrics ───────────────────────────────────

export const processMemoryUsageBytes = new client.Gauge({
  name: `${PREFIX}process_memory_usage_bytes`,
  help: 'Process memory usage in bytes (rss = resident set size)',
  labelNames: ['type'] as const,
  registers: [baseRegistry],
});

export const processUptimeSeconds = new client.Gauge({
  name: `${PREFIX}process_uptime_seconds`,
  help: 'Process uptime in seconds',
  registers: [baseRegistry],
});

// ── Cache metrics ───────────────────────────────────────────────

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

export const cacheSize = new client.Gauge({
  name: `${PREFIX}cache_size`,
  help: 'Current cache size (entries)',
  labelNames: ['cache_name'] as const,
  registers: [baseRegistry],
});

// ── Business metrics (previously unregistered — silently dropped) ─

export const underwritingDecisionsTotal = new client.Counter({
  name: `${PREFIX}underwriting_decisions_total`,
  help: 'Total underwriting decisions by outcome',
  labelNames: ['decision'] as const,
  registers: [baseRegistry],
});

export const counterpartyChecksTotal = new client.Counter({
  name: `${PREFIX}counterparty_checks_total`,
  help: 'Total counterparty checks by outcome',
  labelNames: ['decision'] as const,
  registers: [baseRegistry],
});

export const idempotencyConflictsTotal = new client.Counter({
  name: `${PREFIX}idempotency_conflicts_total`,
  help: 'Total Idempotency-Key conflicts (same key, different body)',
  registers: [baseRegistry],
});

export const verifyChecksTotal = new client.Counter({
  name: `${PREFIX}verify_checks_total`,
  help: 'Total /verify checks by flag and result',
  labelNames: ['flag', 'result'] as const,
  registers: [baseRegistry],
});

export const discoverySearchesTotal = new client.Counter({
  name: `${PREFIX}discovery_searches_total`,
  help: 'Total /discovery/search calls',
  labelNames: ['query_class', 'result_count'] as const,
  registers: [baseRegistry],
});

// ── Helpers ─────────────────────────────────────────────────────

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

export type ContractEventType = 'endorsement' | 'revocation' | 'dispute' | 'success';

export function recordContractEvent(event: ContractEventType): void {
  switch (event) {
    case 'endorsement': contractEndorsementsTotal.inc(); break;
    case 'revocation': contractRevocationsTotal.inc(); break;
    case 'dispute': contractDisputesTotal.inc(); break;
    case 'success': contractSuccessEventsTotal.inc(); break;
    default: {
      const _exhaustive: never = event;
      throw new Error(`Unhandled contract event: ${String(_exhaustive)}`);
    }
  }
}

export function recordUnderwritingDecision(decision: 'approved' | 'denied'): void {
  underwritingDecisionsTotal.inc({ decision });
}

export function recordCounterpartyCheck(decision: 'allow' | 'deny'): void {
  counterpartyChecksTotal.inc({ decision });
}

export function recordIdempotencyConflict(): void {
  idempotencyConflictsTotal.inc();
}

export function recordVerifyCheck(flags: Record<string, boolean>): void {
  for (const [flag, value] of Object.entries(flags)) {
    verifyChecksTotal.inc({ flag, result: value ? 'true' : 'false' });
  }
}

export function recordDiscoverySearch(query: string, resultCount: number): void {
  discoverySearchesTotal.inc({
    query_class: query.length > 0 ? 'non_empty' : 'empty',
    result_count: String(resultCount),
  });
}

export function recordX402SettlementFailure(reason: string): void {
  x402SettlementFailuresTotal.inc({ reason });
}

// ── Middleware ──────────────────────────────────────────────────

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startNs = process.hrtime.bigint();
  res.on('finish', () => {
    const path = normalizePath(req.route?.path ?? req.path);
    const labels = {
      method: req.method,
      path,
      status_class: statusClass(res.statusCode),
    };
    const durationSec = Number(process.hrtime.bigint() - startNs) / 1e9;
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSec);
    if (res.statusCode >= 400) {
      httpRequestErrorsTotal.inc({
        ...labels,
        error_type: res.statusCode >= 500 ? 'server_error' : 'client_error',
      });
    }
  });
  next();
}

export function metricsEndpoint(_req: Request, res: Response): void {
  res.setHeader('Content-Type', registry.contentType);
  registry.metrics().then((body) => res.send(body)).catch(() => {
    res.status(500).send('# error rendering metrics');
  });
}

// ponytail: collapse status codes into classes — raw status exploded
// cardinality into ~millions of series across paths × methods × codes.
function statusClass(code: number): string {
  if (code < 200) return '1xx';
  if (code < 300) return '2xx';
  if (code < 400) return '3xx';
  if (code < 500) return '4xx';
  return '5xx';
}

function normalizePath(p: string): string {
  if (!p) return 'unmatched';
  if (p === '/') return '/';
  // Cap length and collapse anything not matching a registered route to
  // 'unmatched' so a random /?wallet=... doesn't create a new series.
  if (p.length > 64) return p.slice(0, 64);
  return p;
}