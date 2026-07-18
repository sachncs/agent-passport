import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('build-info', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('reads version from package.json when file exists and is valid', async () => {
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '1.2.3' })),
    }));
    vi.doMock('path', () => ({
      join: vi.fn().mockReturnValue('/fake/package.json'),
    }));
    const { packageVersion } = await import('../build-info');
    expect(packageVersion).toBe('1.2.3');
  });

  it('falls back to 0.0.0 when all paths fail (catch block, line 30)', async () => {
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockImplementation(() => { throw new Error('corrupt'); }),
    }));
    vi.doMock('path', () => ({
      join: vi.fn().mockReturnValue('/fake/bad.json'),
    }));
    const { packageVersion } = await import('../build-info');
    expect(packageVersion).toBe('0.0.0');
  });

  it('falls back to 0.0.0 when package.json has no version string (line 33)', async () => {
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(JSON.stringify({ name: 'no-version' })),
    }));
    vi.doMock('path', () => ({
      join: vi.fn().mockReturnValue('/fake/package.json'),
    }));
    const { packageVersion } = await import('../build-info');
    expect(packageVersion).toBe('0.0.0');
  });

  it('falls back to 0.0.0 when file does not exist at any path (line 33)', async () => {
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(false),
      readFileSync: vi.fn(),
    }));
    vi.doMock('path', () => ({
      join: vi.fn().mockReturnValue('/nonexistent/package.json'),
    }));
    const { packageVersion } = await import('../build-info');
    expect(packageVersion).toBe('0.0.0');
  });

  it('exported buildInfo has correct shape', async () => {
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '0.1.0' })),
    }));
    vi.doMock('path', () => ({
      join: vi.fn().mockReturnValue('/fake/package.json'),
    }));
    const { buildInfo } = await import('../build-info');
    expect(buildInfo.version).toBe('0.1.0');
    expect(buildInfo.node).toBe(process.version);
    expect(typeof buildInfo.startedAt).toBe('string');
  });
});
