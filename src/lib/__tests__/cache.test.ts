import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TTLCache } from '../cache';

describe('TTLCache', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', () => {
    const cache = new TTLCache<string>({ maxEntries: 10, ttlMs: 60_000 });
    cache.set('a', 'hello');
    expect(cache.get('a')).toBe('hello');
  });

  it('returns undefined for missing keys', () => {
    const cache = new TTLCache<string>({ maxEntries: 10, ttlMs: 60_000 });
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts oldest entry when full', () => {
    const cache = new TTLCache<string>({ maxEntries: 2, ttlMs: 60_000 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3'); // evicts 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });

  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string>({ maxEntries: 10, ttlMs: 1000 });
    cache.set('a', 'hello');
    expect(cache.get('a')).toBe('hello');
    vi.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();
  });

  it('moves accessed entries to end (LRU)', () => {
    const cache = new TTLCache<string>({ maxEntries: 2, ttlMs: 60_000 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.get('a'); // access 'a', moves to end
    cache.set('c', '3'); // evicts 'b' (oldest)
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('3');
  });

  it('updates existing key without growing', () => {
    const cache = new TTLCache<string>({ maxEntries: 2, ttlMs: 60_000 });
    cache.set('a', '1');
    cache.set('a', '2');
    expect(cache.size).toBe(1);
    expect(cache.get('a')).toBe('2');
  });

  it('clears all entries', () => {
    const cache = new TTLCache<string>({ maxEntries: 10, ttlMs: 60_000 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('per-call ttl overrides constructor ttl', () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string>({ maxEntries: 10, ttlMs: 60_000 });
    cache.set('a', 'short', 100);
    cache.set('b', 'long');
    vi.advanceTimersByTime(500);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('long');
  });

  it('records hit/miss/eviction stats', () => {
    const cache = new TTLCache<string>({ maxEntries: 2, ttlMs: 60_000 });
    cache.set('a', '1');
    cache.get('a'); // hit
    cache.get('missing'); // miss
    cache.set('b', '2');
    cache.set('c', '3'); // evicts 'a'
    const s = cache.stats();
    expect(s.hits).toBe(1);
    expect(s.misses).toBe(1);
    expect(s.evictions).toBe(1);
    expect(s.size).toBe(2);
  });
});