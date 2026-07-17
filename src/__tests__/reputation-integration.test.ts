import { describe, it, expect } from 'vitest';
import { computeReputation } from '../reputation';

const TESTNET_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';

describe('Reputation Layer — Integration Tests (Real Testnet)', () => {
  it('returns valid structure for a real wallet', async () => {
    const result = await computeReputation(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(result!.wallet).toBe(TESTNET_WALLET);
    expect(typeof result!.reputation).toBe('number');
    expect(result!.reputation).toBeGreaterThanOrEqual(0);
    expect(result!.reputation).toBeLessThanOrEqual(100);
    expect(['low', 'medium', 'high', 'critical']).toContain(result!.riskLevel);
    expect(typeof result!.confidence).toBe('number');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.40);
    expect(result!.confidence).toBeLessThanOrEqual(0.95);
  }, 30000);

  it('returns valid breakdown', async () => {
    const result = await computeReputation(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(typeof result!.breakdown.successfulPayments).toBe('number');
    expect(typeof result!.breakdown.successfulPurchases).toBe('number');
    expect(typeof result!.breakdown.disputes).toBe('number');
    expect(typeof result!.breakdown.refunds).toBe('number');
    expect(typeof result!.breakdown.sponsorEndorsements).toBe('number');
    expect(typeof result!.breakdown.serviceInteractions).toBe('number');
    expect(typeof result!.breakdown.totalEvents).toBe('number');
  }, 30000);

  it('reputation matches breakdown calculation', async () => {
    const result = await computeReputation(TESTNET_WALLET);

    expect(result).not.toBeNull();
    const b = result!.breakdown;
    const positive = b.successfulPayments * 10 + b.successfulPurchases * 8 +
      b.sponsorEndorsements * 15 + b.serviceInteractions * 5;
    const negative = b.disputes * 20 + b.refunds * 12;

    let expected: number;
    if (positive + negative === 0) {
      expected = 0;
    } else {
      expected = Math.round(Math.min(100, (positive / (positive + negative)) * 100)
        * 10) / 10;
    }
    expect(result!.reputation).toBe(expected);
  }, 30000);

  it('returns non-empty explanation', async () => {
    const result = await computeReputation(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.explanation)).toBe(true);
    expect(result!.explanation.length).toBeGreaterThanOrEqual(1);
    for (const reason of result!.explanation) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(0);
    }
  }, 30000);

  it('riskLevel matches reputation thresholds', async () => {
    const result = await computeReputation(TESTNET_WALLET);
    expect(result).not.toBeNull();
    const { reputation, riskLevel } = result!;
    if (reputation >= 70) expect(riskLevel).toBe('low');
    else if (reputation >= 45) expect(riskLevel).toBe('medium');
    else if (reputation >= 20) expect(riskLevel).toBe('high');
    else expect(riskLevel).toBe('critical');
  }, 30000);

  it('returns null for invalid wallet', async () => {
    const result = await computeReputation('invalid');
    expect(result).toBeNull();
  });

  it('returns null for wrong length', async () => {
    const result = await computeReputation('AAAA');
    expect(result).toBeNull();
  });

  it('returns null for invalid chars', async () => {
    const result = await computeReputation('0'.repeat(58));
    expect(result).toBeNull();
  });

  it('confidence is consistent with data availability', async () => {
    const result = await computeReputation(TESTNET_WALLET);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.40);
    expect(result!.confidence).toBeLessThanOrEqual(0.95);
  }, 30000);

  it('breakdown totals are consistent', async () => {
    const result = await computeReputation(TESTNET_WALLET);
    expect(result).not.toBeNull();
    const b = result!.breakdown;
    const expectedTotal = b.successfulPayments + b.successfulPurchases
      + b.disputes +
      b.refunds + b.sponsorEndorsements + b.serviceInteractions;
    expect(b.totalEvents).toBe(expectedTotal);
  }, 30000);
});
