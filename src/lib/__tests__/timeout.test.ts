import { describe, it, expect, vi } from 'vitest';
import { withTimeout } from '../timeout';

describe('withTimeout', () => {
  it('resolves before timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  it('rejects on timeout', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200));
    await expect(withTimeout(slow, 50)).rejects.toThrow('Timeout after 50ms');
  });

  it('includes label in error message', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200));
    await expect(withTimeout(slow, 50, 'myCall')).rejects.toThrow('Timeout after 50ms: myCall');
  });

  it('clears timeout on success', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    await withTimeout(Promise.resolve('ok'), 1000);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});