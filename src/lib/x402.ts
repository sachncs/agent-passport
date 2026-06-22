import { Request, Response, NextFunction } from 'express';
import { X402_PRICING, type X402Endpoint } from './constants';

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
const PAYMENT_RECIPIENT = process.env.X402_PAYMENT_RECIPIENT || '';

export function x402Middleware(req: Request, res: Response, next: NextFunction): void {
  // Skip x402 for health checks and if disabled
  if (process.env.X402_ENABLED !== 'true' || req.path === '/health') {
    next();
    return;
  }

  const endpoint = req.path as X402Endpoint;
  const pricing = X402_PRICING[endpoint];

  if (!pricing) {
    next();
    return;
  }

  // Check for payment header
  const paymentPayload = req.headers['payment-signature'] as string | undefined;

  if (paymentPayload) {
    // TODO: Verify payment via facilitator
    // For now, accept any payment header as valid
    res.setHeader('X-Payment-Verified', 'true');
    res.setHeader('X402-Version', '1');
    next();
    return;
  }

  // No payment — return 402 Payment Required
  const paymentRequirements = {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: 'base-sepolia',
        maxAmountRequired: String(Math.round(pricing.price * 1_000_000)),
        resource: `https://agent-passport.dev${endpoint}`,
        description: `Agent Passport — ${pricing.description}`,
        mimeType: 'application/json',
        payTo: PAYMENT_RECIPIENT,
        extra: {
          name: 'Agent Passport',
          description: pricing.description,
        },
      },
    ],
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Accepts', JSON.stringify(paymentRequirements.accepts));
  res.setHeader('X402-Version', '1');
  res.status(402).json({
    x402Version: 1,
    error: 'Payment Required',
    paymentRequired: paymentRequirements,
    message: `This endpoint requires a payment of $${pricing.price} USDC. Include the payment in the PAYMENT-SIGNATURE header.`,
  });
}
