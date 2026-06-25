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
} from '../lib/metrics';

describe('Metrics System', () => {
  describe('Counter Metrics', () => {
    it('records HTTP request counts', () => {
      httpRequestsTotal.inc({ method: 'GET', path: '/score', status: '200' });
      httpRequestsTotal.inc({ method: 'GET', path: '/score', status: '200' });
      httpRequestsTotal.inc({ method: 'POST', path: '/counterparty-check', status: '200' });

      const output = registry.serialize();
      expect(output).toContain('agent_passport_http_requests_total');
    });

    it('records trust score generations', () => {
      trustScoreGenerationCount.inc({ risk_level: 'low' });
      trustScoreGenerationCount.inc({ risk_level: 'medium' });

      const output = registry.serialize();
      expect(output).toContain('agent_passport_trust_score_generations_total');
    });

    it('records x402 payments verified', () => {
      x402PaymentsVerifiedTotal.inc({ status: 'success', path: '/score' });

      const output = registry.serialize();
      expect(output).toContain('agent_passport_x402_payments_verified_total');
    });

    it('records x402 payment failures', () => {
      x402PaymentFailuresTotal.inc({ reason: 'verification_failed', path: '/score' });

      const output = registry.serialize();
      expect(output).toContain('agent_passport_x402_payment_failures_total');
    });

    it('records x402 replay attempts', () => {
      x402ReplayAttemptsTotal.inc({ path: '/score' });

      const output = registry.serialize();
      expect(output).toContain('agent_passport_x402_replay_attempts_total');
    });

    it('records contract endorsements', () => {
      contractEndorsementsTotal.inc();

      const output = registry.serialize();
      expect(output).toContain('agent_passport_contract_endorsements_total');
    });

    it('records contract revocations', () => {
      contractRevocationsTotal.inc();

      const output = registry.serialize();
      expect(output).toContain('agent_passport_contract_revocations_total');
    });

    it('records contract disputes', () => {
      contractDisputesTotal.inc();

      const output = registry.serialize();
      expect(output).toContain('agent_passport_contract_disputes_total');
    });

    it('records cache hits', () => {
      cacheHitsTotal.inc({ cache_name: 'response' });

      const output = registry.serialize();
      expect(output).toContain('agent_passport_cache_hits_total');
    });

    it('records cache misses', () => {
      cacheMissesTotal.inc({ cache_name: 'response' });

      const output = registry.serialize();
      expect(output).toContain('agent_passport_cache_misses_total');
    });
  });

  describe('Histogram Metrics', () => {
    it('records HTTP request durations', () => {
      httpRequestDurationSeconds.observe({ method: 'GET', path: '/score', status: '200' }, 0.5);

      const output = registry.serialize();
      expect(output).toContain('agent_passport_http_request_duration_seconds');
    });

    it('records trust score durations', () => {
      trustScoreDurationSeconds.observe({}, 0.25);

      const output = registry.serialize();
      expect(output).toContain('agent_passport_trust_score_duration_seconds');
    });

    it('records graph traversal durations', () => {
      graphTraversalDurationSeconds.observe({}, 1.5);

      const output = registry.serialize();
      expect(output).toContain('agent_passport_graph_traversal_duration_seconds');
    });
  });

  describe('Gauge Metrics', () => {
    it('records process memory usage', () => {
      processMemoryUsageBytes.set({ type: 'heapUsed' }, 50_000_000);

      const output = registry.serialize();
      expect(output).toContain('agent_passport_process_memory_usage_bytes');
    });

    it('records process uptime', () => {
      processUptimeSeconds.set({}, 3600);

      const output = registry.serialize();
      expect(output).toContain('agent_passport_process_uptime_seconds');
    });
  });

  describe('Helper Functions', () => {
    it('recordTrustScoreDuration records duration and risk level', () => {
      recordTrustScoreDuration(250, 'low');

      const output = registry.serialize();
      expect(output).toContain('agent_passport_trust_score_duration_seconds');
      expect(output).toContain('agent_passport_trust_score_generations_total');
    });

    it('recordGraphTraversal records duration and depth', () => {
      recordGraphTraversal(500, 3);

      const output = registry.serialize();
      expect(output).toContain('agent_passport_graph_traversal_duration_seconds');
    });

    it('recordX402Verification records success', () => {
      recordX402Verification(100, true, '/score');

      const output = registry.serialize();
      expect(output).toContain('agent_passport_x402_verification_duration_seconds');
      expect(output).toContain('agent_passport_x402_payments_verified_total');
    });

    it('recordX402Verification records failure', () => {
      recordX402Verification(100, false, '/score');

      const output = registry.serialize();
      expect(output).toContain('agent_passport_x402_payment_failures_total');
    });

    it('recordCacheHit records cache hit', () => {
      recordCacheHit('response');

      const output = registry.serialize();
      expect(output).toContain('agent_passport_cache_hits_total');
    });

    it('recordCacheMiss records cache miss', () => {
      recordCacheMiss('response');

      const output = registry.serialize();
      expect(output).toContain('agent_passport_cache_misses_total');
    });

    it('recordContractEvent records endorsement', () => {
      recordContractEvent('endorsement');

      const output = registry.serialize();
      expect(output).toContain('agent_passport_contract_endorsements_total');
    });

    it('recordContractEvent records revocation', () => {
      recordContractEvent('revocation');

      const output = registry.serialize();
      expect(output).toContain('agent_passport_contract_revocations_total');
    });

    it('recordContractEvent records dispute', () => {
      recordContractEvent('dispute');

      const output = registry.serialize();
      expect(output).toContain('agent_passport_contract_disputes_total');
    });

    it('recordContractEvent records success', () => {
      recordContractEvent('success');

      const output = registry.serialize();
      expect(output).toContain('agent_passport_contract_success_events_total');
    });
  });

  describe('Registry Serialization', () => {
    it('serializes to Prometheus text format', () => {
      const output = registry.serialize();
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    it('includes HELP and TYPE headers', () => {
      httpRequestsTotal.inc({ method: 'GET', path: '/test', status: '200' });
      const output = registry.serialize();
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
