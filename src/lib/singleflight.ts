/**
 * Singleflight — coalesce concurrent calls for the same key into one
 * underlying operation.
 *
 * ponytail: cache stampedes happen when a popular key expires and 100
 * concurrent requests all miss the cache, each triggering a fresh
 * Algorand indexer query. With singleflight, only the first call hits
 * the upstream; the other 99 await the same promise. The next call after
 * the result is cached will hit the cache normally.
 *
 * Returns the in-flight promise if one exists; otherwise starts a new
 * one and stores it. The caller MUST eventually delete the entry, which
 * is what `wrap()` does on resolve/reject.
 */

const inflight = new Map<string, Promise<unknown>>();

export function inflightGet<T>(key: string): Promise<T> | undefined {
  return inflight.get(key) as Promise<T> | undefined;
}

export function inflightSet<T>(key: string, promise: Promise<T>): void {
  inflight.set(key, promise);
}

export function inflightDelete(key: string): void {
  inflight.delete(key);
}

/** Convenience: run `loader` once even if `key` is requested concurrently. */
export async function singleflight<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const p = loader().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Test-only: drop all inflight entries. */
export function resetInflight(): void {
  inflight.clear();
}