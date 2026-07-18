import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const mockConfig = {
  x402Enabled: false,
  x402FacilitatorUrl: 'https://facilitator.test',
  x402PaymentRecipient: '',
  x402Network: 'eip155:84532' as `${string}:${string}`,
};

vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('../metrics', () => ({
  recordX402SettlementFailure: vi.fn(),
}));

vi.mock('../../config', () => ({
  get config() { return mockConfig; },
}));

vi.mock('../constants', () => ({
  X402_PRICING: {
    '/score': { price: 0.001, description: 'Trust Score' },
    '/delegation': { price: 0.001, description: 'Delegation Trust' },
  },
}));

vi.mock('@x402/core/server', () => ({
  HTTPFacilitatorClient: vi.fn().mockImplementation(() => ({
    verify: vi.fn(),
  })),
}));

vi.mock('@x402/express', () => ({
  paymentMiddlewareFromConfig: vi.fn().mockReturnValue(
    (_req: unknown, _res: unknown, next: NextFunction) => next(),
  ),
}));

function mockReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, path: '/score', ...overrides } as unknown as Request;
}

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response &
    { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe('x402Middleware', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('is passthrough when x402 is disabled', async () => {
    mockConfig.x402Enabled = false;
    const { x402Middleware } = await import('../x402');
    const next = vi.fn();
    x402Middleware(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('is passthrough when payment recipient is empty', async () => {
    mockConfig.x402Enabled = true;
    mockConfig.x402PaymentRecipient = '';
    const { x402Middleware } = await import('../x402');
    const next = vi.fn();
    x402Middleware(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('delegates to paymentMiddlewareFromConfig when enabled', async () => {
    mockConfig.x402Enabled = true;
    mockConfig.x402PaymentRecipient = 'payee_addr';
    await import('../x402');
    const { paymentMiddlewareFromConfig } = await import('@x402/express');
    expect(paymentMiddlewareFromConfig).toHaveBeenCalled();
  });

  it('builds routes with correct accepts structure', async () => {
    mockConfig.x402Enabled = true;
    mockConfig.x402PaymentRecipient = 'payee_addr';
    await import('../x402');
    const { paymentMiddlewareFromConfig } = await import('@x402/express');
    const routes = vi
      .mocked(paymentMiddlewareFromConfig)
      .mock.calls[0][0] as Record<string, unknown>;
    expect(routes).toHaveProperty('/score');
    expect(routes['/score']).toEqual({
      accepts: {
        scheme: 'exact',
        network: 'eip155:84532',
        payTo: 'payee_addr',
        price: '0.001',
      },
    });
  });
});

describe('settlementVerificationMiddleware', () => {
  let svm: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockConfig.x402Enabled = true;
    mockConfig.x402PaymentRecipient = 'payee_addr';
    const mod = await import('../x402');
    svm = mod.settlementVerificationMiddleware;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls next when x402 is disabled', async () => {
    mockConfig.x402Enabled = false;
    const next = vi.fn();
    svm(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next when x-payment header is absent', async () => {
    const next = vi.fn();
    svm(mockReq({ headers: {} }), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next when route is not in X402_PRICING', async () => {
    const next = vi.fn();
    svm(
      mockReq({ headers: { 'x-payment': 'proof' }, path: '/unknown-route' }),
      mockRes(),
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('normalizes trailing slashes before route lookup', async () => {
    const next = vi.fn();
    svm(
      mockReq({ headers: { 'x-payment': 'proof' }, path: '/score/' }),
      mockRes(),
      next,
    );
    // Should NOT call next immediately — it should go into async verification
    // because /score/ normalizes to /score which IS in X402_PRICING
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when settlement is verified', async () => {
    vi.useFakeTimers();
    const { HTTPFacilitatorClient } = await import('@x402/core/server');
    vi.mocked(HTTPFacilitatorClient).mockImplementationOnce(() => ({
      verify: vi.fn().mockResolvedValue({ isValid: true }),
    } as never));

    const next = vi.fn();
    svm(
      mockReq({ headers: { 'x-payment': 'proof' }, path: '/score' }),
      mockRes(),
      next,
    );
    await vi.advanceTimersByTimeAsync(10);
    expect(next).toHaveBeenCalled();
  });

  it('returns 402 when settlement verification fails', async () => {
    vi.useFakeTimers();
    const { HTTPFacilitatorClient } = await import('@x402/core/server');
    vi.mocked(HTTPFacilitatorClient).mockImplementationOnce(() => ({
      verify: vi.fn().mockResolvedValue({
        isValid: false,
        invalidReason: 'insufficient_funds',
      }),
    } as never));

    const res = mockRes();
    const next = vi.fn();
    svm(
      mockReq({ headers: { 'x-payment': 'proof' }, path: '/score' }),
      res,
      next,
    );
    await vi.advanceTimersByTimeAsync(10);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Payment settlement not verified' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('uses invalidMessage as fallback reason', async () => {
    vi.useFakeTimers();
    const { HTTPFacilitatorClient } = await import('@x402/core/server');
    vi.mocked(HTTPFacilitatorClient).mockImplementationOnce(() => ({
      verify: vi.fn().mockResolvedValue({
        isValid: false,
        invalidReason: undefined,
        invalidMessage: 'tx not found',
      }),
    } as never));

    const res = mockRes();
    svm(
      mockReq({ headers: { 'x-payment': 'proof' }, path: '/score' }),
      res,
      vi.fn(),
    );
    await vi.advanceTimersByTimeAsync(10);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Payment settlement not verified', reason: 'tx not found' }),
    );
  });

  it('returns 502 when verifySettlement itself throws', async () => {
    vi.useFakeTimers();
    const { HTTPFacilitatorClient } = await import('@x402/core/server');
    vi.mocked(HTTPFacilitatorClient).mockImplementationOnce(() => ({
      verify: vi.fn().mockRejectedValue(new Error('facilitator down')),
    } as never));

    const { logger } = await import('../logger');
    vi.mocked(logger.error).mockImplementationOnce(() => {
      throw new Error('logger broken');
    });

    const res = mockRes();
    const next = vi.fn();
    svm(
      mockReq({ headers: { 'x-payment': 'proof' }, path: '/delegation' }),
      res,
      next,
    );
    await vi.advanceTimersByTimeAsync(10);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Settlement verification unavailable' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('records settlement failure metric on invalid settlement', async () => {
    vi.useFakeTimers();
    const { HTTPFacilitatorClient } = await import('@x402/core/server');
    vi.mocked(HTTPFacilitatorClient).mockImplementationOnce(() => ({
      verify: vi.fn().mockResolvedValue({ isValid: false, invalidReason: 'double_spend' }),
    } as never));
    const metrics = await import('../metrics');

    svm(
      mockReq({ headers: { 'x-payment': 'proof' }, path: '/score' }),
      mockRes(),
      vi.fn(),
    );
    await vi.advanceTimersByTimeAsync(10);

    expect(metrics.recordX402SettlementFailure).toHaveBeenCalledWith('double_spend');
  });

  it('records exception as settlement failure', async () => {
    vi.useFakeTimers();
    const { HTTPFacilitatorClient } = await import('@x402/core/server');
    vi.mocked(HTTPFacilitatorClient).mockImplementationOnce(() => ({
      verify: vi.fn().mockRejectedValue('something broke'),
    } as never));
    const metrics = await import('../metrics');

    svm(
      mockReq({ headers: { 'x-payment': 'proof' }, path: '/score' }),
      mockRes(),
      vi.fn(),
    );
    await vi.advanceTimersByTimeAsync(10);

    expect(metrics.recordX402SettlementFailure).toHaveBeenCalledWith('exception');
  });

  it('builds correct requirements from route pricing and config', async () => {
    vi.useFakeTimers();
    const { HTTPFacilitatorClient } = await import('@x402/core/server');
    const mockVerify = vi.fn().mockResolvedValue({ isValid: true });
    vi.mocked(HTTPFacilitatorClient).mockImplementationOnce(() => ({
      verify: mockVerify,
    } as never));

    svm(
      mockReq({ headers: { 'x-payment': 'proof' }, path: '/delegation' }),
      mockRes(),
      vi.fn(),
    );
    await vi.advanceTimersByTimeAsync(10);

    expect(mockVerify).toHaveBeenCalledWith(
      'proof',
      { price: '0.001', payTo: 'payee_addr', network: 'eip155:84532' },
    );
  });
});
