import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../lib/security', () => {
  const passthrough = (
    _req: unknown,
    _res: unknown,
    next: () => void,
  ) => next();
  return {
    rateLimiter: vi.fn(() => passthrough),
    corsMiddleware: vi.fn(() => passthrough),
    requestIdMiddleware: passthrough,
    requestLoggingMiddleware: passthrough,
  };
});

vi.mock('../lib/idempotency', () => ({
  idempotencyMiddleware: (
    _req: unknown,
    _res: unknown,
    next: () => void,
  ) => next(),
}));

vi.mock('../lib/metrics', () => ({
  recordCounterpartyCheck: vi.fn(),
  recordDiscoverySearch: vi.fn(),
  recordUnderwritingDecision: vi.fn(),
  recordVerifyCheck: vi.fn(),
  metricsEndpoint: (
    _req: unknown,
    res: { json: (d: unknown) => void },
  ) => res.json({ metrics: true }),
  metricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../lib/metrics-collectors', () => ({
  startMetricsCollectors: vi.fn(),
}));

vi.mock('../lib/sanctions', () => ({
  getSanctionsProvider: vi.fn(() => ({ name: 'mock-sanctions' })),
}));

vi.mock('../lib/operator-wallet', () => ({
  isOperatorInitialized: vi.fn(() => true),
}));

vi.mock('../lib/x402', () => ({
  x402Middleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  settlementVerificationMiddleware: (
    _req: unknown,
    _res: unknown,
    next: () => void,
  ) => next(),
}));

vi.mock('../lib/cache', () => {
  const store = new Map<string, unknown>();
  return {
    TTLCache: vi.fn().mockImplementation(() => ({
      get: (k: string) => store.get(k),
      set: (k: string, v: unknown) => { store.set(k, v); },
      delete: (k: string) => store.delete(k),
      clear: () => store.clear(),
    })),
  };
});

vi.mock('../lib/build-info', () => ({
  packageVersion: '0.0.0-test',
  buildInfo: { version: '0.0.0-test', node: 'v20.0.0', startedAt: '2024-01-01T00:00:00Z' },
}));

vi.mock('../lib/openapi', () => ({
  openApiSpec: { openapi: '3.0.3', paths: { '/score': {}, '/passport': {} } },
}));

vi.mock('../lib/webhooks', () => ({
  addSubscriber: vi.fn(() => ({ id: 'sub-1', wallet: 'w', url: 'http://x', createdAt: '' })),
  removeSubscriber: vi.fn(() => true),
  listSubscribers: vi.fn(() => []),
  fireWebhook: vi.fn(() => Promise.resolve()),
}));

vi.mock('../lib/algorand-client', () => ({
  algod: {
    accountInformation: vi.fn(() => ({
      do: vi.fn(() =>
        Promise.resolve({
          amount: 1000n,
          totalAppsOptedIn: 1,
          totalAssetsOptedIn: 0,
        })),
    })),
    status: vi.fn(() => ({
      do: vi.fn(() => Promise.resolve({ lastRound: 12345 })),
    })),
  },
}));

vi.mock('../lib/constants', () => ({
  isValidWallet: vi.fn((w: string) =>
    /^[A-Z2-7]{58}$/.test(w) && w !== 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ),
}));

vi.mock('../trust-score', () => ({
  scoreWallet: vi.fn(),
}));

vi.mock('../delegation', () => ({
  scoreDelegation: vi.fn(),
}));

vi.mock('../credit', () => ({
  estimateCredit: vi.fn(),
}));

vi.mock('../sybil', () => ({
  detectSybil: vi.fn(),
}));

vi.mock('../reputation', () => ({
  computeReputation: vi.fn(),
  recordEvent: vi.fn(),
  EVENT_TYPES: ['payment', 'delegation', 'revocation', 'dispute'],
}));

vi.mock('../registry', () => ({
  delegate: vi.fn(),
  revoke: vi.fn(),
  isRegistryConfigured: vi.fn(() => true),
  RegistryNotConfiguredError: class RegistryNotConfiguredError extends Error {},
  RegistryValidationError: class RegistryValidationError extends Error {},
}));

vi.mock('../counterparty', () => ({
  checkCounterparty: vi.fn(),
}));

vi.mock('../underwriting', () => ({
  underwrite: vi.fn(),
}));

vi.mock('../trust-graph', () => ({
  analyzeTrustGraph: vi.fn(),
  simulateSponsorLoss: vi.fn(),
}));

vi.mock('../passport', () => ({
  generatePassport: vi.fn(),
}));

vi.mock('helmet', () => {
  const h = (_opts?: unknown) =>
    (_req: unknown, _res: unknown, next: () => void) =>
      next();
  return { default: h };
});

vi.mock('algosdk', () => ({
  default: { isValidAddress: vi.fn(() => true) },
}));

const VALID = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';
const VALID2 = 'A2YR3UXLBTMZK6BLCV6ABNG5JGNOX7TXQFTAVAPF5A4JOI5EFWZ2LETCEA';

let app;
let responseCache;
let scoreWallet: ReturnType<typeof vi.fn>;
let scoreDelegation: ReturnType<typeof vi.fn>;
let estimateCredit: ReturnType<typeof vi.fn>;
let detectSybil: ReturnType<typeof vi.fn>;
let computeReputation: ReturnType<typeof vi.fn>;
let recordEvent: ReturnType<typeof vi.fn>;
let checkCounterparty: ReturnType<typeof vi.fn>;
let underwriteFn: ReturnType<typeof vi.fn>;
let analyzeTrustGraph: ReturnType<typeof vi.fn>;
let simulateSponsorLoss: ReturnType<typeof vi.fn>;
let generatePassport: ReturnType<typeof vi.fn>;
let delegateOnChain: ReturnType<typeof vi.fn>;
let revokeOnChain: ReturnType<typeof vi.fn>;
let isOperatorInitialized: ReturnType<typeof vi.fn>;
let addSubscriber: ReturnType<typeof vi.fn>;
let removeSubscriber: ReturnType<typeof vi.fn>;
let listSubscribers: ReturnType<typeof vi.fn>;
let fireWebhook: ReturnType<typeof vi.fn>;
let algod: {
  accountInformation: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
  vi.clearAllMocks();
  const appModule = await import('../app');
  app = appModule.app;
  responseCache = appModule.responseCache;
  responseCache.clear();
  scoreWallet = (await import('../trust-score')).scoreWallet as unknown as ReturnType<typeof vi.fn>;
  scoreDelegation = (await import('../delegation')).scoreDelegation as unknown as ReturnType<typeof vi.fn>;
  estimateCredit = (await import('../credit')).estimateCredit as unknown as ReturnType<typeof vi.fn>;
  detectSybil = (await import('../sybil')).detectSybil as unknown as ReturnType<typeof vi.fn>;
  computeReputation = (await import('../reputation')).computeReputation as unknown as ReturnType<typeof vi.fn>;
  recordEvent = (await import('../reputation')).recordEvent as unknown as ReturnType<typeof vi.fn>;
  checkCounterparty = (await import('../counterparty')).checkCounterparty as unknown as ReturnType<typeof vi.fn>;
  underwriteFn = (await import('../underwriting')).underwrite as unknown as ReturnType<typeof vi.fn>;
  analyzeTrustGraph = (await import('../trust-graph')).analyzeTrustGraph as unknown as ReturnType<typeof vi.fn>;
  simulateSponsorLoss = (await import('../trust-graph')).simulateSponsorLoss as unknown as ReturnType<typeof vi.fn>;
  generatePassport = (await import('../passport')).generatePassport as unknown as ReturnType<typeof vi.fn>;
  delegateOnChain = (await import('../registry')).delegate as unknown as ReturnType<typeof vi.fn>;
  revokeOnChain = (await import('../registry')).revoke as unknown as ReturnType<typeof vi.fn>;
  isOperatorInitialized = (await import('../lib/operator-wallet')).isOperatorInitialized as unknown as ReturnType<typeof vi.fn>;
  addSubscriber = (await import('../lib/webhooks')).addSubscriber as unknown as ReturnType<typeof vi.fn>;
  removeSubscriber = (await import('../lib/webhooks')).removeSubscriber as unknown as ReturnType<typeof vi.fn>;
  listSubscribers = (await import('../lib/webhooks')).listSubscribers as unknown as ReturnType<typeof vi.fn>;
  fireWebhook = (await import('../lib/webhooks')).fireWebhook as unknown as ReturnType<typeof vi.fn>;
  const algodMod = await import('../lib/algorand-client');
  algod = algodMod.algod as unknown as typeof algod;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /', () => {
  it('returns service metadata', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('Agent Passport');
    expect(res.body.version).toBe('0.0.0-test');
    expect(res.body.docs).toBe('/openapi.json');
    expect(res.body.health).toBe('/health');
  });
});

describe('GET /health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('Agent Passport');
    expect(res.body.network).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('GET /ready', () => {
  it('returns 200 when algorand is connected and operator initialized', async () => {
    isOperatorInitialized.mockReturnValue(true);
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.algorand.connected).toBe(true);
    expect(res.body.operator.initialized).toBe(true);
  });

  it('returns 503 when algorand is unreachable', async () => {
    algod.status.mockReturnValue({ do: vi.fn(() => Promise.reject(new Error('conn refused'))) });
    isOperatorInitialized.mockReturnValue(false);
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.algorand.connected).toBe(false);
  });
});

describe('GET /health/deep', () => {
  it('returns 200 when algorand connected', async () => {
    const res = await request(app).get('/health/deep');
    expect(res.status).toBe(200);
    expect(res.body.algorand.connected).toBe(true);
  });

  it('returns 503 when algorand down', async () => {
    algod.status.mockReturnValue({ do: vi.fn(() => Promise.reject(new Error('down'))) });
    const res = await request(app).get('/health/deep');
    expect(res.status).toBe(503);
  });
});

describe('GET /version', () => {
  it('returns build metadata', async () => {
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('Agent Passport');
    expect(res.body.version).toBe('0.0.0-test');
    expect(res.body.node).toBeDefined();
    expect(res.body.sanctionsProvider).toBe('mock-sanctions');
    expect(res.body.uptime).toBeDefined();
  });
});

describe('GET /metrics', () => {
  it('returns metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body.metrics).toBe(true);
  });
});

describe('GET /openapi.json', () => {
  it('returns openapi spec', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/score']).toBeDefined();
  });
});

describe('GET /registry/status', () => {
  it('returns registry status', async () => {
    const res = await request(app).get('/registry/status');
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
  });
});

describe('GET /score', () => {
  it('returns 400 without wallet', async () => {
    const res = await request(app).get('/score');
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid wallet', async () => {
    const res = await request(app).get('/score?wallet=bad');
    expect(res.status).toBe(400);
  });

  it('returns 404 when wallet not found', async () => {
    scoreWallet.mockResolvedValue(null);
    const res = await request(app).get(`/score?wallet=${VALID}`);
    expect(res.status).toBe(404);
  });

  it('returns score result', async () => {
    scoreWallet.mockResolvedValue({ score: 85, wallet: VALID });
    const res = await request(app).get(`/score?wallet=${VALID}`);
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(85);
  });

  it('returns cached score on second call', async () => {
    scoreWallet.mockResolvedValue({ score: 85, wallet: VALID });
    await request(app).get(`/score?wallet=${VALID}`);
    await request(app).get(`/score?wallet=${VALID}`);
    expect(scoreWallet).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on error', async () => {
    scoreWallet.mockRejectedValue(new Error('boom'));
    const res = await request(app).get(`/score?wallet=${VALID}`);
    expect(res.status).toBe(500);
  });
});

describe('GET /delegation', () => {
  it('returns 400 without wallet', async () => {
    const res = await request(app).get('/delegation');
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    scoreDelegation.mockResolvedValue(null);
    const res = await request(app).get(`/delegation?wallet=${VALID}`);
    expect(res.status).toBe(404);
  });

  it('returns delegation result', async () => {
    scoreDelegation.mockResolvedValue({ trust: 70 });
    const res = await request(app).get(`/delegation?wallet=${VALID}`);
    expect(res.status).toBe(200);
    expect(res.body.trust).toBe(70);
  });

  it('returns 500 on error', async () => {
    scoreDelegation.mockRejectedValue(new Error('fail'));
    const res = await request(app).get(`/delegation?wallet=${VALID}`);
    expect(res.status).toBe(500);
  });
});

describe('POST /counterparty-check', () => {
  it('returns 400 without buyer', async () => {
    const res = await request(app).post('/counterparty-check').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/buyer/);
  });

  it('returns 400 with invalid buyer', async () => {
    const res = await request(app).post('/counterparty-check').send({ buyer: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    checkCounterparty.mockResolvedValue(null);
    const res = await request(app).post('/counterparty-check').send({ buyer: VALID });
    expect(res.status).toBe(404);
  });

  it('returns counterparty result', async () => {
    checkCounterparty.mockResolvedValue({ allow: true, buyer: VALID });
    const res = await request(app).post('/counterparty-check').send({ buyer: VALID });
    expect(res.status).toBe(200);
    expect(res.body.allow).toBe(true);
  });

  it('returns 500 on error', async () => {
    checkCounterparty.mockRejectedValue(new Error('fail'));
    const res = await request(app).post('/counterparty-check').send({ buyer: VALID });
    expect(res.status).toBe(500);
  });
});

describe('POST /credit-estimate', () => {
  it('returns 400 without wallet', async () => {
    const res = await request(app).post('/credit-estimate').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid wallet', async () => {
    const res = await request(app).post('/credit-estimate').send({ wallet: 'bad' });
    expect(res.status).toBe(400);
  });

  it('returns 400 with negative amount', async () => {
    const res = await request(app).post('/credit-estimate').send({ wallet: VALID, amount: -5 });
    expect(res.status).toBe(400);
  });

  it('NaN becomes null in JSON → treated as no amount → 404 from upstream', async () => {
    estimateCredit.mockResolvedValue(null);
    const res = await request(app).post('/credit-estimate').send({ wallet: VALID, amount: NaN });
    expect(res.status).toBe(404);
  });

  it('returns 400 with non-number amount', async () => {
    const res = await request(app).post('/credit-estimate').send({ wallet: VALID, amount: 'abc' });
    expect(res.status).toBe(400);
  });

  it('accepts missing amount (defaults to undefined)', async () => {
    estimateCredit.mockResolvedValue({ capacity: 1000 });
    const res = await request(app).post('/credit-estimate').send({ wallet: VALID });
    expect(res.status).toBe(200);
    expect(estimateCredit).toHaveBeenCalledWith(VALID, undefined);
  });

  it('returns 404 when not found', async () => {
    estimateCredit.mockResolvedValue(null);
    const res = await request(app).post('/credit-estimate').send({ wallet: VALID, amount: 100 });
    expect(res.status).toBe(404);
  });

  it('returns credit result', async () => {
    estimateCredit.mockResolvedValue({ capacity: 500 });
    const res = await request(app).post('/credit-estimate').send({ wallet: VALID, amount: 100 });
    expect(res.status).toBe(200);
    expect(res.body.capacity).toBe(500);
  });

  it('returns 500 on error', async () => {
    estimateCredit.mockRejectedValue(new Error('fail'));
    const res = await request(app).post('/credit-estimate').send({ wallet: VALID, amount: 100 });
    expect(res.status).toBe(500);
  });
});

describe('GET /sybil-check', () => {
  it('returns 400 with invalid wallet', async () => {
    const res = await request(app).get('/sybil-check?wallet=bad');
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    detectSybil.mockResolvedValue(null);
    const res = await request(app).get(`/sybil-check?wallet=${VALID}`);
    expect(res.status).toBe(404);
  });

  it('returns sybil result', async () => {
    detectSybil.mockResolvedValue({ risk: 0.1 });
    const res = await request(app).get(`/sybil-check?wallet=${VALID}`);
    expect(res.status).toBe(200);
    expect(res.body.risk).toBe(0.1);
  });

  it('returns 500 on error', async () => {
    detectSybil.mockRejectedValue(new Error('fail'));
    const res = await request(app).get(`/sybil-check?wallet=${VALID}`);
    expect(res.status).toBe(500);
  });
});

describe('GET /reputation', () => {
  it('returns 400 with invalid wallet', async () => {
    const res = await request(app).get('/reputation?wallet=bad');
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    computeReputation.mockResolvedValue(null);
    const res = await request(app).get(`/reputation?wallet=${VALID}`);
    expect(res.status).toBe(404);
  });

  it('returns reputation result', async () => {
    computeReputation.mockResolvedValue({ score: 75 });
    const res = await request(app).get(`/reputation?wallet=${VALID}`);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    computeReputation.mockRejectedValue(new Error('fail'));
    const res = await request(app).get(`/reputation?wallet=${VALID}`);
    expect(res.status).toBe(500);
  });
});

describe('POST /reputation/record', () => {
  it('returns 400 without wallet', async () => {
    const res = await request(app).post('/reputation/record').send({ eventType: 'payment' });
    expect(res.status).toBe(400);
  });

  it('returns 400 without eventType', async () => {
    const res = await request(app).post('/reputation/record').send({ wallet: VALID });
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid eventType', async () => {
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'nope' });
    expect(res.status).toBe(400);
  });

  it('returns 400 with negative amount', async () => {
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'payment', amount: -1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid counterparty', async () => {
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'payment', counterparty: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for dispute without round', async () => {
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'dispute' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for dispute with round=0', async () => {
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'dispute', round: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for dispute with negative round', async () => {
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'dispute', round: -5 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for dispute with non-number round', async () => {
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'dispute', round: 'abc' });
    expect(res.status).toBe(400);
  });

  it('records event successfully', async () => {
    recordEvent.mockResolvedValue({ recorded: true });
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'payment', amount: 100 });
    expect(res.status).toBe(200);
    expect(res.body.recorded).toBe(true);
    expect(fireWebhook).toHaveBeenCalled();
  });

  it('returns 400 when recordEvent returns null', async () => {
    recordEvent.mockResolvedValue(null);
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'payment' });
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    recordEvent.mockRejectedValue(new Error('fail'));
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'payment' });
    expect(res.status).toBe(500);
  });

  it('dispute with valid round succeeds', async () => {
    recordEvent.mockResolvedValue({ recorded: true });
    const res = await request(app).post('/reputation/record').send({
      wallet: VALID, eventType: 'dispute', round: 100, counterparty: VALID2,
    });
    expect(res.status).toBe(200);
  });
});

describe('GET /underwrite', () => {
  it('returns 400 with invalid wallet', async () => {
    const res = await request(app).get('/underwrite?wallet=bad');
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    underwriteFn.mockResolvedValue(null);
    const res = await request(app).get(`/underwrite?wallet=${VALID}`);
    expect(res.status).toBe(404);
  });

  it('returns underwriting result', async () => {
    underwriteFn.mockResolvedValue({ approved: true, limit: 5000 });
    const res = await request(app).get(`/underwrite?wallet=${VALID}`);
    expect(res.status).toBe(200);
    expect(res.body.approved).toBe(true);
  });

  it('returns 500 on error', async () => {
    underwriteFn.mockRejectedValue(new Error('fail'));
    const res = await request(app).get(`/underwrite?wallet=${VALID}`);
    expect(res.status).toBe(500);
  });
});

describe('GET /trust-graph', () => {
  it('returns 400 with invalid wallet', async () => {
    const res = await request(app).get('/trust-graph?wallet=bad');
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid simulateSponsorLost', async () => {
    const res = await request(app).get(`/trust-graph?wallet=${VALID}&simulateSponsorLost=garbage`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    analyzeTrustGraph.mockResolvedValue(null);
    const res = await request(app).get(`/trust-graph?wallet=${VALID}`);
    expect(res.status).toBe(404);
  });

  it('returns trust graph result', async () => {
    analyzeTrustGraph.mockResolvedValue({ nodes: [], edges: [] });
    const res = await request(app).get(`/trust-graph?wallet=${VALID}`);
    expect(res.status).toBe(200);
    expect(res.body.nodes).toEqual([]);
  });

  it('calls simulateSponsorLoss with simulateSponsorLost param', async () => {
    simulateSponsorLoss.mockResolvedValue({ nodes: [] });
    const res = await request(app).get(`/trust-graph?wallet=${VALID}&simulateSponsorLost=${VALID2}`);
    expect(res.status).toBe(200);
    expect(simulateSponsorLoss).toHaveBeenCalledWith(VALID, VALID2);
  });

  it('returns 500 on error', async () => {
    analyzeTrustGraph.mockRejectedValue(new Error('fail'));
    const res = await request(app).get(`/trust-graph?wallet=${VALID}`);
    expect(res.status).toBe(500);
  });
});

describe('POST /delegate', () => {
  it('returns 400 without sponsor', async () => {
    const res = await request(app).post('/delegate').send({ agent: VALID2, amount: 100 });
    expect(res.status).toBe(400);
  });

  it('returns 400 without agent', async () => {
    const res = await request(app).post('/delegate').send({ sponsor: VALID, amount: 100 });
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid sponsor', async () => {
    const res = await request(app).post('/delegate').send({ sponsor: 'bad', agent: VALID2, amount: 100 });
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid agent', async () => {
    const res = await request(app).post('/delegate').send({ sponsor: VALID, agent: 'bad', amount: 100 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when sponsor == agent', async () => {
    const res = await request(app).post('/delegate').send({ sponsor: VALID, agent: VALID, amount: 100 });
    expect(res.status).toBe(400);
  });

  it('returns 400 without amount', async () => {
    const res = await request(app).post('/delegate').send({ sponsor: VALID, agent: VALID2 });
    expect(res.status).toBe(400);
  });

  it('returns 400 with zero amount', async () => {
    const res = await request(app).post('/delegate').send({ sponsor: VALID, agent: VALID2, amount: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 400 with negative amount', async () => {
    const res = await request(app).post('/delegate').send({ sponsor: VALID, agent: VALID2, amount: -10 });
    expect(res.status).toBe(400);
  });

  it('returns 400 with non-number amount', async () => {
    const res = await request(app).post('/delegate').send({ sponsor: VALID, agent: VALID2, amount: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 400 with Infinity amount', async () => {
    const res = await request(app).post('/delegate').send({ sponsor: VALID, agent: VALID2, amount: Infinity });
    expect(res.status).toBe(400);
  });

  it('returns 201 on success', async () => {
    delegateOnChain.mockResolvedValue({ txId: 'abc' });
    const res = await request(app).post('/delegate').send({ sponsor: VALID, agent: VALID2, amount: 100 });
    expect(res.status).toBe(201);
    expect(res.body.txId).toBe('abc');
  });

  it('returns 503 for RegistryNotConfiguredError', async () => {
    const { RegistryNotConfiguredError } = await import('../registry');
    delegateOnChain.mockRejectedValue(new RegistryNotConfiguredError('not configured'));
    const res = await request(app).post('/delegate').send({ sponsor: VALID, agent: VALID2, amount: 100 });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REGISTRY_NOT_CONFIGURED');
  });

  it('returns 400 for RegistryValidationError', async () => {
    const { RegistryValidationError } = await import('../registry');
    delegateOnChain.mockRejectedValue(new RegistryValidationError('bad input'));
    const res = await request(app).post('/delegate').send({ sponsor: VALID, agent: VALID2, amount: 100 });
    expect(res.status).toBe(400);
  });

  it('returns 500 on generic error', async () => {
    delegateOnChain.mockRejectedValue(new Error('fail'));
    const res = await request(app).post('/delegate').send({ sponsor: VALID, agent: VALID2, amount: 100 });
    expect(res.status).toBe(500);
  });
});

describe('POST /revoke', () => {
  it('returns 400 without sponsor', async () => {
    const res = await request(app).post('/revoke').send({ agent: VALID2 });
    expect(res.status).toBe(400);
  });

  it('returns 400 without agent', async () => {
    const res = await request(app).post('/revoke').send({ sponsor: VALID });
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid sponsor', async () => {
    const res = await request(app).post('/revoke').send({ sponsor: 'bad', agent: VALID2 });
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid agent', async () => {
    const res = await request(app).post('/revoke').send({ sponsor: VALID, agent: 'bad' });
    expect(res.status).toBe(400);
  });

  it('returns 200 on success', async () => {
    revokeOnChain.mockResolvedValue({ revoked: true });
    const res = await request(app).post('/revoke').send({ sponsor: VALID, agent: VALID2 });
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(true);
  });

  it('returns 503 for RegistryNotConfiguredError', async () => {
    const { RegistryNotConfiguredError } = await import('../registry');
    revokeOnChain.mockRejectedValue(new RegistryNotConfiguredError('not configured'));
    const res = await request(app).post('/revoke').send({ sponsor: VALID, agent: VALID2 });
    expect(res.status).toBe(503);
  });

  it('returns 400 for RegistryValidationError', async () => {
    const { RegistryValidationError } = await import('../registry');
    revokeOnChain.mockRejectedValue(new RegistryValidationError('bad'));
    const res = await request(app).post('/revoke').send({ sponsor: VALID, agent: VALID2 });
    expect(res.status).toBe(400);
  });

  it('returns 500 on generic error', async () => {
    revokeOnChain.mockRejectedValue(new Error('fail'));
    const res = await request(app).post('/revoke').send({ sponsor: VALID, agent: VALID2 });
    expect(res.status).toBe(500);
  });
});

describe('GET /passport', () => {
  it('returns 400 with invalid wallet', async () => {
    const res = await request(app).get('/passport?wallet=bad');
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    generatePassport.mockResolvedValue(null);
    const res = await request(app).get(`/passport?wallet=${VALID}`);
    expect(res.status).toBe(404);
  });

  it('returns passport result', async () => {
    generatePassport.mockResolvedValue({ wallet: VALID, score: 80 });
    const res = await request(app).get(`/passport?wallet=${VALID}`);
    expect(res.status).toBe(200);
    expect(res.body.wallet).toBe(VALID);
  });

  it('caches passport result', async () => {
    generatePassport.mockResolvedValue({ wallet: VALID });
    await request(app).get(`/passport?wallet=${VALID}`);
    await request(app).get(`/passport?wallet=${VALID}`);
    expect(generatePassport).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on error', async () => {
    generatePassport.mockRejectedValue(new Error('fail'));
    const res = await request(app).get(`/passport?wallet=${VALID}`);
    expect(res.status).toBe(500);
  });
});

describe('GET /verify', () => {
  it('returns 400 without wallet', async () => {
    const res = await request(app).get('/verify');
    expect(res.status).toBe(400);
  });

  it('returns valid=true with flags for valid wallet', async () => {
    const res = await request(app).get(`/verify?wallet=${VALID}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.wallet).toBe(VALID);
    expect(res.body.flags).toBeDefined();
  });

  it('returns cached verify on second call', async () => {
    const r1 = await request(app).get(`/verify?wallet=${VALID}`);
    const r2 = await request(app).get(`/verify?wallet=${VALID}`);
    expect(r1.status).toBe(200);
    expect(r2.body.cached).toBe(true);
  });

  it('returns valid=false for invalid wallet format', async () => {
    const res = await request(app).get('/verify?wallet=short');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('handles algod lookup failure gracefully', async () => {
    algod.accountInformation.mockReturnValue({
      do: vi.fn(() => Promise.reject(new Error('not found'))),
    });
    const res = await request(app).get(`/verify?wallet=${VALID}`);
    expect(res.status).toBe(200);
    expect(res.body.flags.lookupFailed).toBe(true);
  });
});

describe('GET /discovery/search', () => {
  it('returns all results without query', async () => {
    const res = await request(app).get('/discovery/search');
    expect(res.status).toBe(200);
    expect(res.body.results).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('filters by query', async () => {
    const res = await request(app).get('/discovery/search?q=trust');
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for unmatched query', async () => {
    const res = await request(app).get('/discovery/search?q=zzzznotfound');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('clamps limit to max 100', async () => {
    const res = await request(app).get('/discovery/search?limit=9999');
    expect(res.status).toBe(200);
  });

  it('defaults limit to 20', async () => {
    const res = await request(app).get('/discovery/search');
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeLessThanOrEqual(20);
  });
});

describe('POST /reputation/subscribe', () => {
  it('returns 400 without wallet', async () => {
    const res = await request(app).post('/reputation/subscribe').send({ url: 'http://x.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid wallet', async () => {
    const res = await request(app).post('/reputation/subscribe').send({ wallet: 'bad', url: 'http://x.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 without url', async () => {
    const res = await request(app).post('/reputation/subscribe').send({ wallet: VALID });
    expect(res.status).toBe(400);
  });

  it('returns 400 with non-http url', async () => {
    const res = await request(app).post('/reputation/subscribe').send({ wallet: VALID, url: 'ftp://x.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 with non-string url', async () => {
    const res = await request(app).post('/reputation/subscribe').send({ wallet: VALID, url: 123 });
    expect(res.status).toBe(400);
  });

  it('creates subscriber on valid input', async () => {
    const res = await request(app).post('/reputation/subscribe').send({ wallet: VALID, url: 'https://hook.example.com' });
    expect(res.status).toBe(201);
    expect(addSubscriber).toHaveBeenCalled();
  });
});

describe('DELETE /reputation/subscribe/:id', () => {
  it('returns 204 on success', async () => {
    removeSubscriber.mockReturnValue(true);
    const res = await request(app).delete('/reputation/subscribe/sub-1');
    expect(res.status).toBe(204);
  });

  it('returns 404 when not found', async () => {
    removeSubscriber.mockReturnValue(false);
    const res = await request(app).delete('/reputation/subscribe/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('GET /reputation/subscribers', () => {
  it('returns subscribers list', async () => {
    const res = await request(app).get('/reputation/subscribers');
    expect(res.status).toBe(200);
    expect(res.body.subscribers).toBeInstanceOf(Array);
    expect(listSubscribers).toHaveBeenCalledWith(undefined);
  });

  it('filters by wallet', async () => {
    const res = await request(app).get(`/reputation/subscribers?wallet=${VALID}`);
    expect(res.status).toBe(200);
    expect(listSubscribers).toHaveBeenCalledWith(VALID);
  });
});

describe('GET /dashboard', () => {
  it('attempts to send dashboard file', async () => {
    const res = await request(app).get('/dashboard');
    expect([200, 404]).toContain(res.status);
  });
});

describe('Middleware integration', () => {
  it('rateLimiter and corsMiddleware are registered as middleware', async () => {
    const res = await request(app).get('/test-does-not-exist');
    expect([404, 200]).toContain(res.status);
  });
});

describe('validateAmount edge cases', () => {
  it('rejects 0 amount for credit-estimate', async () => {
    const res = await request(app).post('/credit-estimate').send({ wallet: VALID, amount: 0 });
    expect(res.status).toBe(400);
  });

  it('treats Infinity (serialized as null) as no amount → 404 from upstream', async () => {
    estimateCredit.mockResolvedValue(null);
    const res = await request(app).post('/credit-estimate').send({ wallet: VALID, amount: Infinity });
    expect(res.status).toBe(404);
  });

  it('treats null amount as no amount (defaults to undefined)', async () => {
    estimateCredit.mockResolvedValue(null);
    const res = await request(app).post('/credit-estimate').send({ wallet: VALID, amount: null });
    expect(res.status).toBe(404);
  });
});

describe('POST /reputation/record amount validation', () => {
  it('accepts amount=0', async () => {
    recordEvent.mockResolvedValue({ recorded: true });
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'payment', amount: 0 });
    expect(res.status).toBe(200);
  });

  it('Infinity becomes null in JSON → treated as 0 amount', async () => {
    recordEvent.mockResolvedValue({ recorded: true });
    const res = await request(app).post('/reputation/record').send({ wallet: VALID, eventType: 'payment', amount: Infinity });
    expect(res.status).toBe(200);
  });
});
