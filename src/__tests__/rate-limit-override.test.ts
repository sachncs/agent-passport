import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { setRateLimitOverrides, getRateLimitOverrides } from '../lib/security';

const VALID_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';
const VALID_WALLET_2 = 'A2YR3UXLBTMZK6BLCV6ABNG5JGNOX7TXQFTAVAPF5A4JOI5EFWZ2LETCEA';

describe('per-route rate limit overrides', () => {
  it('GET /underwrite has a tighter cap than the default', async () => {
    const overrides = getRateLimitOverrides();
    // Default per spec: max 30/min
    expect(overrides['GET /underwrite']?.max).toBe(30);
    // POST /delegate: max 5/min
    expect(overrides['POST /delegate']?.max).toBe(5);
    // POST /revoke: max 5/min
    expect(overrides['POST /revoke']?.max).toBe(5);
  });

  it('setRateLimitOverrides can override defaults', () => {
    setRateLimitOverrides({ 'POST /delegate': { max: 1 } });
    expect(getRateLimitOverrides()['POST /delegate']?.max).toBe(1);
    // Untouched defaults are preserved
    expect(getRateLimitOverrides()['POST /revoke']?.max).toBe(5);
  });

  it('overridden cap actually limits requests', async () => {
    setRateLimitOverrides({ 'POST /counterparty-check': { max: 2 } });
    // First two requests should not be rate-limited (we're checking the header
    // value, not the final response — Algorand fetches may 404/500).
    const r1 = await request(app).post('/counterparty-check').send({ buyer: VALID_WALLET });
    const r2 = await request(app).post('/counterparty-check').send({ buyer: VALID_WALLET_2 });
    expect(r1.headers['x-ratelimit-limit']).toBe('2');
    expect(r2.headers['x-ratelimit-limit']).toBe('2');
    // Third should 429.
    const r3 = await request(app).post('/counterparty-check').send({ buyer: VALID_WALLET });
    expect(r3.status).toBe(429);
    // Reset for other tests.
    setRateLimitOverrides({});
  });
});