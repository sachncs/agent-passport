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
  scoreWalletFresh: vi.fn(),
  applySybilPenalty: (score: number, risk: number) => {
    if (risk < 0.45) return score;
    if (risk < 0.70) return Math.round(score * 0.8 * 10) / 10;
    return Math.round(score * 0.5 * 10) / 10;
  },
}));

vi.mock('../delegation', () => ({
  scoreDelegationFresh: vi.fn(),
}));

vi.mock('../credit', () => ({
  estimateCreditWithTrust: vi.fn(),
}));

vi.mock('../sybil', () => ({
  detectSybilFresh: vi.fn(),
}));

vi.mock('../reputation', () => ({
  computeReputation: vi.fn(),
}));

vi.mock('../lib/sanctions', () => ({
  checkSanctions: vi.fn(),
}));

vi.mock('../lib/system-exposure', () => ({
  addSystemExposure: vi.fn((_: string, amount: number) => amount),
  capToSystemCapacity: vi.fn((_: string, amount: number) => amount),
  resetSystemExposure: vi.fn(),
  getSystemExposure: vi.fn(() => 0),
  getWalletExposure: vi.fn(() => 0),
}));

import { underwrite } from '../underwriting';
import { scoreWalletFresh } from '../trust-score';
import { scoreDelegationFresh } from '../delegation';
import { estimateCreditWithTrust } from '../credit';
import { detectSybilFresh } from '../sybil';
import { computeReputation } from '../reputation';
import { checkSanctions } from '../lib/sanctions';
import { addSystemExposure, capToSystemCapacity } from '../lib/system-exposure';

const mockScoreWalletFresh = vi.mocked(scoreWalletFresh);
const mockScoreDelegationFresh = vi.mocked(scoreDelegationFresh);
const mockEstimateCreditWithTrust = vi.mocked(estimateCreditWithTrust);
const mockDetectSybilFresh = vi.mocked(detectSybilFresh);
const mockComputeReputation = vi.mocked(computeReputation);
const mockCheckSanctions = vi.mocked(checkSanctions);
const mockAddSystemExposure = vi.mocked(addSystemExposure);
const mockCapToSystemCapacity = vi.mocked(capToSystemCapacity);

function trustResult(overrides: Record<string, unknown> = {}) {
  return {
    wallet: VALID_WALLET,
    trustScore: 70,
    riskLevel: 'low' as const,
    approved: true,
    recommendedLimit: 500,
    breakdown: {
      ageScore: 70,
      activityScore: 70,
      volumeScore: 70,
      velocityScore: 70,
      complianceScore: 70,
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

function delegationResult(overrides: Record<string, unknown> = {}) {
  return {
    wallet: VALID_WALLET,
    trustScore: 60,
    riskLevel: 'medium' as const,
    approved: true,
    recommendedLimit: 300,
    breakdown: {
      depthScore: 60,
      sponsorQualityScore: 60,
      sponsorCountScore: 60,
      amountScore: 60,
    },
    delegation: {
      depth: 1,
      sponsorCount: 2,
      sponsorQuality: 60,
      delegationPath: [VALID_WALLET],
      totalDelegatedAmount: 1_000_000,
      isTrustAnchor: false,
      trustedAncestors: 0,
    },
    explanation: [],
    ...overrides,
  };
}

function creditResult(overrides: Record<string, unknown> = {}) {
  return {
    wallet: VALID_WALLET,
    estimatedLimit: 800,
    risk: 'medium' as const,
    confidence: 0.76,
    approved: true,
    breakdown: {
      balanceCapacity: 500,
      activityBonus: 200,
      ageBonus: 150,
      riskPenalty: 50,
    },
    explanation: [],
    ...overrides,
  };
}

function sybilResult(overrides: Record<string, unknown> = {}) {
  return {
    wallet: VALID_WALLET,
    sybilRisk: 0.15,
    riskLevel: 'low' as const,
    confidence: 0.85,
    clusterSize: 1,
    signals: {
      creationClustering: 0, interactionDensity: 0, balanceSimilarity: 0,
      circularActivity: 0, timingRegularity: 0, amountFingerprint: 0,
      fundingCorrelation: 0, neighborhoodClustering: 0, hubScore: 0,
      intermediateDensity: 0, componentRatio: 0, temporalCorrelation: 0,
    },
    flaggedWallets: [],
    explanation: [],
    ...overrides,
  };
}

function reputationResult(overrides: Record<string, unknown> = {}) {
  return {
    wallet: VALID_WALLET,
    reputation: 65,
    riskLevel: 'medium' as const,
    confidence: 0.80,
    breakdown: {
      successfulPayments: 10,
      successfulPurchases: 5,
      disputes: 1,
      refunds: 0,
      sponsorEndorsements: 2,
      serviceInteractions: 3,
      totalEvents: 21,
      positiveEvents: 20,
      negativeEvents: 1,
    },
    explanation: [],
    ...overrides,
  };
}

function sanctionsAllowed() {
  return { status: 'allowed' as const, provider: 'memory', checkedAt: new Date().toISOString() };
}

function sanctionsDenied(reason = 'wallet_on_deny_list') {
  return { status: 'denied' as const, reason, provider: 'memory', checkedAt: new Date().toISOString() };
}

function sanctionsUnknown() {
  return { status: 'unknown' as const, reason: 'screening_provider_unavailable', provider: 'memory', checkedAt: new Date().toISOString() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCapToSystemCapacity.mockImplementation(
    (_: string, amount: number) => amount,
  );
  mockAddSystemExposure.mockImplementation(
    (_: string, amount: number) => amount,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('underwrite()', () => {
  describe('invalid wallet', () => {
    it('returns null for empty string', async () => {
      expect(await underwrite('')).toBeNull();
    });

    it('returns null for short wallet', async () => {
      expect(await underwrite('SHORT')).toBeNull();
    });

    it('returns null for wallet with invalid chars', async () => {
      expect(await underwrite('0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O')).toBeNull();
    });
  });

  describe('all services succeed', () => {
    it('returns approved decision with all factors', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result).not.toBeNull();
      expect(result!.wallet).toBe(VALID_WALLET);
      expect(result!.approved).toBe(true);
      expect(result!.factors).toHaveLength(4);
      expect(result!.factors.map(f => f.name)).toEqual([
        'Trust Score', 'Delegation Trust', 'Sybil Resistance', 'Reputation',
      ]);
      expect(result!.sanctions!.status).toBe('allowed');
      expect(result!.recommendedLimit).toBeGreaterThan(0);
    });

    it('includes compositeScore and riskLevel', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result!.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result!.compositeScore).toBeLessThanOrEqual(100);
      expect(['low', 'medium', 'high', 'critical']).toContain(result!.riskLevel);
    });

    it('passes trust result to estimateCreditWithTrust', async () => {
      const trust = trustResult();
      mockScoreWalletFresh.mockResolvedValue(trust as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      await underwrite(VALID_WALLET);

      expect(mockEstimateCreditWithTrust)
        .toHaveBeenCalledWith(VALID_WALLET, trust);
    });

    it('calls capToSystemCapacity and addSystemExposure', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      await underwrite(VALID_WALLET);

      expect(mockCapToSystemCapacity).toHaveBeenCalled();
      expect(mockAddSystemExposure).toHaveBeenCalled();
    });
  });

  describe('partial failures', () => {
    it('continues when scoreWalletFresh fails', async () => {
      mockScoreWalletFresh.mockRejectedValue(new Error('algod down'));
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result).not.toBeNull();
      expect(result!.factors).toHaveLength(4);
      expect(result!.factors[0].score).toBe(0);
    });

    it('continues when delegation fails', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockRejectedValue(new Error('timeout'));
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result).not.toBeNull();
      expect(result!.factors[1].score).toBe(0);
    });

    it('continues when credit fails', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockRejectedValue(new Error('fail'));
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result).not.toBeNull();
      expect(result!.recommendedLimit).toBe(0);
    });

    it('continues when sybil fails', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockRejectedValue(new Error('fail'));
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result).not.toBeNull();
      expect(result!.factors[2].score).toBe(50);
    });

    it('continues when reputation fails', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockRejectedValue(new Error('fail'));
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result).not.toBeNull();
      expect(result!.factors[3].score).toBe(0);
    });
  });

  describe('sanctions', () => {
    it('denies when sanctions status is denied', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsDenied());

      const result = await underwrite(VALID_WALLET);

      expect(result!.approved).toBe(false);
      expect(result!.recommendedLimit).toBe(0);
      expect(result!.sanctions!.status).toBe('denied');
    });

    it('denies when sanctions status is unknown', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsUnknown());

      const result = await underwrite(VALID_WALLET);

      expect(result!.approved).toBe(false);
      expect(result!.sanctions!.status).toBe('unknown');
    });
  });

  describe('system capacity exceeded', () => {
    it('caps recommendedLimit to system capacity', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());
      mockCapToSystemCapacity.mockReturnValue(100);

      const result = await underwrite(VALID_WALLET);

      expect(result!.recommendedLimit).toBe(100);
    });

    it('returns 0 when capToSystemCapacity returns 0', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());
      mockCapToSystemCapacity.mockReturnValue(0);

      const result = await underwrite(VALID_WALLET);

      expect(result!.recommendedLimit).toBe(0);
    });

    it('does not call addSystemExposure when not approved', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh
        .mockResolvedValue(
          sybilResult({ sybilRisk: 0.8 }) as never,
        );
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result!.approved).toBe(false);
      expect(mockAddSystemExposure).not.toHaveBeenCalled();
    });
  });

  describe('all services fail', () => {
    it('returns decision with zeroed factors', async () => {
      mockScoreWalletFresh.mockRejectedValue(new Error('down'));
      mockScoreDelegationFresh.mockRejectedValue(new Error('down'));
      mockEstimateCreditWithTrust.mockRejectedValue(new Error('down'));
      mockDetectSybilFresh.mockRejectedValue(new Error('down'));
      mockComputeReputation.mockRejectedValue(new Error('down'));
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result).not.toBeNull();
      expect(result!.factors).toHaveLength(4);
      expect(result!.factors[0].score).toBe(0);
      expect(result!.factors[1].score).toBe(0);
      expect(result!.factors[3].score).toBe(0);
    });
  });

  describe('factor statuses', () => {
    it('sets positive status for high scores', async () => {
      mockScoreWalletFresh
        .mockResolvedValue(
          trustResult({ trustScore: 80 }) as never,
        );
      mockScoreDelegationFresh
        .mockResolvedValue(
          delegationResult({ trustScore: 80 }) as never,
        );
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh
        .mockResolvedValue(
          sybilResult({ sybilRisk: 0.05 }) as never,
        );
      mockComputeReputation
        .mockResolvedValue(
          reputationResult({ reputation: 80 }) as never,
        );
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result!.factors[0].status).toBe('positive');
      expect(result!.factors[1].status).toBe('positive');
      expect(result!.factors[3].status).toBe('positive');
    });

    it('sets negative status for low scores', async () => {
      mockScoreWalletFresh
        .mockResolvedValue(
          trustResult({ trustScore: 10 }) as never,
        );
      mockScoreDelegationFresh
        .mockResolvedValue(
          delegationResult({ trustScore: 10 }) as never,
        );
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh
        .mockResolvedValue(
          sybilResult({ sybilRisk: 0.9 }) as never,
        );
      mockComputeReputation
        .mockResolvedValue(
          reputationResult({ reputation: 5 }) as never,
        );
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result!.factors[0].status).toBe('negative');
      expect(result!.factors[1].status).toBe('negative');
      expect(result!.factors[3].status).toBe('negative');
    });
  });

  describe('explanation generation', () => {
    it('generates explanation with positive and negative signals', async () => {
      mockScoreWalletFresh
        .mockResolvedValue(
          trustResult({ trustScore: 80 }) as never,
        );
      mockScoreDelegationFresh
        .mockResolvedValue(
          delegationResult({ trustScore: 20 }) as never,
        );
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh
        .mockResolvedValue(
          sybilResult({ sybilRisk: 0.05 }) as never,
        );
      mockComputeReputation
        .mockResolvedValue(
          reputationResult({ reputation: 80 }) as never,
        );
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result!.explanation.length).toBeGreaterThan(0);
      expect(result!.explanation.some(e => e.includes('Approved') || e.includes('Denied'))).toBe(true);
    });
  });

  describe('sybil penalty integration', () => {
    it('applies sybil penalty to trust factor when risk is high', async () => {
      mockScoreWalletFresh
        .mockResolvedValue(
          trustResult({ trustScore: 80 }) as never,
        );
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh
        .mockResolvedValue(
          sybilResult({ sybilRisk: 0.5 }) as never,
        );
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result!.factors[0].score).toBe(64);
    });

    it('halves trust factor when sybil risk is critical', async () => {
      mockScoreWalletFresh
        .mockResolvedValue(
          trustResult({ trustScore: 80 }) as never,
        );
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh
        .mockResolvedValue(
          sybilResult({ sybilRisk: 0.8 }) as never,
        );
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result!.factors[0].score).toBe(40);
    });
  });

  describe('denied path — no addSystemExposure', () => {
    it('does not commit exposure when approved is false', async () => {
      mockScoreWalletFresh.mockResolvedValue(trustResult() as never);
      mockScoreDelegationFresh.mockResolvedValue(delegationResult() as never);
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation.mockResolvedValue(reputationResult() as never);
      mockCheckSanctions.mockResolvedValue(sanctionsDenied());

      await underwrite(VALID_WALLET);

      expect(mockAddSystemExposure).not.toHaveBeenCalled();
    });
  });

  describe('confidence', () => {
    it('returns higher confidence when all factors have data', async () => {
      mockScoreWalletFresh
        .mockResolvedValue(
          trustResult({ trustScore: 80 }) as never,
        );
      mockScoreDelegationFresh
        .mockResolvedValue(
          delegationResult({ trustScore: 80 }) as never,
        );
      mockEstimateCreditWithTrust.mockResolvedValue(creditResult() as never);
      mockDetectSybilFresh.mockResolvedValue(sybilResult() as never);
      mockComputeReputation
        .mockResolvedValue(
          reputationResult({ reputation: 80 }) as never,
        );
      mockCheckSanctions.mockResolvedValue(sanctionsAllowed());

      const result = await underwrite(VALID_WALLET);

      expect(result!.confidence).toBe(0.95);
    });
  });
});
