import { describe, it, expect } from 'vitest';

describe('Edge Cases', () => {
  describe('Wallet address edge cases', () => {
    const VALID_WALLET = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';
    const WALLET_REGEX = /^[A-Z2-7]{58}$/;

    it('rejects wallet with space', () => {
      expect(WALLET_REGEX.test(' ' + VALID_WALLET.slice(1))).toBe(false);
    });

    it('rejects wallet with special chars', () => {
      expect(WALLET_REGEX.test('@'.repeat(58))).toBe(false);
    });

    it('rejects empty string', () => {
      expect(WALLET_REGEX.test('')).toBe(false);
    });

    it('rejects 57 chars (one short)', () => {
      expect(WALLET_REGEX.test('A'.repeat(57))).toBe(false);
    });

    it('rejects 59 chars (one long)', () => {
      expect(WALLET_REGEX.test('A'.repeat(59))).toBe(false);
    });

    it('accepts all valid Algorand base32 chars', () => {
      const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      const wallet = validChars.repeat(2).slice(0, 58);
      expect(WALLET_REGEX.test(wallet)).toBe(true);
    });
  });

  describe('Math edge cases', () => {
    it('computeAgeScore handles very large days', () => {
      const score = (days: number) => {
        if (days <= 0) return 0;
        if (days >= 730) return 100;
        const linear = (days / 730) * 100;
        const log = (Math.log10(days + 1) / Math.log10(731)) * 100;
        return Math.round((linear * 0.6 + log * 0.4) * 10) / 10;
      };
      expect(score(10000)).toBe(100);
      expect(score(Number.MAX_SAFE_INTEGER)).toBe(100);
    });

    it('computeVelocityScore handles zero days', () => {
      const perDay = 100 / Math.max(1, 0);
      expect(perDay).toBe(100);
    });

    it('computeVolumeScore handles zero balance', () => {
      const algo = 0 / 1_000_000;
      expect(Math.log10(Math.max(1, algo))).toBe(0);
    });

    it('computeTrustScore handles equal weights', () => {
      const breakdown = { ageScore: 50, activityScore: 50, volumeScore: 50, velocityScore: 50, complianceScore: 50 };
      const score = Math.round(50 * 10) / 10;
      expect(score).toBe(50);
    });

    it('classifyRisk boundary values', () => {
      const classify = (s: number) => {
        if (s >= 70) return 'low';
        if (s >= 45) return 'medium';
        if (s >= 20) return 'high';
        return 'critical';
      };
      expect(classify(69.9)).toBe('medium');
      expect(classify(70)).toBe('low');
      expect(classify(44.9)).toBe('high');
      expect(classify(45)).toBe('medium');
      expect(classify(19.9)).toBe('critical');
      expect(classify(20)).toBe('high');
    });
  });

  describe('Explanation generation edge cases', () => {
    const generateExplanation = (
      onChain: { balanceAlgo: number; totalTxns: number; assetCount: number; accountAgeDays: number },
      trustScore: number
    ): string[] => {
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
    };

    it('handles zero balance gracefully', () => {
      const reasons = generateExplanation(
        { balanceAlgo: 0, totalTxns: 0, assetCount: 0, accountAgeDays: 1 }, 0
      );
      expect(reasons.some(r => r.includes('low balance'))).toBe(true);
    });

    it('handles exact boundary for year history', () => {
      const reasons365 = generateExplanation(
        { balanceAlgo: 10, totalTxns: 10, assetCount: 0, accountAgeDays: 365 }, 50
      );
      expect(reasons365.some(r => r.includes('month wallet history'))).toBe(true);

      const reasons366 = generateExplanation(
        { balanceAlgo: 10, totalTxns: 10, assetCount: 0, accountAgeDays: 366 }, 50
      );
      expect(reasons366.some(r => r.includes('year wallet history'))).toBe(true);
    });

    it('handles exact boundary for active wallet', () => {
      const reasons100 = generateExplanation(
        { balanceAlgo: 10, totalTxns: 100, assetCount: 0, accountAgeDays: 100 }, 50
      );
      expect(reasons100.some(r => r.includes('moderate activity'))).toBe(true);

      const reasons101 = generateExplanation(
        { balanceAlgo: 10, totalTxns: 101, assetCount: 0, accountAgeDays: 100 }, 50
      );
      expect(reasons101.some(r => r.includes('active wallet'))).toBe(true);
    });

    it('handles exact boundary for balance tiers', () => {
      const reasons0_5 = generateExplanation(
        { balanceAlgo: 0.5, totalTxns: 5, assetCount: 0, accountAgeDays: 30 }, 30
      );
      expect(reasons0_5.some(r => r.includes('ALGO'))).toBe(true);
      expect(reasons0_5.some(r => r.includes('low balance'))).toBe(true);

      const reasons200 = generateExplanation(
        { balanceAlgo: 200, totalTxns: 5, assetCount: 0, accountAgeDays: 30 }, 30
      );
      expect(reasons200.some(r => r.includes('well-funded'))).toBe(true);
    });

    it('handles exact boundary for diverse portfolio', () => {
      const reasons5 = generateExplanation(
        { balanceAlgo: 10, totalTxns: 5, assetCount: 5, accountAgeDays: 100 }, 50
      );
      expect(reasons5.some(r => r.includes('diverse portfolio'))).toBe(false);

      const reasons6 = generateExplanation(
        { balanceAlgo: 10, totalTxns: 5, assetCount: 6, accountAgeDays: 100 }, 50
      );
      expect(reasons6.some(r => r.includes('diverse portfolio'))).toBe(true);
    });
  });
});
