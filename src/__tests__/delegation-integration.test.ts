import { describe, it, expect } from 'vitest';
import {
  scoreDelegation,
  scoreWallet,
} from '../delegation';

// NOTE: These tests require REGISTRY_APP_ID to be set in env
// and a deployed registry contract on testnet.
// They test against real Algorand testnet state.
const TESTNET_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';

describe('Delegation Trust — Integration Tests (Real Testnet)', () => {
  it('returns valid structure for a real wallet', async () => {
    const result = await scoreDelegation(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(result!.wallet).toBe(TESTNET_WALLET);
    expect(typeof result!.trustScore).toBe('number');
    expect(result!.trustScore).toBeGreaterThanOrEqual(0);
    expect(result!.trustScore).toBeLessThanOrEqual(100);
    expect(['low', 'medium', 'high', 'critical']).toContain(result!.riskLevel);
    expect(typeof result!.approved).toBe('boolean');
    expect(typeof result!.recommendedLimit).toBe('number');
  }, 30000);

  it('returns breakdown with all four sub-scores', async () => {
    const result = await scoreDelegation(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(typeof result!.breakdown.depthScore).toBe('number');
    expect(typeof result!.breakdown.sponsorQualityScore).toBe('number');
    expect(typeof result!.breakdown.sponsorCountScore).toBe('number');
    expect(typeof result!.breakdown.amountScore).toBe('number');

    for (const key of [
      'depthScore',
       'sponsorQualityScore',
       'sponsorCountScore',
       'amountScore'
    ] as const) {
      expect(result!.breakdown[key]).toBeGreaterThanOrEqual(0);
      expect(result!.breakdown[key]).toBeLessThanOrEqual(100);
    }
  }, 30000);

  it('returns delegation data with valid fields', async () => {
    const result = await scoreDelegation(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(typeof result!.delegation.depth).toBe('number');
    expect(result!.delegation.depth).toBeGreaterThanOrEqual(0);
    expect(typeof result!.delegation.sponsorCount).toBe('number');
    expect(result!.delegation.sponsorCount).toBeGreaterThanOrEqual(0);
    expect(typeof result!.delegation.sponsorQuality).toBe('number');
    expect(Array.isArray(result!.delegation.delegationPath)).toBe(true);
    expect(typeof result!.delegation.totalDelegatedAmount).toBe('number');
    expect(typeof result!.delegation.isTrustAnchor).toBe('boolean');
    expect(typeof result!.delegation.trustedAncestors).toBe('number');
  }, 30000);

  it('returns explanation as array of strings', async () => {
    const result = await scoreDelegation(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.explanation)).toBe(true);
    expect(result!.explanation.length).toBeGreaterThanOrEqual(1);
    for (const reason of result!.explanation) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(0);
    }
  }, 30000);

  it('returns null for invalid wallet address', async () => {
    const result = await scoreDelegation('invalid');
    expect(result).toBeNull();
  });

  it('returns null for wallet with wrong length', async () => {
    const result = await scoreDelegation('AAAA');
    expect(result).toBeNull();
  });

  it('returns null for wallet with invalid chars', async () => {
    const result = await scoreDelegation('0'.repeat(58));
    expect(result).toBeNull();
  });

  it('approved is true iff trustScore >= 40', async () => {
    const result = await scoreDelegation(TESTNET_WALLET);
    expect(result).not.toBeNull();
    if (result!.trustScore >= 40) {
      expect(result!.approved).toBe(true);
    } else {
      expect(result!.approved).toBe(false);
    }
  }, 30000);

  it('riskLevel matches trustScore thresholds', async () => {
    const result = await scoreDelegation(TESTNET_WALLET);
    expect(result).not.toBeNull();
    const { trustScore, riskLevel } = result!;
    if (trustScore >= 70) expect(riskLevel).toBe('low');
    else if (trustScore >= 45) expect(riskLevel).toBe('medium');
    else if (trustScore >= 20) expect(riskLevel).toBe('high');
    else expect(riskLevel).toBe('critical');
  }, 30000);

  it('recommended limit is positive for non-zero score', async () => {
    const result = await scoreDelegation(TESTNET_WALLET);
    expect(result).not.toBeNull();
    if (result!.trustScore > 0) {
      expect(result!.recommendedLimit).toBeGreaterThan(0);
    }
  }, 30000);
});
