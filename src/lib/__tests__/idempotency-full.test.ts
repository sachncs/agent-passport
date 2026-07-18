import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../metrics', () => ({
  recordIdempotencyConflict: vi.fn(),
}));

import {
  isValidIdempotencyKey,
  generateServerKey,
  hashBody,
  getIdempotencyRecord,
  setIdempotencyRecord,
  clearIdempotencyStore,
  idempotencyStoreSize,
  idempotencyMiddleware,
  stopIdempotencySweeper,
} from '../idempotency';
import { recordIdempotencyConflict } from '../metrics';

afterEach(() => {
  clearIdempotencyStore();
  stopIdempotencySweeper();
});

describe('isValidIdempotencyKey', () => {
  it('accepts valid key of min length', () => {
    expect(isValidIdempotencyKey('12345678')).toBe(true);
  });

  it('accepts valid key with underscores and hyphens', () => {
    expect(isValidIdempotencyKey('my_key-123')).toBe(true);
  });

  it('accepts key with colons', () => {
    expect(isValidIdempotencyKey('abc:def:123')).toBe(true);
  });

  it('accepts max length key (255)', () => {
    expect(isValidIdempotencyKey('a'.repeat(255))).toBe(true);
  });

  it('rejects key shorter than 8 chars', () => {
    expect(isValidIdempotencyKey('1234567')).toBe(false);
  });

  it('rejects key longer than 255 chars', () => {
    expect(isValidIdempotencyKey('a'.repeat(256))).toBe(false);
  });

  it('rejects key with spaces', () => {
    expect(isValidIdempotencyKey('has space')).toBe(false);
  });

  it('rejects key with special characters', () => {
    expect(isValidIdempotencyKey('key@#$%')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidIdempotencyKey(123 as unknown as string)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidIdempotencyKey('')).toBe(false);
  });

  it('rejects key with dots', () => {
    expect(isValidIdempotencyKey('a.b.c.d.e.f.g')).toBe(false);
  });

  it('accepts all alphanumeric', () => {
    expect(isValidIdempotencyKey('abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe(true);
  });
});

describe('generateServerKey', () => {
  it('generates key starting with srv_', () => {
    const key = generateServerKey();
    expect(key).toMatch(/^srv_/);
  });

  it('generates unique keys', () => {
    const keys = new Set(
      Array.from({ length: 100 }, () => generateServerKey()),
    );
    expect(keys.size).toBe(100);
  });

  it('generates key without hyphens', () => {
    const key = generateServerKey();
    expect(key).not.toContain('-');
  });
});

describe('hashBody', () => {
  it('returns consistent hash for same body', () => {
    const h1 = hashBody({ a: 1, b: 2 });
    const h2 = hashBody({ a: 1, b: 2 });
    expect(h1).toBe(h2);
  });

  it('returns different hash for different body', () => {
    const h1 = hashBody({ a: 1 });
    const h2 = hashBody({ a: 2 });
    expect(h1).not.toBe(h2);
  });

  it('is order-independent for object keys', () => {
    const h1 = hashBody({ b: 2, a: 1 });
    const h2 = hashBody({ a: 1, b: 2 });
    expect(h1).toBe(h2);
  });

  it('handles null body', () => {
    const h = hashBody(null);
    expect(typeof h).toBe('string');
    expect(h.length).toBe(64);
  });

  it('handles undefined body (treated as null)', () => {
    const h = hashBody(undefined);
    expect(h).toBe(hashBody(null));
  });

  it('handles nested objects with key order differences', () => {
    const h1 = hashBody({ x: { z: 1, y: 2 }, a: 3 });
    const h2 = hashBody({ a: 3, x: { y: 2, z: 1 } });
    expect(h1).toBe(h2);
  });

  it('handles arrays', () => {
    const h = hashBody([1, 2, 3]);
    expect(typeof h).toBe('string');
  });

  it('differentiates arrays from objects', () => {
    const h1 = hashBody({ 0: 1, 1: 2 });
    const h2 = hashBody([1, 2]);
    expect(h1).not.toBe(h2);
  });

  it('handles string body', () => {
    const h = hashBody('hello');
    expect(typeof h).toBe('string');
    expect(h.length).toBe(64);
  });

  it('handles number body', () => {
    const h = hashBody(42);
    expect(typeof h).toBe('string');
  });

  it('handles boolean body', () => {
    const h = hashBody(true);
    expect(typeof h).toBe('string');
  });
});

describe('getIdempotencyRecord', () => {
  it('returns undefined for missing key', () => {
    expect(getIdempotencyRecord('nonexistent')).toBeUndefined();
  });

  it('returns record for existing key', () => {
    setIdempotencyRecord('key1', 'hash1', 200, { ok: true });
    const rec = getIdempotencyRecord('key1');
    expect(rec).toBeDefined();
    expect(rec!.key).toBe('key1');
    expect(rec!.bodyHash).toBe('hash1');
    expect(rec!.status).toBe(200);
    expect(rec!.body).toEqual({ ok: true });
  });

  it('returns undefined for expired record', () => {
    setIdempotencyRecord('expiring', 'hash', 200, {}, -1);
    const rec = getIdempotencyRecord('expiring');
    expect(rec).toBeUndefined();
  });

  it('returns record within TTL', () => {
    setIdempotencyRecord('valid', 'hash', 201, { created: true }, 60_000);
    const rec = getIdempotencyRecord('valid');
    expect(rec).toBeDefined();
    expect(rec!.status).toBe(201);
  });
});

describe('setIdempotencyRecord', () => {
  it('stores record with correct fields', () => {
    const rec = setIdempotencyRecord('mykey', 'myhash', 200, { data: 1 });
    expect(rec.key).toBe('mykey');
    expect(rec.bodyHash).toBe('myhash');
    expect(rec.status).toBe(200);
    expect(rec.body).toEqual({ data: 1 });
    expect(rec.createdAt).toBeGreaterThan(0);
    expect(rec.expiresAt).toBeGreaterThan(rec.createdAt);
  });

  it('uses default TTL when not specified', () => {
    const rec = setIdempotencyRecord('default', 'h', 200, {});
    expect(rec.expiresAt - rec.createdAt).toBe(24 * 60 * 60 * 1000);
  });

  it('uses custom TTL when specified', () => {
    const rec = setIdempotencyRecord('custom', 'h', 200, {}, 5000);
    expect(rec.expiresAt - rec.createdAt).toBe(5000);
  });
});

describe('clearIdempotencyStore', () => {
  it('clears all records', () => {
    setIdempotencyRecord('k1', 'h1', 200, {});
    setIdempotencyRecord('k2', 'h2', 200, {});
    expect(idempotencyStoreSize()).toBe(2);
    clearIdempotencyStore();
    expect(idempotencyStoreSize()).toBe(0);
  });
});

describe('idempotencyStoreSize', () => {
  it('returns 0 for empty store', () => {
    clearIdempotencyStore();
    expect(idempotencyStoreSize()).toBe(0);
  });

  it('returns correct count', () => {
    clearIdempotencyStore();
    setIdempotencyRecord('a', 'h', 200, {});
    setIdempotencyRecord('b', 'h', 200, {});
    expect(idempotencyStoreSize()).toBe(2);
  });

  it('sweeps expired records', () => {
    clearIdempotencyStore();
    setIdempotencyRecord('expired', 'h', 200, {}, -1);
    expect(idempotencyStoreSize()).toBe(0);
  });
});

describe('idempotencyMiddleware', () => {
  function mockReq(method: string, body?: unknown, headerKey?: string) {
    return {
      method,
      body: body ?? {},
      header: (name: string) => (name === 'Idempotency-Key' ? headerKey : undefined),
      idempotencyKey: undefined as string | undefined,
    } as never;
  }

  function mockRes() {
    let statusCode = 200;
    let jsonBody: unknown;
    const headers: Record<string, string> = {};
    const res = {
      status: (code: number) => { statusCode = code; return res; },
      json: (body: unknown) => { jsonBody = body; return res; },
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      get statusCode() { return statusCode; },
      get jsonBody() { return jsonBody; },
      get headers() { return headers; },
    } as never;
    return res;
  }

  beforeEach(() => {
    clearIdempotencyStore();
  });

  it('passes through GET requests', () => {
    const next = vi.fn();
    idempotencyMiddleware(mockReq('GET'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through HEAD requests', () => {
    const next = vi.fn();
    idempotencyMiddleware(mockReq('HEAD'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through OPTIONS requests', () => {
    const next = vi.fn();
    idempotencyMiddleware(mockReq('OPTIONS'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 400 for invalid Idempotency-Key', () => {
    const next = vi.fn();
    const res = mockRes();
    idempotencyMiddleware(mockReq('POST', {}, 'short'), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('generates server key when header missing', () => {
    const next = vi.fn();
    const req = mockReq('POST', { data: 1 });
    idempotencyMiddleware(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.idempotencyKey).toMatch(/^srv_/);
  });

  it('sets idempotency-key header on response', () => {
    const next = vi.fn();
    const res = mockRes();
    idempotencyMiddleware(mockReq('POST', {}), res, next);
    expect(res.headers['idempotency-key']).toBeDefined();
  });

  it('replays cached response for same key and same body', () => {
    const key = 'testkey_1234';
    const body = { data: 'value' };
    const bodyHash = hashBody(body);
    setIdempotencyRecord(key, bodyHash, 200, body);

    const next = vi.fn();
    const res = mockRes();
    idempotencyMiddleware(mockReq('POST', body, key), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual(body);
    expect(res.headers['idempotent-replay']).toBe('true');
  });

  it('returns 409 when same key with different body', () => {
    const key = 'conflict_key_1';
    const body1 = { a: 1 };
    const body2 = { a: 2 };
    setIdempotencyRecord(key, hashBody(body1), 200, body1);

    const next = vi.fn();
    const res = mockRes();
    idempotencyMiddleware(mockReq('POST', body2, key), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(recordIdempotencyConflict).toHaveBeenCalled();
  });

  it('allows first request to proceed (no record yet)', () => {
    const next = vi.fn();
    const req = mockReq('POST', { x: 1 }, 'fresh_key_1234');
    const res = mockRes();
    idempotencyMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('stores successful response for replay', () => {
    const key = 'store_test_1234';
    const next = vi.fn();
    const req = mockReq('POST', { x: 1 }, key);
    const res = mockRes();
    idempotencyMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();

    res.json({ result: 'ok' });
    const rec = getIdempotencyRecord(key);
    expect(rec).toBeDefined();
    expect(rec!.body).toEqual({ result: 'ok' });
  });

  it('does not store non-2xx responses', () => {
    const key = 'no_store_12345';
    const next = vi.fn();
    const req = mockReq('POST', { x: 1 }, key);
    const res = mockRes();
    idempotencyMiddleware(req, res, next);

    res.status(400).json({ error: 'bad' });
    const rec = getIdempotencyRecord(key);
    expect(rec).toBeUndefined();
  });

  it('uses valid Idempotency-Key from header', () => {
    const next = vi.fn();
    const req = mockReq('POST', {}, 'valid_key_12345');
    idempotencyMiddleware(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.idempotencyKey).toBe('valid_key_12345');
  });
});

describe('stopIdempotencySweeper', () => {
  it('can be called without error', () => {
    expect(() => stopIdempotencySweeper()).not.toThrow();
  });

  it('can be called multiple times', () => {
    stopIdempotencySweeper();
    stopIdempotencySweeper();
  });
});
