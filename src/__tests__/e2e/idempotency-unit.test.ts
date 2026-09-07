/**
 * Unit tests for src/lib/idempotency.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  idempotencyMiddleware,
  clearIdempotencyStore,
  getIdempotencyRecord,
  isValidIdempotencyKey,
  idempotencyStoreSize,
} from '../../lib/idempotency';
import express from 'express';
import request from 'supertest';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(idempotencyMiddleware);
  let counter = 0;
  app.post('/test', (req, res) => {
    counter += 1;
    res.json({ counter, body: req.body, key: req.idempotencyKey });
  });
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('Idempotency Middleware', () => {
  beforeEach(() => {
    clearIdempotencyStore();
  });

  describe('isValidIdempotencyKey', () => {
    it('accepts 8+ char alphanumeric keys', () => {
      expect(isValidIdempotencyKey('abcd1234')).toBe(true);
      expect(isValidIdempotencyKey('abcdefgh-1234-5678')).toBe(true);
    });

    it('rejects too-short keys', () => {
      expect(isValidIdempotencyKey('short')).toBe(false);
    });

    it('rejects keys with disallowed characters', () => {
      expect(isValidIdempotencyKey('key with spaces')).toBe(false);
      expect(isValidIdempotencyKey('key.with.dots')).toBe(false);
    });

    it('rejects too-long keys', () => {
      expect(isValidIdempotencyKey('a'.repeat(300))).toBe(false);
    });
  });

  describe('middleware', () => {
    it('generates a server key when none provided', async () => {
      const app = makeApp();
      const res = await request(app).post('/test').send({ a: 1 });
      expect(res.status).toBe(200);
      expect(res.headers['idempotency-key']).toBeDefined();
      expect(res.body.counter).toBe(1);
    });

    it('passes through for GET requests', async () => {
      const app = makeApp();
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
    });

    it('rejects invalid client key with 400', async () => {
      const app = makeApp();
      const res = await request(app).post('/test').set('Idempotency-Key', 'x').send({ a: 1 });
      expect(res.status).toBe(400);
    });

    it('replays cached response on second call with same key + body', async () => {
      const app = makeApp();
      const key = 'test-key-aaaaaaaa';
      const r1 = await request(app).post('/test').set('Idempotency-Key', key).send({ a: 1 });
      const r2 = await request(app).post('/test').set('Idempotency-Key', key).send({ a: 1 });
      expect(r1.body.counter).toBe(1);
      expect(r2.body.counter).toBe(1);
      expect(r2.headers['idempotent-replay']).toBe('true');
    });

    it('returns 409 on same key with different body', async () => {
      const app = makeApp();
      const key = 'test-key-bbbbbbbb';
      await request(app).post('/test').set('Idempotency-Key', key).send({ a: 1 });
      const r2 = await request(app).post('/test').set('Idempotency-Key', key).send({ a: 2 });
      expect(r2.status).toBe(409);
      expect(r2.body.error).toContain('Idempotency-Key');
    });

    it('different keys do not interfere', async () => {
      const app = makeApp();
      const r1 = await request(app).post('/test').set('Idempotency-Key', 'test-key-11111111').send({ a: 1 });
      const r2 = await request(app).post('/test').set('Idempotency-Key', 'test-key-22222222').send({ a: 1 });
      expect(r1.body.counter).toBe(1);
      expect(r2.body.counter).toBe(2);
    });

    it('store starts empty after clear', () => {
      clearIdempotencyStore();
      expect(idempotencyStoreSize()).toBe(0);
    });

    it('records are stored on success', () => {
      clearIdempotencyStore();
      const app = makeApp();
      const key = 'test-key-ccccccc1';
      return request(app).post('/test').set('Idempotency-Key', key).send({ a: 1 }).then(() => {
        const rec = getIdempotencyRecord(key);
        expect(rec).toBeDefined();
        expect(rec!.bodyHash).toBeDefined();
        expect(rec!.expiresAt).toBeGreaterThan(Date.now());
      });
    });
  });
});
