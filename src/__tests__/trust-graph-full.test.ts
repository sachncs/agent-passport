import { describe, it, expect, vi, beforeEach } from 'vitest';

const VALID_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';
const VALID_B = '7JTDBZA5REDMWGFMYNJRGV24EVRCVZOQ5HKOSSH6KYI6WE6GOAKVAWFC7Y';
const VALID_C = '7RZRWGZHXVKZZDZ3CDGSXLY56J4CTADZMVAP5HFN2GKEPBMAX6TFJRLGUI';
const VALID_D = 'QUYMUXTT5TGNC6QLI6WVJSLAIQHSXOZYIKVNIMIMFGT4XMXJVVKDADJSAQ';

vi.mock('../lib/constants', () => ({
  isValidWallet: (w: string) =>
    typeof w === 'string' &&
    w.length === 58 &&
    /^[A-Z2-7]+$/.test(w),
  MICRO_ALGO: 1_000_000,
}));

vi.mock('../lib/algorand-client', () => ({
  algod: {
    accountInformation: vi.fn(),
    status: vi.fn(),
  },
}));

vi.mock('../lib/timeout', () => ({
  withTimeout: vi.fn(async (p: Promise<unknown>) => p),
  fetchWithTimeout: vi.fn(),
}));

vi.mock('../trust-score', () => ({
  scoreWallet: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../config', () => ({
  config: { indexerUrl: 'https://idx.test' },
}));

import {
  computeWeakestLink,
  computePathRisk,
  computeExposure,
  analyzeTrustGraph,
  simulateSponsorLoss,
  simulateSponsorAdd,
} from '../trust-graph';
import { algod } from '../lib/algorand-client';
import { fetchWithTimeout } from '../lib/timeout';
import { scoreWallet } from '../trust-score';

function mockAccountInfo(balance: bigint = 5_000_000n) {
  return {
    do: vi.fn().mockResolvedValue({ amount: balance }),
  };
}

type TxnStub = {
  receiver?: string;
  amount?: number;
  round?: number;
};

function mockIndexerResponse(txns: TxnStub[] = []) {
  const body = {
    transactions: txns.map((t) => ({
      'payment-transaction': {
        receiver: t.receiver,
        amount: t.amount ?? 1000,
      },
      'confirmed-round': t.round ?? 100,
    })),
  };
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function emptyIndexerResponse() {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ transactions: [] }),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Pure math (already covered in trust-graph.test.ts)

describe('computeWeakestLink', () => {
  it('returns 0 for empty array', () => {
    expect(computeWeakestLink([])).toBe(0);
  });
  it('returns min', () => {
    expect(computeWeakestLink([80, 60, 40])).toBe(40);
  });
});

describe('computePathRisk', () => {
  it('returns weakest link for depth 1', () => {
    expect(computePathRisk(1, 80)).toBe(80);
  });
  it('applies depth penalty and floors at 0', () => {
    expect(computePathRisk(10, 30)).toBe(0);
  });
  it('caps at 100', () => {
    expect(computePathRisk(1, 120)).toBe(100);
  });
});

describe('computeExposure', () => {
  it('returns zeros for no edges', () => {
    const r = computeExposure([], VALID_WALLET);
    expect(r.totalExposure).toBe(0);
    expect(r.directExposure).toBe(0);
    expect(r.indirectExposure).toBe(0);
    expect(r.maxLossIfSponsorFails).toBe(0);
    expect(r.exposureByDepth).toEqual([
      { depth: 1, amount: 0, wallets: 0 },
    ]);
  });
  it('computes direct + indirect', () => {
    const edges = [
      {
        from: VALID_WALLET,
        to: VALID_B,
        amount: 1000,
        round: 1,
      },
      {
        from: VALID_B,
        to: VALID_C,
        amount: 500,
        round: 2,
      },
    ];
    const r = computeExposure(edges, VALID_WALLET);
    expect(r.directExposure).toBe(1000);
    expect(r.indirectExposure).toBe(500);
    expect(r.totalExposure).toBe(1500);
    expect(r.maxLossIfSponsorFails).toBe(1000);
  });
});

// analyzeTrustGraph

describe('analyzeTrustGraph', () => {
  it('returns null for invalid wallet', async () => {
    const result = await analyzeTrustGraph('not-a-wallet');
    expect(result).toBeNull();
  });

  it('returns null for empty string', async () => {
    const result = await analyzeTrustGraph('');
    expect(result).toBeNull();
  });

  it('returns isolated wallet result', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo(1_000_000n));
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValue(emptyIndexerResponse());
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 50 });

    const result = await analyzeTrustGraph(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(result!.nodeCount).toBe(1);
    expect(result!.edges).toEqual([]);
    expect(result!.explanation[0]).toContain('isolated');
    expect(
      result!.explanation.some((e) =>
        e.includes('0 delegation edges'),
      ),
    ).toBe(true);
  });

  it('performs BFS across multiple nodes', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValueOnce(mockAccountInfo(10_000_000n))
      .mockReturnValueOnce(mockAccountInfo(5_000_000n))
      .mockReturnValueOnce(mockAccountInfo(3_000_000n));

    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValueOnce(
      mockIndexerResponse([
        { receiver: VALID_B, amount: 2000, round: 100 },
        { receiver: VALID_C, amount: 3000, round: 101 },
      ]),
    )
      .mockResolvedValueOnce(
        mockIndexerResponse([
          { receiver: VALID_D, amount: 1000, round: 102 },
        ]),
      )
      .mockResolvedValueOnce(emptyIndexerResponse())
      .mockResolvedValueOnce(emptyIndexerResponse());

    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 80 })
      .mockResolvedValue({ trustScore: 60 })
      .mockResolvedValue({ trustScore: 70 })
      .mockResolvedValue({ trustScore: 50 });

    const result = await analyzeTrustGraph(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(result!.nodeCount).toBeGreaterThanOrEqual(3);
    expect(result!.edges.length).toBeGreaterThanOrEqual(3);
    expect(result!.paths.length).toBeGreaterThanOrEqual(2);
    expect(result!.explanation[0]).toContain('wallets');
  });

  it('respects maxDepth limit', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValueOnce(
      mockIndexerResponse([
        { receiver: VALID_B, amount: 1000 },
      ]),
    ).mockResolvedValue(emptyIndexerResponse());
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 50 });

    const result = await analyzeTrustGraph(
      VALID_WALLET,
      1,
    );
    expect(result).not.toBeNull();
    expect(result!.depth).toBeLessThanOrEqual(1);
  });

  it('builds what-if analysis for direct sponsors', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValueOnce(
      mockIndexerResponse([
        { receiver: VALID_B, amount: 5000 },
      ]),
    ).mockResolvedValue(emptyIndexerResponse());
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 50 });

    const result = await analyzeTrustGraph(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(result!.whatIfs.length).toBe(1);
    expect(result!.whatIfs[0].sponsorRemoved).toBe(
      VALID_B,
    );
    expect(result!.whatIfs[0].explanation.length).toBe(2);
  });

  it('handles fetchDelegationEdges error', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockRejectedValue(new Error('network'));
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 0 });

    const result = await analyzeTrustGraph(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(result!.edges).toEqual([]);
  });

  it('handles non-ok indexer response', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValue({ ok: false });
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 0 });

    const result = await analyzeTrustGraph(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(result!.edges).toEqual([]);
  });

  it('handles scoreWallet failure for nodes', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValue(emptyIndexerResponse());
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockRejectedValue(new Error('score fail'));

    const result = await analyzeTrustGraph(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(result!.nodes[0].trustScore).toBe(0);
  });

  it('includes indirect exposure when > 0', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValueOnce(
      mockIndexerResponse([
        { receiver: VALID_B, amount: 1000 },
      ]),
    )
      .mockResolvedValueOnce(
        mockIndexerResponse([
          { receiver: VALID_C, amount: 500 },
        ]),
      )
      .mockResolvedValue(emptyIndexerResponse());
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 50 });

    const result = await analyzeTrustGraph(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(
      result!.explanation.some((e) =>
        e.includes('Indirect exposure'),
      ),
    ).toBe(true);
  });

  it('skips already visited targets in BFS', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValueOnce(
      mockIndexerResponse([
        { receiver: VALID_B, amount: 1000 },
      ]),
    )
      .mockResolvedValueOnce(
        mockIndexerResponse([
          { receiver: VALID_WALLET, amount: 500 },
        ]),
      )
      .mockResolvedValue(emptyIndexerResponse());
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 50 });

    const result = await analyzeTrustGraph(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(result!.nodeCount).toBe(2);
  });

  it('limits to 10 new targets per depth', async () => {
    const wallets = Array.from({ length: 12 }, (_, i) => {
      const c = String.fromCharCode(65 + (i % 26));
      return `GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU${c}`;
    });
    const edges = wallets.map((w) => ({
      receiver: w,
      amount: 100,
    }));

    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValueOnce(mockIndexerResponse(edges))
      .mockResolvedValue(emptyIndexerResponse());
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 50 });

    const result = await analyzeTrustGraph(VALID_WALLET);
    expect(result).not.toBeNull();
    expect(result!.nodeCount).toBeLessThanOrEqual(11);
  });
});

// simulateSponsorLoss

describe('simulateSponsorLoss', () => {
  it('returns null for invalid wallet', async () => {
    expect(
      await simulateSponsorLoss('bad', VALID_B),
    ).toBeNull();
  });

  it('returns null for invalid lostSponsor', async () => {
    expect(
      await simulateSponsorLoss(VALID_WALLET, 'bad'),
    ).toBeNull();
  });

  it('returns null if base analysis fails', async () => {
    expect(
      await simulateSponsorLoss('not-valid', 'also-not'),
    ).toBeNull();
  });

  it('removes edges involving the lost sponsor', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValueOnce(
      mockIndexerResponse([
        { receiver: VALID_B, amount: 2000 },
        { receiver: VALID_C, amount: 3000 },
      ]),
    )
      .mockResolvedValue(emptyIndexerResponse())
      .mockResolvedValue(emptyIndexerResponse());
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 50 });

    const result = await simulateSponsorLoss(
      VALID_WALLET,
      VALID_B,
    );
    expect(result).not.toBeNull();
    expect(
      result!.edges.every(
        (e) => e.from !== VALID_B && e.to !== VALID_B,
      ),
    ).toBe(true);
    expect(result!.whatIfs).toEqual([]);
    expect(
      result!.explanation.some((e) =>
        e.includes('Simulated loss'),
      ),
    ).toBe(true);
  });

  it('filters paths containing lost sponsor', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValueOnce(
      mockIndexerResponse([
        { receiver: VALID_B, amount: 1000 },
      ]),
    ).mockResolvedValue(emptyIndexerResponse());
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 50 });

    const result = await simulateSponsorLoss(
      VALID_WALLET,
      VALID_B,
    );
    expect(result).not.toBeNull();
    expect(
      result!.paths.every(
        (p) => !p.path.includes(VALID_B),
      ),
    ).toBe(true);
  });
});

// simulateSponsorAdd

describe('simulateSponsorAdd', () => {
  it('returns null for invalid wallet', async () => {
    expect(
      await simulateSponsorAdd('bad', VALID_B, 1000),
    ).toBeNull();
  });

  it('returns null for invalid newSponsor', async () => {
    expect(
      await simulateSponsorAdd(
        VALID_WALLET,
        'bad',
        1000,
      ),
    ).toBeNull();
  });

  it('returns null for non-positive amount', async () => {
    expect(
      await simulateSponsorAdd(
        VALID_WALLET,
        VALID_B,
        0,
      ),
    ).toBeNull();
    expect(
      await simulateSponsorAdd(
        VALID_WALLET,
        VALID_B,
        -100,
      ),
    ).toBeNull();
    expect(
      await simulateSponsorAdd(
        VALID_WALLET,
        VALID_B,
        Infinity,
      ),
    ).toBeNull();
    expect(
      await simulateSponsorAdd(
        VALID_WALLET,
        VALID_B,
        NaN,
      ),
    ).toBeNull();
  });

  it('returns null if base analysis fails', async () => {
    expect(
      await simulateSponsorAdd(
        'not-valid',
        'also-not',
        1000,
      ),
    ).toBeNull();
  });

  it('adds a synthetic edge for the new sponsor', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValue(emptyIndexerResponse());
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 50 });

    const result = await simulateSponsorAdd(
      VALID_WALLET,
      VALID_B,
      5_000_000,
    );
    expect(result).not.toBeNull();
    const added = result!.edges.find(
      (e) =>
        e.from === VALID_B &&
        e.to === VALID_WALLET,
    );
    expect(added).toBeDefined();
    expect(added!.amount).toBe(5_000_000);
    expect(
      result!.explanation.some((e) =>
        e.includes('Simulated addition'),
      ),
    ).toBe(true);
    expect(result!.whatIfs).toEqual([]);
  });

  it('increases exposure with new sponsor', async () => {
    const ai = algod.accountInformation as ReturnType<
      typeof vi.fn
    >;
    ai.mockReturnValue(mockAccountInfo());
    const fwt = fetchWithTimeout as ReturnType<typeof vi.fn>;
    fwt.mockResolvedValue(emptyIndexerResponse());
    const sw = scoreWallet as ReturnType<typeof vi.fn>;
    sw.mockResolvedValue({ trustScore: 50 });

    const result = await simulateSponsorAdd(
      VALID_WALLET,
      VALID_B,
      10_000_000,
    );
    expect(result).not.toBeNull();
    expect(result!.exposure.totalExposure).toBe(
      10_000_000,
    );
  });
});
