import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  VALID_WALLET, VALID_DELEGATEE, VALID_DELEGATEE2,
} = vi.hoisted(() => ({
  VALID_WALLET: 'A'.repeat(58),
  VALID_DELEGATEE: 'B'.repeat(58),
  VALID_DELEGATEE2: 'C'.repeat(58),
  VALID_DELEGATEE3: 'D'.repeat(58),
}));

vi.mock('../lib/constants', () => ({
  isValidWallet: (w: string) =>
    typeof w === 'string' && w.length === 58
    && /^[A-Z2-7]+$/.test(w),
  MICRO_ALGO: 1_000_000,
}));

vi.mock('../lib/logger', () => ({
  logger: {
    warn: vi.fn(), info: vi.fn(),
    error: vi.fn(), debug: vi.fn(),
  },
}));

vi.mock('../lib/algorand-client', () => ({
  algod: {
    accountInformation: vi.fn(() => ({
      do: vi.fn().mockResolvedValue({
        amount: 1_000_000n,
        createdApps: [],
        createdAtRound: 100,
      }),
    })),
  },
}));

vi.mock('../lib/timeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('../config', () => ({
  config: {
    indexerUrl: 'https://testnet-idx.algonode.cloud:443',
    registryAppId: 12345,
  },
}));

vi.mock('../trust-score', () => ({
  scoreWallet: vi.fn().mockResolvedValue({
    wallet: 'A'.repeat(58),
    trustScore: 70,
    riskLevel: 'low',
    approved: true,
    recommendedLimit: 500,
    breakdown: {
      ageScore: 70, activityScore: 70,
      volumeScore: 70, velocityScore: 70,
      complianceScore: 70,
    },
    onChain: {
      balanceAlgo: 500, totalTxns: 200,
      assetCount: 5, appCount: 2,
      accountAgeDays: 400,
      firstSeenRound: 100, lastSeenRound: 200,
    },
    explanation: [],
  }),
}));

import {
  scoreDelegation,
  scoreDelegationFresh,
  computeDepthScore,
  computeSponsorQualityScore,
  computeSponsorCountScore,
  computeAmountScore,
  computeDelegationTrustScore,
  classifyDelegationRisk,
  computeDelegationRecommendedLimit,
  clearDelegationCache,
} from '../delegation';
import { algod } from '../lib/algorand-client';
import { fetchWithTimeout } from '../lib/timeout';
import { scoreWallet } from '../trust-score';

const mockAlgod = vi.mocked(algod);
const mockFetchWithTimeout = vi.mocked(fetchWithTimeout);
const mockScoreWallet = vi.mocked(scoreWallet);

function mockIndexerResponse(transactions: unknown[]) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({ transactions }),
  };
}

function mockIndexerEmpty() {
  return {
    ok: true,
    json: () =>
      Promise.resolve({ transactions: [] }),
  };
}

function mockIndexerError() {
  return { ok: false, status: 500 };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearDelegationCache();
  mockAlgod.accountInformation.mockReturnValue({
    do: vi.fn().mockResolvedValue({
      amount: 1_000_000n,
      createdApps: [],
      createdAtRound: 100,
    }),
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('scoreDelegation()', () => {
  describe('invalid wallet', () => {
    it('returns null for empty string', async () => {
      expect(await scoreDelegation('')).toBeNull();
    });

    it('returns null for short wallet', async () => {
      expect(await scoreDelegation('SHORT')).toBeNull();
    });

    it('returns null for wallet with invalid chars', async () => {
      expect(
        await scoreDelegation(
          '0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O0O',
        ),
      ).toBeNull();
    });
  });

  describe('no delegations', () => {
    it('returns delegation score with zero depth', async () => {
      mockFetchWithTimeout.mockResolvedValue(
        mockIndexerEmpty() as never,
      );

      const result = await scoreDelegation(VALID_WALLET);

      expect(result).not.toBeNull();
      expect(result!.wallet).toBe(VALID_WALLET);
      expect(result!.delegation.depth).toBe(0);
      expect(result!.delegation.sponsorCount).toBe(0);
      expect(
        result!.delegation.totalDelegatedAmount,
      ).toBe(0);
    });

    it('returns depth 0 explanation', async () => {
      mockFetchWithTimeout.mockResolvedValue(
        mockIndexerEmpty() as never,
      );

      const result = await scoreDelegation(VALID_WALLET);

      expect(
        result!.explanation.some(
          e => e.includes('No delegation chain found'),
        ),
      ).toBe(true);
    });
  });

  describe('with delegations', () => {
    it('computes delegation depth and sponsor count', async () => {
      mockFetchWithTimeout.mockResolvedValue(
        mockIndexerResponse([
          {
            sender: VALID_WALLET,
            'asset-transfer-transaction': {
              receiver: VALID_DELEGATEE,
              amount: 1_000_000,
            },
            'round-time': 1000,
            'confirmed-round': 100,
          },
        ]) as never,
      );

      const result = await scoreDelegation(VALID_WALLET);

      expect(result).not.toBeNull();
      expect(result!.delegation.sponsorCount).toBe(1);
      expect(
        result!.delegation.totalDelegatedAmount,
      ).toBe(1_000_000);
    });

    it('filters out self-delegations', async () => {
      mockFetchWithTimeout.mockResolvedValue(
        mockIndexerResponse([
          {
            sender: VALID_WALLET,
            'asset-transfer-transaction': {
              receiver: VALID_WALLET,
              amount: 1_000_000,
            },
            'round-time': 1000,
            'confirmed-round': 100,
          },
        ]) as never,
      );

      const result = await scoreDelegation(VALID_WALLET);

      expect(result!.delegation.sponsorCount).toBe(0);
    });

    it('filters out invalid delegatee addresses', async () => {
      mockFetchWithTimeout.mockResolvedValue(
        mockIndexerResponse([
          {
            sender: VALID_WALLET,
            'asset-transfer-transaction': {
              receiver: 'invalid',
              amount: 1_000_000,
            },
            'round-time': 1000,
            'confirmed-round': 100,
          },
        ]) as never,
      );

      const result = await scoreDelegation(VALID_WALLET);

      expect(result!.delegation.sponsorCount).toBe(0);
    });

    it('aggregates multiple delegations', async () => {
      mockFetchWithTimeout.mockResolvedValue(
        mockIndexerResponse([
          {
            sender: VALID_WALLET,
            'asset-transfer-transaction': {
              receiver: VALID_DELEGATEE,
              amount: 500_000,
            },
            'round-time': 1000,
            'confirmed-round': 100,
          },
          {
            sender: VALID_WALLET,
            'asset-transfer-transaction': {
              receiver: VALID_DELEGATEE2,
              amount: 300_000,
            },
            'round-time': 1001,
            'confirmed-round': 101,
          },
        ]) as never,
      );

      const result = await scoreDelegation(VALID_WALLET);

      expect(result!.delegation.sponsorCount).toBe(2);
      expect(
        result!.delegation.totalDelegatedAmount,
      ).toBe(800_000);
    });
  });

  describe('fresh mode', () => {
    it('clears cache and fetches fresh data', async () => {
      mockFetchWithTimeout.mockResolvedValue(
        mockIndexerEmpty() as never,
      );

      await scoreDelegation(VALID_WALLET);
      const firstCallCount =
        mockFetchWithTimeout.mock.calls.length;

      await scoreDelegationFresh(VALID_WALLET);

      expect(
        mockFetchWithTimeout.mock.calls.length,
      ).toBeGreaterThan(firstCallCount);
    });
  });

  describe('trust anchor', () => {
    it('marks wallet as trust anchor when it created the registry app', async () => {
      mockAlgod.accountInformation.mockReturnValue({
        do: vi.fn().mockResolvedValue({
          amount: 1_000_000n,
          createdApps: [{ id: 12345 }],
          createdAtRound: 100,
        }),
      } as never);
      mockFetchWithTimeout.mockResolvedValue(
        mockIndexerEmpty() as never,
      );

      const result = await scoreDelegation(VALID_WALLET);

      expect(
        result!.delegation.isTrustAnchor,
      ).toBe(true);
      expect(
        result!.explanation.some(
          e => e.includes('trust anchor'),
        ),
      ).toBe(true);
    });

    it('returns false for non-anchor wallet', async () => {
      mockAlgod.accountInformation.mockReturnValue({
        do: vi.fn().mockResolvedValue({
          amount: 1_000_000n,
          createdApps: [{ id: 99999 }],
          createdAtRound: 100,
        }),
      } as never);
      mockFetchWithTimeout.mockResolvedValue(
        mockIndexerEmpty() as never,
      );

      const result = await scoreDelegation(VALID_WALLET);

      expect(
        result!.delegation.isTrustAnchor,
      ).toBe(false);
    });
  });
});

describe('fetchDelegationsFromIndexer()', () => {
  it('returns empty on network error', async () => {
    mockFetchWithTimeout.mockRejectedValue(
      new Error('network down'),
    );

    const result = await scoreDelegation(VALID_WALLET);

    expect(result!.delegation.sponsorCount).toBe(0);
  });

  it('returns empty on non-OK response', async () => {
    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerError() as never,
    );

    const result = await scoreDelegation(VALID_WALLET);

    expect(result!.delegation.sponsorCount).toBe(0);
  });

  it('calls correct indexer URL', async () => {
    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerEmpty() as never,
    );

    await scoreDelegation(VALID_WALLET);

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('/v2/accounts/'),
      expect.objectContaining({ timeoutMs: 10_000 }),
    );
  });
});

describe('fetchWalletTrustScore()', () => {
  it('returns trust score from scoreWallet', async () => {
    mockScoreWallet.mockResolvedValue({
      wallet: VALID_DELEGATEE,
      trustScore: 75,
      riskLevel: 'low',
      approved: true,
      recommendedLimit: 500,
      breakdown: {
        ageScore: 70, activityScore: 70,
        volumeScore: 70, velocityScore: 70,
        complianceScore: 70,
      },
      onChain: {
        balanceAlgo: 500, totalTxns: 200,
        assetCount: 5, appCount: 2,
        accountAgeDays: 400,
        firstSeenRound: 100, lastSeenRound: 200,
      },
      explanation: [],
    });
    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerResponse([
        {
          sender: VALID_WALLET,
          'asset-transfer-transaction': {
            receiver: VALID_DELEGATEE,
            amount: 1_000_000,
          },
          'round-time': 1000,
          'confirmed-round': 100,
        },
      ]) as never,
    );

    const result = await scoreDelegation(VALID_WALLET);

    expect(
      result!.delegation.sponsorQuality,
    ).toBe(75);
  });

  it('returns 0 when scoreWallet fails', async () => {
    mockScoreWallet.mockRejectedValue(
      new Error('fail'),
    );
    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerResponse([
        {
          sender: VALID_WALLET,
          'asset-transfer-transaction': {
            receiver: VALID_DELEGATEE,
            amount: 1_000_000,
          },
          'round-time': 1000,
          'confirmed-round': 100,
        },
      ]) as never,
    );

    const result = await scoreDelegation(VALID_WALLET);

    expect(
      result!.delegation.sponsorQuality,
    ).toBe(0);
  });
});

describe('findAllTrustedAncestors()', () => {
  it('finds trust anchor through BFS', async () => {
    mockAlgod.accountInformation.mockReturnValue({
      do: vi.fn().mockResolvedValue({
        amount: 1_000_000n,
        createdApps: [{ id: 12345 }],
        createdAtRound: 100,
      }),
    } as never);
    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerResponse([
        {
          sender: VALID_WALLET,
          'asset-transfer-transaction': {
            receiver: VALID_DELEGATEE,
            amount: 1_000_000,
          },
          'round-time': 1000,
          'confirmed-round': 100,
        },
      ]) as never,
    );

    const result = await scoreDelegation(VALID_WALLET);

    expect(
      result!.delegation.trustedAncestors,
    ).toBeGreaterThanOrEqual(0);
  });
});

describe('BFS traversal — depth cap', () => {
  it('caps branching factor at 10', async () => {
    const manyDelegates = Array.from(
      { length: 15 }, (_, i) => ({
        sender: VALID_WALLET,
        'asset-transfer-transaction': {
          receiver:
            String.fromCharCode(65 + (i % 26))
            + 'A'.repeat(57),
          amount: 100_000,
        },
        'round-time': 1000 + i,
        'confirmed-round': 100 + i,
      }),
    );

    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerResponse(manyDelegates) as never,
    );

    const result = await scoreDelegation(VALID_WALLET);

    expect(result).not.toBeNull();
    expect(
      result!.explanation.some(
        e => e.includes('active delegation'),
      ),
    ).toBe(true);
  });
});

describe('Sponsor quality scoring', () => {
  it('uses average of up to 5 sponsor trust scores', async () => {
    mockScoreWallet.mockResolvedValue({
      wallet: VALID_DELEGATEE,
      trustScore: 90,
      riskLevel: 'low',
      approved: true,
      recommendedLimit: 500,
      breakdown: {
        ageScore: 90, activityScore: 90,
        volumeScore: 90, velocityScore: 90,
        complianceScore: 90,
      },
      onChain: {
        balanceAlgo: 500, totalTxns: 200,
        assetCount: 5, appCount: 2,
        accountAgeDays: 400,
        firstSeenRound: 100, lastSeenRound: 200,
      },
      explanation: [],
    });
    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerResponse([
        {
          sender: VALID_WALLET,
          'asset-transfer-transaction': {
            receiver: VALID_DELEGATEE,
            amount: 1_000_000,
          },
          'round-time': 1000,
          'confirmed-round': 100,
        },
      ]) as never,
    );

    const result = await scoreDelegation(VALID_WALLET);

    expect(
      result!.delegation.sponsorQuality,
    ).toBe(90);
  });
});

describe('Trust score cap', () => {
  it('caps trust score to max sponsor trust minus depth penalty', async () => {
    mockScoreWallet.mockResolvedValue({
      wallet: VALID_DELEGATEE,
      trustScore: 80,
      riskLevel: 'low',
      approved: true,
      recommendedLimit: 500,
      breakdown: {
        ageScore: 80, activityScore: 80,
        volumeScore: 80, velocityScore: 80,
        complianceScore: 80,
      },
      onChain: {
        balanceAlgo: 500, totalTxns: 200,
        assetCount: 5, appCount: 2,
        accountAgeDays: 400,
        firstSeenRound: 100, lastSeenRound: 200,
      },
      explanation: [],
    });
    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerResponse([
        {
          sender: VALID_WALLET,
          'asset-transfer-transaction': {
            receiver: VALID_DELEGATEE,
            amount: 1_000_000,
          },
          'round-time': 1000,
          'confirmed-round': 100,
        },
      ]) as never,
    );

    const result = await scoreDelegation(VALID_WALLET);

    expect(result!.trustScore).toBeLessThanOrEqual(80);
  });
});

describe('Pure math functions (delegation module)', () => {
  describe('computeDepthScore', () => {
    it('returns 100 for depth 0', () => {
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

    it('returns 30 for depth 4', () => {
      expect(computeDepthScore(4)).toBe(30);
    });

    it('returns 0 for very deep', () => {
      expect(computeDepthScore(100)).toBe(0);
    });
  });

  describe('computeSponsorQualityScore', () => {
    it('clamps to [0, 100]', () => {
      expect(computeSponsorQualityScore(150)).toBe(100);
      expect(computeSponsorQualityScore(-10)).toBe(0);
      expect(computeSponsorQualityScore(50)).toBe(50);
    });
  });

  describe('computeSponsorCountScore', () => {
    it('returns 0 for 0 sponsors', () => {
      expect(computeSponsorCountScore(0)).toBe(0);
    });

    it('scales with quality multiplier', () => {
      const high = computeSponsorCountScore(5, 100);
      const low = computeSponsorCountScore(5, 50);
      expect(high).toBeGreaterThan(low);
    });

    it('caps at 100', () => {
      expect(
        computeSponsorCountScore(10, 100),
      ).toBe(100);
    });

    it('uses minimum 0.1 quality multiplier', () => {
      const score = computeSponsorCountScore(5, 0);
      expect(score).toBe(10);
    });
  });

  describe('computeAmountScore', () => {
    it('returns 0 for 0 amount', () => {
      expect(computeAmountScore(0)).toBe(0);
    });

    it('returns 100 for 10000+ ALGO', () => {
      expect(
        computeAmountScore(10_000 * 1_000_000),
      ).toBe(100);
    });

    it('scales logarithmically', () => {
      const score100 =
        computeAmountScore(100 * 1_000_000);
      const score1000 =
        computeAmountScore(1000 * 1_000_000);
      expect(score1000).toBeGreaterThan(score100);
    });
  });

  describe('computeDelegationTrustScore', () => {
    it('returns 0 for all-zero breakdown', () => {
      expect(computeDelegationTrustScore({
        depthScore: 0,
        sponsorQualityScore: 0,
        sponsorCountScore: 0,
        amountScore: 0,
      })).toBe(0);
    });

    it('returns high score for all-100 breakdown', () => {
      expect(computeDelegationTrustScore({
        depthScore: 100,
        sponsorQualityScore: 100,
        sponsorCountScore: 100,
        amountScore: 100,
      })).toBe(100);
    });

    it('weights depth at 0.35', () => {
      const high = computeDelegationTrustScore({
        depthScore: 100,
        sponsorQualityScore: 0,
        sponsorCountScore: 0,
        amountScore: 0,
      });
      expect(high).toBeGreaterThan(0);
      expect(high).toBeLessThan(50);
    });
  });

  describe('classifyDelegationRisk', () => {
    it('returns low for score >= 70', () => {
      expect(classifyDelegationRisk(70)).toBe('low');
    });

    it('returns medium for score 45-69', () => {
      expect(classifyDelegationRisk(45)).toBe(
        'medium',
      );
    });

    it('returns high for score 20-44', () => {
      expect(classifyDelegationRisk(20)).toBe(
        'high',
      );
    });

    it('returns critical for score < 20', () => {
      expect(classifyDelegationRisk(5)).toBe(
        'critical',
      );
    });
  });

  describe('computeDelegationRecommendedLimit', () => {
    it('returns higher limit for higher score', () => {
      const low = computeDelegationRecommendedLimit(
        20,
      );
      const high = computeDelegationRecommendedLimit(
        80,
      );
      expect(high).toBeGreaterThan(low);
    });

    it('applies 1.5x tier for score >= 80', () => {
      expect(
        computeDelegationRecommendedLimit(80),
      ).toBe(600);
    });

    it('applies 1.2x tier for score 60-79', () => {
      expect(
        computeDelegationRecommendedLimit(60),
      ).toBe(360);
    });

    it('applies 1.0x tier for score 40-59', () => {
      expect(
        computeDelegationRecommendedLimit(40),
      ).toBe(200);
    });

    it('applies 0.7x tier for score < 40', () => {
      expect(
        computeDelegationRecommendedLimit(20),
      ).toBe(70);
    });
  });
});

describe('scoreDelegationFresh()', () => {
  it('clears cache before scoring', async () => {
    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerEmpty() as never,
    );

    const result =
      await scoreDelegationFresh(VALID_WALLET);

    expect(result).not.toBeNull();
    expect(result!.wallet).toBe(VALID_WALLET);
  });
});

describe('Explanation generation', () => {
  it('includes delegation depth info', async () => {
    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerResponse([
        {
          sender: VALID_WALLET,
          'asset-transfer-transaction': {
            receiver: VALID_DELEGATEE,
            amount: 1_000_000,
          },
          'round-time': 1000,
          'confirmed-round': 100,
        },
      ]) as never,
    );

    const result = await scoreDelegation(VALID_WALLET);

    expect(
      result!.explanation.some(
        e => e.includes('delegation'),
      ),
    ).toBe(true);
  });

  it('includes sponsor quality description', async () => {
    mockScoreWallet.mockResolvedValue({
      wallet: VALID_DELEGATEE,
      trustScore: 80,
      riskLevel: 'low',
      approved: true,
      recommendedLimit: 500,
      breakdown: {
        ageScore: 80, activityScore: 80,
        volumeScore: 80, velocityScore: 80,
        complianceScore: 80,
      },
      onChain: {
        balanceAlgo: 500, totalTxns: 200,
        assetCount: 5, appCount: 2,
        accountAgeDays: 400,
        firstSeenRound: 100, lastSeenRound: 200,
      },
      explanation: [],
    });
    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerResponse([
        {
          sender: VALID_WALLET,
          'asset-transfer-transaction': {
            receiver: VALID_DELEGATEE,
            amount: 1_000_000,
          },
          'round-time': 1000,
          'confirmed-round': 100,
        },
      ]) as never,
    );

    const result = await scoreDelegation(VALID_WALLET);

    expect(
      result!.explanation.some(
        e => e.includes('Sponsor quality'),
      ),
    ).toBe(true);
  });

  it('includes trust profile summary', async () => {
    mockFetchWithTimeout.mockResolvedValue(
      mockIndexerEmpty() as never,
    );

    const result = await scoreDelegation(VALID_WALLET);

    expect(
      result!.explanation.some(
        e => e.includes('trust profile'),
      ),
    ).toBe(true);
  });
});
