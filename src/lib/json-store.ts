/**
 * Tiny JSON-file persistence helper.
 *
 * Replaces 3 copies of the same pattern that previously lived in
 * security.ts (rate-limit state), system-exposure.ts (credit cap
 * ledger), and webhooks.ts (subscriber list):
 *   - existsSync + mkdirSync + readFileSync + JSON.parse
 *   - mkdirSync + writeFileSync + renameSync, all serialized through
 *     a Promise queue so concurrent writes can't race
 *
 * Each caller keeps its own in-memory cache (a Map, a counter + Map,
 * or an array) and calls `queueJsonWrite(path, snapshot)` when it
 * wants the snapshot persisted.
 *
 * ponytail: Multi-replica deployments still need a shared store
 * (Redis/Postgres); the on-disk file is for single-pod restart
 * durability only.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname } from 'path';

let writeQueue: Promise<void> = Promise.resolve();

/**
 * Schedule an atomic JSON-file write. Serialized through a single
 * promise queue so concurrent writes never race or see a stale
 * snapshot. Failures are reported via `onError` and don't block
 * later writes.
 */
export function queueJsonWrite(
  path: string,
  value: unknown,
  onError?: (error: unknown) => void,
): void {
  writeQueue = writeQueue.then(() => {
    try {
      writeJsonFileSync(path, value);
    } catch (e) {
      onError?.(e);
    }
  });
}

/** Atomic write: .tmp + renameSync so a reader never sees a torn file. */
export function writeJsonFileSync(path: string, value: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

/** Read a JSON file, returning `fallback` on any error or missing file. */
export function readJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}