/**
 * x402 pay-per-call middleware.
 *
 * The external @x402/* packages are unreliable (their published
 * builds reference a chunked `x402Client` module that ships only as
 * a .d.mts declaration file, not as a runtime .mjs, causing
 * `ERR_MODULE_NOT_FOUND` on every process start). This module
 * implements the same wire protocol — `402 Payment Required` with
 * the `PaymentRequirements` body, then verify a returned
 * `x-payment` header against a facilitator URL — without taking a
 * dependency on the broken package.
 *
 * Wire format: see https://www.x402.org/. The body shape mirrors
 * the previous dependency's `PaymentRequirements` so existing
 * SDK callers work unchanged.
 */

import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { X402_PRICING } from './constants';
import { logger } from './logger';
import { recordX402SettlementFailure } from './metrics';

interface RoutePricing {
  price: string;
  network: string;
  payTo: string;
  scheme: 'exact';
}

interface FacilitatorVerifyResult {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
}

async function callFacilitator(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<FacilitatorVerifyResult> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      return { isValid: false, invalidReason: `facilitator_${res.status}` };
    }
    return (await res.json()) as FacilitatorVerifyResult;
  } catch (e) {
    return { isValid: false, invalidReason: `facilitator_unreachable: ${String(e)}` };
  }
}

function buildRequirements(
  path: string,
  pricing: { price: number },
): RoutePricing {
  return {
    scheme: 'exact',
    network: config.x402Network,
    payTo: config.x402PaymentRecipient,
    price: String(pricing.price),
  };
}

/**
 * Express middleware. When x402 is disabled or no recipient is
 * configured, this is a no-op `next()`. Otherwise: for any paid
 * endpoint, return 402 with the payment requirements on missing
 * `x-payment` header; verify the payment via the facilitator on
 * present header; allow through on success.
 */
export function x402Middleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!config.x402Enabled || !config.x402PaymentRecipient) {
    return next();
  }

  const normalizedPath = req.path.replace(/\/+$/, '') || '/';
  const pricing = X402_PRICING[normalizedPath as keyof typeof X402_PRICING];
  if (!pricing) {
    return next();
  }

  const paymentHeader = req.headers['x-payment'];
  if (!paymentHeader) {
    res.status(402).json({
      error: 'Payment Required',
      accepts: [buildRequirements(normalizedPath, pricing)],
    });
    return;
  }

  // Verify with facilitator.
  const requirements = buildRequirements(normalizedPath, pricing);
  callFacilitator(config.x402FacilitatorUrl, '/verify', {
    paymentPayload: paymentHeader,
    paymentRequirements: requirements,
  }).then(result => {
    if (!result.isValid) {
      const reason = result.invalidReason || result.invalidMessage || 'invalid';
      logger.warn('x402 payment rejected', { reason, path: normalizedPath });
      recordX402SettlementFailure(reason);
      res.status(402).json({
        error: 'Payment Required',
        reason,
        accepts: [requirements],
      });
      return;
    }
    next();
  }).catch(e => {
    logger.error('x402 verification threw', { error: String(e) });
    res.status(502).json({ error: 'Payment verification unavailable' });
  });
}

/**
 * Asynchronous settlement verifier — exposed for the
 * `settlementVerificationMiddleware` to use. Returns whether the
 * payment proof corresponds to a settled on-chain transaction.
 */
export async function verifySettlement(
  paymentPayload: unknown,
  paymentRequirements: unknown,
): Promise<{ verified: boolean; error?: string }> {
  if (!config.x402Enabled) {
    return { verified: true };
  }
  const result = await callFacilitator(
    config.x402FacilitatorUrl,
    '/verify',
    { paymentPayload, paymentRequirements },
  );
  if (result.isValid) {
    logger.info('x402 payment settlement verified', {
      amount: (paymentRequirements as { price?: string })?.price,
    });
    return { verified: true };
  }
  const reason = result.invalidReason || result.invalidMessage || 'invalid';
  logger.warn('x402 payment settlement verification failed', { error: reason });
  recordX402SettlementFailure(reason);
  return { verified: false, error: reason };
}

/**
 * Verifies the x402 payment settlement on a request that already
 * passed `x402Middleware`. Rejects with 402 if the proof cannot be
 * matched to a settled on-chain transaction. Without this, an
 * attacker can replay a stale `x-payment` header indefinitely.
 */
export function settlementVerificationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!config.x402Enabled) {
    return next();
  }
  const paymentHeader = req.headers['x-payment'];
  if (!paymentHeader) {
    // x402Middleware already 402s missing-header requests; nothing to do.
    return next();
  }
  const normalizedPath = req.path.replace(/\/+$/, '') || '/';
  const pricing = X402_PRICING[normalizedPath as keyof typeof X402_PRICING];
  if (!pricing) {
    return next();
  }
  const requirements = buildRequirements(normalizedPath, pricing);
  verifySettlement(paymentHeader, requirements).then(result => {
    if (!result.verified) {
      res.status(402).json({
        error: 'Payment settlement not verified',
        reason: result.error,
      });
      return;
    }
    next();
  }).catch(e => {
    logger.error('Settlement verification threw', { error: String(e) });
    res.status(502).json({ error: 'Settlement verification unavailable' });
  });
}