import { describe, it, expect } from 'vitest';
import {
  registry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  trustScoreGenerationCount,
  trustScoreDurationSeconds,
  graphTraversalDurationSeconds,
  x402PaymentsVerifiedTotal,
  x402PaymentFailuresTotal,
  x402SettlementFailuresTotal,
  x402ReplayAttemptsTotal,
  contractEndorsementsTotal,
  contractRevocationsTotal,
  contractDisputesTotal,
  processMemoryUsageBytes,
  processUptimeSeconds,
  cacheHitsTotal,
  cacheMissesTotal,
  metricsMiddleware,
  metricsEndpoint,
  recordTrustScoreDuration,
  recordGraphTraversal,
  recordX402Verification,
  recordCacheHit,
  recordCacheMiss,
  recordContractEvent,
  recordUnderwritingDecision,
  recordCounterpartyCheck,
  recordIdempotencyConflict,
  recordVerifyCheck,
  recordDiscoverySearch,
  recordX402SettlementFailure,
} from '../lib/metrics';

async function render(): Promise<string> {
  return registry.metrics();
}

describe('Metrics System', () => {
  describe('Counter Metrics', () => {
    it('records HTTP request counts', async () => {
      httpRequestsTotal.inc({
        method: 'GET',
         path: '/score',
         status_class: '2xx'
      });
      httpRequestsTotal.inc({
        method: 'GET',
         path: '/score',
         status_class: '2xx'
      });
      httpRequestsTotal.inc({
        method: 'POST',
         path: '/counterparty-check',
         status_class: '2xx'
      });

      const output = await render();
      expect(output).toContain('agent_passport_http_requests_total');
    });

    it('records trust score generations', async () => {
      trustScoreGenerationCount.inc({ risk_level: 'low' });
      trustScoreGenerationCount.inc({ risk_level: 'medium' });

      const output = await render();
      expect(output).toContain('agent_passport_trust_score_generations_total');
    });

    it('records x402 payments verified', async () => {
      x402PaymentsVerifiedTotal.inc({ status: 'success', path: '/score' });

      const output = await render();
      expect(output).toContain('agent_passport_x402_payments_verified_total');
    });

    it('records x402 payment failures', async () => {
      x402PaymentFailuresTotal.inc({
        reason: 'verification_failed',
         path: '/score'
      });

      const output = await render();
      expect(output).toContain('agent_passport_x402_payment_failures_total');
    });

    it('records x402 settlement failures', async () => {
      x402SettlementFailuresTotal.inc({ reason: 'invalid' });

      const output = await render();
      expect(output).toContain('agent_passport_x402_settlement_failures_total');
    });

    it('records x402 replay attempts', async () => {
      x402ReplayAttemptsTotal.inc({ path: '/score' });

      const output = await render();
      expect(output).toContain('agent_passport_x402_replay_attempts_total');
    });

    it('records contract endorsements', async () => {
      contractEndorsementsTotal.inc();

      const output = await render();
      expect(output).toContain('agent_passport_contract_endorsements_total');
    });

    it('records contract revocations', async () => {
      contractRevocationsTotal.inc();

      const output = await render();
      expect(output).toContain('agent_passport_contract_revocations_total');
    });

    it('records contract disputes', async () => {
      contractDisputesTotal.inc();

      const output = await render();
      expect(output).toContain('agent_passport_contract_disputes_total');
    });

    it('records cache hits', async () => {
      cacheHitsTotal.inc({ cache_name: 'response' });

      const output = await render();
      expect(output).toContain('agent_passport_cache_hits_total');
    });

    it('records cache misses', async () => {
      cacheMissesTotal.inc({ cache_name: 'response' });

      const output = await render();
      expect(output).toContain('agent_passport_cache_misses_total');
    });

    it('records underwriting decisions via the helper', async () => {
      recordUnderwritingDecision('approved');
      recordUnderwritingDecision('denied');

      const output = await render();
      expect(output).toContain('agent_passport_underwriting_decisions_total');
    });

    it('records counterparty checks via the helper', async () => {
      recordCounterpartyCheck('allow');
      recordCounterpartyCheck('deny');

      const output = await render();
      expect(output).toContain('agent_passport_counterparty_checks_total');
    });

    it('records idempotency conflicts via the helper', async () => {
      recordIdempotencyConflict();
      recordIdempotencyConflict();

      const output = await render();
      expect(output).toContain('agent_passport_idempotency_conflicts_total');
    });

    it('records verify-check flags via the helper', async () => {
      recordVerifyCheck({ funded: true, active: false });

      const output = await render();
      expect(output).toContain('agent_passport_verify_checks_total');
    });

    it('records discovery searches via the helper', async () => {
      recordDiscoverySearch('trust', 1);
      recordDiscoverySearch('', 1);

      const output = await render();
      expect(output).toContain('agent_passport_discovery_searches_total');
    });
  });

  describe('Histogram Metrics', () => {
    it('records HTTP request durations', async () => {
      httpRequestDurationSeconds.observe({
        method: 'GET',
         path: '/score',
         status_class: '2xx'
      }, 0.5);

      const output = await render();
      expect(output).toContain('agent_passport_http_request_duration_seconds');
    });

    it('records trust score durations', async () => {
      trustScoreDurationSeconds.observe({}, 0.25);

      const output = await render();
      expect(output).toContain('agent_passport_trust_score_duration_seconds');
    });

    it('records graph traversal durations', async () => {
      graphTraversalDurationSeconds.observe({}, 1.5);

      const output = await render();
      expect(output).toContain('agent_passport_graph_traversal_duration_seconds');
    });
  });

  describe('Gauge Metrics', () => {
    it('records process memory usage', async () => {
      processMemoryUsageBytes.set({ type: 'rss' }, 50_000_000);

      const output = await render();
      expect(output).toContain('agent_passport_process_memory_usage_bytes');
    });

    it('records process uptime', async () => {
      processUptimeSeconds.set({}, 3600);

      const output = await render();
      expect(output).toContain('agent_passport_process_uptime_seconds');
    });
  });

  describe('Helper Functions', () => {
    it('recordTrustScoreDuration records duration and risk level', async () => {
      recordTrustScoreDuration(250, 'low');

      const output = await render();
      expect(output).toContain('agent_passport_trust_score_duration_seconds');
      expect(output).toContain('agent_passport_trust_score_generations_total');
    });

    it('recordGraphTraversal records duration and depth', async () => {
      recordGraphTraversal(500, 3);

      const output = await render();
      expect(output).toContain('agent_passport_graph_traversal_duration_seconds');
    });

    it('recordX402Verification records success', async () => {
      recordX402Verification(100, true, '/score');

      const output = await render();
      expect(output).toContain('agent_passport_x402_verification_duration_seconds');
      expect(output).toContain('agent_passport_x402_payments_verified_total');
    });

    it('recordX402Verification records failure', async () => {
      recordX402Verification(100, false, '/score');

      const output = await render();
      expect(output).toContain('agent_passport_x402_payment_failures_total');
    });

    it('recordCacheHit records cache hit', async () => {
      recordCacheHit('response');

      const output = await render();
      expect(output).toContain('agent_passport_cache_hits_total');
    });

    it('recordCacheMiss records cache miss', async () => {
      recordCacheMiss('response');

      const output = await render();
      expect(output).toContain('agent_passport_cache_misses_total');
    });

    it('recordContractEvent records endorsement', async () => {
      recordContractEvent('endorsement');

      const output = await render();
      expect(output).toContain('agent_passport_contract_endorsements_total');
    });

    it('recordContractEvent records revocation', async () => {
      recordContractEvent('revocation');

      const output = await render();
      expect(output).toContain('agent_passport_contract_revocations_total');
    });

    it('recordContractEvent records dispute', async () => {
      recordContractEvent('dispute');

      const output = await render();
      expect(output).toContain('agent_passport_contract_disputes_total');
    });

    it('recordContractEvent records success', async () => {
      recordContractEvent('success');

      const output = await render();
      expect(output).toContain('agent_passport_contract_success_events_total');
    });

    it('recordX402SettlementFailure increments the settlement counter', async () => {
      recordX402SettlementFailure('exception');

      const output = await render();
      expect(output).toContain('agent_passport_x402_settlement_failures_total');
    });
  });

  describe('Registry Serialization', () => {
    it('serializes to Prometheus text format', async () => {
      const output = await render();
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    it('includes HELP and TYPE headers', async () => {
      httpRequestsTotal.inc({
        method: 'GET',
         path: '/test',
         status_class: '2xx'
      });
      const output = await render();
      expect(output).toContain('# HELP');
      expect(output).toContain('# TYPE');
    });
  });

  describe('Metrics Middleware', () => {
    it('is a function', () => {
      expect(typeof metricsMiddleware).toBe('function');
    });
  });

  describe('Metrics Endpoint', () => {
    it('is a function', () => {
      expect(typeof metricsEndpoint).toBe('function');
    });
  });
});