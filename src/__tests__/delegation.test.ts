import { describe, it, expect } from 'vitest';
import {
  computeDepthScore,
  computeSponsorQualityScore,
  computeSponsorCountScore,
  computeAmountScore,
  computeDelegationTrustScore,
  classifyDelegationRisk,
  computeDelegationRecommendedLimit,
} from '../delegation';

describe('Delegation Trust — Pure Math Functions', () => {
  describe('computeDepthScore', () => {
    it('returns 100 for depth 0 (trust anchor)', () => {
      expect(computeDepthScore(0)).toBe(100);
    });

    it('returns 80 for depth 1', () => {
      expect(computeDepthScore(1)).toBe(80);
    });

    it('returns 60 for depth 2', () => {
      expect(computeDepthScore(2)).toBe(60);
    });

    it('returns 40 for depth 3', () => {
      expect(computeDepthScore(3)).toBe(40);
    });

    it('decreases by 10 per additional depth beyond 3', () => {
      expect(computeDepthScore(4)).toBe(30);
      expect(computeDepthScore(5)).toBe(20);
      expect(computeDepthScore(6)).toBe(10);
    });

    it('never goes below 0', () => {
      expect(computeDepthScore(100)).toBe(0);
      expect(computeDepthScore(1000)).toBe(0);
    });

    it('decreases monotonically', () => {
      const scores = [0, 1, 2, 3, 4, 5, 10, 20].map(computeDepthScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });
  });

  describe('computeSponsorQualityScore', () => {
    it('returns 0 for score 0', () => {
      expect(computeSponsorQualityScore(0)).toBe(0);
    });

    it('returns 100 for score 100', () => {
      expect(computeSponsorQualityScore(100)).toBe(100);
    });

    it('passes through score 50', () => {
      expect(computeSponsorQualityScore(50)).toBe(50);
    });

    it('clamps above 100', () => {
      expect(computeSponsorQualityScore(150)).toBe(100);
    });

    it('clamps below 0', () => {
      expect(computeSponsorQualityScore(-10)).toBe(0);
    });
  });

  describe('computeSponsorCountScore', () => {
    it('returns 0 for 0 sponsors', () => {
      expect(computeSponsorCountScore(0)).toBe(0);
    });

    it('returns 20 for 1 sponsor', () => {
      expect(computeSponsorCountScore(1)).toBe(20);
    });

    it('returns 40 for 2 sponsors', () => {
      expect(computeSponsorCountScore(2)).toBe(40);
    });

    it('caps at 100 for 5+ sponsors', () => {
      expect(computeSponsorCountScore(5)).toBe(100);
      expect(computeSponsorCountScore(10)).toBe(100);
    });

    it('increases with count', () => {
      const scores = [0, 1, 2, 3, 4, 5].map(computeSponsorCountScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });
  });

  describe('computeAmountScore', () => {
    it('returns 0 for 0 amount', () => {
      expect(computeAmountScore(0)).toBe(0);
    });

    it('returns > 0 for positive amount', () => {
      expect(computeAmountScore(1_000_000)).toBeGreaterThan(0);
    });

    it('returns 100 for very large amount', () => {
      expect(computeAmountScore(10_000_000_000)).toBe(100);
    });

    it('increases with amount', () => {
      const amounts = [100_000, 1_000_000, 10_000_000, 100_000_000];
      const scores = amounts.map(computeAmountScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });
  });

  describe('computeDelegationTrustScore', () => {
    it('returns 0 for all-zero breakdown', () => {
      const score = computeDelegationTrustScore({
        depthScore: 0, sponsorQualityScore: 0, sponsorCountScore: 0, amountScore: 0,
      });
      expect(score).toBe(0);
    });

    it('returns 100 for all-100 breakdown', () => {
      const score = computeDelegationTrustScore({
        depthScore: 100, sponsorQualityScore: 100, sponsorCountScore: 100, amountScore: 100,
      });
      expect(score).toBe(100);
    });

    it('weights depth highest (0.35)', () => {
      const highDepth = computeDelegationTrustScore({
        depthScore: 100, sponsorQualityScore: 0, sponsorCountScore: 0, amountScore: 0,
      });
      const highQuality = computeDelegationTrustScore({
        depthScore: 0, sponsorQualityScore: 100, sponsorCountScore: 0, amountScore: 0,
      });
      expect(highDepth).toBeGreaterThan(highQuality);
    });

    it('weights quality second highest (0.30)', () => {
      const highQuality = computeDelegationTrustScore({
        depthScore: 0, sponsorQualityScore: 100, sponsorCountScore: 0, amountScore: 0,
      });
      const highCount = computeDelegationTrustScore({
        depthScore: 0, sponsorQualityScore: 0, sponsorCountScore: 100, amountScore: 0,
      });
      expect(highQuality).toBeGreaterThan(highCount);
    });

    it('is between 0 and 100', () => {
      const score = computeDelegationTrustScore({
        depthScore: 45, sponsorQualityScore: 60, sponsorCountScore: 30, amountScore: 80,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('classifyDelegationRisk', () => {
    it('returns low for 70+', () => {
      expect(classifyDelegationRisk(70)).toBe('low');
      expect(classifyDelegationRisk(100)).toBe('low');
    });

    it('returns medium for 45-69', () => {
      expect(classifyDelegationRisk(45)).toBe('medium');
      expect(classifyDelegationRisk(69)).toBe('medium');
    });

    it('returns high for 20-44', () => {
      expect(classifyDelegationRisk(20)).toBe('high');
      expect(classifyDelegationRisk(44)).toBe('high');
    });

    it('returns critical for <20', () => {
      expect(classifyDelegationRisk(0)).toBe('critical');
      expect(classifyDelegationRisk(19)).toBe('critical');
    });
  });

  describe('computeDelegationRecommendedLimit', () => {
    it('returns 0 for score 0', () => {
      expect(computeDelegationRecommendedLimit(0)).toBe(0);
    });

    it('applies 1.5x tier for score >= 80', () => {
      expect(computeDelegationRecommendedLimit(80)).toBe(600);
    });

    it('applies 1.2x tier for score 60-79', () => {
      expect(computeDelegationRecommendedLimit(60)).toBe(360);
    });

    it('applies 1.0x tier for score 40-59', () => {
      expect(computeDelegationRecommendedLimit(40)).toBe(200);
    });

    it('applies 0.7x tier for score < 40', () => {
      expect(computeDelegationRecommendedLimit(20)).toBe(70);
    });

    it('increases with score', () => {
      const limits = [0, 20, 40, 60, 80, 100].map(computeDelegationRecommendedLimit);
      for (let i = 1; i < limits.length; i++) {
        expect(limits[i]).toBeGreaterThanOrEqual(limits[i - 1]);
      }
    });
  });
});
