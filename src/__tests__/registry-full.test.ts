import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const VALID_SPONSOR = 'A'.repeat(58);
const VALID_AGENT = 'B'.repeat(58);

vi.mock('../lib/constants', () => ({
  isValidWallet: (w: string) => typeof w === 'string' && w.length === 58 && /^[A-Z2-7]+$/.test(w),
}));

vi.mock('../lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../lib/metrics', () => ({
  recordContractEvent: vi.fn(),
}));

vi.mock('../lib/operator-wallet', () => ({
  submitApplicationCall: vi.fn(),
}));

vi.mock('../config', () => ({
  config: {
    registryAppId: 12345,
    indexerUrl: 'https://testnet-idx.algonode.cloud:443',
    reputationAppId: 0,
  },
}));

import { delegate, revoke, isRegistryConfigured, RegistryNotConfiguredError, RegistryValidationError } from '../registry';
import { submitApplicationCall } from '../lib/operator-wallet';
import { recordContractEvent } from '../lib/metrics';

const mockSubmitApplicationCall = vi.mocked(submitApplicationCall);
const mockRecordContractEvent = vi.mocked(recordContractEvent);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('delegate()', () => {
  describe('validation errors', () => {
    it('throws RegistryValidationError for invalid sponsor', async () => {
      await expect(delegate('', VALID_AGENT, 100)).rejects.toThrow(RegistryValidationError);
    });

    it('throws RegistryValidationError for invalid agent', async () => {
      await expect(delegate(VALID_SPONSOR, '', 100)).rejects.toThrow(RegistryValidationError);
    });

    it('throws when sponsor equals agent', async () => {
      await expect(delegate(VALID_SPONSOR, VALID_SPONSOR, 100)).rejects.toThrow(
        'Sponsor and agent must be different wallets',
      );
    });

    it('throws for zero amount', async () => {
      await expect(delegate(VALID_SPONSOR, VALID_AGENT, 0)).rejects.toThrow(
        'Amount must be a positive finite number',
      );
    });

    it('throws for negative amount', async () => {
      await expect(delegate(VALID_SPONSOR, VALID_AGENT, -10)).rejects.toThrow(
        'Amount must be a positive finite number',
      );
    });

    it('throws for Infinity amount', async () => {
      await expect(
        delegate(VALID_SPONSOR, VALID_AGENT, Infinity),
      ).rejects.toThrow(
        'Amount must be a positive finite number',
      );
    });

    it('throws for NaN amount', async () => {
      await expect(delegate(VALID_SPONSOR, VALID_AGENT, NaN)).rejects.toThrow(
        'Amount must be a positive finite number',
      );
    });

    it('throws for amount exceeding MAX_SAFE_INTEGER', async () => {
      await expect(
        delegate(
          VALID_SPONSOR,
          VALID_AGENT,
          Number.MAX_SAFE_INTEGER + 1,
        ),
      ).rejects.toThrow(
        'Amount exceeds maximum safe integer',
      );
    });
  });

  describe('not configured', () => {
    it('throws RegistryNotConfiguredError when registryAppId is 0', async () => {
      vi.resetModules();
      vi.doMock('../config', () => ({
        config: { registryAppId: 0, indexerUrl: '', reputationAppId: 0 },
      }));
      vi.doMock('../lib/constants', () => ({
        isValidWallet: (w: string) =>
          typeof w === 'string' &&
          w.length === 58 &&
          /^[A-Z2-7]+$/.test(w),
      }));
      vi.doMock('../lib/logger', () => ({
        logger: {
          warn: vi.fn(),
          info: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }));
      vi.doMock('../lib/metrics', () => ({
        recordContractEvent: vi.fn(),
      }));
      vi.doMock('../lib/operator-wallet', () => ({
        submitApplicationCall: vi.fn(),
      }));

      const {
        delegate: freshDelegate,
      } = await import('../registry');

      await expect(freshDelegate(VALID_SPONSOR, VALID_AGENT, 100)).rejects.toThrow('not configured');

      vi.doUnmock('../config');
      vi.doUnmock('../lib/constants');
      vi.doUnmock('../lib/logger');
      vi.doUnmock('../lib/metrics');
      vi.doUnmock('../lib/operator-wallet');
    });
  });

  describe('submit failure', () => {
    it('throws when submitApplicationCall returns null', async () => {
      mockSubmitApplicationCall.mockResolvedValue(null);

      await expect(delegate(VALID_SPONSOR, VALID_AGENT, 100)).rejects.toThrow(
        'Failed to submit delegation transaction',
      );
    });

    it('throws when submitApplicationCall rejects', async () => {
      mockSubmitApplicationCall.mockRejectedValue(new Error('network error'));

      await expect(delegate(VALID_SPONSOR, VALID_AGENT, 100)).rejects.toThrow('network error');
    });
  });

  describe('success', () => {
    it('returns delegation result with txId', async () => {
      mockSubmitApplicationCall.mockResolvedValue('TXID123');

      const result = await delegate(VALID_SPONSOR, VALID_AGENT, 100);

      expect(result.txId).toBe('TXID123');
      expect(result.sponsor).toBe(VALID_SPONSOR);
      expect(result.agent).toBe(VALID_AGENT);
      expect(result.amount).toBe(100);
      expect(result.round).toBe(0);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('floors fractional amount', async () => {
      mockSubmitApplicationCall.mockResolvedValue('TXID123');

      const result = await delegate(VALID_SPONSOR, VALID_AGENT, 99.7);

      expect(result.amount).toBe(99);
    });

    it('records contract endorsement event', async () => {
      mockSubmitApplicationCall.mockResolvedValue('TXID123');

      await delegate(VALID_SPONSOR, VALID_AGENT, 100);

      expect(mockRecordContractEvent).toHaveBeenCalledWith('endorsement');
    });

    it('passes correct appArgs to submitApplicationCall', async () => {
      mockSubmitApplicationCall.mockResolvedValue('TXID123');

      await delegate(VALID_SPONSOR, VALID_AGENT, 200);

      expect(mockSubmitApplicationCall).toHaveBeenCalled();
      const [appIndex, appArgs, accounts] =
        mockSubmitApplicationCall.mock.calls[0];
      expect(typeof appIndex).toBe('number');
      expect(appArgs).toHaveLength(2);
      expect(accounts).toEqual([VALID_AGENT]);
    });
  });
});

describe('revoke()', () => {
  describe('validation errors', () => {
    it('throws RegistryValidationError for invalid sponsor', async () => {
      await expect(revoke('', VALID_AGENT)).rejects.toThrow(RegistryValidationError);
    });

    it('throws RegistryValidationError for invalid agent', async () => {
      await expect(revoke(VALID_SPONSOR, '')).rejects.toThrow(RegistryValidationError);
    });

    it('throws when sponsor equals agent', async () => {
      await expect(revoke(VALID_SPONSOR, VALID_SPONSOR)).rejects.toThrow(
        'Sponsor and agent must be different wallets',
      );
    });
  });

  describe('not configured', () => {
    it('throws RegistryNotConfiguredError when registryAppId is 0', async () => {
      vi.resetModules();
      vi.doMock('../config', () => ({
        config: { registryAppId: 0, indexerUrl: '', reputationAppId: 0 },
      }));
      vi.doMock('../lib/constants', () => ({
        isValidWallet: (w: string) =>
          typeof w === 'string' &&
          w.length === 58 &&
          /^[A-Z2-7]+$/.test(w),
      }));
      vi.doMock('../lib/logger', () => ({
        logger: {
          warn: vi.fn(),
          info: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }));
      vi.doMock('../lib/metrics', () => ({
        recordContractEvent: vi.fn(),
      }));
      vi.doMock('../lib/operator-wallet', () => ({
        submitApplicationCall: vi.fn(),
      }));

      const {
        revoke: freshRevoke,
      } = await import('../registry');

      await expect(
        freshRevoke(VALID_SPONSOR, VALID_AGENT),
      ).rejects.toThrow('not configured');

      vi.doUnmock('../config');
      vi.doUnmock('../lib/constants');
      vi.doUnmock('../lib/logger');
      vi.doUnmock('../lib/metrics');
      vi.doUnmock('../lib/operator-wallet');
    });
  });

  describe('submit failure', () => {
    it('throws when submitApplicationCall returns null', async () => {
      mockSubmitApplicationCall.mockResolvedValue(null);

      await expect(
        revoke(VALID_SPONSOR, VALID_AGENT),
      ).rejects.toThrow(
        'Failed to submit revocation transaction',
      );
    });

    it('throws when submitApplicationCall rejects', async () => {
      mockSubmitApplicationCall.mockRejectedValue(new Error('rpc error'));

      await expect(revoke(VALID_SPONSOR, VALID_AGENT)).rejects.toThrow('rpc error');
    });
  });

  describe('success', () => {
    it('returns revocation result with txId', async () => {
      mockSubmitApplicationCall.mockResolvedValue('REVOKE_TX');

      const result = await revoke(VALID_SPONSOR, VALID_AGENT);

      expect(result.txId).toBe('REVOKE_TX');
      expect(result.sponsor).toBe(VALID_SPONSOR);
      expect(result.agent).toBe(VALID_AGENT);
      expect(result.round).toBe(0);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('records contract revocation event', async () => {
      mockSubmitApplicationCall.mockResolvedValue('REVOKE_TX');

      await revoke(VALID_SPONSOR, VALID_AGENT);

      expect(mockRecordContractEvent).toHaveBeenCalledWith('revocation');
    });

    it('passes correct appArgs with revoke_delegation', async () => {
      mockSubmitApplicationCall.mockResolvedValue('REVOKE_TX');

      await revoke(VALID_SPONSOR, VALID_AGENT);

      const [appIndex, appArgs, accounts] =
        mockSubmitApplicationCall.mock.calls[0];
      expect(typeof appIndex).toBe('number');
      expect(appArgs).toHaveLength(1);
      const decoded = new TextDecoder().decode(appArgs[0]);
      expect(decoded).toBe('revoke_delegation');
      expect(accounts).toEqual([VALID_AGENT]);
    });
  });
});

describe('isRegistryConfigured()', () => {
  it('returns true when registryAppId is non-zero', () => {
    expect(isRegistryConfigured()).toBe(true);
  });
});

describe('RegistryNotConfiguredError', () => {
  it('has correct name', () => {
    const err = new RegistryNotConfiguredError();
    expect(err.name).toBe('RegistryNotConfiguredError');
    expect(err.message).toContain('not configured');
  });
});

describe('RegistryValidationError', () => {
  it('has correct name and message', () => {
    const err = new RegistryValidationError('bad input');
    expect(err.name).toBe('RegistryValidationError');
    expect(err.message).toBe('bad input');
  });
});
