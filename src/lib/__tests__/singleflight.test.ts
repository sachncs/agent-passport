import { describe, it, expect, vi } from 'vitest';
import { singleflight, inflightGet, resetInflight } from '../singleflight';

describe('singleflight', () => {
  beforeEach(() => resetInflight());

  it('runs the loader only once for concurrent callers', async () => {
    const loader = vi.fn().mockResolvedValue('result');
    const [a, b, c] = await Promise.all([
      singleflight('key1', loader),
      singleflight('key1', loader),
      singleflight('key1', loader),
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(a).toBe('result');
    expect(b).toBe('result');
    expect(c).toBe('result');
  });

  it('removes the inflight entry on resolve so a later call hits the loader again', async () => {
    const loader = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const a = await singleflight('key2', loader);
    const b = await singleflight('key2', loader);
    expect(a).toBe('first');
    expect(b).toBe('second');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('removes the inflight entry on reject', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');
    await expect(singleflight('key3', loader)).rejects.toThrow('boom');
    expect(inflightGet('key3')).toBeUndefined();
    const ok = await singleflight('key3', loader);
    expect(ok).toBe('ok');
  });

  it('keys are independent', async () => {
    const a = vi.fn().mockResolvedValue('A');
    const b = vi.fn().mockResolvedValue('B');
    const [ra, rb] = await Promise.all([
      singleflight('alpha', a),
      singleflight('beta', b),
    ]);
    expect(ra).toBe('A');
    expect(rb).toBe('B');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});