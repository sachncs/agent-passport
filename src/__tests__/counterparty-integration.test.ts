import { describe, it, expect } from 'vitest';
import { checkCounterparty } from '../counterparty';

const TESTNET_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';

describe('Counterparty Verification — Integration Tests (Real Testnet)', () => {
  it('returns valid structure for a real wallet', async () => {
    const result = await checkCounterparty(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(typeof result!.allow).toBe('boolean');
    expect(typeof result!.confidence).toBe('number');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.3);
    expect(result!.confidence).toBeLessThanOrEqual(1.0);
    expect(['low', 'medium', 'high', 'critical']).toContain(result!.riskLevel);
    expect(typeof result!.trustScore).toBe('number');
    expect(result!.trustScore).toBeGreaterThanOrEqual(0);
    expect(result!.trustScore).toBeLessThanOrEqual(100);
  }, 30000);

  it('returns onChainScore and delegationScore', async () => {
    const result = await checkCounterparty(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(typeof result!.onChainScore).toBe('number');
    expect(result!.onChainScore).toBeGreaterThanOrEqual(0);
    expect(result!.onChainScore).toBeLessThanOrEqual(100);
    expect(typeof result!.delegationScore).toBe('number');
    expect(result!.delegationScore).toBeGreaterThanOrEqual(0);
    expect(result!.delegationScore).toBeLessThanOrEqual(100);
  }, 30000);

  it('trustScore matches weighted combination', async () => {
    const result = await checkCounterparty(TESTNET_WALLET);

    expect(result).not.toBeNull();
    const weighted = 0.6 * result!.onChainScore + 0.4 * result!.delegationScore;
    const expected = Math.round(weighted * 10) / 10;
    expect(result!.trustScore).toBe(expected);
  }, 30000);

  it('returns explanation as non-empty array', async () => {
    const result = await checkCounterparty(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.explanation)).toBe(true);
    expect(result!.explanation.length).toBeGreaterThanOrEqual(2);
    for (const reason of result!.explanation) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(0);
    }
  }, 30000);

  it('riskLevel matches trustScore thresholds', async () => {
    const result = await checkCounterparty(TESTNET_WALLET);
    expect(result).not.toBeNull();
    const { trustScore, riskLevel } = result!;
    if (trustScore >= 70) expect(riskLevel).toBe('low');
    else if (trustScore >= 45) expect(riskLevel).toBe('medium');
    else if (trustScore >= 20) expect(riskLevel).toBe('high');
    else expect(riskLevel).toBe('critical');
  }, 30000);

  it('allow is true iff trustScore >= 40', async () => {
    const result = await checkCounterparty(TESTNET_WALLET);
    expect(result).not.toBeNull();
    if (result!.trustScore >= 40) {
      expect(result!.allow).toBe(true);
    } else {
      expect(result!.allow).toBe(false);
    }
  }, 30000);

  it('confidence is consistent with score tier', async () => {
    const result = await checkCounterparty(TESTNET_WALLET);
    expect(result).not.toBeNull();
    const { trustScore, confidence } = result!;
    if (trustScore >= 60) {
      expect(confidence).toBeGreaterThanOrEqual(0.70);
    } else if (trustScore >= 40) {
      expect(confidence).toBeGreaterThanOrEqual(0.50);
      expect(confidence).toBeLessThanOrEqual(0.70);
    } else {
      expect(confidence).toBeGreaterThanOrEqual(0.30);
      expect(confidence).toBeLessThanOrEqual(0.50);
    }
  }, 30000);

  it('returns null for invalid wallet', async () => {
    const result = await checkCounterparty('invalid');
    expect(result).toBeNull();
  });

  it('returns null for wrong length', async () => {
    const result = await checkCounterparty('AAAA');
    expect(result).toBeNull();
  });

  it('returns null for invalid chars', async () => {
    const result = await checkCounterparty('0'.repeat(58));
    expect(result).toBeNull();
  });
});
