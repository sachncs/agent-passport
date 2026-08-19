/**
 * Algorand wallet validation. Mirrors the server rule
 * `^[A-Z2-7]{58}$` so we can show inline errors before submitting.
 */

export const WALLET_REGEX = /^[A-Z2-7]{58}$/

export function isValidWallet(s: string): boolean {
  return typeof s === "string" && WALLET_REGEX.test(s)
}
