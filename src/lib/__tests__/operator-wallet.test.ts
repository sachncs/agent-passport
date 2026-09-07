import { describe, it, expect, vi, beforeEach } from 'vitest';

const VALID_MNEMONIC = Array(25).fill('abandon').join(' ');
const MOCK_ADDR = 'MOCKADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const mockSignTxn = vi.fn().mockReturnValue(new Uint8Array(100));

vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('../algorand-client', () => ({
  algod: {
    getTransactionParams: vi.fn(),
    sendRawTransaction: vi.fn(),
  },
}));

vi.mock('../timeout', () => ({
  withTimeout: vi.fn(async (p: Promise<unknown>) => p),
}));

vi.mock('algosdk', () => ({
  default: {
    mnemonicToSecretKey: vi.fn().mockReturnValue({
      addr: { toString: () => MOCK_ADDR },
      sk: new Uint8Array(64),
    }),
    makeApplicationCallTxnFromObject:
      vi.fn().mockReturnValue({ signTxn: mockSignTxn }),
    OnApplicationComplete: { NoOpOC: 0 },
  },
}));

describe('operator-wallet', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.OPERATOR_MNEMONIC;
  });

  describe('initOperatorWallet', () => {
    it('returns false when OPERATOR_MNEMONIC is not set', async () => {
      const { initOperatorWallet, isOperatorInitialized } = await import('../operator-wallet');
      expect(initOperatorWallet()).toBe(false);
      expect(isOperatorInitialized()).toBe(false);
    });

    it('returns false when mnemonic has wrong word count', async () => {
      process.env.OPERATOR_MNEMONIC = 'one two three';
      const { initOperatorWallet, isOperatorInitialized } = await import('../operator-wallet');
      expect(initOperatorWallet()).toBe(false);
      expect(isOperatorInitialized()).toBe(false);
    });

    it('returns true for valid 25-word mnemonic', async () => {
      process.env.OPERATOR_MNEMONIC = VALID_MNEMONIC;
      const { initOperatorWallet, isOperatorInitialized } = await import('../operator-wallet');
      expect(initOperatorWallet()).toBe(true);
      expect(isOperatorInitialized()).toBe(true);
    });

    it('returns false when algosdk.mnemonicToSecretKey throws', async () => {
      process.env.OPERATOR_MNEMONIC = VALID_MNEMONIC;
      const algosdk = (await import('algosdk')).default;
      vi.mocked(algosdk.mnemonicToSecretKey).mockImplementationOnce(() => {
        throw new Error('bad mnemonic');
      });
      const { initOperatorWallet, isOperatorInitialized } = await import('../operator-wallet');
      expect(initOperatorWallet()).toBe(false);
      expect(isOperatorInitialized()).toBe(false);
    });
  });

  describe('isOperatorInitialized', () => {
    it('returns false before init', async () => {
      const { isOperatorInitialized } = await import('../operator-wallet');
      expect(isOperatorInitialized()).toBe(false);
    });

    it('returns true after successful init', async () => {
      process.env.OPERATOR_MNEMONIC = VALID_MNEMONIC;
      const { initOperatorWallet, isOperatorInitialized } = await import('../operator-wallet');
      initOperatorWallet();
      expect(isOperatorInitialized()).toBe(true);
    });
  });

  describe('submitApplicationCall', () => {
    it('returns null when operator is not initialized', async () => {
      const { submitApplicationCall } = await import('../operator-wallet');
      const result = await submitApplicationCall(42, [new Uint8Array([1])]);
      expect(result).toBeNull();
    });

    it('returns txId on successful submission', async () => {
      process.env.OPERATOR_MNEMONIC = VALID_MNEMONIC;
      const { initOperatorWallet, submitApplicationCall } = await import('../operator-wallet');
      initOperatorWallet();

      const { algod } = await import('../algorand-client');
      vi.mocked(algod.getTransactionParams).mockReturnValueOnce({
        do: vi.fn().mockResolvedValue({ fee: 1000, lastRound: 100 }),
      } as never);
      vi.mocked(algod.sendRawTransaction).mockReturnValueOnce({
        do: vi.fn().mockResolvedValue({ txid: 'TXID_abc123' }),
      } as never);

      const result = await submitApplicationCall(
        7,
        [new Uint8Array([1, 2])],
        ['REF_ADDR'],
      );
      expect(result).toBe('TXID_abc123');
    });

    it('returns null on timeout error from withTimeout', async () => {
      process.env.OPERATOR_MNEMONIC = VALID_MNEMONIC;
      const { initOperatorWallet, submitApplicationCall } = await import('../operator-wallet');
      initOperatorWallet();

      const { withTimeout } = await import('../timeout');
      vi.mocked(withTimeout).mockRejectedValueOnce(
        new Error(
          'Timeout after 10000ms: getTransactionParams',
        ),
      );

      const result = await submitApplicationCall(1, []);
      expect(result).toBeNull();
    });

    it('returns null when algod.getTransactionParams throws', async () => {
      process.env.OPERATOR_MNEMONIC = VALID_MNEMONIC;
      const { initOperatorWallet, submitApplicationCall } = await import('../operator-wallet');
      initOperatorWallet();

      const { algod } = await import('../algorand-client');
      vi.mocked(algod.getTransactionParams).mockImplementationOnce(() => {
        throw new Error('network down');
      });

      const result = await submitApplicationCall(1, []);
      expect(result).toBeNull();
    });

    it('returns null when sendRawTransaction fails', async () => {
      process.env.OPERATOR_MNEMONIC = VALID_MNEMONIC;
      const { initOperatorWallet, submitApplicationCall } = await import('../operator-wallet');
      initOperatorWallet();

      const { algod } = await import('../algorand-client');
      vi.mocked(algod.getTransactionParams).mockReturnValueOnce({
        do: vi.fn().mockResolvedValue({ fee: 1000 }),
      } as never);
      vi.mocked(algod.sendRawTransaction).mockReturnValueOnce({
        do: vi.fn().mockRejectedValue(new Error('send failed')),
      } as never);

      const result = await submitApplicationCall(1, []);
      expect(result).toBeNull();
    });

    it('uses default empty accounts array', async () => {
      process.env.OPERATOR_MNEMONIC = VALID_MNEMONIC;
      const {
        initOperatorWallet,
        submitApplicationCall,
      } = await import('../operator-wallet');
      initOperatorWallet();

      const algosdk = (await import('algosdk')).default;
      const { algod } = await import('../algorand-client');
      vi.mocked(algod.getTransactionParams).mockReturnValueOnce({
        do: vi.fn().mockResolvedValue({ fee: 1000 }),
      } as never);
      vi.mocked(algod.sendRawTransaction).mockReturnValueOnce({
        do: vi.fn().mockResolvedValue({ txid: 'TX2' }),
      } as never);

      await submitApplicationCall(1, []);
      expect(
        vi.mocked(
          algosdk.makeApplicationCallTxnFromObject,
        ),
      ).toHaveBeenCalledWith(
        expect.objectContaining({ accounts: [] }),
      );
    });
  });
});
