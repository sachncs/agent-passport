import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockLogStream, mockErrorStream } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PT = require('stream').PassThrough;
  return {
    mockLogStream: new PT(),
    mockErrorStream: new PT(),
  };
});

vi.mock('fs', () => ({
  existsSync: () => true,
  mkdirSync: () => undefined,
  createWriteStream: vi.fn()
    .mockImplementationOnce(() => mockLogStream)
    .mockImplementationOnce(() => mockErrorStream),
}));

vi.mock('../../config', () => ({
  config: {
    logLevel: 'debug',
    logFile: '/tmp/test-agent-passport.log',
    logErrorFile: '/tmp/test-agent-passport-error.log',
  },
}));

import { logger, closeLoggerStreams } from '../logger';

describe('logger — branch coverage', () => {
  let logWriteSpy: ReturnType<typeof vi.spyOn>;
  let errorWriteSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    logWriteSpy = vi.spyOn(mockLogStream, 'write').mockImplementation(() => true);
    errorWriteSpy = vi.spyOn(mockErrorStream, 'write').mockImplementation(() => true);
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes debug messages to logStream (line 65)', () => {
    logger.debug('debug msg', { key: 'val' });
    expect(logWriteSpy).toHaveBeenCalled();
    const written = logWriteSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.level).toBe('debug');
    expect(parsed.message).toBe('debug msg');
    expect(parsed.key).toBe('val');
  });

  it('writes info messages to logStream', () => {
    logger.info('info msg');
    expect(logWriteSpy).toHaveBeenCalled();
  });

  it('writes warn messages to both logStream and errorStream (line 75)', () => {
    logger.warn('warn msg');
    expect(logWriteSpy).toHaveBeenCalled();
    expect(errorWriteSpy).toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalled();
  });

  it('writes error messages to both logStream and errorStream (line 80)', () => {
    logger.error('error msg');
    expect(logWriteSpy).toHaveBeenCalled();
    expect(errorWriteSpy).toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalled();
  });

  it('debug messages go to console.debug, not console.log (line 65)', () => {
    logger.debug('debug only');
    expect(consoleSpy.debug).toHaveBeenCalled();
    expect(consoleSpy.log).not.toHaveBeenCalled();
  });

  it('closeLoggerStreams ends both streams (lines 87-91)', () => {
    const logEndSpy = vi.spyOn(mockLogStream, 'end')
      .mockImplementation(() => mockLogStream as never);
    const errorEndSpy = vi.spyOn(mockErrorStream, 'end')
      .mockImplementation(() => mockErrorStream as never);
    closeLoggerStreams();
    expect(logEndSpy).toHaveBeenCalled();
    expect(errorEndSpy).toHaveBeenCalled();
  });
});
