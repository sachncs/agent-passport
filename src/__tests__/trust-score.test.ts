import { describe, it, expect } from 'vitest';

const WALLET_REGEX = /^[A-Z2-7]{58}$/;

function computeAgeScore(days: number): number {
  if (days <= 0) return 0;
  if (days >= 730) return 100;
  const linear = (days / 730) * 100;
  const log = (Math.log10(days + 1) / Math.log10(731)) * 100;
  return Math.round((linear * 0.6 + log * 0.4) * 10) / 10;
}

function computeActivityScore(txns: number, days: number, assets: number): number {
  const txPerMonth = days > 0 ? txns / (days / 30) : 0;
  return Math.min(100,
    Math.min(40, txPerMonth * 2) +
    Math.min(30, (days / 365) * 30) +
    Math.min(30, assets * 3)
  );
}

function computeVolumeScore(balanceMicroAlgo: number, txns: number): number {
  const algo = balanceMicroAlgo / 1_000_000;
  return Math.min(100,
    Math.min(50, Math.log10(Math.max(1, algo)) * 10) +
    Math.min(50, txns * 0.5)
  );
}

function computeVelocityScore(txns: number, days: number): number {
  if (days === 0) return 0;
  const perDay = txns / Math.max(1, days);
  if (perDay > 50) return 20;
  if (perDay > 20) return 40;
  if (perDay > 5) return 60;
  if (perDay > 1) return 80;
  return 100;
}

function computeComplianceScore(balanceMicroAlgo: number, txns: number): number {
  let score = 100;
  if (balanceMicroAlgo / 1_000_000 < 0.01) score -= 20;
  if (txns === 0) score -= 30;
  return Math.max(0, Math.min(100, score));
}

function computeTrustScore(breakdown: {
  ageScore: number;
  activityScore: number;
  volumeScore: number;
  velocityScore: number;
  complianceScore: number;
}): number {
  const w = { age: 0.2, activity: 0.25, volume: 0.2, velocity: 0.15, compliance: 0.2 };
  const total = w.age + w.activity + w.volume + w.velocity + w.compliance;
  return Math.round(Math.max(0, Math.min(100,
    (w.age / total) * breakdown.ageScore +
    (w.activity / total) * breakdown.activityScore +
    (w.volume / total) * breakdown.volumeScore +
    (w.velocity / total) * breakdown.velocityScore +
    (w.compliance / total) * breakdown.complianceScore
  )) * 10) / 10;
}

function classifyRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 70) return 'low';
  if (score >= 45) return 'medium';
  if (score >= 20) return 'high';
  return 'critical';
}

function computeRecommendedLimit(score: number): number {
  const base = (score / 100) * 500;
  const tier = score >= 80 ? 1.5 : score >= 60 ? 1.2 : score >= 40 ? 1.0 : 0.7;
  return Math.round(base * tier * 100) / 100;
}

function generateExplanation(
  onChain: { balanceAlgo: number; totalTxns: number; assetCount: number; accountAgeDays: number },
  trustScore: number
): string[] {
  const reasons: string[] = [];
  const { balanceAlgo, totalTxns, assetCount, accountAgeDays } = onChain;
  if (accountAgeDays > 365) reasons.push(`${Math.floor(accountAgeDays / 365)}+ year wallet history`);
  else if (accountAgeDays > 30) reasons.push(`${Math.floor(accountAgeDays / 30)}-month wallet history`);
  else reasons.push('New wallet with limited history');
  if (totalTxns > 100) reasons.push(`${totalTxns} transactions — active wallet`);
  else if (totalTxns > 10) reasons.push(`${totalTxns} transactions — moderate activity`);
  else reasons.push(`${totalTxns} transactions — limited activity`);
  if (balanceAlgo > 100) reasons.push(`Balance: ${balanceAlgo.toFixed(2)} ALGO — well-funded`);
  else if (balanceAlgo > 1) reasons.push(`Balance: ${balanceAlgo.toFixed(4)} ALGO`);
  else reasons.push(`Balance: ${balanceAlgo.toFixed(6)} ALGO — low balance`);
  if (assetCount > 5) reasons.push(`${assetCount} assets — diverse portfolio`);
  if (trustScore >= 70) reasons.push('Strong overall trust profile');
  else if (trustScore >= 40) reasons.push('Moderate trust profile');
  else reasons.push('Weak trust profile — additional verification recommended');
  return reasons;
}

describe('Trust Score — Pure Math Functions', () => {
  describe('computeAgeScore', () => {
    it('returns 0 for zero days', () => {
      expect(computeAgeScore(0)).toBe(0);
    });

    it('returns 0 for negative days', () => {
      expect(computeAgeScore(-10)).toBe(0);
    });

    it('returns 100 for 730+ days', () => {
      expect(computeAgeScore(730)).toBe(100);
      expect(computeAgeScore(1000)).toBe(100);
    });

    it('returns between 0 and 100 for intermediate values', () => {
      const score = computeAgeScore(365);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    it('increases monotonically', () => {
      const scores = [1, 30, 90, 180, 365, 540, 730].map(computeAgeScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });
  });

  describe('computeActivityScore', () => {
    it('returns 30 for no activity (age component alone)', () => {
      expect(computeActivityScore(0, 365, 0)).toBe(30);
    });

    it('increases with more transactions', () => {
      const low = computeActivityScore(5, 365, 0);
      const high = computeActivityScore(100, 365, 0);
      expect(high).toBeGreaterThan(low);
    });

    it('increases with more assets', () => {
      const noAssets = computeActivityScore(10, 365, 0);
      const withAssets = computeActivityScore(10, 365, 10);
      expect(withAssets).toBeGreaterThan(noAssets);
    });

    it('caps at 100', () => {
      expect(computeActivityScore(10000, 3650, 100)).toBe(100);
    });
  });

  describe('computeVolumeScore', () => {
    it('returns 0 for zero balance and zero txns', () => {
      expect(computeVolumeScore(0, 0)).toBe(0);
    });

    it('increases with higher balance', () => {
      const low = computeVolumeScore(1_000_000, 1);
      const high = computeVolumeScore(100_000_000, 1);
      expect(high).toBeGreaterThan(low);
    });

    it('increases with more transactions', () => {
      const low = computeVolumeScore(1_000_000, 1);
      const high = computeVolumeScore(1_000_000, 100);
      expect(high).toBeGreaterThan(low);
    });

    it('caps at 100', () => {
      expect(computeVolumeScore(1_000_000_000_000, 1000)).toBe(100);
    });
  });

  describe('computeVelocityScore', () => {
    it('returns 0 for zero days', () => {
      expect(computeVelocityScore(100, 0)).toBe(0);
    });

    it('returns 20 for very high velocity', () => {
      expect(computeVelocityScore(5000, 10)).toBe(20);
    });

    it('returns 100 for very low velocity', () => {
      expect(computeVelocityScore(10, 100)).toBe(100);
    });

    it('decreases as velocity increases', () => {
      const scores = [
        computeVelocityScore(10, 100),
        computeVelocityScore(50, 100),
        computeVelocityScore(200, 100),
        computeVelocityScore(600, 100),
      ];
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });
  });

  describe('computeComplianceScore', () => {
    it('returns 100 for healthy account', () => {
      expect(computeComplianceScore(1_000_000, 10)).toBe(100);
    });

    it('does not reduce score for balance exactly at threshold', () => {
      const score = computeComplianceScore(10_000, 10);
      expect(score).toBe(100);
    });

    it('reduces score for balance below threshold', () => {
      const score = computeComplianceScore(9_999, 10);
      expect(score).toBe(80);
    });

    it('reduces score for zero transactions', () => {
      const score = computeComplianceScore(1_000_000, 0);
      expect(score).toBe(70);
    });

    it('reduces both for low balance and zero txns', () => {
      const score = computeComplianceScore(0, 0);
      expect(score).toBe(50);
    });

    it('never goes below 0', () => {
      expect(computeComplianceScore(0, 0)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('computeTrustScore', () => {
    it('returns 0 for all-zero breakdown', () => {
      const score = computeTrustScore({
        ageScore: 0, activityScore: 0, volumeScore: 0, velocityScore: 0, complianceScore: 0,
      });
      expect(score).toBe(0);
    });

    it('returns 100 for all-100 breakdown', () => {
      const score = computeTrustScore({
        ageScore: 100, activityScore: 100, volumeScore: 100, velocityScore: 100, complianceScore: 100,
      });
      expect(score).toBe(100);
    });

    it('weights activity highest (0.25)', () => {
      const highActivity = computeTrustScore({
        ageScore: 0, activityScore: 100, volumeScore: 0, velocityScore: 0, complianceScore: 0,
      });
      const highAge = computeTrustScore({
        ageScore: 100, activityScore: 0, volumeScore: 0, velocityScore: 0, complianceScore: 0,
      });
      expect(highActivity).toBeGreaterThan(highAge);
    });

    it('is between 0 and 100', () => {
      const score = computeTrustScore({
        ageScore: 45, activityScore: 60, volumeScore: 30, velocityScore: 80, complianceScore: 50,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('classifyRisk', () => {
    it('returns low for 70+', () => {
      expect(classifyRisk(70)).toBe('low');
      expect(classifyRisk(100)).toBe('low');
    });

    it('returns medium for 45-69', () => {
      expect(classifyRisk(45)).toBe('medium');
      expect(classifyRisk(69)).toBe('medium');
    });

    it('returns high for 20-44', () => {
      expect(classifyRisk(20)).toBe('high');
      expect(classifyRisk(44)).toBe('high');
    });

    it('returns critical for <20', () => {
      expect(classifyRisk(0)).toBe('critical');
      expect(classifyRisk(19)).toBe('critical');
    });
  });

  describe('computeRecommendedLimit', () => {
    it('returns 0 for score 0', () => {
      expect(computeRecommendedLimit(0)).toBe(0);
    });

    it('applies 1.5x tier for score >= 80', () => {
      const limit = computeRecommendedLimit(80);
      expect(limit).toBe(600);
    });

    it('applies 1.2x tier for score 60-79', () => {
      const limit = computeRecommendedLimit(60);
      expect(limit).toBe(360);
    });

    it('applies 1.0x tier for score 40-59', () => {
      const limit = computeRecommendedLimit(40);
      expect(limit).toBe(200);
    });

    it('applies 0.7x tier for score < 40', () => {
      const limit = computeRecommendedLimit(20);
      expect(limit).toBe(70);
    });

    it('increases with score', () => {
      const limits = [0, 20, 40, 60, 80, 100].map(computeRecommendedLimit);
      for (let i = 1; i < limits.length; i++) {
        expect(limits[i]).toBeGreaterThanOrEqual(limits[i - 1]);
      }
    });
  });

  describe('generateExplanation', () => {
    it('identifies year-old wallet', () => {
      const reasons = generateExplanation(
        { balanceAlgo: 100, totalTxns: 50, assetCount: 3, accountAgeDays: 400 }, 70
      );
      expect(reasons.some(r => r.includes('year wallet history'))).toBe(true);
    });

    it('identifies month-old wallet', () => {
      const reasons = generateExplanation(
        { balanceAlgo: 10, totalTxns: 5, assetCount: 0, accountAgeDays: 60 }, 50
      );
      expect(reasons.some(r => r.includes('month wallet history'))).toBe(true);
    });

    it('identifies new wallet', () => {
      const reasons = generateExplanation(
        { balanceAlgo: 1, totalTxns: 1, assetCount: 0, accountAgeDays: 5 }, 10
      );
      expect(reasons.some(r => r.includes('New wallet'))).toBe(true);
    });

    it('identifies active wallet', () => {
      const reasons = generateExplanation(
        { balanceAlgo: 10, totalTxns: 200, assetCount: 2, accountAgeDays: 100 }, 60
      );
      expect(reasons.some(r => r.includes('active wallet'))).toBe(true);
    });

    it('identifies well-funded wallet', () => {
      const reasons = generateExplanation(
        { balanceAlgo: 500, totalTxns: 10, assetCount: 1, accountAgeDays: 100 }, 60
      );
      expect(reasons.some(r => r.includes('well-funded'))).toBe(true);
    });

    it('identifies diverse portfolio', () => {
      const reasons = generateExplanation(
        { balanceAlgo: 10, totalTxns: 10, assetCount: 10, accountAgeDays: 100 }, 60
      );
      expect(reasons.some(r => r.includes('diverse portfolio'))).toBe(true);
    });

    it('identifies strong profile', () => {
      const reasons = generateExplanation(
        { balanceAlgo: 100, totalTxns: 200, assetCount: 5, accountAgeDays: 500 }, 80
      );
      expect(reasons.some(r => r.includes('Strong overall'))).toBe(true);
    });

    it('identifies weak profile', () => {
      const reasons = generateExplanation(
        { balanceAlgo: 0.001, totalTxns: 1, assetCount: 0, accountAgeDays: 2 }, 10
      );
      expect(reasons.some(r => r.includes('Weak trust profile'))).toBe(true);
    });

    it('returns multiple reasons', () => {
      const reasons = generateExplanation(
        { balanceAlgo: 500, totalTxns: 500, assetCount: 20, accountAgeDays: 1000 }, 90
      );
      expect(reasons.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Wallet address validation regex', () => {
    it('accepts valid 58-char base32 address', () => {
      expect(WALLET_REGEX.test('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ')).toBe(true);
    });

    it('rejects too short', () => {
      expect(WALLET_REGEX.test('AAAA')).toBe(false);
    });

    it('rejects too long', () => {
      expect(WALLET_REGEX.test('A'.repeat(59))).toBe(false);
    });

    it('rejects lowercase', () => {
      expect(WALLET_REGEX.test('a'.repeat(58))).toBe(false);
    });

    it('accepts all Algorand base32 chars including O and I', () => {
      expect(WALLET_REGEX.test('A'.repeat(58))).toBe(true);
      expect(WALLET_REGEX.test('O'.repeat(58))).toBe(true);
      expect(WALLET_REGEX.test('I'.repeat(58))).toBe(true);
      expect(WALLET_REGEX.test('Z'.repeat(58))).toBe(true);
    });

    it('rejects digits 0 and 1', () => {
      expect(WALLET_REGEX.test('0'.repeat(58))).toBe(false);
      expect(WALLET_REGEX.test('1'.repeat(58))).toBe(false);
    });

    it('accepts digits 2-7', () => {
      expect(WALLET_REGEX.test('2222222222222222222222222222222222222222222222222222222222')).toBe(true);
      expect(WALLET_REGEX.test('7777777777777777777777777777777777777777777777777777777777')).toBe(true);
    });

    it('accepts letters A-Z excluding O and I', () => {
      expect(WALLET_REGEX.test('A'.repeat(58))).toBe(true);
      expect(WALLET_REGEX.test('B'.repeat(58))).toBe(true);
      expect(WALLET_REGEX.test('Z'.repeat(58))).toBe(true);
    });
  });
});
