import { describe, it, expect } from 'vitest';
import {
  computeCompositeScore,
  classifyUnderwritingRisk,
  computeUnderwritingLimit,
  decideApproval,
  computeUnderwritingConfidence,
  generateUnderwritingExplanation,
} from '../underwriting';
import type { UnderwritingFactor } from '../underwriting';

function makeFactor(overrides: Partial<UnderwritingFactor>): UnderwritingFactor {
  return {
    name: 'Test',
    score: 50,
    weight: 0.25,
    contribution: 12.5,
    status: 'neutral',
    ...overrides,
  };
}

describe('Underwriting Decision Engine — Pure Math Functions', () => {
  describe('computeCompositeScore', () => {
    it('returns 0 for empty factors', () => {
      expect(computeCompositeScore([])).toBe(0);
    });

    it('computes weighted average', () => {
      const factors = [
        makeFactor({ score: 80, weight: 0.5 }),
        makeFactor({ score: 40, weight: 0.5 }),
      ];
      expect(computeCompositeScore(factors)).toBe(60);
    });

    it('handles unequal weights', () => {
      const factors = [
        makeFactor({ score: 100, weight: 0.75 }),
        makeFactor({ score: 0, weight: 0.25 }),
      ];
      expect(computeCompositeScore(factors)).toBe(75);
    });

    it('caps at 100', () => {
      const factors = [makeFactor({ score: 200, weight: 1.0 })];
      expect(computeCompositeScore(factors)).toBe(100);
    });

    it('floors at 0', () => {
      const factors = [makeFactor({ score: -50, weight: 1.0 })];
      expect(computeCompositeScore(factors)).toBe(0);
    });
  });

  describe('classifyUnderwritingRisk', () => {
    it('returns low for score >= 70', () => {
      expect(classifyUnderwritingRisk(70)).toBe('low');
      expect(classifyUnderwritingRisk(100)).toBe('low');
    });

    it('returns medium for score 45-69', () => {
      expect(classifyUnderwritingRisk(45)).toBe('medium');
      expect(classifyUnderwritingRisk(60)).toBe('medium');
    });

    it('returns high for score 20-44', () => {
      expect(classifyUnderwritingRisk(20)).toBe('high');
      expect(classifyUnderwritingRisk(35)).toBe('high');
    });

    it('returns critical for score < 20', () => {
      expect(classifyUnderwritingRisk(0)).toBe('critical');
      expect(classifyUnderwritingRisk(19)).toBe('critical');
    });
  });

  describe('computeUnderwritingLimit', () => {
    it('returns 0 for zero credit limit', () => {
      expect(computeUnderwritingLimit(50, 0, 0, 50)).toBe(0);
    });

    it('applies score multiplier', () => {
      const result = computeUnderwritingLimit(50, 1000, 0, 0);
      // 1000 * (0.5 + 0.5) = 1000
      expect(result).toBe(1000);
    });

    it('applies sybil penalty', () => {
      const result = computeUnderwritingLimit(50, 1000, 0.5, 0);
      // 1000 * 1.0 * (1 - 0.35) = 650
      expect(result).toBe(650);
    });

    it('applies reputation bonus', () => {
      const result = computeUnderwritingLimit(50, 1000, 0, 100);
      // 1000 * 1.0 * 1.0 * 1.3 = 1300
      expect(result).toBe(1300);
    });

    it('caps at 10000', () => {
      const result = computeUnderwritingLimit(100, 10000, 0, 100);
      expect(result).toBe(10000);
    });

    it('floors at 0', () => {
      const result = computeUnderwritingLimit(0, 100, 1.0, 0);
      // scoreMultiplier = 0.5 + 0 = 0.5, limit = 100 * 0.5 = 50
      // sybilMultiplier = 1.0 - 0.7 = 0.3, limit = 50 * 0.3 = 15
      expect(result).toBe(15);
    });
  });

  describe('decideApproval', () => {
    it('denies if sybil risk is critical', () => {
      expect(decideApproval(80, 0.80, 50)).toBe(false);
    });

    it('denies if composite score is too low', () => {
      expect(decideApproval(25, 0.10, 50)).toBe(false);
    });

    it('denies if reputation is critical with low score', () => {
      expect(decideApproval(40, 0.10, 5)).toBe(false);
    });

    it('approves for good profile', () => {
      expect(decideApproval(70, 0.10, 50)).toBe(true);
    });

    it('approves for moderate profile', () => {
      expect(decideApproval(50, 0.20, 30)).toBe(true);
    });
  });

  describe('computeUnderwritingConfidence', () => {
    it('returns 0.40 for empty factors', () => {
      expect(computeUnderwritingConfidence([])).toBe(0.40);
    });

    it('increases with more factors having data', () => {
      const factors = [
        makeFactor({ score: 50 }),
        makeFactor({ score: 50 }),
        makeFactor({ score: 0 }),
      ];
      const result = computeUnderwritingConfidence(factors);
      expect(result).toBeGreaterThan(0.40);
      expect(result).toBeLessThan(0.95);
    });

    it('caps at 0.95', () => {
      const factors = Array(10).fill(null).map(() => makeFactor({ score: 80 }));
      expect(computeUnderwritingConfidence(factors)).toBe(0.95);
    });
  });

  describe('generateUnderwritingExplanation', () => {
    it('reports approval', () => {
      const factors = [makeFactor({ score: 80 })];
      const reasons = generateUnderwritingExplanation(factors, true, 75, 500);
      expect(reasons.some(r => r.includes('Approved'))).toBe(true);
    });

    it('reports denial', () => {
      const factors = [makeFactor({ score: 20 })];
      const reasons = generateUnderwritingExplanation(factors, false, 20, 0);
      expect(reasons.some(r => r.includes('Denied'))).toBe(true);
    });

    it('reports recommended limit', () => {
      const factors = [makeFactor({ score: 80 })];
      const reasons = generateUnderwritingExplanation(factors, true, 75, 500);
      expect(reasons.some(r => r.includes('$500'))).toBe(true);
    });

    it('reports strong signals', () => {
      const factors = [
        makeFactor({ name: 'Trust', score: 80, status: 'positive' }),
        makeFactor({ name: 'Credit', score: 20, status: 'negative' }),
      ];
      const reasons = generateUnderwritingExplanation(factors, true, 60, 300);
      expect(reasons.some(r => r.includes('Trust'))).toBe(true);
    });
  });
});
