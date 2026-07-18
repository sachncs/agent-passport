import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePassport, PASSPORT_SCHEMA_VERSION } from '../passport';
import { isValidWallet } from '../lib/constants';

vi.mock('../lib/constants', () => ({
  isValidWallet: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const VALID_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';

function mockModules(opts: {
  algodStatus?: { lastRound: number } | Error;
  trust?: {
    trustScore: number;
    riskLevel: string;
    onChain: Record<string, unknown>;
  } | Error;
  delegation?: { delegation: Record<string, unknown> } | Error;
  sybil?: { sybilRisk: number; riskLevel: string } | Error;
  reputation?: {
    reputation: number;
    riskLevel: string;
    breakdown: Record<string, unknown>;
  } | Error;
  credit?: { estimatedLimit: number; risk: string } | Error;
}) {
  // algorand-client
  if (opts.algodStatus instanceof Error) {
    vi.doMock('../lib/algorand-client', () => ({
      algod: {
        status: () => ({
          do: vi.fn().mockRejectedValue(
            opts.algodStatus,
          ),
        }),
      },
    }));
  } else {
    vi.doMock('../lib/algorand-client', () => ({
      algod: {
        status: () => ({
          do: vi.fn().mockResolvedValue(
            opts.algodStatus ?? { lastRound: 100 },
          ),
        }),
      },
    }));
  }

  // trust-score
  const trustFn = opts.trust instanceof Error
    ? vi.fn().mockRejectedValue(opts.trust)
    : vi.fn().mockResolvedValue(opts.trust ?? {
        trustScore: 75,
        riskLevel: 'low',
        onChain: {
          balanceAlgo: 1000,
          totalTxns: 50,
          accountAgeDays: 365,
          assetCount: 3,
          appCount: 2,
        },
      });
  vi.doMock('../trust-score', () => ({ scoreWalletFresh: trustFn }));

  // delegation
  const delFn = opts.delegation instanceof Error
    ? vi.fn().mockRejectedValue(opts.delegation)
    : vi.fn().mockResolvedValue(opts.delegation ?? {
        delegation: {
          depth: 2,
          sponsorCount: 3,
          totalDelegatedAmount: 5000,
          isTrustAnchor: true,
        },
      });
  vi.doMock('../delegation', () => ({ scoreDelegationFresh: delFn }));

  // sybil
  const sybilFn = opts.sybil instanceof Error
    ? vi.fn().mockRejectedValue(opts.sybil)
    : vi.fn().mockResolvedValue(opts.sybil ?? {
        sybilRisk: 0.1,
        riskLevel: 'low',
      });
  vi.doMock('../sybil', () => ({ detectSybilFresh: sybilFn }));

  // reputation
  const repFn = opts.reputation instanceof Error
    ? vi.fn().mockRejectedValue(opts.reputation)
    : vi.fn().mockResolvedValue(opts.reputation ?? {
        reputation: 80,
        riskLevel: 'low',
        breakdown: { totalEvents: 10 },
      });
  vi.doMock('../reputation', () => ({ computeReputation: repFn }));

  // credit
  const creditFn = opts.credit instanceof Error
    ? vi.fn().mockRejectedValue(opts.credit)
    : vi.fn().mockResolvedValue(opts.credit ?? {
        estimatedLimit: 5000,
        risk: 'low',
      });
  vi.doMock('../credit', () => ({ estimateCreditWithTrust: creditFn }));
}

describe('generatePassport — branch coverage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(isValidWallet).mockReturnValue(true);
  });

  it('returns null for invalid wallet', async () => {
    vi.mocked(isValidWallet).mockReturnValue(false);
    expect(await generatePassport('bad')).toBeNull();
  });

  it('covers algod.status failure path (line 279)', async () => {
    mockModules({ algodStatus: new Error('connection refused') });
    const { generatePassport: gp } = await import('../passport');
    const result = await gp(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(result!.blockRound).toBe(0);
  });

  it('covers algod.status success with falsy lastRound (line 277)', async () => {
    mockModules({ algodStatus: { lastRound: 0 } });
    const { generatePassport: gp } = await import('../passport');
    const result = await gp(VALID_WALLET);
    expect(result!.blockRound).toBe(0);
  });

  it('covers all service catch handlers returning null (lines 286-296)', async () => {
    mockModules({
      trust: new Error('trust down'),
      delegation: new Error('delegation down'),
      sybil: new Error('sybil down'),
      reputation: new Error('reputation down'),
      credit: new Error('credit down'),
    });
    const { generatePassport: gp } = await import('../passport');
    const result = await gp(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(result!.dataSources.trust).toBe(false);
    expect(result!.dataSources.delegation).toBe(false);
    expect(result!.dataSources.sybil).toBe(false);
    expect(result!.dataSources.reputation).toBe(false);
    expect(result!.dataSources.credit).toBe(false);
    expect(result!.trustScore).toBe(0);
    expect(result!.creditLimit).toBe(0);
    expect(result!.sybilRisk).toBe(0);
    expect(result!.reputation).toBe(0);
  });

  it('covers partial service failures (mixed null/non-null)', async () => {
    mockModules({
      trust: { trustScore: 60, riskLevel: 'medium', onChain: { balanceAlgo: 500, totalTxns: 10, accountAgeDays: 30, assetCount: 1, appCount: 0 } },
      delegation: new Error('fail'),
      sybil: { sybilRisk: 0.3, riskLevel: 'medium' },
      reputation: new Error('fail'),
      credit: { estimatedLimit: 1000, risk: 'medium' },
    });
    const { generatePassport: gp } = await import('../passport');
    const result = await gp(VALID_WALLET);
    expect(result!.dataSources.trust).toBe(true);
    expect(result!.dataSources.delegation).toBe(false);
    expect(result!.dataSources.sybil).toBe(true);
    expect(result!.dataSources.reputation).toBe(false);
    expect(result!.dataSources.credit).toBe(true);
  });

  it('covers all services succeeding', async () => {
    mockModules({});
    const { generatePassport: gp } = await import('../passport');
    const result = await gp(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(result!.dataSources.trust).toBe(true);
    expect(result!.dataSources.delegation).toBe(true);
    expect(result!.dataSources.sybil).toBe(true);
    expect(result!.dataSources.reputation).toBe(true);
    expect(result!.dataSources.credit).toBe(true);
    expect(result!.schemaVersion).toBe(PASSPORT_SCHEMA_VERSION);
    expect(result!.checksum).toBeDefined();
    expect(result!.explanation.length).toBeGreaterThanOrEqual(5);
  });
});
