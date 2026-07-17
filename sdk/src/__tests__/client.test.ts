/**
 * Unit tests for the AgentPassportClient.
 * Uses Node's built-in fetch — no external mocking lib required.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentPassportClient } from '../index';
import {
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServerError,
  IdempotencyError,
  TimeoutError,
  ConnectionError,
} from '../errors';

const VALID_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';
const ALT_WALLET = 'ALT7V52CKSH5F2S6L4XJ7UKI3DPEHBQJAHOV4DKRY7GNU3CJQX6FMT2BIP';

function mockFetchResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('AgentPassportClient', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('construction', () => {
    it('throws on missing baseUrl', () => {
      expect(() => new AgentPassportClient({ baseUrl: '' } as any)).toThrow('baseUrl is required');
    });

    it('strips trailing slash from baseUrl', () => {
      const c = new AgentPassportClient({ baseUrl: 'http://example.com/' });
      expect((c as any).baseUrl).toBe('http://example.com');
    });

    it('applies default timeout, retries, retryDelay', () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      expect((c as any).timeout).toBe(30_000);
      expect((c as any).retries).toBe(3);
      expect((c as any).retryDelay).toBe(1_000);
    });
  });

  describe('validation', () => {
    it('rejects invalid wallet on getScore', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      await expect(c.getScore('invalid')).rejects.toThrow(ValidationError);
    });

    it('rejects empty wallet', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      await expect(c.getScore('')).rejects.toThrow(ValidationError);
    });

    it('rejects 57-char wallet', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      await expect(c.getScore('A'.repeat(57))).rejects.toThrow(ValidationError);
    });

    it('rejects 59-char wallet', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      await expect(c.getScore('A'.repeat(59))).rejects.toThrow(ValidationError);
    });
  });

  describe('request flow', () => {
    it('passes through 2xx responses', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      globalThis.fetch = vi.fn(async () =>
        mockFetchResponse(200, { status: 'ok', service: 'x' }),
      ) as any;
      const res = await c.health();
      expect(res.status).toBe('ok');
    });

    it('maps 404 to NotFoundError', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      globalThis.fetch = vi.fn(async () =>
        mockFetchResponse(404, { error: 'Wallet not found on testnet' }),
      ) as any;
      await expect(c.getScore(VALID_WALLET)).rejects.toThrow(NotFoundError);
    });

    it('maps 400 to ValidationError', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      globalThis.fetch = vi.fn(async () =>
        mockFetchResponse(400, { error: 'Invalid wallet' }),
      ) as any;
      await expect(c.getScore(VALID_WALLET)).rejects.toThrow(ValidationError);
    });

    it('maps 500 to ServerError', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      globalThis.fetch = vi.fn(async () =>
        mockFetchResponse(500, { error: 'Internal error' }),
      ) as any;
      await expect(c.getScore(VALID_WALLET)).rejects.toThrow(ServerError);
    });

    it('maps 409 to IdempotencyError on idempotency conflict', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      globalThis.fetch = vi.fn(async () =>
        mockFetchResponse(409, { error: 'Idempotency-Key conflict' }),
      ) as any;
      await expect(
        c.endorse({ sponsor: VALID_WALLET, agent: ALT_WALLET, amount: 1000 }),
      ).rejects.toThrow(IdempotencyError);
    });

    it('maps 429 to RateLimitError', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x', retries: 0 });
      globalThis.fetch = vi.fn(async () =>
        mockFetchResponse(429, { error: 'Too many requests' }, { 'retry-after': '30' }),
      ) as any;
      try {
        await c.getScore(VALID_WALLET);
      } catch (e: any) {
        expect(e).toBeInstanceOf(RateLimitError);
        expect(e.retryAfter).toBe(30);
      }
    });
  });

  describe('headers', () => {
    it('sets Authorization header when apiKey is configured', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x', apiKey: 'secret-key' });
      let capturedHeaders: any;
      globalThis.fetch = vi.fn(async (_url, init: any) => {
        capturedHeaders = init.headers;
        return mockFetchResponse(200, { status: 'ok' });
      }) as any;
      await c.health();
      expect(capturedHeaders['Authorization']).toBe('Bearer secret-key');
    });

    it('sends Idempotency-Key header on endorse', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      let capturedHeaders: any;
      globalThis.fetch = vi.fn(async (_url, init: any) => {
        capturedHeaders = init.headers;
        return mockFetchResponse(201, { txId: 'tx1' });
      }) as any;
      await c.endorse({
        sponsor: VALID_WALLET,
        agent: ALT_WALLET,
        amount: 1000,
        idempotencyKey: 'key-12345678',
      });
      expect(capturedHeaders['Idempotency-Key']).toBe('key-12345678');
    });
  });

  describe('endorse', () => {
    it('sends POST to /delegate with body', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      let captured: any;
      globalThis.fetch = vi.fn(async (url: any, init: any) => {
        captured = { url, init };
        return mockFetchResponse(201, { txId: 'tx1', sponsor: VALID_WALLET, agent: ALT_WALLET, amount: 1000, round: 0, timestamp: 0 });
      }) as any;
      await c.endorse({ sponsor: VALID_WALLET, agent: ALT_WALLET, amount: 1000 });
      expect(captured.url).toBe(`http://x/delegate`);
      expect(captured.init.method).toBe('POST');
      const body = JSON.parse(captured.init.body);
      expect(body.sponsor).toBe(VALID_WALLET);
      expect(body.agent).toBe(ALT_WALLET);
      expect(body.amount).toBe(1000);
    });

    it('rejects self-delegation', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      await expect(
        c.endorse({ sponsor: VALID_WALLET, agent: VALID_WALLET, amount: 1000 }),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects non-positive amount', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      await expect(
        c.endorse({ sponsor: VALID_WALLET, agent: ALT_WALLET, amount: 0 }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('revoke', () => {
    it('sends POST to /revoke with body', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      let captured: any;
      globalThis.fetch = vi.fn(async (url: any, init: any) => {
        captured = { url, init };
        return mockFetchResponse(200, { txId: 'tx1', sponsor: VALID_WALLET, agent: ALT_WALLET, round: 0, timestamp: 0 });
      }) as any;
      await c.revoke({ sponsor: VALID_WALLET, agent: ALT_WALLET });
      expect(captured.url).toBe(`http://x/revoke`);
      expect(captured.init.method).toBe('POST');
      const body = JSON.parse(captured.init.body);
      expect(body.sponsor).toBe(VALID_WALLET);
      expect(body.agent).toBe(ALT_WALLET);
    });
  });

  describe('createPassport', () => {
    it('is an alias for getPassport', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      globalThis.fetch = vi.fn(async () =>
        mockFetchResponse(200, { wallet: VALID_WALLET, checksum: 'abc' }),
      ) as any;
      const p = await c.createPassport({ wallet: VALID_WALLET });
      expect(p.wallet).toBe(VALID_WALLET);
    });
  });

  describe('verifyCounterparty', () => {
    it('sends POST to /counterparty-check', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      let captured: any;
      globalThis.fetch = vi.fn(async (url: any, init: any) => {
        captured = { url, init };
        return mockFetchResponse(200, { allow: true, confidence: 0.9, riskLevel: 'low', trustScore: 80, onChainScore: 80, delegationScore: 80, explanation: [] });
      }) as any;
      await c.checkCounterparty(VALID_WALLET);
      expect(captured.url).toBe(`http://x/counterparty-check`);
      const body = JSON.parse(captured.init.body);
      expect(body.buyer).toBe(VALID_WALLET);
    });
  });

  describe('underwrite', () => {
    it('sends GET to /underwrite', async () => {
      const c = new AgentPassportClient({ baseUrl: 'http://x' });
      let captured: any;
      globalThis.fetch = vi.fn(async (url: any, init: any) => {
        captured = { url, init };
        return mockFetchResponse(200, { wallet: VALID_WALLET, approved: true, compositeScore: 80, riskLevel: 'low', recommendedLimit: 100, confidence: 0.9, factors: {}, explanation: [] });
      }) as any;
      await c.underwrite(VALID_WALLET);
      expect(captured.url).toBe(`http://x/underwrite?wallet=${VALID_WALLET}`);
      expect(captured.init.method).toBe('GET');
    });
  });
});
