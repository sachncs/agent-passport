/**
 * System Exposure Store
 *
 * Tracks cumulative approved credit across all wallets.
 * Persists state to a JSON file to survive server restarts.
 *
 * Per-wallet tracking (`walletExposure`) prevents a single wallet from
 * exhausting the global cap by repeatedly hitting /underwrite. Each wallet
 * gets its own ledger entry; `getWalletExposure` returns the running total
 * for a wallet, and `addWalletExposure` enforces both the global cap and
 * a per-wallet cap (default MAX_SYSTEM_EXPOSURE / 10 — see MAX_WALLET_SHARE).
 *
 * Concurrency: All mutating ops serialize through a single promise queue so
 * read-cap-and-write cannot race in a single process. Multi-process deployments
 * still need a shared store (Redis/PostgreSQL) — the on-disk file is for
 * restart durability only.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { logger } from './logger';

export const MAX_SYSTEM_EXPOSURE = 100_000;
export const MAX_WALLET_SHARE = MAX_SYSTEM_EXPOSURE / 10; // 10k — no single wallet gets more than 10% of the cap

let totalSystemExposure = 0;
const walletExposure = new Map<string, number>();

const PERSISTENCE_PATH = process.env.EXPOSURE_PERSISTENCE_PATH
  || join(process.cwd(), 'data', 'system-exposure.json');

interface PersistedState {
  total: number;
  wallets: Record<string, number>;
}

function loadFromDisk(): void {
  try {
    if (existsSync(PERSISTENCE_PATH)) {
      const data = readFileSync(PERSISTENCE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      const state = parsed as Partial<PersistedState>;
      if (typeof state.total === 'number' && Number.isFinite(state.total)) {
        totalSystemExposure = Math.max(0, state.total);
      }
      if (state.wallets && typeof state.wallets === 'object') {
        for (const [wallet, amount] of Object.entries(state.wallets)) {
          if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
            walletExposure.set(wallet, amount);
          }
        }
      }
      logger.info('Loaded system exposure from disk', {
        total: totalSystemExposure,
        wallets: walletExposure.size,
      });
    }
  } catch (e) {
    logger.warn('Failed to load system exposure from disk — starting from zero', { error: String(e) });
  }
}

// Serialize all mutating ops through a single chained promise.
// ponytail: in-process mutex; remove when this moves to Redis.
let writeQueue: Promise<void> = Promise.resolve();
function enqueueWrite(task: () => void): void {
  writeQueue = writeQueue.then(task).catch(() => { /* swallow — logged inside task */ });
}

function saveToDisk(): void {
  const snapshot: PersistedState = {
    total: totalSystemExposure,
    wallets: Object.fromEntries(walletExposure),
  };
  enqueueWrite(() => {
    try {
      const dir = dirname(PERSISTENCE_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(PERSISTENCE_PATH, JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
    } catch (e) {
      logger.warn('Failed to persist system exposure to disk', { error: String(e) });
    }
  });
}

loadFromDisk();

/** Gets the current total system exposure. */
export function getSystemExposure(): number {
  return totalSystemExposure;
}

/** Gets the running exposure for one wallet (0 if none). */
export function getWalletExposure(wallet: string): number {
  return walletExposure.get(wallet) ?? 0;
}

/** Number of wallets currently tracked. */
export function getTrackedWalletCount(): number {
  return walletExposure.size;
}

/**
 * Atomically reserves `amount` of system capacity for `wallet` and adds
 * it to the running total. Returns the actual amount reserved (may be less
 * than requested if either the global cap or per-wallet share is exhausted).
 *
 * Enforces two caps:
 *   1. Global: totalSystemExposure ≤ MAX_SYSTEM_EXPOSURE
 *   2. Per-wallet: walletExposure[wallet] ≤ MAX_WALLET_SHARE
 *
 * Persists to disk on every commit so the cap holds across restarts.
 */
export function addSystemExposure(wallet: string, amount: number): number {
  if (amount <= 0 || !wallet) return 0;

  const globalRemaining = Math.max(0, MAX_SYSTEM_EXPOSURE - totalSystemExposure);
  if (globalRemaining <= 0) return 0;

  const walletCurrent = walletExposure.get(wallet) ?? 0;
  const walletRemaining = Math.max(0, MAX_WALLET_SHARE - walletCurrent);
  if (walletRemaining <= 0) {
    logger.warn('Wallet has reached per-wallet exposure cap', { wallet, cap: MAX_WALLET_SHARE });
    return 0;
  }

  const reserved = Math.round(Math.min(amount, globalRemaining, walletRemaining) * 100) / 100;
  if (reserved <= 0) return 0;

  totalSystemExposure += reserved;
  walletExposure.set(wallet, walletCurrent + reserved);
  saveToDisk();
  return reserved;
}

/**
 * Resets the system exposure to zero. Use with caution — in production
 * this should require admin authorization.
 */
export function resetSystemExposure(): void {
  totalSystemExposure = 0;
  walletExposure.clear();
  saveToDisk();
}

/** Sets the system exposure to a specific value (for restoring from persistent storage). */
export function setSystemExposure(amount: number): void {
  totalSystemExposure = Math.max(0, Number.isFinite(amount) ? amount : 0);
  saveToDisk();
}

/**
 * Caps a recommended limit to the available system capacity AND the
 * wallet's per-wallet share. Formula:
 *   min(recommendedLimit, MAX_SYSTEM_EXPOSURE - total, MAX_WALLET_SHARE - walletCurrent)
 */
export function capToSystemCapacity(wallet: string, recommendedLimit: number): number {
  const globalRemaining = Math.max(0, MAX_SYSTEM_EXPOSURE - totalSystemExposure);
  const walletCurrent = walletExposure.get(wallet) ?? 0;
  const walletRemaining = Math.max(0, MAX_WALLET_SHARE - walletCurrent);
  return Math.round(Math.min(recommendedLimit, globalRemaining, walletRemaining) * 100) / 100;
}
