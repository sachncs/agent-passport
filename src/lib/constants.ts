export const WALLET_REGEX = /^[A-Z2-7]{58}$/;

export function isValidWallet(wallet: string): boolean {
  return typeof wallet === 'string' && WALLET_REGEX.test(wallet);
}

export const X402_PRICING = {
  '/score': { price: 0.001, description: 'Trust Score' },
  '/delegation': { price: 0.001, description: 'Delegation Trust' },
  '/counterparty-check': { price: 0.002, description: 'Counterparty Verification' },
  '/credit-estimate': { price: 0.002, description: 'Credit Capacity Estimation' },
  '/sybil-check': { price: 0.003, description: 'Sybil Detection' },
  '/reputation': { price: 0.001, description: 'Reputation Lookup' },
  '/reputation/record': { price: 0.005, description: 'Record Reputation Event' },
  '/underwrite': { price: 0.01, description: 'Underwriting Decision' },
  '/trust-graph': { price: 0.005, description: 'Trust Graph Analytics' },
  '/passport': { price: 0.005, description: 'Agent Passport Document' },
} as const;

export type X402Endpoint = keyof typeof X402_PRICING;
