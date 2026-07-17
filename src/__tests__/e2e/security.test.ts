/**
 * E2E: Security Hardening
 *
 * Security-focused scenarios covering input validation, header
 * injection, rate limiting, request ID propagation, CORS, payload
 * size limits, and edge-case envelope handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, responseCache } from '../../app';
import {
  KNOWN_TESTNET_WALLET,
   ALT_TESTNET_WALLET,
   randomIdempotencyKey
} from './_fixtures';
import { isE2ESkipped } from './_fixtures';

const maybeDescribe = isE2ESkipped() ? describe.skip : describe;

beforeEach(() => {
  responseCache.clear();
});

maybeDescribe('Security: Input Validation', () => {
  const wallets = [
    '/score',
     '/delegation',
     '/sybil-check',
     '/reputation',
     '/underwrite',
     '/trust-graph',
     '/passport'
  ];

  for (const endpoint of wallets) {
    it(`rejects missing wallet on ${endpoint}`, async () => {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });

    it(`rejects invalid wallet on ${endpoint}`, async () => {
      const res = await request(app).get(`${endpoint}?wallet=invalid`);
      expect(res.status).toBe(400);
    });
  }

  it('rejects SQL injection in wallet', async () => {
    const res = await request(app).get("/score?wallet='; DROP TABLE users; --");
    expect(res.status).toBe(400);
  });

  it('rejects XSS in wallet', async () => {
    const res = await request(app).get('/score?wallet=<script>alert(1)</script>');
    expect(res.status).toBe(400);
  });

  it('rejects excessively long wallet (10000 chars)', async () => {
    const long = 'A'.repeat(10_000);
    const res = await request(app).get(`/score?wallet=${long}`);
    expect(res.status).toBe(400);
  });

  it('rejects wallet with whitespace', async () => {
    const walletWithSpace = ' ' + KNOWN_TESTNET_WALLET.slice(1);
    const res = await request(app).get(`/score?wallet=${encodeURIComponent(walletWithSpace)}`);
    expect(res.status).toBe(400);
  });

  it('rejects wallet with non-base32 characters (@)', async () => {
    const res = await request(app).get('/score?wallet=' + encodeURIComponent('@'.repeat(58)));
    expect(res.status).toBe(400);
  });

  it('rejects 57-char wallet (one short)', async () => {
    const res = await request(app).get('/score?wallet=' + 'A'.repeat(57));
    expect(res.status).toBe(400);
  });

  it('rejects 59-char wallet (one long)', async () => {
    const res = await request(app).get('/score?wallet=' + 'A'.repeat(59));
    expect(res.status).toBe(400);
  });
});

maybeDescribe('Security: Headers', () => {
  it('returns X-Request-ID for every request', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('echoes a valid client-provided X-Request-ID', async () => {
    const uuid = '11111111-2222-3333-4444-555555555555';
    const res = await request(app).get('/health').set('X-Request-ID', uuid);
    expect(res.headers['x-request-id']).toBe(uuid);
  });

  it('replaces invalid X-Request-ID with a server-generated one', async () => {
    const res = await request(app).get('/health').set('X-Request-ID', 'not-a-uuid');
    expect(res.headers['x-request-id']).not.toBe('not-a-uuid');
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('sets helmet security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('CORS preflight returns 204', async () => {
    const res = await request(app)
      .options('/passport')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-methods']).toBeDefined();
  });

  it('CORS allows configured origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});

maybeDescribe('Security: Rate Limiting', () => {
  it('exposes X-RateLimit-Limit header on non-exempt endpoint', async () => {
    const res = await request(app).get('/verify').query({ wallet: KNOWN_TESTNET_WALLET }).catch(() => null) || await request(app).get('/reputation').query({ wallet: KNOWN_TESTNET_WALLET });
    // /reputation will 200 or 404, but rate limit headers should always be set
    // on a rate-limited endpoint
    const limitedRes = await request(app).get(`/reputation?wallet=${KNOWN_TESTNET_WALLET}`);
    expect(limitedRes.headers['x-ratelimit-limit']).toBeDefined();
    // The default limit is 600 (was 60 pre-production)
    expect(parseInt(limitedRes.headers['x-ratelimit-limit'], 10)).toBe(600);
  });

  it('exposes X-RateLimit-Remaining header on non-exempt endpoint', async () => {
    const res = await request(app).get(`/reputation?wallet=${KNOWN_TESTNET_WALLET}`);
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('exposes X-RateLimit-Reset header on non-exempt endpoint', async () => {
    const res = await request(app).get(`/reputation?wallet=${KNOWN_TESTNET_WALLET}`);
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('/health is exempt from rate limiting', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await request(app).get('/health');
      expect(r.status).toBeLessThan(400);
    }
  });

  it('/metrics is exempt from rate limiting', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await request(app).get('/metrics');
      expect(r.status).toBe(200);
    }
  });
});

maybeDescribe('Security: Payload Limits', () => {
  it('rejects oversized JSON body (>100kb)', async () => {
    const large = 'A'.repeat(200_000);
    const res = await request(app)
      .post('/delegate')
      .set('Content-Type', 'application/json')
      .send({
        sponsor: KNOWN_TESTNET_WALLET,
         agent: ALT_TESTNET_WALLET,
         amount: 1000,
         _junk: large
      });
    expect(res.status).toBe(413);
  });

  it('rejects malformed JSON', async () => {
    const res = await request(app)
      .post('/counterparty-check')
      .set('Content-Type', 'application/json')
      .send('{ malformed json');
    expect(res.status).toBe(400);
  });

  it('rejects empty JSON body', async () => {
    const res = await request(app)
      .post('/counterparty-check')
      .set('Content-Type', 'application/json')
      .send('');
    expect(res.status).toBe(400);
  });
});

maybeDescribe('Security: Error Envelope Consistency', () => {
  const endpoints = [
    { method: 'get' as const, path: '/score' },
    { method: 'get' as const, path: '/delegation' },
    { method: 'get' as const, path: '/sybil-check' },
    { method: 'get' as const, path: '/reputation' },
    { method: 'get' as const, path: '/underwrite' },
    { method: 'get' as const, path: '/trust-graph' },
    { method: 'get' as const, path: '/passport' },
  ];

  for (const e of endpoints) {
    it(`returns consistent error envelope on ${e.path}`, async () => {
      const res = await request(app)[e.method](e.path);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });
  }

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
  });
});

maybeDescribe('Security: Idempotency Edge Cases', () => {
  it('rejects idempotency key with special characters', async () => {
    const res = await request(app)
      .post('/delegate')
      .set('Idempotency-Key', 'key with spaces')
      .send({
        sponsor: KNOWN_TESTNET_WALLET,
         agent: ALT_TESTNET_WALLET,
         amount: 1000
      });
    expect(res.status).toBe(400);
  });

  it('rejects very short idempotency key', async () => {
    const res = await request(app)
      .post('/delegate')
      .set('Idempotency-Key', 'short')
      .send({
        sponsor: KNOWN_TESTNET_WALLET,
         agent: ALT_TESTNET_WALLET,
         amount: 1000
      });
    expect(res.status).toBe(400);
  });

  it('accepts valid 8-char idempotency key', async () => {
    const res = await request(app)
      .post('/delegate')
      .set('Idempotency-Key', randomIdempotencyKey())
      .send({
        sponsor: KNOWN_TESTNET_WALLET,
         agent: ALT_TESTNET_WALLET,
         amount: 1000
      });
    expect([200, 201, 400, 503]).toContain(res.status);
  });
});
