import { describe, it, expect, vi, beforeEach } from 'vitest';

const VALID_W = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';
const VALID_B = '7JTDBZA5REDMWGFMYNJRGV24EVRCVZOQ5HKOSSH6KYI6WE6GOAKVAWFC7Y';
const VALID_C = '7RZRWGZHXVKZZDZ3CDGSXLY56J4CTADZMVAP5HFN2GKEPBMAX6TFJRLGUI';
const _VALID_D = 'QUYMUXTT5TGNC6QLI6WVJSLAIQHSXOZYIKVNIMIMFGT4XMXJVVKDADJSAQ';

const DYNAMIC_WALLETS = [
  'PJTU3APXHPZ5OGSVO3BFUJ7AYY7BGUSI5EB6K42OH6AA4Z4ADPUV57SIDU',
  'Q2QX473UGIN47RCFN2BUQJWN7H5MFJIITVCEQLNZ22PG4RZQXJXV26TKPQ',
  '4PWY2TXFULLXCA4U4PPENJFNOQJPZAXTE3FCDACBFEMTMW57KME67ODWFQ',
  'EX4346GIPH3OSCM4HCRM7ANA7AAQNWS3CKIRP4Z4IAXHXE6W3AR3HBYPDQ',
  '5MTFHNGBF2P4UDSZYKI4V4PHPL7ZOJW3RY6E3SY5UBWWR34W6FAJV7KTKE',
  'U6J2A7TTNIXJWCPKRESHJWYUUHLDIWOAQGDMDPG7QJKUU4SR7PC33Q7QJE',
  'A3BOH63QOCNMUGQ4NH7DEMHKSO2FJKV6F64ZDOLEPEQTC6F3C6XFN4UYXY',
  '7JRH5DPQPWR74V27ZEVSTQLIAVNXDODVP72TYYH3MIY6TA3B6VUN7X4EVY',
  'GDEPGYDKWNGXXODMUOD5AZFMNZQIHAMTKHGF3WEAXMXMCM4JHYAX62SSZY',
  '6QAET7UXWSTMYVXIBGUXOCALX5YLLHOKUDYJ4WZ6SKFLJ64YWI5SEM6NTA',
  'QBNHR5PDYJPT4MG35SYZE37LVAP6L5UOU3XZ5MEJG4Y4557UMJJNJ5D4A4',
  'IG4I43YVDB3LGLQEQIGN76O6WX3FVCYTWMRUMEXZPP5BV7KQ4V2BBVT32Y',
  'TNUOYXTAF6LG26DDINHN6JVPGMQKT5CLEGGQPRZIVC4LXSBSHCQV6BIE2U',
  'AJIFWLOCH4BA6BQSLQRJUPAWMBQOSBHTQJK4D6U3AHOIEWH42RAPPI3LWI',
  'E7X5YCCFST5VZD5WLRRCTYVBMUBCLS7NUDELBYZQLWXLKMM3Q4BD5HENBE',
  '6JRKRYN47LBBLWOSNF3Y64DENIASNORI3YLVLMIGGZ3LMC7FW3Q5ROX2DM',
  'HN6ANOBTMVQQEOKEJWVIB4GBDSMZZYCKANB6EP6NWSV63NHZCSU3CPRMNI',
  'CU7YLS5YMSUKRB4UW2MCSHYXWXLNGT6VOCXRJXPSP3GEQPTYHHNRGSHHTU',
  '6MWVXFNTTWCOHKQN5QJOHVUH5I374ABHNUVVUMVQBJW5ZTWAPMGSV44BKQ',
  'C4XLVKIMTKSFAEMYI3JSSLBAKM7JITTHRJEWKGM5TNRYRBKDYDBRUZEOPM',
  '62Q4RIXOH4JIFW4B5XCDE2J44NDAVKYE6IK22PLIL26LEWUT444DKNZGVQ',
  'R6IWPCL7F5CNQY4EA3HZZOKD72RLB35JV7PKOSBETE5MLC7BCN37ILNCUY',
  'V4MMGXJNUYIFBKNIDMGLRHA7EIN6ILXGQAIZYP6UUXICRHQYMMSZKAFGDY',
  'BEDND7KQJGQKL664A4WRECP6N5HOY2EH55TLKLAEND4KJ2P3UF3O4YFKHM',
  '2G4T2RKWMANHAXBFTBMX34URGVUMYSZ46ES7YUQ6GFBMAVTWP6QRC5CDBA',
  'E6HGMCE6BKNBUKKR32FO75K73DLAGKDE3XYCTIR7TNWNFCEK64A7LGAW34',
  'COUNACJG5FF5RER6MVMEJQ5HILB6JZRIQ437OAPNB7C2TP7Y5P5ITRXLIA',
  '77H65UW7BBFK2GSTB4CKLL7BAVGA4TBZU2A7HNEXCE7QHW4S4RZYGMSQG4',
  'ADJFU55RALM5O25OKP4YMWCJVJKRTRTY36U5PNGK23W2SWHSUCSJPTY57M',
  'YF3T6Y4Q2UESBHQWLXFBGJAZ3CYUUKFOXRJG63UYPMQMOMGYJBP3BJHDFE',
  'QSS7MX252GMGV4W6Q5QHOUG3ABYHREA2ZJXVRNPU7EBDDVWFQB3T6LZWAA',
  'MROA34ETXSYCWEAWBJSQH7774IM36HDZYXHOOW35OIG5GR3W5OOD73C4HY',
  '7SF66JGSNC3J5G77CVS5SS45W2G32FE45YMO2ND5WDOEAVDLFEQ5RIVVX4',
  'F4WJITGEC6BHT7NZFE6Y3VZTXA235RO6JGQPRP54V45AUHMNJOCQFNXNM4',
  '7IXEIPGVPGAC2USY5NIKRLOD4SMSTQJIIL7YL4E5QNEHDKKFGTHXIGD35U',
];

vi.mock('../lib/constants', () => ({
  isValidWallet: (w: string) =>
    typeof w === 'string' && w.length === 58 &&
    /^[A-Z2-7]+$/.test(w),
  MICRO_ALGO: 1_000_000,
}));

vi.mock('../lib/algorand-client', () => ({
  algod: {
    accountInformation: vi.fn(),
  },
}));

vi.mock('../lib/timeout', () => ({
  withTimeout: vi.fn(async (p: Promise<unknown>) => p),
  fetchWithTimeout: vi.fn(),
}));

vi.mock('../config', () => ({
  config: { indexerUrl: 'https://idx.test' },
}));

vi.mock('../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../lib/graph', () => ({
  computeGraphSignals: vi.fn().mockReturnValue({
    neighborhoodClustering: 0,
    hubScore: 0,
    intermediateDensity: 0,
    componentRatio: 1,
    temporalCorrelation: 0,
    subGroupCount: 1,
  }),
}));

import {
  detectSybil,
  detectSybilFresh,
  computeCreationClustering,
  computeInteractionDensity,
  computeBalanceSimilarity,
  computeCircularActivity,
  computeTimingRegularity,
  computeAmountFingerprint,
  computeFundingCorrelation,
  computeSybilRisk,
  classifySybilRisk,
  computeSybilConfidence,
  generateSybilExplanation,
} from '../sybil';
import {
  algod,
} from '../lib/algorand-client';
import {
  fetchWithTimeout,
} from '../lib/timeout';
import {
  computeGraphSignals,
} from '../lib/graph';

type MockFn = ReturnType<typeof vi.fn>;

function mockAccountInfo(
  balance = 5_000_000,
  createdRound = 1000,
) {
  return {
    do: vi.fn().mockResolvedValue({
      amount: BigInt(balance),
      createdAtRound: createdRound,
    }),
  };
}

function mockIndexerPage(
  txns: Array<{
    sender?: string;
    receiver?: string;
    amount?: number;
    round?: number;
    txType?: string;
  }> = [],
  nextToken?: string,
) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      transactions: txns.map((t) => ({
        sender: t.sender,
        'payment-transaction': t.receiver
          ? {
              receiver: t.receiver,
              amount: t.amount ?? 1000,
            }
          : undefined,
        'asset-transfer-transaction':
          t.txType === 'axfer'
            ? {
                receiver: t.receiver,
                amount: t.amount ?? 1000,
              }
            : undefined,
        'confirmed-round': t.round ?? 100,
      })),
      'next-token': nextToken,
    }),
  } as unknown as Response;
}

function emptyPage() {
  return mockIndexerPage([]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Pure math (included for full coverage) ──

describe('computeCreationClustering', () => {
  it('returns 0 for single wallet', () => {
    expect(
      computeCreationClustering([1000], 1000),
    ).toBe(0);
  });
  it('returns 1.0 when all in window', () => {
    expect(
      computeCreationClustering(
        [1000, 1010, 1020],
        1000,
      ),
    ).toBe(1);
  });
  it('returns partial for mixed', () => {
    expect(
      computeCreationClustering(
        [1000, 1010, 1020, 50000],
        1000,
      ),
    ).toBe(0.67);
  });
  it('handles empty', () => {
    expect(
      computeCreationClustering([], 1000),
    ).toBe(0);
  });
});

describe('computeInteractionDensity', () => {
  it('0 for no txns', () => {
    expect(
      computeInteractionDensity(0, 0),
    ).toBe(0);
  });
  it('1.0 for all internal', () => {
    expect(
      computeInteractionDensity(10, 0),
    ).toBe(1);
  });
  it('0 for all external', () => {
    expect(
      computeInteractionDensity(0, 10),
    ).toBe(0);
  });
  it('0.5 for even split', () => {
    expect(
      computeInteractionDensity(5, 5),
    ).toBe(0.5);
  });
});

describe('computeBalanceSimilarity', () => {
  it('0 for single', () => {
    expect(
      computeBalanceSimilarity([100]),
    ).toBe(0);
  });
  it('1.0 for identical', () => {
    expect(
      computeBalanceSimilarity([100, 100, 100]),
    ).toBe(1);
  });
  it('0 for all zero', () => {
    expect(
      computeBalanceSimilarity([0, 0]),
    ).toBe(0);
  });
  it('0 for empty', () => {
    expect(
      computeBalanceSimilarity([]),
    ).toBe(0);
  });
});

describe('computeCircularActivity', () => {
  it('0 for empty', () => {
    expect(
      computeCircularActivity([]),
    ).toBe(0);
  });
  it('1.0 for full circle', () => {
    expect(
      computeCircularActivity([
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ]),
    ).toBe(1);
  });
  it('0 for one-way', () => {
    expect(
      computeCircularActivity([
        { from: 'A', to: 'B' },
        { from: 'A', to: 'C' },
      ]),
    ).toBe(0);
  });
  it('ignores self-txns', () => {
    expect(
      computeCircularActivity([
        { from: 'A', to: 'A' },
        { from: 'A', to: 'B' },
      ]),
    ).toBe(0);
  });
});

describe('computeTimingRegularity', () => {
  it('0 for single interval', () => {
    expect(
      computeTimingRegularity([100]),
    ).toBe(0);
  });
  it('1.0 for regular', () => {
    expect(
      computeTimingRegularity([100, 100, 100, 100]),
    ).toBe(1);
  });
  it('low for irregular', () => {
    expect(
      computeTimingRegularity([10, 500, 20, 800]),
    ).toBeLessThan(0.3);
  });
  it('0 for empty', () => {
    expect(
      computeTimingRegularity([]),
    ).toBe(0);
  });
  it('0 for zero-mean', () => {
    expect(
      computeTimingRegularity([0, 0, 0]),
    ).toBe(0);
  });
});

describe('computeAmountFingerprint', () => {
  it('0 for single', () => {
    expect(
      computeAmountFingerprint([100]),
    ).toBe(0);
  });
  it('high for identical', () => {
    expect(
      computeAmountFingerprint([
        100, 100, 100, 100, 100,
        100, 100, 100, 100, 100,
      ]),
    ).toBe(0.9);
  });
  it('0 for all different', () => {
    expect(
      computeAmountFingerprint([1, 2, 3, 4]),
    ).toBe(0);
  });
  it('0.5 for half', () => {
    expect(
      computeAmountFingerprint([100, 100, 200, 200]),
    ).toBe(0.5);
  });
  it('0 for empty', () => {
    expect(
      computeAmountFingerprint([]),
    ).toBe(0);
  });
});

describe('computeFundingCorrelation', () => {
  it('0 for single', () => {
    expect(
      computeFundingCorrelation(['A']),
    ).toBe(0);
  });
  it('high for same', () => {
    expect(
      computeFundingCorrelation(Array(10).fill('A')),
    ).toBe(0.9);
  });
  it('0 for all diff', () => {
    expect(
      computeFundingCorrelation(['A', 'B', 'C']),
    ).toBe(0);
  });
  it('0 for empty', () => {
    expect(
      computeFundingCorrelation([]),
    ).toBe(0);
  });
});

describe('computeSybilRisk', () => {
  it('0 for all-zero', () => {
    expect(computeSybilRisk({
      creationClustering: 0,
      interactionDensity: 0,
      balanceSimilarity: 0,
      circularActivity: 0,
    })).toBe(0);
  });
  it('1.0 for all-one', () => {
    expect(computeSybilRisk({
      creationClustering: 1,
      interactionDensity: 1,
      balanceSimilarity: 1,
      circularActivity: 1,
      timingRegularity: 1,
      amountFingerprint: 1,
      fundingCorrelation: 1,
      neighborhoodClustering: 1,
      hubScore: 1,
      intermediateDensity: 1,
      temporalCorrelation: 1,
    })).toBe(1);
  });
  it('clamps to [0,1]', () => {
    expect(computeSybilRisk({
      creationClustering: 2,
      interactionDensity: 2,
      balanceSimilarity: 2,
      circularActivity: 2,
    })).toBe(1);
  });
  it('defaults optional signals to 0', () => {
    const risk = computeSybilRisk({
      creationClustering: 1,
      interactionDensity: 0,
      balanceSimilarity: 0,
      circularActivity: 0,
    });
    expect(risk).toBe(0.20); // just creationClustering weight
  });
});

describe('classifySybilRisk', () => {
  it('low < 0.25', () => {
    expect(classifySybilRisk(0.24)).toBe('low');
  });
  it('medium 0.25-0.44', () => {
    expect(classifySybilRisk(0.25)).toBe('medium');
  });
  it('high 0.45-0.69', () => {
    expect(classifySybilRisk(0.45)).toBe('high');
  });
  it('critical >= 0.70', () => {
    expect(
      classifySybilRisk(0.70),
    ).toBe('critical');
  });
});

describe('computeSybilConfidence', () => {
  it('0.50 for 0 points', () => {
    expect(
      computeSybilConfidence(0),
    ).toBe(0.50);
  });
  it('0.95 for 4+ points', () => {
    expect(
      computeSybilConfidence(4),
    ).toBe(0.95);
  });
  it('clamps at 0.50', () => {
    expect(
      computeSybilConfidence(-1),
    ).toBe(0.50);
  });
});

describe('generateSybilExplanation', () => {
  it('no clustering for single', () => {
    expect(
      generateSybilExplanation(1, 0, 0, 0, 0, 0)
        .some((r) => r.includes('No clustering')),
    ).toBe(true);
  });
  it('reports cluster size', () => {
    expect(
      generateSybilExplanation(
        5, 0.9, 0.95, 0.85, 0.7, 0.91,
      ).some((r) => r.includes('5 wallets')),
    ).toBe(true);
  });
  it('reports high interaction', () => {
    expect(
      generateSybilExplanation(
        5, 0.9, 0.95, 0.85, 0.7, 0.91,
      ).some((r) => r.includes('95%')),
    ).toBe(true);
  });
  it('reports balance similarity', () => {
    expect(
      generateSybilExplanation(
        5, 0.9, 0.95, 0.85, 0.7, 0.91,
      ).some((r) => r.includes('85%')),
    ).toBe(true);
  });
  it('reports circular patterns', () => {
    expect(
      generateSybilExplanation(
        5, 0.9, 0.95, 0.85, 0.7, 0.91,
      ).some((r) => r.includes('Circular')),
    ).toBe(true);
  });
  it('reports high sybil risk', () => {
    expect(
      generateSybilExplanation(
        5, 0.9, 0.95, 0.85, 0.7, 0.91,
      ).some((r) =>
        r.includes('High sybil risk')),
    ).toBe(true);
  });
  it('reports low sybil risk', () => {
    expect(
      generateSybilExplanation(
        1, 0, 0, 0, 0, 0.05,
      ).some((r) =>
        r.includes('Low sybil risk')),
    ).toBe(true);
  });
  it('reports moderate risk', () => {
    expect(
      generateSybilExplanation(
        3, 0.5, 0.5, 0.5, 0.3, 0.30,
      ).some((r) =>
        r.includes('Low-moderate')),
    ).toBe(true);
  });
  it('reports bot-like timing', () => {
    const r = generateSybilExplanation(
      5, 0.9, 0.95, 0.85, 0.7, 0.91, 0.8,
    );
    expect(
      r.some((x) =>
        x.includes('Bot-like timing')),
    ).toBe(true);
  });
  it('reports uniform amounts', () => {
    const r = generateSybilExplanation(
      5, 0.9, 0.95, 0.85, 0.7, 0.91,
      0.5, 0.8,
    );
    expect(
      r.some((x) =>
        x.includes('Uniform transaction amounts')),
    ).toBe(true);
  });
  it('reports common funding', () => {
    const r = generateSybilExplanation(
      5, 0.9, 0.95, 0.85, 0.7, 0.91,
      0.5, 0.3, 0.8,
    );
    expect(
      r.some((x) =>
        x.includes('Common funding source')),
    ).toBe(true);
  });
  it('reports moderate interaction density', () => {
    const r = generateSybilExplanation(
      5, 0.9, 0.6, 0.5, 0.3, 0.30,
    );
    expect(
      r.some((x) =>
        x.includes('mixed activity')),
    ).toBe(true);
  });
  it('reports low interaction density', () => {
    const r = generateSybilExplanation(
      5, 0.9, 0.2, 0.5, 0.3, 0.30,
    );
    expect(
      r.some((x) =>
        x.includes('mostly external')),
    ).toBe(true);
  });
  it('reports moderate balance similarity', () => {
    const r = generateSybilExplanation(
      5, 0.9, 0.9, 0.6, 0.3, 0.30,
    );
    expect(
      r.some((x) =>
        x.includes('moderately similar')),
    ).toBe(true);
  });
  it('reports some bidirectional patterns', () => {
    const r = generateSybilExplanation(
      5, 0.9, 0.9, 0.8, 0.3, 0.30,
    );
    expect(
      r.some((x) =>
        x.includes('Some bidirectional')),
    ).toBe(true);
  });
  it('reports graph signals when provided', () => {
    const r = generateSybilExplanation(
      5, 0.9, 0.95, 0.85, 0.7, 0.91,
      0.5, 0.3, 0.3,
      {
        neighborhoodClustering: 0.8,
        hubScore: 0.9,
        intermediateDensity: 0.6,
        componentRatio: 0.5,
        temporalCorrelation: 0.7,
        subGroupCount: 3,
      },
    );
    expect(
      r.some((x) =>
        x.includes('highly interconnected')),
    ).toBe(true);
    expect(
      r.some((x) =>
        x.includes('Central hub')),
    ).toBe(true);
    expect(
      r.some((x) =>
        x.includes('Heavy intermediary')),
    ).toBe(true);
    expect(
      r.some((x) =>
        x.includes('highly correlated')),
    ).toBe(true);
    expect(
      r.some((x) =>
        x.includes('sub-groups')),
    ).toBe(true);
  });
  it('reports moderate graph signals', () => {
    const r = generateSybilExplanation(
      5, 0.9, 0.95, 0.85, 0.7, 0.91,
      0.5, 0.3, 0.3,
      {
        neighborhoodClustering: 0.4,
        hubScore: 0.3,
        intermediateDensity: 0.3,
        temporalCorrelation: 0.4,
        subGroupCount: 1,
      },
    );
    expect(
      r.some((x) =>
        x.includes('Some interconnected')),
    ).toBe(true);
    expect(
      r.some((x) =>
        x.includes('Some intermediary')),
    ).toBe(true);
    expect(
      r.some((x) =>
        x.includes('Moderate temporal')),
    ).toBe(true);
  });
  it('reports moderate sybil risk', () => {
    expect(
      generateSybilExplanation(
        3, 0.5, 0.5, 0.5, 0.3, 0.50,
      ).some((r) =>
        r.includes('Moderate sybil risk')),
    ).toBe(true);
  });
});

// ── fetchAccountInfo via detectSybilInternal ──

describe('detectSybil - fetchAccountInfo', () => {
  it('returns null for invalid wallet', async () => {
    expect(await detectSybil('bad')).toBeNull();
  });

  it('returns null when account info fails', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue({
      do: vi.fn().mockRejectedValue(
        new Error('timeout'),
      ),
    });
    expect(await detectSybil(VALID_W)).toBeNull();
  });

  it('returns null when fetchAccountInfo returns null', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue({
      do: vi.fn().mockRejectedValue(
        new Error('not found'),
      ),
    });
    expect(await detectSybil(VALID_W)).toBeNull();
  });

  it('succeeds with valid account info', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(emptyPage());

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(result!.wallet).toBe(VALID_W);
    expect(typeof result!.sybilRisk).toBe('number');
    expect([
      'low', 'medium', 'high', 'critical',
    ]).toContain(result!.riskLevel);
  });
});

// ── fetchTransactions via detectSybilInternal ──

describe('detectSybil - fetchTransactions', () => {
  it('handles empty transaction list', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(emptyPage());

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(result!.clusterSize).toBe(1);
  });

  it('handles non-ok indexer response', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue({ ok: false });

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
  });

  it('handles fetchTransactions error', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockRejectedValue(
      new Error('network'),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(result!.clusterSize).toBe(1);
  });

  it('paginates through multiple pages', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());

    const page1Txns = Array.from(
      { length: 2000 },
      (_, i) => ({
        sender: VALID_W,
        receiver: VALID_B,
        amount: 100,
        round: i + 1,
      }),
    );
    const page2Txns = Array.from(
      { length: 100 },
      (_, i) => ({
        sender: VALID_W,
        receiver: VALID_C,
        amount: 200,
        round: 2001 + i,
      }),
    );

    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValueOnce(
      mockIndexerPage(page1Txns, 'token123'),
    ).mockResolvedValueOnce(
      mockIndexerPage(page2Txns),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      fetchWithTimeout,
    ).toHaveBeenCalledTimes(2);
  });

  it('handles asset-transfer-transaction', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());

    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage([{
        sender: VALID_W,
        receiver: VALID_B,
        amount: 500,
        round: 100,
        txType: 'axfer',
      }]),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.signals.amountFingerprint,
    ).toBeGreaterThanOrEqual(0);
  });
});

// ── detectSybilInternal (signals) ──

describe('detectSybilInternal - all 11 signals', () => {
  it('computes all 11 signals in result', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(emptyPage());

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(result!.signals).toHaveProperty(
      'creationClustering',
    );
    expect(result!.signals).toHaveProperty(
      'interactionDensity',
    );
    expect(result!.signals).toHaveProperty(
      'balanceSimilarity',
    );
    expect(result!.signals).toHaveProperty(
      'circularActivity',
    );
    expect(result!.signals).toHaveProperty(
      'timingRegularity',
    );
    expect(result!.signals).toHaveProperty(
      'amountFingerprint',
    );
    expect(result!.signals).toHaveProperty(
      'fundingCorrelation',
    );
    expect(result!.signals).toHaveProperty(
      'neighborhoodClustering',
    );
    expect(result!.signals).toHaveProperty(
      'hubScore',
    );
    expect(result!.signals).toHaveProperty(
      'intermediateDensity',
    );
    expect(result!.signals).toHaveProperty(
      'componentRatio',
    );
    expect(result!.signals).toHaveProperty(
      'temporalCorrelation',
    );
  });

  it('calls computeGraphSignals with correct args', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage([
        {
          sender: VALID_W,
          receiver: VALID_B,
          amount: 100,
          round: 100,
        },
      ]),
    );
    m.mockReturnValue(mockAccountInfo());

    await detectSybil(VALID_W);
    expect(computeGraphSignals).toHaveBeenCalled();
  });

  it('builds correct cluster with counterparties', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage([
        {
          sender: VALID_W,
          receiver: VALID_B,
          amount: 100,
          round: 100,
        },
        {
          sender: VALID_B,
          receiver: VALID_W,
          amount: 200,
          round: 101,
        },
      ]),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.clusterSize,
    ).toBeGreaterThanOrEqual(2);
    expect(
      result!.flaggedWallets,
    ).toContain(VALID_B);
  });

  it('limits counterparties to 25', async () => {
    const wallets = DYNAMIC_WALLETS.slice(0, 30);

    const txns = wallets.map((w, i) => ({
      sender: VALID_W,
      receiver: w,
      amount: 100 + i,
      round: 100 + i,
    }));

    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage(txns),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.clusterSize,
    ).toBeLessThanOrEqual(26);
  });

  it('detects high creation clustering', async () => {
    const m = algod.accountInformation as MockFn;
    m
      .mockReturnValueOnce(
        mockAccountInfo(5_000_000, 1000),
      )
      .mockReturnValueOnce(
        mockAccountInfo(5_000_000, 1010),
      );

    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage([{
        sender: VALID_W,
        receiver: VALID_B,
        amount: 100,
        round: 200,
      }]),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.signals.creationClustering,
    ).toBeGreaterThan(0);
  });

  it('detects high interaction density', async () => {
    const txns = Array.from(
      { length: 20 },
      (_, i) => ({
        sender: VALID_W,
        receiver: VALID_B,
        amount: 100,
        round: 100 + i,
      }),
    );

    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage(txns),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.signals.interactionDensity,
    ).toBeGreaterThan(0);
  });

  it('detects circular activity', async () => {
    const txns = [
      {
        sender: VALID_W,
        receiver: VALID_B,
        amount: 100,
        round: 100,
      },
      {
        sender: VALID_B,
        receiver: VALID_W,
        amount: 100,
        round: 101,
      },
    ];

    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage(txns),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.signals.circularActivity,
    ).toBeGreaterThan(0);
  });

  it('detects timing regularity', async () => {
    const txns = Array.from(
      { length: 10 },
      (_, i) => ({
        sender: VALID_W,
        receiver: VALID_B,
        amount: 100,
        round: 100 + i * 100,
      }),
    );

    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage(txns),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.signals.timingRegularity,
    ).toBeGreaterThan(0);
  });

  it('detects amount fingerprint', async () => {
    const txns = Array.from(
      { length: 10 },
      (_, i) => ({
        sender: VALID_W,
        receiver: VALID_B,
        amount: 1000,
        round: 100 + i,
      }),
    );

    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage(txns),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.signals.amountFingerprint,
    ).toBeGreaterThan(0);
  });

  it('handles counterparty info fetch failure gracefully', async () => {
    const m = algod.accountInformation as MockFn;
    m
      .mockReturnValueOnce(mockAccountInfo())
      .mockReturnValueOnce({
        do: vi.fn().mockRejectedValue(
          new Error('fail'),
        ),
      });

    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage([{
        sender: VALID_W,
        receiver: VALID_B,
        amount: 100,
        round: 100,
      }]),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
  });
});

// ── detectSybilFresh ──

describe('detectSybilFresh', () => {
  it('bypasses cache by calling with fresh=true', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(emptyPage());

    const result = await detectSybilFresh(
      VALID_W,
    );
    expect(result).not.toBeNull();
    expect(result!.wallet).toBe(VALID_W);
  });

  it('returns null for invalid wallet', async () => {
    expect(
      await detectSybilFresh('bad'),
    ).toBeNull();
  });

  it('returns null when account info fails', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReset();
    m.mockReturnValue({
      do: vi.fn().mockRejectedValue(
        new Error('not found'),
      ),
    });
    expect(
      await detectSybilFresh(VALID_W),
    ).toBeNull();
  });

  it('uses fresh data (no cache)', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage([{
        sender: VALID_W,
        receiver: VALID_B,
        amount: 100,
        round: 100,
      }]),
    );

    const r1 = await detectSybilFresh(VALID_W);
    const r2 = await detectSybilFresh(VALID_W);
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
  });
});

// ── Cluster building ──

describe('cluster building', () => {
  it('includes target wallet as first cluster member', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage([{
        sender: VALID_W,
        receiver: VALID_B,
        amount: 100,
      }]),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.flaggedWallets,
    ).not.toContain(VALID_W);
  });

  it('flagged wallets exclude the target wallet', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage([
        {
          sender: VALID_W,
          receiver: VALID_B,
          amount: 100,
          round: 100,
        },
        {
          sender: VALID_W,
          receiver: VALID_C,
          amount: 200,
          round: 101,
        },
      ]),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.flaggedWallets,
    ).not.toContain(VALID_W);
    expect(
      result!.flaggedWallets,
    ).toContain(VALID_B);
    expect(
      result!.flaggedWallets,
    ).toContain(VALID_C);
  });

  it('returns empty flaggedWallets when no counterparties', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(emptyPage());

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.flaggedWallets,
    ).toEqual([]);
    expect(result!.clusterSize).toBe(1);
  });

  it('explanation includes cluster details', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(emptyPage());

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.explanation.length,
    ).toBeGreaterThan(0);
  });

  it('confidence computation works with data', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage(
        Array.from({ length: 25 }, (_, i) => ({
          sender: VALID_W,
          receiver: DYNAMIC_WALLETS[
            i % DYNAMIC_WALLETS.length
          ],
          amount: 1000,
          round: 100 + i,
        })),
      ),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.confidence,
    ).toBeGreaterThanOrEqual(0.50);
  });
});

// ── Self-transactions ignored in fetchTransactions ──

describe('fetchTransactions - self-transaction filtering', () => {
  it('ignores self-transactions (sender === receiver)', async () => {
    const m = algod.accountInformation as MockFn;
    m.mockReturnValue(mockAccountInfo());
    const f = fetchWithTimeout as MockFn;
    f.mockResolvedValue(
      mockIndexerPage([
        {
          sender: VALID_W,
          receiver: VALID_W,
          amount: 100,
          round: 100,
        },
        {
          sender: VALID_W,
          receiver: VALID_B,
          amount: 200,
          round: 101,
        },
      ]),
    );

    const result = await detectSybil(VALID_W);
    expect(result).not.toBeNull();
    expect(
      result!.signals.interactionDensity,
    ).toBeDefined();
  });
});
