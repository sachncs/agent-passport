import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { promises as fsp } from 'fs';
import { join, dirname } from 'path';
import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  max: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    clientIp?: string;
  }
}

const RATE_LIMIT_PATH = process.env.RATE_LIMIT_PERSISTENCE_PATH
  || join(process.cwd(), 'data', 'rate-limit.json');

let globalClients: Map<string, RateLimitEntry> | null = null;

function loadRateLimitState(): Map<string, RateLimitEntry> {
  const clients = new Map<string, RateLimitEntry>();
  try {
    if (existsSync(RATE_LIMIT_PATH)) {
      const data = readFileSync(RATE_LIMIT_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (typeof parsed === 'object' && parsed !== null) {
        const now = Date.now();
        for (const [key, entry] of Object.entries(parsed)) {
          const e = entry as RateLimitEntry;
          if (e.resetAt > now) clients.set(key, e);
        }
      }
    }
  } catch {
    // Start fresh on any error
  }
  return clients;
}

// Async save — sync writes block the event loop on a busy host. The write
// queue in system-exposure.ts serializes rate-limit saves too, but here we
// coalesce by tracking an in-flight write so concurrent calls reuse it.
let inFlightSave: Promise<void> | null = null;
function saveRateLimitState(clients: Map<string, RateLimitEntry>): void {
  if (inFlightSave) return;
  inFlightSave = (async () => {
    try {
      const dir = dirname(RATE_LIMIT_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const obj: Record<string, RateLimitEntry> = {};
      for (const [key, entry] of clients) obj[key] = entry;
      await fsp.writeFile(
        RATE_LIMIT_PATH,
        JSON.stringify(obj),
        { mode: 0o600 },
      );
    } catch (e) {
      logger.warn('Failed to persist rate limit state', { error: String(e) });
    } finally {
      inFlightSave = null;
    }
  })();
}

export function resetRateLimiter(): void {
  if (globalClients) globalClients.clear();
}

/**
 * Per-route rate limit overrides. Maps path prefix → { windowMs, max }.
 * The first match wins. Falls back to the default when no prefix matches.
 *
 * Overrides take precedence over RATE_LIMIT_MAX for matching routes.
 * Set via `RATE_LIMIT_OVERRIDES='{"POST /underwrite":20,"POST /delegate":5}'`
 * in env, or programmatically via setRateLimitOverrides().
 */
type RouteOverride = { windowMs?: number; max: number };
type OverrideMap = Record<string, RouteOverride>;

const DEFAULT_OVERRIDES: OverrideMap = {
  // On-chain writes are expensive; cap aggressively.
  'POST /delegate': { max: 5 },
  'POST /revoke':   { max: 5 },
  // Underwriting triggers Algorand fetch fan-out; cap tighter than reads.
  'GET /underwrite': { max: 30 },
  // Sanctions screening on every counterparty-check; cap moderate.
  'POST /counterparty-check': { max: 120 },
};

let overrides: OverrideMap = { ...DEFAULT_OVERRIDES };

export function setRateLimitOverrides(o: OverrideMap): void {
  overrides = { ...DEFAULT_OVERRIDES, ...o };
}

export function getRateLimitOverrides(): OverrideMap {
  return overrides;
}

function lookupOverride(method: string, path: string): RouteOverride | null {
  const key = `${method} ${path}`;
  return overrides[key] ?? null;
}

export function rateLimiter(opts: { windowMs?: number; max?: number } = {}) {
  const defaultWindowMs = opts.windowMs ?? 60_000;
  const defaultMax = opts.max ?? (() => {
    const env = process.env.RATE_LIMIT_MAX;
    const envMax = env ? parseInt(env, 10) : NaN;
    return Number.isFinite(envMax) ? envMax : 600;
  })();

  const clients = globalClients ?? loadRateLimitState();
  globalClients = clients;

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [key, entry] of clients) {
      if (now > entry.resetAt) {
        clients.delete(key);
        changed = true;
      }
    }
    if (changed) saveRateLimitState(clients);
  }, 300_000);
  cleanupTimer.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    // Operational endpoints bypass rate limiting.
    if (req.path === '/health' || req.path === '/ready' || req.path === '/health/deep' || req.path === '/metrics' || req.path === '/registry/status') {
      return next();
    }

    if (process.env.LOAD_TEST_MODE === '1') return next();

    // Trusted-IP bypass — exact match. CIDR support deferred until a real
    // operator needs it (a single dep for one boolean check is not worth it).
    const trustedIps = (process.env.RATE_LIMIT_TRUSTED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
    const clientIp = req.ip ?? req.socket.remoteAddress ?? '';
    if (trustedIps.length > 0 && trustedIps.includes(clientIp)) return next();

    const override = lookupOverride(req.method, req.path);
    const windowMs = override?.windowMs ?? defaultWindowMs;
    const max = override?.max ?? defaultMax;

    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    let entry = clients.get(key);

    if (!entry || now > entry.resetAt || entry.max !== max) {
      entry = { count: 0, resetAt: now + windowMs, max };
      clients.set(key, entry);
    }

    entry.count++;

    if (entry.count % 100 === 0) saveRateLimitState(clients);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      res.status(429).json({ error: 'Too many requests. Try again later.' });
      return;
    }

    next();
  };
}

export function corsMiddleware(opts: { origin?: string } = {}) {
  const allowedOrigin = opts.origin ?? '*';

  return (req: Request, res: Response, next: NextFunction) => {
    if (allowedOrigin === '*') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else {
      
      const origin = req.headers.origin;
      if (origin) {
        const allowed = allowedOrigin.split(',').map(s => s.trim());
        if (allowed.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Vary', 'Origin');
        }
      }
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

/**
 *
 * Validates client-provided IDs to prevent log injection.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let requestId = req.headers['x-request-id'] as string | undefined;

  // Validate client-provided request ID (must be UUID format or generate new)
  if (requestId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requestId)) {
      requestId = undefined; // Invalid format — generate new
    }
  }

  const finalId = requestId || randomUUID();
  req.requestId = finalId;
  res.setHeader('X-Request-ID', finalId);
  next();
}

/**
 *
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const requestId = req.requestId;
  req.clientIp = clientIp;

  // Log the request with IP and ID for audit trail
  logger.info('Request received', {
    requestId,
    clientIp,
    method: req.method,
    path: req.path,
  });

  next();
}
