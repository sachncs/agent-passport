import { describe, it, expect } from 'vitest';
import { analyzeTrustGraph } from '../trust-graph';

const TESTNET_WALLET = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';

describe('Trust Graph Analytics — Integration Tests (Real Testnet)', () => {
  it('returns valid structure for a real wallet', async () => {
    const result = await analyzeTrustGraph(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(result!.wallet).toBe(TESTNET_WALLET);
    expect(typeof result!.depth).toBe('number');
    expect(result!.depth).toBeGreaterThanOrEqual(0);
    expect(typeof result!.nodeCount).toBe('number');
    expect(result!.nodeCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result!.edges)).toBe(true);
    expect(Array.isArray(result!.nodes)).toBe(true);
  }, 120000);

  it('contains the target wallet as root node', async () => {
    const result = await analyzeTrustGraph(TESTNET_WALLET);

    expect(result).not.toBeNull();
    const rootNode = result!.nodes.find(n => n.address === TESTNET_WALLET);
    expect(rootNode).toBeDefined();
    expect(rootNode!.depth).toBe(0);
  }, 120000);

  it('returns valid exposure analysis', async () => {
    const result = await analyzeTrustGraph(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(typeof result!.exposure.totalExposure).toBe('number');
    expect(typeof result!.exposure.directExposure).toBe('number');
    expect(typeof result!.exposure.indirectExposure).toBe('number');
    expect(result!.exposure.totalExposure).toBeGreaterThanOrEqual(0);
  }, 120000);

  it('returns non-empty explanation', async () => {
    const result = await analyzeTrustGraph(TESTNET_WALLET);

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.explanation)).toBe(true);
    expect(result!.explanation.length).toBeGreaterThanOrEqual(1);
  }, 120000);

  it('returns null for invalid wallet', async () => {
    const result = await analyzeTrustGraph('invalid');
    expect(result).toBeNull();
  });

  it('returns null for wrong length', async () => {
    const result = await analyzeTrustGraph('AAAA');
    expect(result).toBeNull();
  });

  it('returns null for invalid chars', async () => {
    const result = await analyzeTrustGraph('0'.repeat(58));
    expect(result).toBeNull();
  });

  it('edges have valid structure', async () => {
    const result = await analyzeTrustGraph(TESTNET_WALLET);

    expect(result).not.toBeNull();
    for (const edge of result!.edges) {
      expect(typeof edge.from).toBe('string');
      expect(typeof edge.to).toBe('string');
      expect(typeof edge.amount).toBe('number');
      expect(typeof edge.round).toBe('number');
    }
  }, 120000);

  it('nodes have valid structure', async () => {
    const result = await analyzeTrustGraph(TESTNET_WALLET);

    expect(result).not.toBeNull();
    for (const node of result!.nodes) {
      expect(typeof node.address).toBe('string');
      expect(typeof node.depth).toBe('number');
      expect(node.depth).toBeGreaterThanOrEqual(0);
    }
  }, 120000);

  it('whatIfs have valid structure', async () => {
    const result = await analyzeTrustGraph(TESTNET_WALLET);

    expect(result).not.toBeNull();
    for (const wi of result!.whatIfs) {
      expect(typeof wi.sponsorRemoved).toBe('string');
      expect(typeof wi.originalScore).toBe('number');
      expect(typeof wi.newScore).toBe('number');
      expect(typeof wi.scoreImpact).toBe('number');
      expect(Array.isArray(wi.explanation)).toBe(true);
    }
  }, 120000);
});
