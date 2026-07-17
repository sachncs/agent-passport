import { describe, it, expect } from 'vitest';
import { scoreWallet } from '../trust-score';

const TESTNET_WALLETS = [
  'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A',
  'UAEICEQV3AJRLG3IHB2O6W3C2QVQ6MYG4KDUYAGKZU4U4S55IHXFYZHICE',
  '4R6ELB72VM4WV3OQDJPXR76H6XBEY7YH4UQFQ6NS2275F7OARO4KKBHJ7A',
];

describe('Trust Score — Integration Tests (Real Testnet)', () => {
  it('scores a real testnet wallet and returns valid structure', async () => {
    const result = await scoreWallet(TESTNET_WALLETS[0]);

    expect(result).not.toBeNull();
    expect(result!.wallet).toBe(TESTNET_WALLETS[0]);
    expect(typeof result!.trustScore).toBe('number');
    expect(result!.trustScore).toBeGreaterThanOrEqual(0);
    expect(result!.trustScore).toBeLessThanOrEqual(100);
    expect(['low', 'medium', 'high', 'critical']).toContain(result!.riskLevel);
    expect(typeof result!.approved).toBe('boolean');
    expect(typeof result!.recommendedLimit).toBe('number');
    expect(result!.recommendedLimit).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('returns breakdown with all five sub-scores', async () => {
    const result = await scoreWallet(TESTNET_WALLETS[0]);

    expect(result).not.toBeNull();
    expect(typeof result!.breakdown.ageScore).toBe('number');
    expect(typeof result!.breakdown.activityScore).toBe('number');
    expect(typeof result!.breakdown.volumeScore).toBe('number');
    expect(typeof result!.breakdown.velocityScore).toBe('number');
    expect(typeof result!.breakdown.complianceScore).toBe('number');

    for (const key of [
      'ageScore',
       'activityScore',
       'volumeScore',
       'velocityScore',
       'complianceScore'
    ] as const) {
      expect(result!.breakdown[key]).toBeGreaterThanOrEqual(0);
      expect(result!.breakdown[key]).toBeLessThanOrEqual(100);
    }
  }, 30000);

  it('returns on-chain data with valid fields', async () => {
    const result = await scoreWallet(TESTNET_WALLETS[0]);

    expect(result).not.toBeNull();
    expect(typeof result!.onChain.balanceAlgo).toBe('number');
    expect(result!.onChain.balanceAlgo).toBeGreaterThanOrEqual(0);
    expect(typeof result!.onChain.totalTxns).toBe('number');
    expect(result!.onChain.totalTxns).toBeGreaterThanOrEqual(0);
    expect(typeof result!.onChain.assetCount).toBe('number');
    expect(typeof result!.onChain.appCount).toBe('number');
    expect(typeof result!.onChain.accountAgeDays).toBe('number');
    expect(result!.onChain.accountAgeDays).toBeGreaterThanOrEqual(1);
    expect(typeof result!.onChain.firstSeenRound).toBe('number');
    expect(typeof result!.onChain.lastSeenRound).toBe('number');
  }, 30000);

  it('returns explanation as array of strings', async () => {
    const result = await scoreWallet(TESTNET_WALLETS[0]);

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.explanation)).toBe(true);
    expect(result!.explanation.length).toBeGreaterThanOrEqual(3);
    for (const reason of result!.explanation) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(0);
    }
  }, 30000);

  it('returns null for invalid wallet address', async () => {
    const result = await scoreWallet('invalid');
    expect(result).toBeNull();
  });

  it('returns null for wallet with wrong length', async () => {
    const result = await scoreWallet('AAAA');
    expect(result).toBeNull();
  });

  it('returns null for wallet with invalid chars', async () => {
    const result = await scoreWallet('0'.repeat(58));
    expect(result).toBeNull();
  });

  it('scores multiple testnet wallets independently', async () => {
    const results = await Promise.all(TESTNET_WALLETS.map(scoreWallet));

    for (const result of results) {
      expect(result).not.toBeNull();
      expect(result!.trustScore).toBeGreaterThanOrEqual(0);
      expect(result!.trustScore).toBeLessThanOrEqual(100);
    }

    const scores = results.map(r => r!.trustScore);
    expect(new Set(scores).size).toBeGreaterThan(0);
  }, 60000);

  it('approved is true iff trustScore >= 40', async () => {
    const result = await scoreWallet(TESTNET_WALLETS[0]);
    expect(result).not.toBeNull();
    if (result!.trustScore >= 40) {
      expect(result!.approved).toBe(true);
    } else {
      expect(result!.approved).toBe(false);
    }
  }, 30000);

  it('riskLevel matches trustScore thresholds', async () => {
    const result = await scoreWallet(TESTNET_WALLETS[0]);
    expect(result).not.toBeNull();
    const { trustScore, riskLevel } = result!;
    if (trustScore >= 70) expect(riskLevel).toBe('low');
    else if (trustScore >= 45) expect(riskLevel).toBe('medium');
    else if (trustScore >= 20) expect(riskLevel).toBe('high');
    else expect(riskLevel).toBe('critical');
  }, 30000);

  it('recommended limit is positive for non-zero score', async () => {
    const result = await scoreWallet(TESTNET_WALLETS[0]);
    expect(result).not.toBeNull();
    if (result!.trustScore > 0) {
      expect(result!.recommendedLimit).toBeGreaterThan(0);
    }
  }, 30000);
});
