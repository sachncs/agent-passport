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
import { delegate as delegateOnChain, revoke as revokeOnChain, RegistryNotConfiguredError, RegistryValidationError, isRegistryConfigured } from './registry';
import { logger } from './lib/logger';
import { isValidWallet } from './lib/constants';
import { x402Middleware, settlementVerificationMiddleware } from './lib/x402';
import { rateLimiter, corsMiddleware, requestIdMiddleware, requestLoggingMiddleware } from './lib/security';
import { algod } from './lib/algorand-client';
import { LRUCache } from './lib/cache';
import { metricsMiddleware, metricsEndpoint, recordUnderwritingDecision, recordCounterpartyCheck, recordIdempotencyConflict, recordVerifyCheck, recordDiscoverySearch } from './lib/metrics';
import { idempotencyMiddleware } from './lib/idempotency';
import { startMetricsCollectors, stopMetricsCollectors } from './lib/metrics-collectors';

export const app = express();

// P1 FIX: Response cache for wallet lookups (60s TTL, 500 entries)
export const responseCache = new LRUCache<unknown>(500, 60_000);

// Security: trust proxy for correct IP behind load balancers
app.set('trust proxy', 1);

// Security: helmet for HTTP headers (HSTS, X-Content-Type-Options, CSP, etc.)
app.use(helmet());

// Request ID and logging
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);

// CORS with configurable origins
app.use(corsMiddleware({ origin: config.corsAllowedOrigins }));
app.use(rateLimiter({ windowMs: 60_000 }));
app.use(express.json({ limit: '100kb' }));
app.use(metricsMiddleware);
app.use(x402Middleware);
app.use(settlementVerificationMiddleware);
app.use(idempotencyMiddleware);

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
    recordCounterpartyCheck(result.allow ? 'allow' : 'deny');
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
    recordUnderwritingDecision(result.approved ? 'approved' : 'denied');
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

// ── Capability #8b: On-chain Delegation / Endorsement ─────────
app.post('/delegate', async (req, res) => {
  const { sponsor, agent, amount } = req.body || {};
  if (!sponsor) { res.status(400).json({ error: 'Missing required field: sponsor' }); return; }
  if (!agent) { res.status(400).json({ error: 'Missing required field: agent' }); return; }
  if (!isValidWallet(sponsor)) { res.status(400).json({ error: 'Invalid sponsor wallet address. Must be 58-character base32 (A-Z, 2-7).' }); return; }
  if (!isValidWallet(agent)) { res.status(400).json({ error: 'Invalid agent wallet address. Must be 58-character base32 (A-Z, 2-7).' }); return; }
  if (sponsor === agent) { res.status(400).json({ error: 'Sponsor and agent must be different wallets.' }); return; }
  if (amount === undefined || amount === null) { res.status(400).json({ error: 'Missing required field: amount' }); return; }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) { res.status(400).json({ error: 'Amount must be a positive finite number.' }); return; }

  try {
    const result = await delegateOnChain(sponsor, agent, amount);
    responseCache.delete(`passport:${agent}`);
    responseCache.delete(`passport:${sponsor}`);
    responseCache.delete(`score:${agent}`);
    responseCache.delete(`score:${sponsor}`);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof RegistryNotConfiguredError) {
      res.status(503).json({ error: error.message, code: 'REGISTRY_NOT_CONFIGURED' });
      return;
    }
    if (error instanceof RegistryValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    logger.error('Failed to submit delegation', { sponsor, agent, amount, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Capability #8c: On-chain Revocation ───────────────────────
app.post('/revoke', async (req, res) => {
  const { sponsor, agent } = req.body || {};
  if (!sponsor) { res.status(400).json({ error: 'Missing required field: sponsor' }); return; }
  if (!agent) { res.status(400).json({ error: 'Missing required field: agent' }); return; }
  if (!isValidWallet(sponsor)) { res.status(400).json({ error: 'Invalid sponsor wallet address. Must be 58-character base32 (A-Z, 2-7).' }); return; }
  if (!isValidWallet(agent)) { res.status(400).json({ error: 'Invalid agent wallet address. Must be 58-character base32 (A-Z, 2-7).' }); return; }

  try {
    const result = await revokeOnChain(sponsor, agent);
    responseCache.delete(`passport:${agent}`);
    responseCache.delete(`passport:${sponsor}`);
    responseCache.delete(`score:${agent}`);
    responseCache.delete(`score:${sponsor}`);
    res.json(result);
  } catch (error) {
    if (error instanceof RegistryNotConfiguredError) {
      res.status(503).json({ error: error.message, code: 'REGISTRY_NOT_CONFIGURED' });
      return;
    }
    if (error instanceof RegistryValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    logger.error('Failed to submit revocation', { sponsor, agent, error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Registry status endpoint (used by E2E) ────────────────────
app.get('/registry/status', (_req, res) => {
  res.json({ configured: isRegistryConfigured(), appId: config.registryAppId });
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

// ── Capability #10: Lightweight Wallet Verify ─────────────────
app.get('/verify', async (req, res) => {
  const raw = req.query.wallet;
  if (typeof raw !== 'string' || !raw) {
    res.status(400).json({ error: 'Missing required query parameter: wallet' });
    return;
  }

  const valid = isValidWallet(raw);
  const flags: Record<string, boolean> = {};

  if (valid) {
    // Lightweight flag derivation: do a single, fast account lookup with
    // bounded timeout. Cached for 60s to avoid hammering algod.
    const cacheKey = `verify:${raw}`;
    const cached = responseCache.get(cacheKey) as { flags: Record<string, boolean> } | undefined;
    if (cached) {
      recordVerifyCheck(cached.flags);
      res.json({ valid: true, wallet: raw, flags: cached.flags, cached: true });
      return;
    }
    try {
      const info = await algod.accountInformation(raw).do();
      // Naive flag heuristics — refine in production
      flags.funded = Number(info.amount || 0n) > 0;
      flags.active = (info.totalAppsOptedIn || 0) > 0 || (info.totalAssetsOptedIn || 0) > 0;
      flags.empty = Number(info.amount || 0n) === 0;
      responseCache.set(cacheKey, { flags });
    } catch (e) {
      // Wallet not found on chain is still a valid Algorand address format
      flags.lookup_failed = true;
    }
  }

  recordVerifyCheck(flags);
  res.json({ valid, wallet: raw, flags });
});

// ── Capability #11: Bazaar Discovery ───────────────────────────
app.get('/discovery/search', async (req, res) => {
  const q = (req.query.q as string | undefined)?.toLowerCase() ?? '';
  const limit = Math.min(parseInt(req.query.limit as string ?? '20', 10) || 20, 100);

  // Static Bazaar catalog (production: backed by a registry or x402 bazaar service)
  const catalog = [
    {
      id: 'agent-passport',
      type: 'service',
      category: 'trust',
      name: 'Agent Passport',
      description: 'Stateless trust scoring, delegation, credit, sybil, reputation, and underwriting for AI agents on Algorand',
      tags: ['trust', 'scoring', 'algorand', 'agent', 'wallet', 'x402'],
      endpoints: {
        score: '/score',
        passport: '/passport',
        underwrite: '/underwrite',
        counterparty: '/counterparty-check',
        delegate: '/delegate',
        revoke: '/revoke',
      },
      pricing: {
        score: '0.001 USDC',
        passport: '0.005 USDC',
        underwrite: '0.01 USDC',
        counterparty: '0.01 USDC',
      },
      health: '/health',
    },
  ];

  const filtered = q
    ? catalog.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      )
    : catalog;

  recordDiscoverySearch(q, filtered.length);
  res.json({
    query: q,
    total: filtered.length,
    results: filtered.slice(0, limit),
  });
});

// ── Prometheus Metrics ────────────────────────────────────────
app.get('/metrics', metricsEndpoint);

// ── Health (liveness) ─────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Agent Passport',
    version: '0.1.0',
    network: config.algoNetwork,
    x402: config.x402Enabled,
    timestamp: new Date().toISOString(),
  });
});

// ── Readiness (deep probe — checks Algorand connectivity) ──────
app.get('/ready', async (_req, res) => {
  const health: Record<string, unknown> = {
    status: 'ok',
    service: 'Agent Passport',
    network: config.algoNetwork,
    timestamp: new Date().toISOString(),
  };

  try {
    const status = await algod.status().do();
    health.algorand = {
      connected: true,
      round: Number(status.lastRound || 0),
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

// ── Backwards-compat: /health still reports Algorand status ──
// but always returns 200 unless the process is severely broken.
app.get('/health/deep', async (_req, res) => {
  const health: Record<string, unknown> = {
    status: 'ok',
    service: 'Agent Passport',
    version: '0.1.0',
    network: config.algoNetwork,
    x402: config.x402Enabled,
    timestamp: new Date().toISOString(),
  };

  try {
    const status = await algod.status().do();
    health.algorand = {
      connected: true,
      round: Number(status.lastRound || 0),
    };
  } catch (e) {
    health.algorand = {
      connected: false,
      error: String(e),
    };
  }

  // Always 200 — the process is alive; Algorand status is informational
  res.json(health);
});

// ── Background Workers ────────────────────────────────────────
// Start metrics collectors at module load. Stop gracefully on shutdown.
if (process.env.NODE_ENV !== 'test') {
  startMetricsCollectors();
  process.once('SIGTERM', () => { stopMetricsCollectors(); });
  process.once('SIGINT', () => { stopMetricsCollectors(); });
}
