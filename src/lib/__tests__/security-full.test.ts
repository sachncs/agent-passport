import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  rateLimiter,
  corsMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
  resetRateLimiter,
  setRateLimitOverrides,
  getRateLimitOverrides,
} from '../security';
import { logger } from '../logger';

afterEach(() => {
  resetRateLimiter();
  vi.unstubAllEnvs();
});

describe('rateLimiter', () => {
  function makeApp(opts: { windowMs?: number; max?: number } = {}) {
    const app = express();
    app.set('trust proxy', 1);
    app.use(rateLimiter(opts));
    app.get('/test', (_req, res) => res.json({ ok: true }));
    app.get('/health', (_req, res) => res.json({ ok: true }));
    app.get('/ready', (_req, res) => res.json({ ok: true }));
    app.get('/health/deep', (_req, res) => res.json({ ok: true }));
    app.get('/metrics', (_req, res) => res.json({ ok: true }));
    app.get('/registry/status', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('allows requests under limit', async () => {
    const app = makeApp({ windowMs: 10000, max: 3 });
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('3');
    expect(res.headers['x-ratelimit-remaining']).toBe('2');
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('blocks requests over limit', async () => {
    const app = makeApp({ windowMs: 10000, max: 2 });
    await request(app).get('/test');
    await request(app).get('/test');
    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Too many requests');
  });

  it('resets after window expires', async () => {
    vi.useFakeTimers();
    const app = makeApp({ windowMs: 1000, max: 1 });
    await request(app).get('/test');
    vi.advanceTimersByTime(1001);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    vi.useRealTimers();
  });

  it('bypasses /health endpoint', async () => {
    const app = makeApp({ windowMs: 10000, max: 0 });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('bypasses /ready endpoint', async () => {
    const app = makeApp({ windowMs: 10000, max: 0 });
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
  });

  it('bypasses /health/deep endpoint', async () => {
    const app = makeApp({ windowMs: 10000, max: 0 });
    const res = await request(app).get('/health/deep');
    expect(res.status).toBe(200);
  });

  it('bypasses /metrics endpoint', async () => {
    const app = makeApp({ windowMs: 10000, max: 0 });
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
  });

  it('bypasses /registry/status endpoint', async () => {
    const app = makeApp({ windowMs: 10000, max: 0 });
    const res = await request(app).get('/registry/status');
    expect(res.status).toBe(200);
  });

  it('bypasses in LOAD_TEST_MODE', async () => {
    vi.stubEnv('LOAD_TEST_MODE', '1');
    const app = makeApp({ windowMs: 10000, max: 0 });
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('bypasses trusted IPs via X-Forwarded-For', async () => {
    vi.stubEnv('RATE_LIMIT_TRUSTED_IPS', '10.0.0.99');
    const app = makeApp({ windowMs: 10000, max: 0 });
    const res = await request(app)
      .get('/test')
      .set('X-Forwarded-For', '10.0.0.99');
    expect(res.status).toBe(200);
  });

  it('does not bypass non-trusted IPs', async () => {
    vi.stubEnv('RATE_LIMIT_TRUSTED_IPS', '10.0.0.1');
    const app = makeApp({ windowMs: 10000, max: 0 });
    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
  });

  it('reads max from RATE_LIMIT_MAX env', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '5');
    const app = makeApp({ windowMs: 10000 });
    await request(app).get('/test');
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('falls back to 600 when RATE_LIMIT_MAX is not a number', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', 'not-a-number');
    const app = makeApp({ windowMs: 10000 });
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('applies route-specific overrides for POST /delegate', async () => {
    setRateLimitOverrides({});
    const app = makeApp({ windowMs: 10000, max: 1000 });
    app.post('/delegate', (_req, res) => res.json({ ok: true }));
    for (let i = 0; i < 5; i++) {
      await request(app).post('/delegate');
    }
    const res = await request(app).post('/delegate');
    expect(res.status).toBe(429);
  });

  it('applies override for POST /revoke', async () => {
    setRateLimitOverrides({});
    const app = makeApp({ windowMs: 10000, max: 1000 });
    app.post('/revoke', (_req, res) => res.json({ ok: true }));
    for (let i = 0; i < 5; i++) {
      await request(app).post('/revoke');
    }
    const res = await request(app).post('/revoke');
    expect(res.status).toBe(429);
  });

  it('applies override for GET /underwrite', async () => {
    setRateLimitOverrides({});
    const app = makeApp({ windowMs: 10000, max: 1000 });
    app.get('/underwrite', (_req, res) => res.json({ ok: true }));
    for (let i = 0; i < 30; i++) {
      await request(app).get('/underwrite');
    }
    const res = await request(app).get('/underwrite');
    expect(res.status).toBe(429);
  });

  it('applies override for POST /counterparty-check', async () => {
    setRateLimitOverrides({});
    const app = makeApp({ windowMs: 10000, max: 1000 });
    app.post('/counterparty-check', (_req, res) => res.json({ ok: true }));
    for (let i = 0; i < 120; i++) {
      await request(app).post('/counterparty-check');
    }
    const res = await request(app).post('/counterparty-check');
    expect(res.status).toBe(429);
  });

  it('custom overrides take effect', async () => {
    setRateLimitOverrides({ 'GET /custom': { max: 2 } });
    const overrides = getRateLimitOverrides();
    expect(overrides['GET /custom'].max).toBe(2);
    expect(overrides['POST /delegate']).toBeDefined();
  });
});

describe('corsMiddleware', () => {
  function makeApp(opts: { origin?: string } = {}) {
    const app = express();
    app.use(corsMiddleware(opts));
    app.get('/test', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('sets wildcard Access-Control-Allow-Origin', async () => {
    const app = makeApp({ origin: '*' });
    const res = await request(app).get('/test');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('allows matching origin', async () => {
    const app = makeApp({ origin: 'https://app.example.com' });
    const res = await request(app).get('/test').set('Origin', 'https://app.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect(res.headers['vary']).toBe('Origin');
  });

  it('does not set origin for non-matching origin', async () => {
    const app = makeApp({ origin: 'https://allowed.com' });
    const res = await request(app).get('/test').set('Origin', 'https://evil.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('handles comma-separated origins', async () => {
    const app = makeApp({ origin: 'https://a.com,https://b.com' });
    const res = await request(app).get('/test').set('Origin', 'https://b.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://b.com');
  });

  it('returns 204 for OPTIONS preflight', async () => {
    const app = makeApp();
    const res = await request(app).options('/test');
    expect(res.status).toBe(204);
  });

  it('sets Access-Control-Allow-Methods', async () => {
    const app = makeApp();
    const res = await request(app).get('/test');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('sets Access-Control-Allow-Headers', async () => {
    const app = makeApp();
    const res = await request(app).get('/test');
    expect(res.headers['access-control-allow-headers']).toContain('Content-Type');
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
    expect(res.headers['access-control-allow-headers']).toContain('X-Request-ID');
  });

  it('sets Access-Control-Max-Age', async () => {
    const app = makeApp();
    const res = await request(app).get('/test');
    expect(res.headers['access-control-max-age']).toBe('86400');
  });

  it('defaults to wildcard when no origin specified', async () => {
    const app = makeApp({});
    const res = await request(app).get('/test');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});

describe('requestIdMiddleware', () => {
  function makeApp() {
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/test', (_req, res) => {
      res.json({
        requestId: (_req as { requestId?: string })
          .requestId,
      });
    });
    return app;
  }

  it('generates a UUID when no X-Request-ID header', async () => {
    const app = makeApp();
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('preserves valid UUID format X-Request-ID', async () => {
    const app = makeApp();
    const id = '12345678-1234-1234-1234-123456789abc';
    const res = await request(app).get('/test').set('X-Request-ID', id);
    expect(res.body.requestId).toBe(id);
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('rejects invalid format and generates new UUID', async () => {
    const app = makeApp();
    const res = await request(app).get('/test').set('X-Request-ID', 'not-a-uuid');
    expect(res.body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(res.body.requestId).not.toBe('not-a-uuid');
  });

  it('rejects empty string and generates new UUID', async () => {
    const app = makeApp();
    const res = await request(app).get('/test').set('X-Request-ID', '');
    expect(res.body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('rejects uppercase hex UUID and generates new UUID', async () => {
    const app = makeApp();
    const res = await request(app).get('/test').set('X-Request-ID', '12345678-1234-1234-1234-123456789ABC');
    expect(res.body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

describe('requestLoggingMiddleware', () => {
  function makeApp() {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(requestLoggingMiddleware);
    app.get('/test', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('logs incoming request with method and path', async () => {
    const app = makeApp();
    await request(app).get('/test');
    expect(logger.info).toHaveBeenCalledWith('Request received', expect.objectContaining({
      method: 'GET',
      path: '/test',
    }));
  });

  it('sets clientIp on request', async () => {
    const app = makeApp();
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('logs requestId', async () => {
    const app = makeApp();
    await request(app).get('/test');
    expect(logger.info).toHaveBeenCalledWith('Request received', expect.objectContaining({
      requestId: expect.stringMatching(/^[0-9a-f-]+$/),
    }));
  });
});

describe('resetRateLimiter', () => {
  it('clears internal state without error', () => {
    expect(() => resetRateLimiter()).not.toThrow();
  });
});

describe('getRateLimitOverrides', () => {
  it('returns default overrides', () => {
    const overrides = getRateLimitOverrides();
    expect(overrides['POST /delegate']).toBeDefined();
    expect(overrides['POST /revoke']).toBeDefined();
    expect(overrides['GET /underwrite']).toBeDefined();
    expect(overrides['POST /counterparty-check']).toBeDefined();
  });
});

describe('setRateLimitOverrides', () => {
  it('merges custom overrides with defaults', () => {
    setRateLimitOverrides({ 'GET /custom': { max: 99 } });
    const overrides = getRateLimitOverrides();
    expect(overrides['GET /custom'].max).toBe(99);
    expect(overrides['POST /delegate']).toBeDefined();
  });
});
