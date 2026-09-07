import { describe, it, expect, beforeEach } from 'vitest';
import { checkSanctions, getSanctionsProvider } from '../sanctions';

describe('sanctions — memory provider', () => {
  beforeEach(() => {
    delete process.env.SANCTIONS_EXTRA_DENY;
    const p = getSanctionsProvider();
    if ('refresh' in p) (p as { refresh(): void }).refresh();
  });

  it('returns allowed for unknown wallets', async () => {
    const result = await checkSanctions('GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A');
    expect(result.status).toBe('allowed');
    expect(result.provider).toBe('memory');
  });

  it('returns denied for wallets in SANCTIONS_EXTRA_DENY', async () => {
    process.env.SANCTIONS_EXTRA_DENY = 'DENY_BAD_ACTOR,GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';
    const p = getSanctionsProvider();
    if ('refresh' in p) (p as { refresh(): void }).refresh();

    const denied = await checkSanctions('DENY_BAD_ACTOR');
    expect(denied.status).toBe('denied');
    expect(denied.reason).toBe('wallet_on_deny_list');

    const allowed = await checkSanctions('AAAAAAAAAABBBBBBBBBBCCCCCCCCCCDDDDDDDDDDEEEEEEEEEEFFFFFFFFFF');
    expect(allowed.status).toBe('allowed');
  });

  it('exposes the current provider name', () => {
    expect(getSanctionsProvider().name).toBe('memory');
  });
});