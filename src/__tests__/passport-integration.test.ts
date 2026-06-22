import { describe, it, expect } from 'vitest';
import { generatePassport } from '../passport';

const TESTNET_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';

describe('Agent Passport — Integration Tests (Real Testnet)', () => {
  it('returns valid structure for a real wallet', async () => {
    const result = await generatePassport(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(result!.wallet).toBe(TESTNET_WALLET);
    expect(typeof result!.generatedAt).toBe('string');
    expect(typeof result!.identityStrength).toBe('number');
    expect(typeof result!.trustScore).toBe('number');
    expect(typeof result!.reputation).toBe('number');
    expect(typeof result!.paymentReliability).toBe('number');
    expect(typeof result!.creditLimit).toBe('number');
    expect(typeof result!.risk).toBe('number');
    expect(typeof result!.sybilRisk).toBe('number');
  }, 60000);

  it('returns valid on-chain profile', async () => {
    const result = await generatePassport(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(typeof result!.onChain.balanceAlgo).toBe('number');
    expect(typeof result!.onChain.totalTxns).toBe('number');
    expect(typeof result!.onChain.accountAgeDays).toBe('number');
    expect(typeof result!.onChain.assets).toBe('number');
    expect(typeof result!.onChain.apps).toBe('number');
  }, 60000);

  it('returns valid delegation profile', async () => {
    const result = await generatePassport(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(typeof result!.delegation.depth).toBe('number');
    expect(typeof result!.delegation.sponsorCount).toBe('number');
    expect(typeof result!.delegation.delegatedAmount).toBe('number');
    expect(typeof result!.delegation.isTrustAnchor).toBe('boolean');
  }, 60000);

  it('returns valid capabilities', async () => {
    const result = await generatePassport(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(typeof result!.capabilities.trustScoring).toBe('boolean');
    expect(typeof result!.capabilities.delegation).toBe('boolean');
    expect(typeof result!.capabilities.creditEligible).toBe('boolean');
    expect(typeof result!.capabilities.sybilClear).toBe('boolean');
    expect(typeof result!.capabilities.reputationActive).toBe('boolean');
  }, 60000);

  it('returns non-empty summary', async () => {
    const result = await generatePassport(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(typeof result!.summary).toBe('string');
    expect(result!.summary.length).toBeGreaterThan(10);
  }, 60000);

  it('returns non-empty explanation', async () => {
    const result = await generatePassport(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.explanation)).toBe(true);
    expect(result!.explanation.length).toBeGreaterThanOrEqual(5);
  }, 60000);

  it('overall risk level matches risk score', async () => {
    const result = await generatePassport(TESTNET_WALLET);
    expect(result).not.toBeNull();
    const { risk, overallRiskLevel } = result!;
    if (risk <= 25) expect(overallRiskLevel).toBe('low');
    else if (risk <= 50) expect(overallRiskLevel).toBe('medium');
    else if (risk <= 75) expect(overallRiskLevel).toBe('high');
    else expect(overallRiskLevel).toBe('critical');
  }, 60000);

  it('returns null for invalid wallet', async () => {
    const result = await generatePassport('invalid');
    expect(result).toBeNull();
  });

  it('returns null for wrong length', async () => {
    const result = await generatePassport('AAAA');
    expect(result).toBeNull();
  });

  it('returns null for invalid chars', async () => {
    const result = await generatePassport('0'.repeat(58));
    expect(result).toBeNull();
  });
});
