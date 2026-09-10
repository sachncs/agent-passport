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

  it('records a metric on timeout (so operators can alert on leaks)', async () => {
    const { algosdkTimeoutLeaksTotal } = await import('../metrics');
    const before = await algosdkTimeoutLeaksTotal.get();
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200));
    await expect(withTimeout(slow, 30, 'algod-status')).rejects.toThrow('Timeout after 30ms: algod-status');
    const after = await algosdkTimeoutLeaksTotal.get();
    const inc = after.values.find(v => v.labels.operation === 'algod-status');
    expect(inc?.value).toBe((before.values.find(v => v.labels.operation === 'algod-status')?.value ?? 0) + 1);
  });

  it('does not record a metric on success', async () => {
    const { algosdkTimeoutLeaksTotal } = await import('../metrics');
    const before = await algosdkTimeoutLeaksTotal.get();
    await withTimeout(Promise.resolve('ok'), 1000, 'algod-accountInfo');
    const after = await algosdkTimeoutLeaksTotal.get();
    const inc = after.values.find(v => v.labels.operation === 'algod-accountInfo');
    expect(inc?.value ?? 0).toBe(before.values.find(v => v.labels.operation === 'algod-accountInfo')?.value ?? 0);
  });
});