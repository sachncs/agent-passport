/**
 * System Exposure Store
 *
 * Tracks cumulative approved credit across all wallets.
 * Persists state to a JSON file to survive server restarts.
 *
 * Determinism guarantee: Given the same sequence of addSystemExposure() calls,
 * the totalSystemExposure value is identical regardless of process start time.
 *
 * Thread safety: All operations are synchronous (single-threaded Node.js).
 * In a multi-process deployment, this must be backed by a shared store (Redis/PostgreSQL).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { logger } from './logger';

export const MAX_SYSTEM_EXPOSURE = 100_000;

type ExposureListener = (total: number) => void;

let totalSystemExposure = 0;
const listeners: ExposureListener[] = [];

// P0 FIX: Persistence to disk
const PERSISTENCE_PATH = process.env.EXPOSURE_PERSISTENCE_PATH
  || join(process.cwd(), 'data', 'system-exposure.json');

function loadFromDisk(): void {
  try {
    if (existsSync(PERSISTENCE_PATH)) {
      const data = readFileSync(PERSISTENCE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (typeof parsed.total === 'number' && Number.isFinite(parsed.total)) {
        totalSystemExposure = Math.max(0, parsed.total);
        logger.info('Loaded system exposure from disk', { total: totalSystemExposure });
      }
    }
  } catch (e) {
    logger.warn('Failed to load system exposure from disk — starting from zero', { error: String(e) });
  }
}

function saveToDisk(): void {
  try {
    const dir = dirname(PERSISTENCE_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(PERSISTENCE_PATH, JSON.stringify({
      total: totalSystemExposure,
      updatedAt: new Date().toISOString(),
    }, null, 2));
  } catch (e) {
    logger.warn('Failed to persist system exposure to disk', { error: String(e) });
  }
}

// Load on module initialization
loadFromDisk();

/**
 * Gets the current total system exposure.
 */
export function getSystemExposure(): number {
  return totalSystemExposure;
}

/**
 * Adds to the cumulative system exposure.
 * Returns the new total after adding.
 */
export function addSystemExposure(amount: number): number {
  totalSystemExposure += amount;
  saveToDisk();
  notifyListeners();
  return totalSystemExposure;
}

/**
 * Resets the system exposure to zero.
 * Use with caution — in production this should require admin authorization.
 */
export function resetSystemExposure(): void {
  totalSystemExposure = 0;
  saveToDisk();
  notifyListeners();
}

/**
 * Sets the system exposure to a specific value.
 * Use for restoring from persistent storage on startup.
 */
export function setSystemExposure(amount: number): void {
  totalSystemExposure = amount;
  saveToDisk();
  notifyListeners();
}

/**
 * Caps a recommended limit to the available system capacity.
 *
 * Design rationale:
 * - Without this, the system could extend unbounded credit
 * - Analogous to a bank's reserve requirement: total loans <= reserves
 * - Per-wallet cap = remaining system capacity (prevents any single wallet from consuming all)
 *
 * Formula: min(recommendedLimit, MAX_SYSTEM_EXPOSURE - totalSystemExposure)
 */
export function capToSystemCapacity(recommendedLimit: number): number {
  const remaining = Math.max(0, MAX_SYSTEM_EXPOSURE - totalSystemExposure);
  return Math.round(Math.min(recommendedLimit, remaining) * 100) / 100;
}

/**
 * Subscribes to exposure changes.
 * Returns an unsubscribe function.
 */
export function onExposureChange(listener: ExposureListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyListeners(): void {
  for (const listener of listeners) {
    try {
      listener(totalSystemExposure);
    } catch {
      // Listener errors should not crash the system
    }
  }
}
