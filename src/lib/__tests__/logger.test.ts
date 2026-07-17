import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../logger';

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
    const output = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output.requestId).toBe('req-123');
  });
});
