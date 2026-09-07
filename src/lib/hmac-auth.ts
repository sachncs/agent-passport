import { createHmac, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger';
import { config } from '../config';

const DEFAULT_SKEW_MS = 60_000;

export interface HmacAuthOptions {
  secret: string;
  skewMs?: number;
  /** Routes that bypass HMAC auth. */
  bypassPaths?: RegExp[];
}

declare module 'express-serve-static-core' {
  interface Request {
    hmacAuth?: {
      keyId: string;
      timestamp: number;
      nonce: string;
    };
  }
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * HMAC-signed request authentication.
 *
 * Wire format (request headers):
 *   X-Auth-Timestamp:  unix ms (UTC) of the signed request
 *   X-Auth-Nonce:      client-generated unique string per request
 *   X-Auth-KeyId:      opaque identifier for the secret (audit only)
 *   X-Auth-Signature:  hex(HMAC-SHA256(secret, canonicalString))
 *
 * Canonical string (newline-separated, exact field order):
 *   <METHOD>\n<PATH>\n<sha256-hex(body)>\n<timestamp>\n<nonce>
 *
 * Replay window: timestamp must be within ±skewMs of server clock.
 *
 * The body hash is computed AFTER json parsing, so callers MUST send
 * Content-Type: application/json with a parseable body. Empty body
 * yields sha256("").
 *
 * For routes with no body (e.g. GET), use the empty-body hash.
 *
 * This middleware is fail-closed: any error → 401.
 */
export function hmacAuth(opts: HmacAuthOptions) {
  const secret = opts.secret;
  const skewMs = opts.skewMs ?? DEFAULT_SKEW_MS;
  const bypassPaths = opts.bypassPaths ?? [];

  if (!secret || secret.length < 32) {
    throw new Error(
      'hmacAuth: HMAC_SECRET must be set and at least 32 characters (256 bits). ' +
      'Generate with: openssl rand -hex 32',
    );
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (bypassPaths.some(re => re.test(req.path))) {
      next();
      return;
    }

    const timestampRaw = req.header('X-Auth-Timestamp');
    const nonce = req.header('X-Auth-Nonce');
    const keyId = req.header('X-Auth-KeyId');
    const signature = req.header('X-Auth-Signature');

    if (!timestampRaw || !nonce || !keyId || !signature) {
      res.status(401).json({
        error: 'Missing HMAC auth headers (X-Auth-Timestamp, X-Auth-Nonce, X-Auth-KeyId, X-Auth-Signature)',
      });
      return;
    }

    const timestamp = parseInt(timestampRaw, 10);
    if (!Number.isFinite(timestamp)) {
      res.status(401).json({ error: 'Invalid X-Auth-Timestamp (must be unix ms)' });
      return;
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > skewMs) {
      res.status(401).json({
        error: 'HMAC timestamp outside replay window',
        skewMs,
      });
      return;
    }

    if (nonce.length < 8 || nonce.length > 128) {
      res.status(401).json({ error: 'X-Auth-Nonce must be 8-128 chars' });
      return;
    }

    const bodyHash = hashBodyForAuth(req.body);
    const canonical = `${req.method}\n${req.originalUrl.split('?')[0]}\n${bodyHash}\n${timestampRaw}\n${nonce}`;
    const expected = createHmac('sha256', secret).update(canonical).digest('hex');

    if (!timingSafeEqualStr(expected, signature)) {
      logger.warn('HMAC auth failed', {
        requestId: req.requestId,
        keyId,
        method: req.method,
        path: req.path,
      });
      res.status(401).json({ error: 'Invalid HMAC signature' });
      return;
    }

    req.hmacAuth = { keyId, timestamp, nonce };
    next();
  };
}

function hashBodyForAuth(body: unknown): string {
  return createHmac('sha256', '')
    .update(body === undefined || body === null ? '' : canonicalJsonForAuth(body))
    .digest('hex');
}

function canonicalJsonForAuth(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJsonForAuth).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalJsonForAuth((value as Record<string, unknown>)[k])}`).join(',') + '}';
}

/** Helper for SDK / clients: sign a request. */
export function signHmacRequest(
  secret: string,
  method: string,
  path: string,
  body: unknown,
  keyId: string,
  nonce: string,
  timestamp: number = Date.now(),
): { headers: Record<string, string>; canonical: string } {
  const bodyHash = hashBodyForAuth(body);
  const canonical = `${method}\n${path}\n${bodyHash}\n${timestamp}\n${nonce}`;
  const signature = createHmac('sha256', secret).update(canonical).digest('hex');
  return {
    canonical,
    headers: {
      'X-Auth-Timestamp': String(timestamp),
      'X-Auth-Nonce': nonce,
      'X-Auth-KeyId': keyId,
      'X-Auth-Signature': signature,
    },
  };
}

/** Routes that bypass HMAC auth: public reads, health, metrics, OpenAPI. */
export const HMAC_BYPASS_PATHS = [
  /^\/(health|health\/deep|ready|metrics|openapi\.json|version|dashboard|reputation\/subscribe|reputation\/unsubscribe|reputation\/subscribers)$/,
  /^\/(score|delegation|counterparty-check|credit-estimate|sybil-check|reputation|underwrite|trust-graph|passport|verify|discovery\/search)$/,
];

/** Returns the configured secret or null if HMAC auth is disabled. */
export function getHmacSecret(): string | null {
  return process.env.HMAC_SECRET || config.hmacSecret || null;
}

/** True when HMAC auth is configured. */
export function isHmacAuthEnabled(): boolean {
  return getHmacSecret() !== null;
}