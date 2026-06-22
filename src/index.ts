import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { scoreWallet } from './trust-score';
import { scoreDelegation } from './delegation';
import { checkCounterparty } from './counterparty';
import { estimateCredit } from './credit';
import { detectSybil } from './sybil';
import { recordEvent, computeReputation } from './reputation';
import { underwrite } from './underwriting';
import { analyzeTrustGraph } from './trust-graph';
import { generatePassport } from './passport';
import { logger } from './lib/logger';
import { isValidWallet } from './lib/constants';
import { x402Middleware } from './lib/x402';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '100kb' }));
app.use(x402Middleware);

// ── Helper: validate wallet from query param ──────────────────
function requireWallet(req: express.Request, res: express.Response): string | null {
  const wallet = req.query.wallet as string;
  if (!wallet) {
    res.status(400).json({ error: 'Missing required query parameter: wallet' });
    return null;
  }
  if (!isValidWallet(wallet)) {
    res.status(400).json({ error: 'Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).' });
    return null;
  }
  return wallet;
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

  try {
    const result = await scoreWallet(wallet);
    if (!result) { res.status(404).json({ error: 'Wallet not found on testnet' }); return; }
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

  const amount = req.body?.amount;
  if (amount !== undefined) {
    const validated = validateAmount(amount);
    if (validated === null) {
      res.status(400).json({ error: 'Amount must be a positive finite number.' });
      return;
    }
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

  const validTypes = ['payment', 'purchase', 'dispute', 'refund', 'endorsement', 'service'];
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

  try {
    const result = await generatePassport(wallet);
    if (!result) { res.status(404).json({ error: 'Wallet not found on testnet' }); return; }
    res.json(result);
  } catch (error) {
    logger.error('Failed to generate passport', { wallet, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Agent Passport',
    version: '0.2.0',
    network: process.env.ALGO_NETWORK || 'testnet',
    x402: process.env.X402_ENABLED === 'true',
    timestamp: new Date().toISOString(),
  });
});

let server: ReturnType<typeof express.application.listen> | null = null;

function main() {
  server = app.listen(PORT, () => {
    logger.info(`Agent Passport running on port ${PORT}`, {
      network: process.env.ALGO_NETWORK || 'testnet',
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

export { app };
