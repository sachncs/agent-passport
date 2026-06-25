/**
 * E2E test fixtures and helpers.
 *
 * The e2e suite uses a known Algorand testnet wallet as the canonical
 * subject under test. Tests that need real on-chain data will be
 * skipped when SKIP_E2E=1 is set. The known wallet must remain funded
 * and active for tests to be reliable.
 */

import { randomBytes, createHash } from 'crypto';
import { resetRateLimiter } from '../../lib/security';
import { beforeEach } from 'vitest';

export const resetForTest = (): void => {
  resetRateLimiter();
};

// Auto-reset rate limiter between E2E tests so the test run is not throttled
beforeEach(() => {
  resetRateLimiter();
});

export const KNOWN_TESTNET_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5ADKRY7GNU3CJQX6FMT2BIP';
export const ALT_TESTNET_WALLET = 'ALT7V52CKSH5F2S6L4XJ7UKI3DPEHBQJAHOV4DKRY7GNU3CJQX6FMT2BIP';
export const SANCTIONED_WALLET = 'SANC7V52CKSH5F2S6L4XJ7UKI3DPEHBQJHOV4DKRY7GNU3CJQX6FMT2BIP';
export const FRESH_WALLET = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';

export const isE2ESkipped = (): boolean => process.env.SKIP_E2E === '1';

export function freshWallet(): string {
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let wallet = '';
  for (let i = 0; i < 58; i++) {
    wallet += validChars[Math.floor(Math.random() * validChars.length)];
  }
  return wallet;
}

export function randomIdempotencyKey(): string {
  return `e2e_${randomBytes(12).toString('hex')}`;
}

export function hashBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
}

export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export interface TestRequestOptions {
  idempotencyKey?: string;
  xPayment?: string;
  requestId?: string;
}

export const FIVE_PERCENT = 0.05;
export const ONE_PERCENT = 0.01;
