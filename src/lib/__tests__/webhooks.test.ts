import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addSubscriber, removeSubscriber, listSubscribers, fireWebhook, clearSubscribers } from '../webhooks';

describe('webhooks', () => {
  beforeEach(() => {
    clearSubscribers();
    vi.restoreAllMocks();
  });

  it('adds and lists subscribers', () => {
    const sub = addSubscriber('WALLET_A', 'https://example.com/hook');
    expect(sub.wallet).toBe('WALLET_A');
    expect(sub.url).toBe('https://example.com/hook');
    expect(sub.id).toMatch(/^[0-9a-f-]{36}$/);
    const all = listSubscribers();
    expect(all).toHaveLength(1);
  });

  it('filters subscribers by wallet', () => {
    addSubscriber('WALLET_A', 'https://a.example.com/hook');
    addSubscriber('WALLET_B', 'https://b.example.com/hook');
    expect(listSubscribers('WALLET_A')).toHaveLength(1);
    expect(listSubscribers('WALLET_MISSING')).toHaveLength(0);
  });

  it('removes subscribers', () => {
    const sub = addSubscriber('WALLET_A', 'https://a.example.com/hook');
    expect(removeSubscriber(sub.id)).toBe(true);
    expect(removeSubscriber(sub.id)).toBe(false);
    expect(listSubscribers()).toHaveLength(0);
  });

  it('fireWebhook POSTs to all subscribers of a wallet', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    addSubscriber('WALLET_A', 'https://a.example.com/hook');
    addSubscriber('WALLET_A', 'https://b.example.com/hook');
    addSubscriber('WALLET_B', 'https://c.example.com/hook'); // different wallet

    await fireWebhook('WALLET_A', { hello: 'world' });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    for (const call of fetchSpy.mock.calls) {
      expect(call[0]).toMatch(/example\.com\/hook/);
      expect(call[1]?.method).toBe('POST');
    }
  });

  it('fireWebhook does not throw when delivery fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    addSubscriber('WALLET_A', 'https://broken.example.com/hook');
    await expect(fireWebhook('WALLET_A', { data: 1 })).resolves.toBeUndefined();
  });

  it('fireWebhook is a no-op when no subscribers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await fireWebhook('WALLET_NONE', { data: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});