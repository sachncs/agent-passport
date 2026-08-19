import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('build-info', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function setupFsMock(version: string | null) {
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(version !== null || true),
      readFileSync: vi.fn().mockReturnValue(
        version === null ? '{}' : JSON.stringify({ version }),
      ),
    }));
  }

  it('reads version from package.json when file exists and is valid', async () => {
    setupFsMock('1.2.3');
    const { packageVersion } = await import('../build-info');
    expect(packageVersion).toBe('1.2.3');
  });

  it('falls back to 0.0.0 when all paths fail (catch block)', async () => {
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockImplementation(() => {
        throw new Error('corrupt');
      }),
    }));
    const { packageVersion } = await import('../build-info');
    expect(packageVersion).toBe('0.0.0');
  });

  it('falls back to 0.0.0 when package.json has no version string', async () => {
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(JSON.stringify({ name: 'no-version' })),
    }));
    const { packageVersion } = await import('../build-info');
    expect(packageVersion).toBe('0.0.0');
  });

  it('falls back to 0.0.0 when no file exists at any path', async () => {
    vi.doMock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(false),
      readFileSync: vi.fn(),
    }));
    const { packageVersion } = await import('../build-info');
    expect(packageVersion).toBe('0.0.0');
  });

  it('exported buildInfo has correct shape', async () => {
    setupFsMock('0.1.0');
    const { buildInfo } = await import('../build-info');
    expect(buildInfo.version).toBe('0.1.0');
    expect(buildInfo.node).toBe(process.version);
    expect(typeof buildInfo.startedAt).toBe('string');
  });
});