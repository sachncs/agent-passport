import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { scoreWallet } from './trust-score';
import { scoreDelegation } from './delegation';
import { checkCounterparty } from './counterparty';
import { estimateCredit } from './credit';
import { detectSybil } from './sybil';
import { recordEvent, computeReputation, EVENT_TYPES } from './reputation';
import { underwrite } from './underwriting';
import { analyzeTrustGraph } from './trust-graph';
import { generatePassport } from './passport';
import { logger } from './lib/logger';
import { isValidWallet } from './lib/constants';
import { x402Middleware } from './lib/x402';
import { rateLimiter, corsMiddleware, requestIdMiddleware, requestLoggingMiddleware } from './lib/security';
import { algod } from './lib/algorand-client';
import { LRUCache } from './lib/cache';

const app = express();
const PORT = config.port;

// P1 FIX: Response cache for wallet lookups (60s TTL, 500 entries)
const responseCache = new LRUCache<unknown>(500, 60_000);

// Security: trust proxy for correct IP behind load balancers
app.set('trust proxy', 1);

// Security: helmet for HTTP headers (HSTS, X-Content-Type-Options, CSP, etc.)
app.use(helmet());

// Request ID and logging
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);

// CORS with configurable origins
app.use(corsMiddleware({ origin: config.corsAllowedOrigins }));
app.use(rateLimiter({ windowMs: 60_000, max: 60 }));
app.use(express.json({ limit: '100kb' }));
app.use(x402Middleware);

// ── Helper: validate wallet from query param ──────────────────
function requireWallet(req: express.Request, res: express.Response): string | null {
  const raw = req.query.wallet;
  if (typeof raw !== 'string' || !raw) {
    res.status(400).json({ error: 'Missing required query parameter: wallet' });
    return null;
  }
  if (!isValidWallet(raw)) {
    res.status(400).json({ error: 'Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).' });
    return null;
  }
  return raw;
}

// ── Helper: validate wallet from body ─────────────────────────
function requireBodyWallet(req: express.Request, res: express.Response): string | null {
  const wallet = req.body?.wallet;
  if (!wallet) {
    res.status(400).json({ error: 'Missing required field: wallet' });
    return null;
  }
  if (!isValidWallet(wallet)) {
    res.status(400).json({ error: 'Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).' });
    return null;
  }
  return wallet;
}

// ── Helper: validate numeric amount ───────────────────────────
function validateAmount(amount: unknown, opts: { allowNegative?: boolean } = {}): number | null {
  if (amount === undefined || amount === null) return 0;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (!opts.allowNegative && amount < 0) return null;
  if (!opts.allowNegative && amount <= 0) return null;
  return amount;
}

// ── Capability #1: Trust Score ────────────────────────────────
app.get('/score', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;

  // P1 FIX: Check response cache first
  const cacheKey = `score:${wallet}`;
  const cached = responseCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const result = await scoreWallet(wallet);
    if (!result) { res.status(404).json({ error: 'Wallet not found on testnet' }); return; }
    responseCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    logger.error('Failed to score wallet', { wallet, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Capability #2: Delegation Trust ───────────────────────────
app.get('/delegation', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;

  try {
    const result = await scoreDelegation(wallet);
    if (!result) { res.status(404).json({ error: 'Wallet not found on testnet' }); return; }
    res.json(result);
  } catch (error) {
    logger.error('Failed to score delegation trust', { wallet, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Capability #3: Counterparty Verification ──────────────────
app.post('/counterparty-check', async (req, res) => {
  const buyer = req.body?.buyer;
  if (!buyer) {
    res.status(400).json({ error: 'Missing required field: buyer' });
    return;
  }
  if (!isValidWallet(buyer)) {
    res.status(400).json({ error: 'Invalid buyer wallet address. Must be 58-character base32 (A-Z, 2-7).' });
    return;
  }

  try {
    const result = await checkCounterparty(buyer);
    if (!result) { res.status(404).json({ error: 'Wallet not found on testnet' }); return; }
    res.json(result);
  } catch (error) {
    logger.error('Failed to check counterparty', { buyer, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Capability #4: Credit Capacity Estimation ─────────────────
app.post('/credit-estimate', async (req, res) => {
  const wallet = requireBodyWallet(req, res);
  if (!wallet) return;

  const rawAmount = req.body?.amount;
  let amount: number | undefined;
  if (rawAmount !== undefined) {
    const validated = validateAmount(rawAmount);
    if (validated === null) {
      res.status(400).json({ error: 'Amount must be a positive finite number.' });
      return;
    }
    amount = validated;
  }

  try {
    const result = await estimateCredit(wallet, amount);
    if (!result) { res.status(404).json({ error: 'Wallet not found on testnet' }); return; }
    res.json(result);
  } catch (error) {
    logger.error('Failed to estimate credit', { wallet, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Capability #5: Sybil Detection ────────────────────────────
app.get('/sybil-check', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;

  try {
    const result = await detectSybil(wallet);
    if (!result) { res.status(404).json({ error: 'Wallet not found on testnet' }); return; }
    res.json(result);
  } catch (error) {
    logger.error('Failed to detect sybil risk', { wallet, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Capability #6: Reputation ─────────────────────────────────
app.get('/reputation', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;

  try {
    const result = await computeReputation(wallet);
    if (!result) { res.status(404).json({ error: 'Wallet not found on testnet' }); return; }
    res.json(result);
  } catch (error) {
    logger.error('Failed to compute reputation', { wallet, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/reputation/record', async (req, res) => {
  const wallet = requireBodyWallet(req, res);
  if (!wallet) return;

  const { eventType, amount, counterparty } = req.body || {};

  if (!eventType) {
    res.status(400).json({ error: 'Missing required field: eventType' });
    return;
  }

  const validTypes = EVENT_TYPES;
  if (!validTypes.includes(eventType)) {
    res.status(400).json({ error: `Invalid eventType. Must be one of: ${validTypes.join(', ')}` });
    return;
  }

  if (amount !== undefined) {
    const validated = validateAmount(amount, { allowNegative: true });
    if (validated === null || validated < 0) {
      res.status(400).json({ error: 'Amount must be a non-negative finite number.' });
      return;
    }
  }

  if (counterparty !== undefined && counterparty !== null && !isValidWallet(counterparty)) {
    res.status(400).json({ error: 'Invalid counterparty wallet address.' });
    return;
  }

  try {
    const result = await recordEvent(wallet, eventType, amount || 0, counterparty);
    if (!result) {
      res.status(400).json({ error: 'Failed to record event' });
      return;
    }
    // P1 FIX: Invalidate response cache for this wallet after reputation change
    responseCache.delete(`passport:${wallet}`);
    responseCache.delete(`score:${wallet}`);
    res.json(result);
  } catch (error) {
    logger.error('Failed to record reputation event', { wallet, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Capability #7: Underwriting Decision Engine ───────────────
app.get('/underwrite', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;

  try {
    const result = await underwrite(wallet);
    if (!result) { res.status(404).json({ error: 'Wallet not found on testnet' }); return; }
    res.json(result);
  } catch (error) {
    logger.error('Failed to underwrite wallet', { wallet, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Capability #8: Trust Graph Analytics ──────────────────────
app.get('/trust-graph', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;

  try {
    const result = await analyzeTrustGraph(wallet);
    if (!result) { res.status(404).json({ error: 'Wallet not found on testnet' }); return; }
    res.json(result);
  } catch (error) {
    logger.error('Failed to analyze trust graph', { wallet, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Capability #9: Agent Passport Document ────────────────────
app.get('/passport', async (req, res) => {
  const wallet = requireWallet(req, res);
  if (!wallet) return;

  // P1 FIX: Check response cache first
  const cacheKey = `passport:${wallet}`;
  const cached = responseCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const result = await generatePassport(wallet);
    if (!result) { res.status(404).json({ error: 'Wallet not found on testnet' }); return; }
    responseCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    logger.error('Failed to generate passport', { wallet, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Health ────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const health: Record<string, unknown> = {
    status: 'ok',
    service: 'Agent Passport',
    version: '0.1.0',
    network: config.algoNetwork,
    x402: config.x402Enabled,
    timestamp: new Date().toISOString(),
  };

  // Deep probe: verify Algorand endpoint connectivity
  try {
    const status = await algod.status().do();
    health.algorand = {
      connected: true,
      round: Number((status as any)['last-round'] || 0),
    };
  } catch (e) {
    health.status = 'degraded';
    health.algorand = {
      connected: false,
      error: String(e),
    };
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

let server: ReturnType<typeof express.application.listen> | null = null;

function main() {
  server = app.listen(PORT, () => {
    logger.info(`Agent Passport running on port ${PORT}`, {
      network: config.algoNetwork,
      port: PORT,
    });
  });
}

function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

main();
