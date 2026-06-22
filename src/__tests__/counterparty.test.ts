import { describe, it, expect } from 'vitest';
import {
  computeCombinedScore,
  computeConfidence,
  decideAllow,
  classifyCounterpartyRisk,
  generateCounterpartyExplanation,
} from '../counterparty';

describe('Counterparty Verification — Pure Math Functions', () => {
  describe('computeCombinedScore', () => {
    it('returns 0 for 0/0', () => {
      expect(computeCombinedScore(0, 0)).toBe(0);
    });

    it('returns 100 for 100/100', () => {
      expect(computeCombinedScore(100, 100)).toBe(100);
    });

    it('weights on-chain at 0.6', () => {
      expect(computeCombinedScore(100, 0)).toBe(60);
    });

    it('weights delegation at 0.4', () => {
      expect(computeCombinedScore(0, 100)).toBe(40);
    });

    it('computes weighted average correctly', () => {
      expect(computeCombinedScore(50, 50)).toBe(50);
    });

    it('rounds to 1 decimal', () => {
      const result = computeCombinedScore(33, 67);
      expect(result).toBe(Math.round((0.6 * 33 + 0.4 * 67) * 10) / 10);
    });
  });

  describe('computeConfidence', () => {
    it('returns 0.30 for score 0', () => {
      expect(computeConfidence(0)).toBe(0.30);
    });

    it('returns 0.50 for score 40 (threshold boundary)', () => {
      expect(computeConfidence(40)).toBe(0.50);
    });

    it('returns 0.70 for score 60 (upper tier boundary)', () => {
      expect(computeConfidence(60)).toBe(0.70);
    });

    it('returns 1.00 for score 100', () => {
      expect(computeConfidence(100)).toBe(1.00);
    });

    it('never returns below 0.30', () => {
      expect(computeConfidence(-10)).toBeGreaterThanOrEqual(0.30);
    });

    it('never returns above 1.00', () => {
      expect(computeConfidence(200)).toBeLessThanOrEqual(1.00);
    });

    it('increases monotonically', () => {
      const scores = [0, 20, 40, 50, 60, 80, 100];
      const confidences = scores.map(computeConfidence);
      for (let i = 1; i < confidences.length; i++) {
        expect(confidences[i]).toBeGreaterThanOrEqual(confidences[i - 1]);
      }
    });

    it('has correct range for low tier (0-39)', () => {
      expect(computeConfidence(0)).toBe(0.30);
      expect(computeConfidence(20)).toBeLessThan(0.50);
    });

    it('has correct range for mid tier (40-59)', () => {
      expect(computeConfidence(40)).toBe(0.50);
      expect(computeConfidence(59)).toBeLessThan(0.70);
    });

    it('has correct range for high tier (60-100)', () => {
      expect(computeConfidence(60)).toBe(0.70);
      expect(computeConfidence(100)).toBe(1.00);
    });
  });

  describe('decideAllow', () => {
    it('returns false for score 39', () => {
      expect(decideAllow(39)).toBe(false);
    });

    it('returns true for score 40', () => {
      expect(decideAllow(40)).toBe(true);
    });

    it('returns true for score 100', () => {
      expect(decideAllow(100)).toBe(true);
    });

    it('returns false for score 0', () => {
      expect(decideAllow(0)).toBe(false);
    });
  });

  describe('classifyCounterpartyRisk', () => {
    it('returns low for 70+', () => {
      expect(classifyCounterpartyRisk(70)).toBe('low');
      expect(classifyCounterpartyRisk(100)).toBe('low');
    });

    it('returns medium for 45-69', () => {
      expect(classifyCounterpartyRisk(45)).toBe('medium');
      expect(classifyCounterpartyRisk(69)).toBe('medium');
    });

    it('returns high for 20-44', () => {
      expect(classifyCounterpartyRisk(20)).toBe('high');
      expect(classifyCounterpartyRisk(44)).toBe('high');
    });

    it('returns critical for <20', () => {
      expect(classifyCounterpartyRisk(0)).toBe('critical');
      expect(classifyCounterpartyRisk(19)).toBe('critical');
    });
  });

  describe('generateCounterpartyExplanation', () => {
    it('identifies strong on-chain history', () => {
      const reasons = generateCounterpartyExplanation(80, 60, 72, true, 0.85);
      expect(reasons.some(r => r.includes('Strong on-chain'))).toBe(true);
    });

    it('identifies weak on-chain history', () => {
      const reasons = generateCounterpartyExplanation(10, 50, 26, false, 0.4);
      expect(reasons.some(r => r.includes('Weak on-chain'))).toBe(true);
    });

    it('identifies well-sponsored', () => {
      const reasons = generateCounterpartyExplanation(60, 80, 68, true, 0.8);
      expect(reasons.some(r => r.includes('Well-sponsored'))).toBe(true);
    });

    it('identifies no delegation data', () => {
      const reasons = generateCounterpartyExplanation(70, 0, 42, true, 0.5);
      expect(reasons.some(r => r.includes('No delegation'))).toBe(true);
    });

    it('reports approved with confidence', () => {
      const reasons = generateCounterpartyExplanation(70, 70, 70, true, 0.85);
      expect(reasons.some(r => r.includes('Approved'))).toBe(true);
      expect(reasons.some(r => r.includes('85%'))).toBe(true);
    });

    it('reports denied with score', () => {
      const reasons = generateCounterpartyExplanation(20, 10, 16, false, 0.38);
      expect(reasons.some(r => r.includes('Denied'))).toBe(true);
      expect(reasons.some(r => r.includes('16'))).toBe(true);
    });

    it('returns multiple reasons', () => {
      const reasons = generateCounterpartyExplanation(80, 75, 78, true, 0.9);
      expect(reasons.length).toBe(3);
    });
  });
});
