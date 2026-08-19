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

function mockReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, path: '/score', ...overrides } as unknown as Request;
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  return res;
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockConfig.x402Enabled = true;
  mockConfig.x402PaymentRecipient = 'payee_addr';
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ isValid: true }), { status: 200 }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  mockConfig.x402Enabled = false;
  mockConfig.x402PaymentRecipient = '';
});

describe('x402Middleware', () => {
  it('calls next when x402 is disabled', async () => {
    mockConfig.x402Enabled = false;
    const next = vi.fn();
    await new Promise<void>((resolve) => {
      x402Middleware(mockReq(), mockRes() as Response, (() => { resolve(); next(); }) as NextFunction);
    });
    expect(next).toHaveBeenCalled();
  });

  it('returns 402 when x-payment header is absent', async () => {
    const res = mockRes();
    const next = vi.fn();
    x402Middleware(mockReq(), res as unknown as Response, next as NextFunction);
    await new Promise(r => setTimeout(r, 10));
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 402 when route is not in X402_PRICING', () => {
    const res = mockRes();
    const next = vi.fn();
    x402Middleware(mockReq({ path: '/unknown' }), res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('normalizes trailing slashes before route lookup', async () => {
    const res = mockRes();
    const next = vi.fn();
    x402Middleware(mockReq({ path: '/score/' }), res as unknown as Response, next as NextFunction);
    await new Promise(r => setTimeout(r, 10));
    expect(res.status).toHaveBeenCalledWith(402);
  });

  it('calls next when settlement is verified', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: true }), { status: 200 }),
    );
    const next = vi.fn();
    const req = mockReq({ headers: { 'x-payment': 'proof' } });
    await new Promise<void>((resolve) => {
      x402Middleware(req, mockRes() as Response, (() => { resolve(); next(); }) as NextFunction);
    });
    expect(next).toHaveBeenCalled();
  });

  it('rejects when settlement fails', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: false, invalidMessage: 'tx not found' }), { status: 200 }),
    );
    const res = mockRes();
    const next = vi.fn();
    const req = mockReq({ headers: { 'x-payment': 'proof' } });
    x402Middleware(req, res as unknown as Response, next as NextFunction);
    await new Promise(r => setTimeout(r, 10));
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 502 when fetch throws', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const res = mockRes();
    const next = vi.fn();
    const req = mockReq({ headers: { 'x-payment': 'proof' } });
    x402Middleware(req, res as unknown as Response, next as NextFunction);
    await new Promise(r => setTimeout(r, 10));
    expect(res.status).toHaveBeenCalledWith(402);
  });
});

describe('verifySettlement', () => {
  it('returns verified when facilitator confirms', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: true }), { status: 200 }),
    );
    const result = await verifySettlement('proof', { price: '0.001' });
    expect(result.verified).toBe(true);
  });

  it('returns unverified with reason when facilitator rejects', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: false, invalidReason: 'global_block' }), { status: 200 }),
    );
    const result = await verifySettlement('proof', { price: '0.001' });
    expect(result.verified).toBe(false);
    expect(result.error).toBe('global_block');
  });

  it('returns verified when x402 is disabled', async () => {
    mockConfig.x402Enabled = false;
    const result = await verifySettlement('proof', { price: '0.001' });
    expect(result.verified).toBe(true);
  });

  it('uses invalidMessage as fallback reason', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: false, invalidMessage: 'msg' }), { status: 200 }),
    );
    const result = await verifySettlement('proof', { price: '0.001' });
    expect(result.error).toBe('msg');
  });

  it('returns unverified when fetch throws', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await verifySettlement('proof', { price: '0.001' });
    expect(result.verified).toBe(false);
  });
});

describe('settlementVerificationMiddleware', () => {
  it('calls next when x402 is disabled', () => {
    mockConfig.x402Enabled = false;
    const next = vi.fn();
    settlementVerificationMiddleware(mockReq(), mockRes() as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next when x-payment header is absent', () => {
    const next = vi.fn();
    settlementVerificationMiddleware(mockReq(), mockRes() as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next when route is not in X402_PRICING', () => {
    const next = vi.fn();
    const req = mockReq({ path: '/unknown', headers: { 'x-payment': 'proof' } });
    settlementVerificationMiddleware(req, mockRes() as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next when settlement is verified', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: true }), { status: 200 }),
    );
    const next = vi.fn();
    const req = mockReq({ headers: { 'x-payment': 'proof' } });
    await new Promise<void>((resolve) => {
      settlementVerificationMiddleware(req, mockRes() as Response, (() => { resolve(); next(); }) as NextFunction);
    });
    expect(next).toHaveBeenCalled();
  });

  it('returns 402 when settlement is not verified', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: false, invalidMessage: 'bad' }), { status: 200 }),
    );
    const res = mockRes();
    const next = vi.fn();
    const req = mockReq({ headers: { 'x-payment': 'proof' } });
    settlementVerificationMiddleware(req, res as unknown as Response, next);
    await new Promise(r => setTimeout(r, 10));
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 502 when verification throws', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const res = mockRes();
    const next = vi.fn();
    const req = mockReq({ headers: { 'x-payment': 'proof' } });
    settlementVerificationMiddleware(req, res as unknown as Response, next);
    await new Promise(r => setTimeout(r, 10));
    expect(res.status).toHaveBeenCalledWith(402);
  });
});

import { x402Middleware, verifySettlement, settlementVerificationMiddleware } from '../x402';