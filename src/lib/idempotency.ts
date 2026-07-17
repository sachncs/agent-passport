import { Request, Response, NextFunction } from 'express';
import { createHash, randomUUID } from 'crypto';
import { recordIdempotencyConflict } from './metrics';

const KEY_MIN_LENGTH = 8;
const KEY_MAX_LENGTH = 255;
const KEY_PATTERN = /^[A-Za-z0-9_\-:]+$/;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_STORE_SIZE = 10_000;

export interface IdempotencyRecord {
  key: string;
  bodyHash: string;
  status: number;
  body: unknown;
  createdAt: number;
  expiresAt: number;
}

const store: Map<string, IdempotencyRecord> = new Map();

let sweepTimer: NodeJS.Timeout | null = null;

function sweep(): void {
  const now = Date.now();
  for (const [key, rec] of store) {
    if (rec.expiresAt <= now) store.delete(key);
  }
}

function startSweeper(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    sweep();
    if (store.size > MAX_STORE_SIZE) {
      const overflow = store.size - MAX_STORE_SIZE;
      const keys = store.keys();
      for (let i = 0; i < overflow; i++) {
        const next = keys.next();
        if (next.done) break;
        store.delete(next.value);
      }
    }
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

/** Stops the periodic sweep. Used by tests and on graceful shutdown. */
export function stopIdempotencySweeper(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

startSweeper();

export function isValidIdempotencyKey(key: string): boolean {
  if (typeof key !== 'string') return false;
  if (key.length < KEY_MIN_LENGTH) return false;
  if (key.length > KEY_MAX_LENGTH) return false;
  return KEY_PATTERN.test(key);
}

export function generateServerKey(): string {
  return `srv_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Canonical JSON: sort keys recursively so {a:1,b:2} and {b:2,a:1} hash
 * to the same digest. Without this, two semantically-identical bodies
 * with different key order would 409 instead of being treated as a replay.
 */
export function hashBody(body: unknown): string {
  return createHash('sha256').update(canonicalJson(body ?? null)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',') + '}';
}

export function getIdempotencyRecord(key: string): IdempotencyRecord | undefined {
  const rec = store.get(key);
  if (!rec) return undefined;
  if (rec.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return rec;
}

export function setIdempotencyRecord(
  key: string,
  bodyHash: string,
  status: number,
  body: unknown,
  ttlMs: number = DEFAULT_TTL_MS,
): IdempotencyRecord {
  const now = Date.now();
  const rec: IdempotencyRecord = {
    key,
    bodyHash,
    status,
    body,
    createdAt: now,
    expiresAt: now + ttlMs,
  };
  store.set(key, rec);
  return rec;
}

export function clearIdempotencyStore(): void {
  store.clear();
}

export function idempotencyStoreSize(): number {
  sweep();
  return store.size;
}

declare module 'express-serve-static-core' {
  interface Request {
    idempotencyKey?: string;
  }
}

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  const headerKey = req.header('Idempotency-Key');
  let key: string;
  if (headerKey === undefined) {
    key = generateServerKey();
  } else if (!isValidIdempotencyKey(headerKey)) {
    res.status(400).json({ error: 'Invalid Idempotency-Key format. Must be 8-255 chars of [A-Za-z0-9_-:]' });
    return;
  } else {
    key = headerKey;
  }

  req.idempotencyKey = key;
  res.setHeader('idempotency-key', key);

  const bodyHash = hashBody(req.body);

  const existing = getIdempotencyRecord(key);
  if (existing) {
    if (existing.bodyHash !== bodyHash) {
      recordIdempotencyConflict();
      res.status(409).json({ error: 'Idempotency-Key reused with different request body' });
      return;
    }
    res.setHeader('idempotent-replay', 'true');
    res.status(existing.status).json(existing.body);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown): Response => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      setIdempotencyRecord(key, bodyHash, res.statusCode, body);
    }
    return originalJson(body);
  };

  next();
}
