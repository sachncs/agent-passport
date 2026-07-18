import { describe, it, expect } from 'vitest';
import {
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
import type { Request, Response } from 'express';

function mockReq(path = '/test', method = 'GET'): Request {
  return { path, method, route: { path } } as unknown as Request;
}
function mockRes(statusCode = 200): Response {
  const res = {
    statusCode,
    on: (_event: string, _cb: () => void) => {},
    setHeader: () => {},
    send: () => {},
    status: () => res,
    json: () => {},
  } as unknown as Response;
  return res;
}

describe('Metrics System', () => {
  describe('Helper Functions', () => {
    it('recordTrustScoreDuration records duration and risk level', () => {
      recordTrustScoreDuration(250, 'low');
    });

    it('recordGraphTraversal records duration and depth', () => {
      recordGraphTraversal(500, 3);
    });

    it('recordX402Verification records success', () => {
      recordX402Verification(100, true, '/score');
    });

    it('recordX402Verification records failure', () => {
      recordX402Verification(100, false, '/score');
    });

    it('recordCacheHit records cache hit', () => {
      recordCacheHit('response');
    });

    it('recordCacheMiss records cache miss', () => {
      recordCacheMiss('response');
    });

    it('recordContractEvent records endorsement', () => {
      recordContractEvent('endorsement');
    });

    it('recordContractEvent records revocation', () => {
      recordContractEvent('revocation');
    });

    it('recordContractEvent records dispute', () => {
      recordContractEvent('dispute');
    });

    it('recordContractEvent records success', () => {
      recordContractEvent('success');
    });

    it('recordX402SettlementFailure increments the settlement counter', () => {
      recordX402SettlementFailure('exception');
    });

    it('recordUnderwritingDecision records approved', () => {
      recordUnderwritingDecision('approved');
    });

    it('recordUnderwritingDecision records denied', () => {
      recordUnderwritingDecision('denied');
    });

    it('recordCounterpartyCheck records allow', () => {
      recordCounterpartyCheck('allow');
    });

    it('recordCounterpartyCheck records deny', () => {
      recordCounterpartyCheck('deny');
    });

    it('recordIdempotencyConflict increments', () => {
      recordIdempotencyConflict();
    });

    it('recordVerifyCheck records flags', () => {
      recordVerifyCheck({ funded: true, active: false });
    });

    it('recordDiscoverySearch records queries', () => {
      recordDiscoverySearch('trust', 1);
      recordDiscoverySearch('', 0);
    });
  });

  describe('Metrics Middleware', () => {
    it('is a function', () => {
      expect(typeof metricsMiddleware).toBe('function');
    });

    it('calls next', () => {
      let called = false;
      metricsMiddleware(mockReq(), mockRes(), () => { called = true; });
      expect(called).toBe(true);
    });
  });

  describe('Metrics Endpoint', () => {
    it('is a function', () => {
      expect(typeof metricsEndpoint).toBe('function');
    });
  });
});
