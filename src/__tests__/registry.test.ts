/**
 * Unit tests for src/registry.ts (on-chain delegation operations).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/operator-wallet', () => ({
  submitApplicationCall: vi.fn(),
  getOperatorAddress: vi.fn().mockReturnValue('OPERATOR_ADDRESS_58_CHARSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'),
}));

vi.mock('../lib/metrics', () => ({
  recordContractEvent: vi.fn(),
}));

import { delegate, revoke, RegistryNotConfiguredError, RegistryValidationError, isRegistryConfigured } from '../registry';
import { submitApplicationCall } from '../lib/operator-wallet';
import { recordContractEvent } from '../lib/metrics';

const SPONSOR = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A';
const AGENT = 'A2YR3UXLBTMZK6BLCV6ABNG5JGNOX7TXQFTAVAPF5A4JOI5EFWZ2LETCEA';

describe('Registry Service', () => {
  beforeEach(() => {
    vi.mocked(submitApplicationCall).mockReset();
    vi.mocked(recordContractEvent).mockReset();
  });

  describe('isRegistryConfigured', () => {
    it('returns false when REGISTRY_APP_ID is 0', () => {
      expect(isRegistryConfigured()).toBe(false);
    });
  });

  describe('delegate', () => {
    it('throws RegistryNotConfiguredError when app id is 0', async () => {
      await expect(delegate(SPONSOR, AGENT, 1000)).rejects.toThrow(RegistryNotConfiguredError);
    });

    it('rejects invalid sponsor', async () => {
      await expect(delegate('X', AGENT, 1000)).rejects.toThrow(RegistryValidationError);
    });

    it('rejects invalid agent', async () => {
      await expect(delegate(SPONSOR, 'X', 1000)).rejects.toThrow(RegistryValidationError);
    });

    it('rejects self-delegation', async () => {
      await expect(delegate(SPONSOR, SPONSOR, 1000)).rejects.toThrow(RegistryValidationError);
    });

    it('rejects non-positive amount', async () => {
      await expect(delegate(SPONSOR, AGENT, 0)).rejects.toThrow(RegistryValidationError);
      await expect(delegate(SPONSOR, AGENT, -1)).rejects.toThrow(RegistryValidationError);
    });

    it('rejects non-finite amount', async () => {
      await expect(delegate(SPONSOR, AGENT, NaN)).rejects.toThrow(RegistryValidationError);
      await expect(delegate(SPONSOR, AGENT, Infinity)).rejects.toThrow(RegistryValidationError);
    });
  });

  describe('revoke', () => {
    it('throws RegistryNotConfiguredError when app id is 0', async () => {
      await expect(revoke(SPONSOR, AGENT)).rejects.toThrow(RegistryNotConfiguredError);
    });

    it('rejects invalid sponsor', async () => {
      await expect(revoke('X', AGENT)).rejects.toThrow(RegistryValidationError);
    });

    it('rejects invalid agent', async () => {
      await expect(revoke(SPONSOR, 'X')).rejects.toThrow(RegistryValidationError);
    });

    it('rejects same wallet sponsor and agent', async () => {
      await expect(revoke(SPONSOR, SPONSOR)).rejects.toThrow(RegistryValidationError);
    });
  });
});
