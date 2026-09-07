// Shared k6 configuration for the Agent Passport load-test suite.
//
// All scenarios import `BASE_URL`, `pickWallet`, and `VALID_WALLET` from here.
// `BASE_URL` can be overridden with the k6 environment variable of the same
// name: `k6 run -e BASE_URL=https://staging.example.com scenarios/a-100vu.js`.

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// One well-known testnet wallet used by every read-only scenario for
// reproducibility. The wallet has substantial history so the score is
// non-zero and cache-invalidates predictably.
export const VALID_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';

// A second testnet wallet — used for non-trivial scenario mixes to avoid
// hammering the cache with a single key.
const SECONDARY_WALLET = 'A2YR3UXLBTMZK6BLCV6ABNG5JGNOX7TXQFTAVAPF5A4JOI5EFWZ2LETCEA';
const TERTIARY_WALLET  = '6YSUR3VHR5X3R27AGBG5AJYARTDSXZJHRZ3D7XO6PWERNGKWDFRXG76NEA';

const WALLETS = [VALID_WALLET, SECONDARY_WALLET, TERTIARY_WALLET];

/**
 * Returns a wallet address. When `scenario` is provided the function is
 * deterministic (always returns the same wallet for the same scenario),
 * which is helpful when reproducing a specific run. When called with no
 * argument it round-robins across the pool.
 */
export function pickWallet(scenario) {
  if (scenario === 'score')         return VALID_WALLET;
  if (scenario === 'passport')      return VALID_WALLET;
  if (scenario === 'delegation')    return VALID_WALLET;
  if (scenario === 'underwrite')    return VALID_WALLET;
  if (scenario === 'counterparty')  return VALID_WALLET;
  if (scenario === 'trust-graph')   return VALID_WALLET;
  if (scenario === 'sybil')         return VALID_WALLET;
  if (scenario === 'reputation')    return VALID_WALLET;
  if (scenario === 'credit')        return VALID_WALLET;
  if (scenario === 'verify')        return VALID_WALLET;
  if (scenario === 'discovery')     return null;
  return WALLETS[Math.floor(Math.random() * WALLETS.length)];
}
