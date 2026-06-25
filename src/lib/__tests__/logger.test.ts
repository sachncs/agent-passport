import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, createRequestLogger } from '../logger';

describe('Logger', () => {
  let consoleSpy: { log: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn>; warn: ReturnType<typeof vi.spyOn>; debug: ReturnType<typeof vi.spyOn> };

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

describe('createRequestLogger', () => {
  let consoleSpy: { log: ReturnType<typeof vi.spyOn> };

  beforeEach(() => {
    vi.restoreAllMocks();
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };
  });

  it('includes requestId in log entries', () => {
    const reqLogger = createRequestLogger('req-123');
    reqLogger.info('test');
    expect(consoleSpy.log).toHaveBeenCalled();
    const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
    expect(output.requestId).toBe('req-123');
  });

  it('includes additional meta', () => {
    const reqLogger = createRequestLogger('req-456');
    reqLogger.info('action', { wallet: 'ABC' });
    const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
    expect(output.requestId).toBe('req-456');
    expect(output.wallet).toBe('ABC');
  });

  it('supports warn level', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reqLogger = createRequestLogger('req-789');
    reqLogger.warn('warning');
    expect(warnSpy).toHaveBeenCalled();
    const output = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(output.requestId).toBe('req-789');
    expect(output.level).toBe('warn');
    warnSpy.mockRestore();
  });

  it('supports error level', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reqLogger = createRequestLogger('req-err');
    reqLogger.error('failure', { code: 500 });
    expect(errorSpy).toHaveBeenCalled();
    const output = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(output.requestId).toBe('req-err');
    expect(output.code).toBe(500);
    errorSpy.mockRestore();
  });
});
