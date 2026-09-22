import { isValidWallet } from '../lib/constants';

export type WalletLocation = 'query' | 'body';

export function validateWallet(
  raw: unknown,
  location: WalletLocation,
): string | null {
  if (typeof raw !== 'string' || !raw) {
    return location === 'query'
      ? 'Missing required query parameter: wallet'
      : 'Missing required field: wallet';
  }
  if (!isValidWallet(raw)) {
    return 'Invalid wallet address. Must be 58-character base32 (A-Z, 2-7).';
  }
  return null;
}

export function validateAmount(
  amount: unknown,
  opts: { allowNegative?: boolean } = {},
): number | null {
  if (amount === undefined || amount === null) return 0;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (!opts.allowNegative && amount < 0) return null;
  if (!opts.allowNegative && amount <= 0) return null;
  return amount;
}
