import { describe, it, expect } from 'vitest';
import {
  computeWeakestLink,
  computePathRisk,
  computeExposure,
} from '../trust-graph';

describe('Trust Graph Analytics — Pure Math Functions', () => {
  describe('computeWeakestLink', () => {
    it('returns 0 for empty array', () => {
      expect(computeWeakestLink([])).toBe(0);
    });

    it('returns minimum score', () => {
      expect(computeWeakestLink([80, 60, 40])).toBe(40);
    });

    it('returns single score', () => {
      expect(computeWeakestLink([75])).toBe(75);
    });

    it('returns 0 if any score is 0', () => {
      expect(computeWeakestLink([80, 0, 60])).toBe(0);
    });
  });

  describe('computePathRisk', () => {
    it('returns weakest link for depth 1', () => {
      expect(computePathRisk(1, 80)).toBe(80);
    });

    it('applies depth penalty', () => {
      // depth 3, weakest 80 → 80 - (2*5) = 70
      expect(computePathRisk(3, 80)).toBe(70);
    });

    it('floors at 0', () => {
      expect(computePathRisk(10, 30)).toBe(0);
    });

    it('caps at 100', () => {
      expect(computePathRisk(1, 120)).toBe(100);
    });
  });

  describe('computeExposure', () => {
    it('returns 0 for no edges', () => {
      const result = computeExposure([], 'walletA');
      expect(result.totalExposure).toBe(0);
      expect(result.directExposure).toBe(0);
      expect(result.indirectExposure).toBe(0);
    });

    it('computes direct exposure', () => {
      const edges = [
        { from: 'walletA', to: 'walletB', amount: 1000, round: 1 },
        { from: 'walletA', to: 'walletC', amount: 2000, round: 2 },
      ];
      const result = computeExposure(edges, 'walletA');
      expect(result.directExposure).toBe(3000);
    });

    it('computes indirect exposure', () => {
      const edges = [
        { from: 'walletA', to: 'walletB', amount: 1000, round: 1 },
        { from: 'walletB', to: 'walletC', amount: 500, round: 2 },
      ];
      const result = computeExposure(edges, 'walletA');
      expect(result.directExposure).toBe(1000);
      expect(result.indirectExposure).toBe(500);
      expect(result.totalExposure).toBe(1500);
    });

    it('computes max loss if sponsor fails', () => {
      const edges = [
        { from: 'walletA', to: 'walletB', amount: 1000, round: 1 },
      ];
      const result = computeExposure(edges, 'walletA');
      expect(result.maxLossIfSponsorFails).toBe(1000);
    });
  });
});
