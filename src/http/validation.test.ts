import { describe, expect, it } from 'vitest';
import { validateAmount, validateWallet } from './validation';

describe('HTTP validation boundary', () => {
  it('returns location-specific wallet errors', () => {
    expect(validateWallet(undefined, 'query')).toContain('query parameter');
    expect(validateWallet(undefined, 'body')).toContain('field');
  });

  it('rejects malformed wallets and accepts valid Algorand addresses', () => {
    expect(validateWallet('not-a-wallet', 'query')).toContain('Invalid wallet');
    expect(validateWallet('GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A', 'query')).toBeNull();
  });

  it('keeps amount validation deterministic', () => {
    expect(validateAmount(undefined)).toBe(0);
    expect(validateAmount(10)).toBe(10);
    expect(validateAmount(0)).toBeNull();
    expect(validateAmount(-1)).toBeNull();
    expect(validateAmount(-1, { allowNegative: true })).toBe(-1);
    expect(validateAmount(Number.NaN)).toBeNull();
  });
});
