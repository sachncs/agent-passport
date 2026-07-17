import type { RoutesConfig } from '@x402/core/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { paymentMiddlewareFromConfig } from '@x402/express';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { X402_PRICING } from './constants';
import { logger } from './logger';
import { recordX402SettlementFailure } from './metrics';

function buildRoutes(): RoutesConfig {
  const routes: RoutesConfig = {};

  for (const [endpoint, pricing] of Object.entries(X402_PRICING)) {
    routes[endpoint] = {
      accepts: {
        scheme: 'exact',
        network: config.x402Network,
        payTo: config.x402PaymentRecipient,
        price: String(pricing.price),
      },
    };
  }

  return routes;
}

function createMiddleware() {
  if (!config.x402Enabled || !config.x402PaymentRecipient) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: config.x402FacilitatorUrl,
  });

  const routes = buildRoutes();

  return paymentMiddlewareFromConfig(
    routes,
    facilitatorClient,
    undefined,
    undefined,
    undefined,
    true,
  );
}

export const x402Middleware = createMiddleware();

/**
 * Verifies payment settlement with the facilitator. Returns whether the
 * payment proof corresponds to a settled on-chain transaction.
 */
export async function verifySettlement(
  paymentPayload: unknown,
  paymentRequirements: unknown,
): Promise<{ verified: boolean; error?: string }> {
  if (!config.x402Enabled) {
    return { verified: true };
  }

  try {
    const facilitatorClient = new HTTPFacilitatorClient({
      url: config.x402FacilitatorUrl,
    });

    const result = await facilitatorClient.verify(
      paymentPayload as unknown as Parameters<HTTPFacilitatorClient['verify']>[0],
      paymentRequirements as unknown as Parameters<HTTPFacilitatorClient['verify']>[1],
    );

    if (result.isValid) {
      logger.info('Payment settlement verified', {
        amount: (paymentRequirements as { price?: string })?.price,
      });
      return { verified: true };
    }

    const reason = result.invalidReason || result.invalidMessage || 'invalid';
    logger.warn('Payment settlement verification failed', { error: reason });
    recordX402SettlementFailure(reason);
    return { verified: false, error: reason };
  } catch (e) {
    const msg = String(e);
    logger.error('Settlement verification error', { error: msg });
    recordX402SettlementFailure('exception');
    return { verified: false, error: msg };
  }
}

/**
 * Verifies the x402 payment settlement. Rejects with 402 when the proof
 * cannot be matched to a settled on-chain transaction — without this, an
 * attacker can replay a stale x-payment header indefinitely.
 */
export function settlementVerificationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!config.x402Enabled) {
    return next();
  }

  const paymentHeader = req.headers['x-payment'];
  if (!paymentHeader) {
    // x402Middleware already 402s requests missing the header; nothing to do.
    return next();
  }

  // Strip trailing slashes before lookup so /score/ matches /score.
  const normalizedPath = req.path.replace(/\/+$/, '') || '/';
  const route = X402_PRICING[normalizedPath as keyof typeof X402_PRICING];
  if (!route) {
    return next();
  }

  // Block the request until the facilitator confirms the payment is settled.
  // The x402 middleware checks the payment proof shape but does NOT verify the
  // on-chain settlement — that is a separate defense against replay and
  // double-spend.
  verifySettlement(
    paymentHeader,
    { price: String(route.price), payTo: config.x402PaymentRecipient, network: config.x402Network },
  ).then(result => {
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
