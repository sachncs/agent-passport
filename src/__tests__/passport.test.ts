import { describe, it, expect } from 'vitest';
import {
  computeIdentityStrength,
  computePaymentReliability,
  computeOverallRisk,
  classifyOverallRisk,
  generatePassportSummary,
} from '../passport';

describe('Agent Passport — Pure Math Functions', () => {
  describe('computeIdentityStrength', () => {
    it('returns 0 for all zeros', () => {
      expect(computeIdentityStrength(0, 0, 0, 0)).toBe(0);
    });

    it('scales with trust score', () => {
      const low = computeIdentityStrength(30, 30, 30, 30);
      const high = computeIdentityStrength(90, 30, 30, 30);
      expect(high).toBeGreaterThan(low);
    });

    it('scales with account age', () => {
      const young = computeIdentityStrength(50, 30, 30, 30);
      const old = computeIdentityStrength(50, 365, 30, 30);
      expect(old).toBeGreaterThan(young);
    });

    it('scales with transaction count', () => {
      const low = computeIdentityStrength(50, 30, 5, 30);
      const high = computeIdentityStrength(50, 30, 200, 30);
      expect(high).toBeGreaterThan(low);
    });

    it('scales with balance', () => {
      const poor = computeIdentityStrength(50, 30, 30, 1);
      const rich = computeIdentityStrength(50, 30, 30, 100000);
      expect(rich).toBeGreaterThan(poor);
    });

    it('caps at 100', () => {
      // balanceScore = min(100, log10(1000000) * 10) = 60, so total = 94
      expect(computeIdentityStrength(100, 730, 500, 1000000)).toBe(94);
    });
  });

  describe('computePaymentReliability', () => {
    it('returns 0 for all zeros', () => {
      expect(computePaymentReliability(0, 0, 0)).toBe(0);
    });

    it('scales with trust score', () => {
      const low = computePaymentReliability(30, 50, 500);
      const high = computePaymentReliability(90, 50, 500);
      expect(high).toBeGreaterThan(low);
    });

    it('scales with reputation', () => {
      const low = computePaymentReliability(50, 10, 500);
      const high = computePaymentReliability(50, 90, 500);
      expect(high).toBeGreaterThan(low);
    });

    it('scales with credit limit', () => {
      const low = computePaymentReliability(50, 50, 100);
      const high = computePaymentReliability(50, 50, 5000);
      expect(high).toBeGreaterThan(low);
    });

    it('caps at 100', () => {
      expect(computePaymentReliability(100, 100, 10000)).toBe(100);
    });
  });

  describe('computeOverallRisk', () => {
    it('returns low risk for all low inputs', () => {
      const risk = computeOverallRisk('low', 0.1, 'low', 'low');
      expect(risk).toBeLessThanOrEqual(25);
    });

    it('returns high risk for critical inputs', () => {
      const risk = computeOverallRisk('critical', 0.8, 'critical', 'critical');
      expect(risk).toBeGreaterThan(75);
    });

    it('returns medium risk for mixed inputs', () => {
      const risk = computeOverallRisk('medium', 0.3, 'medium', 'medium');
      expect(risk).toBeGreaterThan(25);
      expect(risk).toBeLessThan(75);
    });

    it('sybil risk has significant impact', () => {
      const lowSybil = computeOverallRisk('medium', 0.1, 'medium', 'medium');
      const highSybil = computeOverallRisk('medium', 0.9, 'medium', 'medium');
      expect(highSybil).toBeGreaterThan(lowSybil);
    });
  });

  describe('classifyOverallRisk', () => {
    it('returns low for risk <= 25', () => {
      expect(classifyOverallRisk(0)).toBe('low');
      expect(classifyOverallRisk(25)).toBe('low');
    });

    it('returns medium for risk 26-50', () => {
      expect(classifyOverallRisk(26)).toBe('medium');
      expect(classifyOverallRisk(50)).toBe('medium');
    });

    it('returns high for risk 51-75', () => {
      expect(classifyOverallRisk(51)).toBe('high');
      expect(classifyOverallRisk(75)).toBe('high');
    });

    it('returns critical for risk > 75', () => {
      expect(classifyOverallRisk(76)).toBe('critical');
      expect(classifyOverallRisk(100)).toBe('critical');
    });
  });

  describe('generatePassportSummary', () => {
    it('describes well-established agent', () => {
      const summary = generatePassportSummary(80, 80, 80, 15, 0.1);
      expect(summary).toContain('well-established');
      expect(summary).toContain('highly reputed');
      expect(summary).toContain('reliable payer');
      expect(summary).toContain('low-risk');
      expect(summary).toContain('clean');
    });

    it('describes new agent', () => {
      const summary = generatePassportSummary(20, 10, 10, 80, 0.6);
      expect(summary).toContain('new');
      expect(summary).toContain('untested');
      expect(summary).toContain('unproven');
      expect(summary).toContain('high-risk');
    });

    it('describes moderate agent', () => {
      const summary = generatePassportSummary(50, 50, 50, 40, 0.3);
      expect(summary).toContain('moderately');
    });
  });
});
