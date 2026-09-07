import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatPretty, logger } from '../logger';

describe('Logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  it('logs info messages as JSON', () => {
    logger.info('test message', { key: 'value' });
    expect(consoleSpy.log).toHaveBeenCalledOnce();
    const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
    expect(output.level).toBe('info');
    expect(output.message).toBe('test message');
    expect(output.key).toBe('value');
    expect(output.timestamp).toBeDefined();
  });

  it('logs error messages', () => {
    logger.error('error occurred', { error: 'something broke' });
    expect(consoleSpy.error).toHaveBeenCalledOnce();
    const output = JSON.parse(consoleSpy.error.mock.calls[0][0]);
    expect(output.level).toBe('error');
    expect(output.message).toBe('error occurred');
  });

  it('logs warning messages', () => {
    logger.warn('warning');
    expect(consoleSpy.warn).toHaveBeenCalledOnce();
    const output = JSON.parse(consoleSpy.warn.mock.calls[0][0]);
    expect(output.level).toBe('warn');
  });

  it('always logs errors regardless of level', () => {
    logger.error('critical error');
    expect(consoleSpy.error).toHaveBeenCalled();
  });

  it('always logs warnings', () => {
    logger.warn('warning');
    expect(consoleSpy.warn).toHaveBeenCalled();
  });

  it('handles messages without meta', () => {
    logger.info('simple message');
    expect(consoleSpy.log).toHaveBeenCalledOnce();
    const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
    expect(output.message).toBe('simple message');
  });
});

// `createRequestLogger` was removed — callers now pass `requestId` directly
// in the meta object to `logger.info/warn/error`. The original tests are
// dropped; meta-merging is covered by the Logger tests above.
describe('Logger request-scoped usage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('attaches requestId via meta', () => {
    logger.info('test', { requestId: 'req-123' });
    expect(console.log).toHaveBeenCalled();
    type LogCall = ReturnType<typeof vi.fn>;
    const calls = (console.log as LogCall).mock.calls as Array<[string]>;
    const output = JSON.parse(calls[0]![0]);
    expect(output.requestId).toBe('req-123');
  });
});

describe('formatPretty', () => {
  it('emits timestamp + padded level + message + JSON meta (no duplicates)', () => {
    const out = formatPretty(
      {
        level: 'info',
        message: 'Loaded system exposure from disk',
        timestamp: '2026-08-19T18:01:28.766Z',
        total: 10000,
        wallets: 1,
      },
      false,
    );
    expect(out).toBe(
      '2026-08-19T18:01:28.766Z INFO  Loaded system exposure from disk {"total":10000,"wallets":1}',
    );
    expect(out).not.toContain('"message"');
  });

  it('omits the meta section when only standard fields are present', () => {
    const out = formatPretty(
      {
        level: 'warn',
        message: 'OPERATOR_MNEMONIC not set',
        timestamp: '2026-08-19T18:01:28.766Z',
      },
      false,
    );
    expect(out).toBe('2026-08-19T18:01:28.766Z WARN  OPERATOR_MNEMONIC not set');
    expect(out).not.toContain('{"message"');
  });

  it('does not duplicate the message in the meta JSON', () => {
    // Regression: when the entry is built from the call-site with
    // a message, the pretty format should only render the message
    // once (in the body), not also inside the meta JSON object.
    const out = formatPretty(
      {
        level: 'warn',
        message: 'real message',
        timestamp: '2026-08-19T18:01:28.766Z',
        extra: 'data',
      },
      false,
    );
    expect(out).toContain('real message')
    expect(out).not.toContain('"message"')
    expect(out).toContain('"extra":"data"')
  });

  it('includes ANSI colors only when useColor is true', () => {
    const plain = formatPretty(
      { level: 'error', message: 'kaboom', timestamp: '2026-08-19T18:01:28.766Z' },
      false,
    );
    const colored = formatPretty(
      { level: 'error', message: 'kaboom', timestamp: '2026-08-19T18:01:28.766Z' },
      true,
    );
    expect(plain).not.toContain('\x1b[');
    expect(colored).toContain('\x1b[31m');
  });
});
