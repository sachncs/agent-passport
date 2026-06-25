import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { logger } from './logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    clientIp?: string;
  }
}

// P1 FIX: Persistent rate limiter state
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
          // Only restore non-expired entries
          if (e.resetAt > now) {
            clients.set(key, e);
          }
        }
      }
    }
  } catch {
    // Start fresh on any error
  }
  return clients;
}

function saveRateLimitState(clients: Map<string, RateLimitEntry>): void {
  try {
    const dir = dirname(RATE_LIMIT_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const obj: Record<string, RateLimitEntry> = {};
    for (const [key, entry] of clients) {
      obj[key] = entry;
    }
    writeFileSync(RATE_LIMIT_PATH, JSON.stringify(obj));
  } catch (e) {
    logger.warn('Failed to persist rate limit state', { error: String(e) });
  }
}

export function resetRateLimiter(): void {
  if (globalClients) globalClients.clear();
}

export function rateLimiter(opts: { windowMs?: number; max?: number } = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  // Default raised from 60 → 600 req/min per IP.
  // Override with env RATE_LIMIT_MAX or pass `max` in opts.
  const envMax = process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : NaN;
  const max = opts.max ?? (Number.isFinite(envMax) ? envMax : 600);
  const clients = globalClients ?? loadRateLimitState();
  globalClients = clients;

  // Cleanup stale entries every 5 minutes
  setInterval(() => {
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

  return (req: Request, res: Response, next: NextFunction) => {
    // Operational endpoints (health, metrics) bypass rate limiting
    if (req.path === '/health' || req.path === '/ready' || req.path === '/health/deep' || req.path === '/metrics' || req.path === '/registry/status') {
      return next();
    }

    // Load-test bypass — never rate-limit when LOAD_TEST_MODE=1
    if (process.env.LOAD_TEST_MODE === '1') {
      return next();
    }

    // Trusted-IP bypass — internal services, operator wallet hosts
    const trustedIps = (process.env.RATE_LIMIT_TRUSTED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
    const clientIp = req.ip ?? req.socket.remoteAddress ?? '';
    if (trustedIps.length > 0 && trustedIps.includes(clientIp)) {
      return next();
    }

    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    let entry = clients.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      clients.set(key, entry);
    }

    entry.count++;

    // Persist state periodically (every 100 requests per client)
    if (entry.count % 100 === 0) {
      saveRateLimitState(clients);
    }

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
      // P2 FIX: Validate origin as a single value, not comma-separated
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
 * P2 FIX: Middleware that attaches a unique request ID to each request.
 * Validates client-provided IDs to prevent log injection.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  let requestId = req.headers['x-request-id'] as string | undefined;

  // P2 FIX: Validate client-provided request ID (must be UUID format or generate new)
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
 * P2 FIX: Middleware that logs client IP and request ID for security auditing.
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
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
