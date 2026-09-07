import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as SystemExposureType from '../system-exposure';
import type * as FsType from 'fs';

const mockLogger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../logger', () => ({
  logger: mockLogger,
}));

let mod: SystemExposureType;

beforeEach(async () => {
  vi.resetModules();
  vi.doMock('../logger', () => ({ logger: mockLogger }));
  mockLogger.warn.mockClear();
  mockLogger.info.mockClear();
  mod = await import('../system-exposure');
  mod.resetSystemExposure();
});

describe('system-exposure — branch coverage', () => {
  it('returns 0 for wallet not in map (line 102 ?? 0)', () => {
    expect(mod.getWalletExposure('NONEXISTENT')).toBe(0);
  });

  it('returns wallet exposure when wallet is in map', () => {
    mod.addSystemExposure('W1', 500);
    expect(mod.getWalletExposure('W1')).toBe(500);
  });

  it('covers wallet cap exceeded branch (lines 125-130)', () => {
    // MAX_WALLET_SHARE = 10_000. Fill it entirely.
    const reserved = mod.addSystemExposure('W1', 10_000);
    expect(reserved).toBe(10_000);
    // Now wallet cap is hit — next call should return 0 and log warning
    const second = mod.addSystemExposure('W1', 100);
    expect(second).toBe(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Wallet has reached per-wallet exposure cap',
      expect.objectContaining({ wallet: 'W1' }),
    );
  });

  it('covers saveToDisk error path (lines 87-89)', async () => {
    vi.doMock('fs', async () => {
      const actual = await vi.importActual<FsType>('fs');
      return {
        ...actual,
        writeFileSync: vi.fn().mockImplementation(() => { throw new Error('disk full'); }),
      };
    });
    vi.resetModules();
    vi.doMock('../logger', () => ({ logger: mockLogger }));
    const mod2 = await import('../system-exposure');
    mod2.resetSystemExposure();
    // Should not throw — saveToDisk swallows the error and logs
    const reserved = mod2.addSystemExposure('W1', 100);
    expect(reserved).toBe(100);
  });

  it('covers global cap exceeded (globalRemaining <= 0)', () => {
    // MAX_SYSTEM_EXPOSURE = 100_000, MAX_WALLET_SHARE = 10_000
    // Need 10 wallets to fill the global cap
    for (let i = 1; i <= 10; i++) {
      mod.addSystemExposure(`W${i}`, 10_000);
    }
    // Global cap is now full — next call returns 0
    const extra = mod.addSystemExposure('W11', 100);
    expect(extra).toBe(0);
  });

  it('covers addSystemExposure with amount <= 0', () => {
    expect(mod.addSystemExposure('W1', 0)).toBe(0);
    expect(mod.addSystemExposure('W1', -5)).toBe(0);
  });

  it('covers addSystemExposure with empty wallet', () => {
    expect(mod.addSystemExposure('', 100)).toBe(0);
  });
});
