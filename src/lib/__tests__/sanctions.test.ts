import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkSanctions,
   getSanctionsProvider,
   setSanctionsProvider
} from '../sanctions';

describe('sanctions', () => {
  beforeEach(() => {
    delete process.env.SANCTIONS_PROVIDER;
    delete process.env.SANCTIONS_EXTRA_DENY;
    // Re-import default — but vitest hoists, so just reset to memory via
    // setProvider.
    setSanctionsProvider({
      name: 'memory',
      check: async (wallet) => ({
        status: wallet.startsWith('DENY_') ? 'denied' : 'allowed',
        reason: wallet.startsWith('DENY_') ? 'wallet_on_deny_list' : undefined,
        provider: 'memory',
        checkedAt: new Date().toISOString(),
      }),
    });
  });

  it('returns allowed for unknown wallets under the memory provider', async () => {
    const result = await checkSanctions('GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A');
    expect(result.status).toBe('allowed');
    expect(result.provider).toBe('memory');
  });

  it('returns denied for wallets on the deny list', async () => {
    const result = await checkSanctions('DENY_BAD_ACTOR');
    expect(result.status).toBe('denied');
    expect(result.reason).toBe('wallet_on_deny_list');
  });

  it('honours a custom provider via setSanctionsProvider', async () => {
    setSanctionsProvider({
      name: 'chainalysis-mock',
      check: async () => ({
        status: 'denied',
        reason: 'mock_provider_blocked',
        provider: 'chainalysis-mock',
        checkedAt: new Date().toISOString(),
      }),
    });
    const result = await checkSanctions('GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A');
    expect(result.status).toBe('denied');
    expect(result.provider).toBe('chainalysis-mock');
  });

  it('fails closed when the provider throws', async () => {
    setSanctionsProvider({
      name: 'broken',
      check: async () => { throw new Error('network down'); },
    });
    const result = await checkSanctions('GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A');
    expect(result.status).toBe('unknown');
    expect(result.reason).toBe('screening_provider_unavailable');
  });

  it('exposes the current provider name', () => {
    expect(getSanctionsProvider().name).toBe('memory');
  });
});