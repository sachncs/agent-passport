/**
 * Lightweight Algorand wallet validation — mirrors the server-side
 * rule (58 chars, base32 A-Z 2-7). The server is the source of truth;
 * this exists so the form can show inline errors before submitting.
 */
export const WALLET_REGEX = /^[A-Z2-7]{58}$/;

export function isValidWallet(s: string): boolean {
  return typeof s === 'string' && WALLET_REGEX.test(s);
}

export function isValidAlgoAddress(s: string): boolean {
  return isValidWallet(s);
}