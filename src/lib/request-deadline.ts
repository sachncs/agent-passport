import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger';

declare module 'express-serve-static-core' {
  interface Locals {
    deadlineAt?: number;
  }
}

/**
 * Per-request deadline middleware. Computes a deadlineAt timestamp on each
 * request and exposes it via res.locals. Route handlers can check
 * `Date.now() > res.locals.deadlineAt` to abort early on long fan-out.
 *
 * Default deadline is 30s. Set REQUEST_TIMEOUT_MS to override. Even with
 * every Algorand call wrapped in withTimeout(10s), a 5-fan-out request
 * could still hold the connection for 50s without this. (H6)
 */
export function requestDeadlineMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ttlMs = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);
  const deadlineAt = Date.now() + ttlMs;
  res.locals.deadlineAt = deadlineAt;
  req.setTimeout?.(ttlMs + 5_000);

  res.on('finish', () => {
    const elapsed = Date.now() - (deadlineAt - ttlMs);
    if (elapsed > ttlMs) {
      logger.warn('Request exceeded deadline', {
        requestId: req.requestId,
        path: req.path,
        method: req.method,
        elapsedMs: elapsed,
        deadlineMs: ttlMs,
      });
    }
  });

  next();
}

/** True when the request has exceeded its deadline. */
export function isPastDeadline(res: Response): boolean {
  const d = res.locals.deadlineAt;
  return typeof d === 'number' && Date.now() > d;
}