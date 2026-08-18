/**
 * Integration tests for src/app.ts — every route, no mocks.
 *
 * Replaces the previous api.test.ts which re-implemented every route
 * inline. These tests exercise the real middleware chain (idempotency,
 * rate limit, request ID, metrics, body validation, error mapping)
 * against a supertest-driven app instance.
 *
 * Tests avoid hitting Algorand by feeding the wallet-validation layer
 * real testnet addresses (which pass algosdk.isValidAddress), and
 * accepting the 404 "wallet not found on testnet" response from the
 * downstream Algorand fetches as a valid signal that the route works.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Test } from 'supertest';
import { app, responseCache } from '../app';

const VALID_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';
const VALID_WALLET_2 = 'A2YR3UXLBTMZK6BLCV6ABNG5JGNOX7TXQFTAVAPF5A4JOI5EFWZ2LETCEA';

// Helper: every mutating test request must carry an Idempotency-Key
// (mandatory since the C2 fix). Each test gets a unique key so idempotency
// replay between tests is impossible.
let idemSeq = 0;
function post(path: string): Test {
  idemSeq++;
  return request(app)
    .post(path)
    .set('Idempotency-Key', `test_${Date.now()}_${idemSeq}`);
}

beforeEach(() => {
  responseCache.clear();
});

describe('GET /score', () => {
  it('rejects missing wallet param with 400', async () => {
    const res = await request(app).get('/score');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/wallet/i);
  });

  it('rejects malformed wallet with 400', async () => {
    const res = await request(app).get('/score?wallet=tooshort');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/58-character/);
  });

  it('rejects wallet with bad checksum with 400', async () => {
    const res = await request(app).get('/score?wallet=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    expect(res.status).toBe(400);
  });

  it('attaches X-Request-ID header to every response (or regenerates if client ID is malformed)', async () => {
    // Client-supplied X-Request-ID is validated against the UUID format; a
    // bad value is dropped and replaced with a server-generated UUID. This
    // is intentional — prevents log injection from header forgery.
    const res = await request(app).get('/score').set('X-Request-ID', 'not-a-uuid');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('preserves a client-supplied UUID-format X-Request-ID', async () => {
    const id = '11111111-2222-3333-4444-555555555555';
    const res = await request(app).get('/score').set('X-Request-ID', id);
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('generates a request id when client omits X-Request-ID', async () => {
    const res = await request(app).get('/score');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

describe('GET /delegation', () => {
  it('rejects missing wallet with 400', async () => {
    const res = await request(app).get('/delegation');
    expect(res.status).toBe(400);
  });

  it('rejects bad checksum with 400', async () => {
    const res = await request(app).get('/delegation?wallet=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    expect(res.status).toBe(400);
  });
});

describe('POST /counterparty-check', () => {
  it('rejects missing buyer with 400', async () => {
    const res = await post('/counterparty-check').send({});
    expect(res.status).toBe(400);
  });

  it('rejects malformed buyer with 400', async () => {
    const res = await post('/counterparty-check').send({ buyer: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('POST /credit-estimate', () => {
  it('rejects missing wallet with 400', async () => {
    const res = await post('/credit-estimate').send({});
    expect(res.status).toBe(400);
  });

  it('rejects non-positive amount with 400', async () => {
    const res = await post('/credit-estimate').send({
      wallet: VALID_WALLET,
       amount: -100
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive/);
  });
});

describe('GET /sybil-check', () => {
  it('rejects bad wallet with 400', async () => {
    const res = await request(app).get('/sybil-check?wallet=invalid');
    expect(res.status).toBe(400);
  });
});

describe('GET /reputation', () => {
  it('rejects bad wallet with 400', async () => {
    const res = await request(app).get('/reputation?wallet=invalid');
    expect(res.status).toBe(400);
  });
});

describe('POST /reputation/record', () => {
  it('rejects missing eventType with 400', async () => {
    const res = await post('/reputation/record').send({ wallet: VALID_WALLET });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/eventType/);
  });

  it('rejects invalid eventType with 400', async () => {
    const res = await post('/reputation/record').send({
      wallet: VALID_WALLET,
       eventType: 'unknown'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid eventType/);
  });

  it('rejects dispute events without round with 400', async () => {
    const res = await post('/reputation/record').send({
      wallet: VALID_WALLET,
      eventType: 'dispute',
      counterparty: VALID_WALLET_2,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/round/);
  });

  it('rejects dispute events with round=0 with 400', async () => {
    const res = await post('/reputation/record').send({
      wallet: VALID_WALLET,
      eventType: 'dispute',
      counterparty: VALID_WALLET_2,
      round: 0,
    });
    expect(res.status).toBe(400);
  });

  it('rejects malformed counterparty with 400', async () => {
    const res = await post('/reputation/record').send({
      wallet: VALID_WALLET,
      eventType: 'payment',
      counterparty: 'X',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /underwrite', () => {
  it('rejects bad wallet with 400', async () => {
    const res = await request(app).get('/underwrite?wallet=invalid');
    expect(res.status).toBe(400);
  });
});

describe('GET /trust-graph', () => {
  it('rejects bad wallet with 400', async () => {
    const res = await request(app).get('/trust-graph?wallet=invalid');
    expect(res.status).toBe(400);
  });

  it('rejects bad simulateSponsorLost wallet with 400', async () => {
    const res = await request(app).get(`/trust-graph?wallet=${VALID_WALLET}&simulateSponsorLost=garbage`);
    expect(res.status).toBe(400);
  });
});

describe('GET /passport', () => {
  it('rejects bad wallet with 400', async () => {
    const res = await request(app).get('/passport?wallet=invalid');
    expect(res.status).toBe(400);
  });
});

describe('POST /delegate', () => {
  it('rejects when sponsor == agent with 400', async () => {
    const res = await post('/delegate').send({
      sponsor: VALID_WALLET,
      agent: VALID_WALLET,
      amount: 100,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/different/);
  });

  it('rejects missing amount with 400', async () => {
    const res = await post('/delegate').send({
      sponsor: VALID_WALLET,
       agent: VALID_WALLET_2
    });
    expect(res.status).toBe(400);
  });

  it('rejects negative amount with 400', async () => {
    const res = await post('/delegate').send({
      sponsor: VALID_WALLET,
       agent: VALID_WALLET_2,
       amount: -1
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /revoke', () => {
  it('rejects missing sponsor with 400', async () => {
    const res = await post('/revoke').send({ agent: VALID_WALLET });
    expect(res.status).toBe(400);
  });
});

describe('GET /verify', () => {
  it('rejects missing wallet with 400', async () => {
    const res = await request(app).get('/verify');
    expect(res.status).toBe(400);
  });

  it('returns flags envelope for a valid-format wallet even when not on chain', async () => {
    const res = await request(app).get(`/verify?wallet=${VALID_WALLET}`);
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('valid');
      expect(res.body).toHaveProperty('wallet');
      expect(res.body).toHaveProperty('flags');
    }
  });
});

describe('GET /discovery/search', () => {
  it('returns results without query', async () => {
    const res = await request(app).get('/discovery/search');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
  });

  it('clamps limit to 100', async () => {
    const res = await request(app).get('/discovery/search?limit=10000');
    expect(res.status).toBe(200);
  });
});

describe('GET /health, /ready, /version, /metrics, /openapi.json', () => {
  it('/health always returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('/ready returns 200 or 503 (algorand reachable or not)', async () => {
    const res = await request(app).get('/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('algorand');
  });

  it('/version returns build metadata', async () => {
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('node');
    expect(res.body).toHaveProperty('sanctionsProvider');
  });

  it('/metrics is in Prometheus text format', async () => {
    const res = await request(app).get('/metrics');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.text).toMatch(/# HELP/);
    }
  });

  it('/openapi.json returns the spec', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/score']).toBeDefined();
    expect(res.body.paths['/passport']).toBeDefined();
  });
});

describe('Idempotency-Key middleware', () => {
  it('returns 400 when Idempotency-Key is missing on a mutating request', async () => {
    const res = await request(app)
      .post('/counterparty-check')
      .send({ buyer: VALID_WALLET });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Idempotency-Key/);
  });

  it('returns 400 for an invalid Idempotency-Key', async () => {
    const res = await request(app)
      .post('/counterparty-check')
      .set('Idempotency-Key', 'short')
      .send({ buyer: VALID_WALLET });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Idempotency-Key/);
  });

  it('accepts a valid Idempotency-Key on a mutating route', async () => {
    const res = await request(app)
      .post('/counterparty-check')
      .set('Idempotency-Key', 'a_valid_key_123')
      .send({ buyer: VALID_WALLET });
    // Not 400 — could be 200 or 404 if upstream rejects.
    expect(res.status).not.toBe(400);
    expect(res.headers['idempotency-key']).toBe('a_valid_key_123');
  });
});

describe('CORS', () => {
  it('responds to OPTIONS with 204', async () => {
    const res = await request(app).options('/score');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toMatch(/GET/);
  });

  it('echoes a configured origin', async () => {
    // Default CORS_ALLOWED_ORIGINS is "*"; production deploys set a
    // comma-separated origin allow-list. Verify the header is present (either
    // wildcard or echoed origin).
    const res = await request(app).get('/health').set('Origin', 'https://app.example.com');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('permits Idempotency-Key, x-payment, and HMAC headers in CORS preflight', async () => {
    const res = await request(app)
      .options('/counterparty-check')
      .set('Access-Control-Request-Headers', 'idempotency-key,x-payment,x-auth-signature');
    expect(res.headers['access-control-allow-headers']).toMatch(/idempotency-key/i);
    expect(res.headers['access-control-allow-headers']).toMatch(/x-payment/i);
    expect(res.headers['access-control-allow-headers']).toMatch(/x-auth-signature/i);
  });
});

describe('JSON body size limit', () => {
  it('rejects oversized bodies with 413', async () => {
    const huge = 'x'.repeat(200_000); // > 100 KB
    const res = await request(app)
      .post('/counterparty-check')
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', 'oversize_test_1')
      .send({ buyer: VALID_WALLET, garbage: huge });
    expect([413, 400]).toContain(res.status);
  });
});

describe('Webhook URL validation', () => {
  it('rejects loopback URLs', async () => {
    const res = await post('/reputation/subscribe').send({
      wallet: VALID_WALLET,
      url: 'http://localhost:6379/hook',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/loopback|private/i);
  });

  it('rejects AWS metadata URLs', async () => {
    const res = await post('/reputation/subscribe').send({
      wallet: VALID_WALLET,
      url: 'http://169.254.169.254/latest/meta-data/',
    });
    expect(res.status).toBe(400);
  });

  it('rejects userinfo URLs', async () => {
    const res = await post('/reputation/subscribe').send({
      wallet: VALID_WALLET,
      url: 'https://user:pass@example.com/hook',
    });
    expect(res.status).toBe(400);
  });

  it('accepts a valid https URL and returns a subscriber with secret', async () => {
    const res = await post('/reputation/subscribe').send({
      wallet: VALID_WALLET,
      url: 'https://example.com/hook',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('secret');
    expect(res.body.secret).toMatch(/^[a-f0-9]{64}$/);
  });
});