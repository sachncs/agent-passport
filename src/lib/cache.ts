/**
 * Tiny TTL+LRU cache built on Map insertion order.
 *
 * Why not lru-cache or similar: ponytail — Map already maintains insertion
 * order, so eviction is `cache.delete(key); cache.set(key, ...)` and LRU is
 * `cache.delete(key); cache.set(key, cache.get(key)!)`. A 30-line class
 * beats a 3rd-party dep for one feature.
 *
 * Thread-safety: single-process, single-thread (Node). Multi-replica needs
 * a shared store.
 */

interface TTLCacheOptions {
  /** Max entries before LRU eviction kicks in. */
  maxEntries: number;
  /** Per-entry lifetime in ms. */
  ttlMs: number;
}

interface Entry<V> {
  v: V;
  exp: number; // unix ms
}

export class TTLCache<V> {
  private readonly store = new Map<string, Entry<V>>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(private readonly opts: TTLCacheOptions) {}

  clear(): void {
    this.store.clear();
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.exp <= Date.now()) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    // Refresh LRU position by re-inserting.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.v;
  }

  get size(): number {
    return this.store.size;
  }

  set(key: string, value: V, ttlMs?: number): void {
    const exp = Date.now() + (ttlMs ?? this.opts.ttlMs);
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { v: value, exp });
    while (this.store.size > this.opts.maxEntries) {
      // Map iteration is in insertion order — the first key is the LRU.
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
      this.evictions++;
    }
  }

  stats(): { hits: number; misses: number; evictions: number; size: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.store.size,
    };
  }
}