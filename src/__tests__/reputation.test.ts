import { describe, it, expect } from 'vitest';
import {
  computeReputationScore,
  classifyReputationRisk,
  computeReputationConfidence,
  generateReputationExplanation,
} from '../reputation';
import type { ReputationBreakdown } from '../reputation';

function emptyBreakdown(): ReputationBreakdown {
  return {
    successfulPayments: 0,
    successfulPurchases: 0,
    disputes: 0,
    refunds: 0,
    sponsorEndorsements: 0,
    serviceInteractions: 0,
    totalEvents: 0,
    positiveEvents: 0,
    negativeEvents: 0,
  };
}

function makeBreakdown(overrides: Partial<ReputationBreakdown>): ReputationBreakdown {
  const b = emptyBreakdown();
  Object.assign(b, overrides);
  b.totalEvents = b.successfulPayments + b.successfulPurchases + b.disputes +
    b.refunds + b.sponsorEndorsements + b.serviceInteractions;
  b.positiveEvents = b.successfulPayments + b.successfulPurchases +
    b.sponsorEndorsements + b.serviceInteractions;
  b.negativeEvents = b.disputes + b.refunds;
  return b;
}

describe('Reputation Layer — Pure Math Functions', () => {
  describe('computeReputationScore', () => {
    it('returns 0 for empty breakdown', () => {
      expect(computeReputationScore(emptyBreakdown())).toBe(0);
    });

    it('returns 100 for all positive events', () => {
      const b = makeBreakdown({ successfulPayments: 10 });
      expect(computeReputationScore(b)).toBe(100);
    });

    it('returns 0 for all negative events', () => {
      const b = makeBreakdown({ disputes: 5 });
      expect(computeReputationScore(b)).toBe(0);
    });

    it('weights payments at 10x', () => {
      const b = makeBreakdown({ successfulPayments: 1, disputes: 1 });
      // positive = 10, negative = 20 → 10/30 = 33.3
      expect(computeReputationScore(b)).toBe(33.3);
    });

    it('weights purchases at 8x', () => {
      const b = makeBreakdown({ successfulPurchases: 1, disputes: 1 });
      // positive = 8, negative = 20 → 8/28 = 28.6
      expect(computeReputationScore(b)).toBe(28.6);
    });

    it('weights endorsements at 15x', () => {
      const b = makeBreakdown({ sponsorEndorsements: 1, disputes: 1 });
      // positive = 15, negative = 20 → 15/35 = 42.9
      expect(computeReputationScore(b)).toBe(42.9);
    });

    it('weights service at 5x', () => {
      const b = makeBreakdown({ serviceInteractions: 1, disputes: 1 });
      // positive = 5, negative = 20 → 5/25 = 20
      expect(computeReputationScore(b)).toBe(20);
    });

    it('weights refunds at 12x', () => {
      const b = makeBreakdown({ successfulPayments: 1, refunds: 1 });
      // positive = 10, negative = 12 → 10/22 = 45.5
      expect(computeReputationScore(b)).toBe(45.5);
    });

    it('caps at 100', () => {
      const b = makeBreakdown({ successfulPayments: 1000 });
      expect(computeReputationScore(b)).toBe(100);
    });

    it('handles mixed positive and negative', () => {
      const b = makeBreakdown({
        successfulPayments: 5,
        successfulPurchases: 3,
        disputes: 1,
        refunds: 1,
      });
      // positive = 5*10 + 3*8 = 74, negative = 20 + 12 = 32
      // 74/106 = 69.8
      expect(computeReputationScore(b)).toBe(69.8);
    });
  });

  describe('classifyReputationRisk', () => {
    it('returns low for score >= 70', () => {
      expect(classifyReputationRisk(70)).toBe('low');
      expect(classifyReputationRisk(100)).toBe('low');
    });

    it('returns medium for score 45-69', () => {
      expect(classifyReputationRisk(45)).toBe('medium');
      expect(classifyReputationRisk(60)).toBe('medium');
    });

    it('returns high for score 20-44', () => {
      expect(classifyReputationRisk(20)).toBe('high');
      expect(classifyReputationRisk(35)).toBe('high');
    });

    it('returns critical for score < 20', () => {
      expect(classifyReputationRisk(0)).toBe('critical');
      expect(classifyReputationRisk(19)).toBe('critical');
    });
  });

  describe('computeReputationConfidence', () => {
    it('returns 0.40 for 0 events and no recent activity', () => {
      expect(computeReputationConfidence(0, false)).toBe(0.40);
    });

    it('increases with more events', () => {
      expect(computeReputationConfidence(5, false)).toBe(0.51);
      expect(computeReputationConfidence(10, false)).toBe(0.62);
      expect(computeReputationConfidence(20, false)).toBe(0.73);
    });

    it('increases with recent activity', () => {
      expect(computeReputationConfidence(0, true)).toBe(0.51);
    });

    it('caps at 0.95', () => {
      expect(computeReputationConfidence(20, true)).toBe(0.84);
      expect(computeReputationConfidence(100, true)).toBe(0.95);
    });

    it('never goes below 0.40', () => {
      expect(computeReputationConfidence(-5, false)).toBe(0.40);
    });
  });

  describe('generateReputationExplanation', () => {
    it('reports no events for empty breakdown', () => {
      const reasons = generateReputationExplanation(emptyBreakdown(), 0);
      expect(reasons.some(r => r.includes('No reputation events'))).toBe(true);
    });

    it('reports total event count', () => {
      const b = makeBreakdown({ successfulPayments: 3, disputes: 1 });
      const reasons = generateReputationExplanation(b, 50);
      expect(reasons.some(r => r.includes('4 total events'))).toBe(true);
    });

    it('reports successful payments', () => {
      const b = makeBreakdown({ successfulPayments: 5 });
      const reasons = generateReputationExplanation(b, 100);
      expect(reasons.some(r => r.includes('5 successful payments'))).toBe(true);
    });

    it('reports disputes', () => {
      const b = makeBreakdown({ disputes: 2 });
      const reasons = generateReputationExplanation(b, 0);
      expect(reasons.some(r => r.includes('2 disputes'))).toBe(true);
    });

    it('reports refunds', () => {
      const b = makeBreakdown({ refunds: 1 });
      const reasons = generateReputationExplanation(b, 0);
      expect(reasons.some(r => r.includes('1 refund'))).toBe(true);
    });

    it('reports endorsements', () => {
      const b = makeBreakdown({ sponsorEndorsements: 3 });
      const reasons = generateReputationExplanation(b, 100);
      expect(reasons.some(r => r.includes('3 sponsor endorsements'))).toBe(true);
    });

    it('reports strong reputation', () => {
      const b = makeBreakdown({ successfulPayments: 10 });
      const reasons = generateReputationExplanation(b, 100);
      expect(reasons.some(r => r.includes('Strong reputation'))).toBe(true);
    });

    it('reports poor reputation', () => {
      const b = makeBreakdown({ disputes: 10 });
      const reasons = generateReputationExplanation(b, 0);
      expect(reasons.some(r => r.includes('Poor reputation'))).toBe(true);
    });
  });
});
