import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const VALID_WALLET = 'A'.repeat(58);

vi.mock('../lib/constants', () => ({
  isValidWallet: (w: string) => typeof w === 'string' && w.length === 58 && /^[A-Z2-7]+$/.test(w),
  MICRO_ALGO: 1_000_000,
}));

vi.mock('../lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../trust-score', () => ({
  scoreWallet: vi.fn(),
  scoreWalletFresh: vi.fn(),
  computeTrustScore: vi.fn(),
  computeAgeScore: vi.fn(),
  computeActivityScore: vi.fn(),
  computeVolumeScore: vi.fn(),
  computeVelocityScore: vi.fn(),
  computeComplianceScore: vi.fn(),
  classifyRisk: vi.fn(),
  computeRecommendedLimit: vi.fn(),
  generateExplanation: vi.fn(),
}));

vi.mock('../lib/sanctions', () => ({
  checkSanctions: vi.fn(),
}));

import {
  estimateCredit,
  estimateCreditWithTrust,
  computeBalanceCapacity,
  computeActivityBonus,
  computeAgeBonus,
  computeRiskPenalty,
  computeCreditLimit,
  classifyCreditRisk,
  computeCreditConfidence,
  generateCreditExplanation,
} from '../credit';
import { scoreWallet } from '../trust-score';
import type { WalletTrustScore } from '../trust-score';

const mockScoreWallet = vi.mocked(scoreWallet);

function makeTrustScore(
  overrides: Partial<WalletTrustScore> = {},
): WalletTrustScore {
  return {
    wallet: VALID_WALLET,
    trustScore: 70,
    riskLevel: 'low',
    approved: true,
    recommendedLimit: 500,
    breakdown: {
      ageScore: 70,
      activityScore: 70,
      volumeScore: 70,
      velocityScore: 70,
      complianceScore: 80,
    },
    onChain: {
      balanceAlgo: 500,
      totalTxns: 200,
      assetCount: 5,
      appCount: 2,
      accountAgeDays: 400,
      firstSeenRound: 100,
      lastSeenRound: 200,
    },
    explanation: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('estimateCredit()', () => {
  describe('invalid wallet', () => {
    it('returns null for empty string', async () => {
      expect(await estimateCredit('')).toBeNull();
    });

    it('returns null for short wallet', async () => {
      expect(await estimateCredit('SHORT')).toBeNull();
    });

    it('returns null for wallet with lowercase', async () => {
      expect(await estimateCredit('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeNull();
    });
  });

  describe('success', () => {
    it('returns credit estimate with valid data', async () => {
      mockScoreWallet.mockResolvedValue(makeTrustScore());

      const result = await estimateCredit(VALID_WALLET);

      expect(result).not.toBeNull();
      expect(result!.wallet).toBe(VALID_WALLET);
      expect(result!.estimatedLimit).toBeGreaterThanOrEqual(0);
      expect(result!.approved).toBe(true);
      expect(result!.breakdown).toBeDefined();
      expect(result!.explanation.length).toBeGreaterThan(0);
    });

    it('calls scoreWallet with the wallet', async () => {
      mockScoreWallet.mockResolvedValue(makeTrustScore());

      await estimateCredit(VALID_WALLET);

      expect(mockScoreWallet).toHaveBeenCalledWith(VALID_WALLET);
    });

    it('applies request amount for approval check', async () => {
      mockScoreWallet.mockResolvedValue(makeTrustScore());

      const result = await estimateCredit(VALID_WALLET, 200);

      expect(result).not.toBeNull();
      expect(typeof result!.approved).toBe('boolean');
    });

    it('denies when requested amount exceeds limit', async () => {
      const lowTrust = makeTrustScore({
        onChain: {
          balanceAlgo: 0.001,
          totalTxns: 0,
          assetCount: 0,
          appCount: 0,
          accountAgeDays: 1,
          firstSeenRound: 0,
          lastSeenRound: 0,
        },
        breakdown: {
          ageScore: 0,
          activityScore: 0,
          volumeScore: 0,
          velocityScore: 0,
          complianceScore: 10,
        },
      });
      mockScoreWallet.mockResolvedValue(lowTrust);

      const result = await estimateCredit(VALID_WALLET, 1000);

      expect(result!.approved).toBe(false);
    });

    it('approves when requested amount is within limit', async () => {
      mockScoreWallet.mockResolvedValue(makeTrustScore());

      const result = await estimateCredit(VALID_WALLET, 1);

      expect(result!.approved).toBe(true);
    });

    it('uses defaults when scoreWallet returns null fields', async () => {
      mockScoreWallet.mockResolvedValue({
        wallet: VALID_WALLET,
        trustScore: 0,
        riskLevel: 'critical',
        approved: false,
        recommendedLimit: 0,
        breakdown: {
          ageScore: 0,
          activityScore: 0,
          volumeScore: 0,
          velocityScore: 0,
          complianceScore: 0,
        },
        onChain: {
          balanceAlgo: 0,
          totalTxns: 0,
          assetCount: 0,
          appCount: 0,
          accountAgeDays: 0,
          firstSeenRound: 0,
          lastSeenRound: 0,
        },
        explanation: [],
      });

      const result = await estimateCredit(VALID_WALLET);

      expect(result).not.toBeNull();
      expect(result!.estimatedLimit).toBe(0);
      expect(result!.risk).toBe('critical');
    });
  });

  describe('trust fetch error', () => {
    it('propagates the error from scoreWallet', async () => {
      mockScoreWallet.mockRejectedValue(new Error('network error'));

      await expect(estimateCredit(VALID_WALLET)).rejects.toThrow('network error');
    });
  });

  describe('sanctions', () => {
    it('estimateCredit does not call checkSanctions (only underwrite does)', async () => {
      mockScoreWallet.mockResolvedValue(makeTrustScore());

      await estimateCredit(VALID_WALLET);

      const { checkSanctions } = await import('../lib/sanctions');
      expect(vi.mocked(checkSanctions)).not.toHaveBeenCalled();
    });
  });

  describe('breakdown computation', () => {
    it('computes balance capacity from on-chain balance', async () => {
      mockScoreWallet.mockResolvedValue(makeTrustScore({
        onChain: {
          balanceAlgo: 1000,
          totalTxns: 100,
          assetCount: 3,
          appCount: 1,
          accountAgeDays: 200,
          firstSeenRound: 100,
          lastSeenRound: 200,
        },
      }));

      const result = await estimateCredit(VALID_WALLET);

      expect(result!.breakdown.balanceCapacity).toBe(500);
    });

    it('computes activity bonus from total txns', async () => {
      mockScoreWallet.mockResolvedValue(makeTrustScore({
        onChain: {
          balanceAlgo: 100,
          totalTxns: 50,
          assetCount: 2,
          appCount: 1,
          accountAgeDays: 100,
          firstSeenRound: 100,
          lastSeenRound: 200,
        },
      }));

      const result = await estimateCredit(VALID_WALLET);

      expect(result!.breakdown.activityBonus).toBe(100);
    });

    it('computes risk penalty from velocity and compliance', async () => {
      mockScoreWallet.mockResolvedValue(makeTrustScore({
        breakdown: {
          ageScore: 50,
          activityScore: 50,
          volumeScore: 50,
          velocityScore: 20,
          complianceScore: 30,
        },
      }));

      const result = await estimateCredit(VALID_WALLET);

      expect(result!.breakdown.riskPenalty).toBeGreaterThan(0);
    });
  });

  describe('risk classification', () => {
    it('returns critical risk for zero limit', async () => {
      mockScoreWallet.mockResolvedValue(makeTrustScore({
        onChain: {
          balanceAlgo: 0,
          totalTxns: 0,
          assetCount: 0,
          appCount: 0,
          accountAgeDays: 0,
          firstSeenRound: 0,
          lastSeenRound: 0,
        },
        breakdown: {
          ageScore: 0,
          activityScore: 0,
          volumeScore: 0,
          velocityScore: 0,
          complianceScore: 0,
        },
      }));

      const result = await estimateCredit(VALID_WALLET);

      expect(result!.risk).toBe('critical');
    });
  });

  describe('confidence', () => {
    it('returns higher confidence with more data points', async () => {
      mockScoreWallet.mockResolvedValue(makeTrustScore());

      const result = await estimateCredit(VALID_WALLET);

      expect(result!.confidence).toBeGreaterThanOrEqual(0.40);
      expect(result!.confidence).toBeLessThanOrEqual(0.95);
    });
  });
});

describe('estimateCreditWithTrust()', () => {
  describe('invalid wallet', () => {
    it('returns null for empty string', async () => {
      expect(await estimateCreditWithTrust('', null)).toBeNull();
    });

    it('returns null for invalid wallet', async () => {
      expect(await estimateCreditWithTrust('bad', null)).toBeNull();
    });
  });

  describe('null trust data', () => {
    it('uses zeroed defaults when trustData is null', async () => {
      const result = await estimateCreditWithTrust(VALID_WALLET, null);

      expect(result).not.toBeNull();
      expect(result!.wallet).toBe(VALID_WALLET);
      expect(result!.estimatedLimit).toBe(0);
      expect(result!.breakdown.balanceCapacity).toBe(0);
      expect(result!.breakdown.activityBonus).toBe(0);
      expect(result!.breakdown.ageBonus).toBe(0);
    });

    it('does not call scoreWallet', async () => {
      await estimateCreditWithTrust(VALID_WALLET, null);

      expect(mockScoreWallet).not.toHaveBeenCalled();
    });
  });

  describe('valid trust data', () => {
    it('uses pre-fetched trust data for credit computation', async () => {
      const trust = makeTrustScore();

      const result = await estimateCreditWithTrust(VALID_WALLET, trust);

      expect(result).not.toBeNull();
      expect(result!.wallet).toBe(VALID_WALLET);
      expect(result!.estimatedLimit).toBeGreaterThan(0);
    });

    it('computes breakdown from trust onChain data', async () => {
      const trust = makeTrustScore({
        onChain: {
          balanceAlgo: 200,
          totalTxns: 30,
          assetCount: 2,
          appCount: 1,
          accountAgeDays: 180,
          firstSeenRound: 100,
          lastSeenRound: 200,
        },
      });

      const result = await estimateCreditWithTrust(VALID_WALLET, trust);

      expect(result!.breakdown.balanceCapacity).toBe(100);
      expect(result!.breakdown.activityBonus).toBe(60);
    });

    it('applies request amount for approval', async () => {
      const trust = makeTrustScore();

      const approved = await estimateCreditWithTrust(VALID_WALLET, trust, 1);
      expect(approved!.approved).toBe(true);

      const denied = await estimateCreditWithTrust(VALID_WALLET, trust, 100000);
      expect(denied!.approved).toBe(false);
    });

    it('uses default velocity/compliance when breakdown values are zero', async () => {
      const trust = makeTrustScore({
        breakdown: {
          ageScore: 0,
          activityScore: 0,
          volumeScore: 0,
          velocityScore: 0,
          complianceScore: 0,
        },
      });

      const result = await estimateCreditWithTrust(VALID_WALLET, trust);

      expect(result).not.toBeNull();
      expect(result!.breakdown.riskPenalty).toBeGreaterThan(0);
    });
  });
});

describe('Pure math functions (credit module)', () => {
  describe('computeBalanceCapacity', () => {
    it('returns 0 for 0 balance', () => {
      expect(computeBalanceCapacity(0)).toBe(0);
    });

    it('returns 50% of balance', () => {
      expect(computeBalanceCapacity(100)).toBe(50);
    });

    it('caps at 1000', () => {
      expect(computeBalanceCapacity(5000)).toBe(1000);
    });

    it('handles negative balance as 0', () => {
      expect(computeBalanceCapacity(-100)).toBe(0);
    });
  });

  describe('computeActivityBonus', () => {
    it('returns 0 for 0 txns', () => {
      expect(computeActivityBonus(0)).toBe(0);
    });

    it('returns $2 per txn', () => {
      expect(computeActivityBonus(10)).toBe(20);
    });

    it('caps at 200', () => {
      expect(computeActivityBonus(200)).toBe(200);
    });
  });

  describe('computeAgeBonus', () => {
    it('returns 0 for 0 days', () => {
      expect(computeAgeBonus(0)).toBe(0);
    });

    it('returns 150 for 365+ days', () => {
      expect(computeAgeBonus(365)).toBe(150);
    });

    it('caps at 150', () => {
      expect(computeAgeBonus(1000)).toBe(150);
    });
  });

  describe('computeRiskPenalty', () => {
    it('returns 0 for high velocity and compliance', () => {
      expect(computeRiskPenalty(80, 90)).toBe(0);
    });

    it('penalizes low velocity', () => {
      expect(computeRiskPenalty(0, 100)).toBe(50);
    });

    it('penalizes low compliance', () => {
      expect(computeRiskPenalty(100, 0)).toBe(100);
    });

    it('combines both penalties', () => {
      expect(computeRiskPenalty(0, 0)).toBe(150);
    });
  });

  describe('computeCreditLimit', () => {
    it('returns 0 for all-zero breakdown', () => {
      expect(computeCreditLimit({
        balanceCapacity: 0, activityBonus: 0, ageBonus: 0, riskPenalty: 0,
      })).toBe(0);
    });

    it('caps at 1350', () => {
      expect(computeCreditLimit({
        balanceCapacity: 1000,
        activityBonus: 200,
        ageBonus: 150,
        riskPenalty: 0,
      })).toBe(1350);
    });

    it('never goes below 0', () => {
      expect(computeCreditLimit({
        balanceCapacity: 0, activityBonus: 0, ageBonus: 0, riskPenalty: 500,
      })).toBe(0);
    });
  });

  describe('classifyCreditRisk', () => {
    it('returns low for high limit', () => {
      expect(classifyCreditRisk(600)).toBe('low');
    });

    it('returns critical for very low limit', () => {
      expect(classifyCreditRisk(5)).toBe('critical');
    });

    it('returns low when ratio >= 2', () => {
      expect(classifyCreditRisk(400, 200)).toBe('low');
    });

    it('returns critical when ratio < 0.8', () => {
      expect(classifyCreditRisk(50, 200)).toBe('critical');
    });
  });

  describe('computeCreditConfidence', () => {
    it('returns 0.40 for 0 data points', () => {
      expect(computeCreditConfidence(0)).toBe(0.40);
    });

    it('caps at 0.95', () => {
      expect(computeCreditConfidence(10)).toBe(0.95);
    });
  });

  describe('generateCreditExplanation', () => {
    it('identifies strong collateral', () => {
      const reasons = generateCreditExplanation(500, 50, 100, 400);
      expect(reasons.some(r => r.includes('strong collateral'))).toBe(true);
    });

    it('identifies minimal collateral', () => {
      const reasons = generateCreditExplanation(0.001, 0, 1, 0);
      expect(reasons.some(r => r.includes('minimal collateral'))).toBe(true);
    });

    it('reports request within capacity', () => {
      const reasons = generateCreditExplanation(100, 50, 100, 300, 200, true);
      expect(reasons.some(r => r.includes('within estimated capacity'))).toBe(true);
    });

    it('reports request exceeds capacity', () => {
      const reasons = generateCreditExplanation(10, 5, 10, 50, 200, false);
      expect(reasons.some(r => r.includes('exceeds estimated capacity'))).toBe(true);
    });

    it('identifies moderate collateral', () => {
      const reasons = generateCreditExplanation(5, 10, 100, 100);
      expect(reasons.some(r => r.includes('moderate collateral'))).toBe(true);
    });

    it('identifies month-old account', () => {
      const reasons = generateCreditExplanation(10, 50, 60, 100);
      expect(reasons.some(r => r.includes('month'))).toBe(true);
    });

    it('identifies moderate activity', () => {
      const reasons = generateCreditExplanation(10, 50, 100, 100);
      expect(reasons.some(r => r.includes('moderate activity'))).toBe(true);
    });

    it('identifies limited activity', () => {
      const reasons = generateCreditExplanation(10, 2, 10, 10);
      expect(reasons.some(r => r.includes('limited activity'))).toBe(true);
    });
  });
});
