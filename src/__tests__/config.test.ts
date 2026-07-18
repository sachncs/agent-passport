import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
  vi.resetModules();
});

describe('config', () => {
  it('loads with defaults when no env vars set', async () => {
    delete process.env.PORT;
    delete process.env.ALGO_NETWORK;
    delete process.env.X402_ENABLED;
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.LOG_LEVEL;
    delete process.env.REGISTRY_APP_ID;
    delete process.env.REPUTATION_APP_ID;
    const { config } = await import('../config');
    expect(config.port).toBe(3000);
    expect(config.algoNetwork).toBe('testnet');
    expect(config.x402Enabled).toBe(false);
    expect(config.corsAllowedOrigins).toBe('*');
    expect(config.logLevel).toBe('info');
    expect(config.registryAppId).toBe(0);
    expect(config.reputationAppId).toBe(0);
  });

  it('parses PORT from env', async () => {
    process.env.PORT = '8080';
    const { config } = await import('../config');
    expect(config.port).toBe(8080);
  });

  it('falls back to default for non-numeric PORT', async () => {
    process.env.PORT = 'not-a-number';
    const { config } = await import('../config');
    expect(config.port).toBe(3000);
  });

  it('falls back to default for Infinity PORT', async () => {
    process.env.PORT = 'Infinity';
    const { config } = await import('../config');
    expect(config.port).toBe(3000);
  });

  it('parses REGISTRY_APP_ID', async () => {
    process.env.REGISTRY_APP_ID = '12345';
    const { config } = await import('../config');
    expect(config.registryAppId).toBe(12345);
  });

  it('falls back to 0 for non-numeric REGISTRY_APP_ID', async () => {
    process.env.REGISTRY_APP_ID = 'abc';
    const { config } = await import('../config');
    expect(config.registryAppId).toBe(0);
  });

  it('parses REPUTATION_APP_ID', async () => {
    process.env.REPUTATION_APP_ID = '99999';
    const { config } = await import('../config');
    expect(config.reputationAppId).toBe(99999);
  });

  it('enables x402 when X402_ENABLED=true', async () => {
    process.env.X402_ENABLED = 'true';
    process.env.X402_PAYMENT_RECIPIENT = '0xABC';
    const { config } = await import('../config');
    expect(config.x402Enabled).toBe(true);
  });

  it('disables x402 when X402_ENABLED is not "true"', async () => {
    process.env.X402_ENABLED = '1';
    const { config } = await import('../config');
    expect(config.x402Enabled).toBe(false);
  });

  it('uses custom ALGO_NETWORK', async () => {
    process.env.ALGO_NETWORK = 'mainnet';
    const { config } = await import('../config');
    expect(config.algoNetwork).toBe('mainnet');
  });

  it('uses custom CORS_ALLOWED_ORIGINS', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
    const { config } = await import('../config');
    expect(config.corsAllowedOrigins).toBe('https://app.example.com');
  });

  it('normalizes LOG_LEVEL to lowercase', async () => {
    process.env.LOG_LEVEL = 'DEBUG';
    const { config } = await import('../config');
    expect(config.logLevel).toBe('debug');
  });

  it('accepts valid LOG_LEVEL values', async () => {
    for (const level of ['debug', 'info', 'warn', 'error']) {
      process.env.LOG_LEVEL = level;
      vi.resetModules();
      const { config } = await import('../config');
      expect(config.logLevel).toBe(level);
    }
  });

  it('uses custom ALGOD_URL', async () => {
    process.env.ALGOD_URL = 'https://my-algod.example.com';
    const { config } = await import('../config');
    expect(config.algodUrl).toBe('https://my-algod.example.com');
  });

  it('uses custom INDEXER_URL', async () => {
    process.env.INDEXER_URL = 'https://my-indexer.example.com';
    const { config } = await import('../config');
    expect(config.indexerUrl).toBe('https://my-indexer.example.com');
  });

  it('uses custom ALGOD_TOKEN', async () => {
    process.env.ALGOD_TOKEN = 'my-token';
    const { config } = await import('../config');
    expect(config.algodToken).toBe('my-token');
  });

  it('uses custom INDEXER_TOKEN', async () => {
    process.env.INDEXER_TOKEN = 'idx-token';
    const { config } = await import('../config');
    expect(config.indexerToken).toBe('idx-token');
  });

  it('uses custom X402_FACILITATOR_URL', async () => {
    process.env.X402_FACILITATOR_URL = 'https://custom.facilitator';
    const { config } = await import('../config');
    expect(config.x402FacilitatorUrl).toBe('https://custom.facilitator');
  });

  it('uses custom X402_PAYMENT_RECIPIENT', async () => {
    process.env.X402_PAYMENT_RECIPIENT = '0xABCDEF';
    const { config } = await import('../config');
    expect(config.x402PaymentRecipient).toBe('0xABCDEF');
  });

  it('uses custom X402_NETWORK', async () => {
    process.env.X402_NETWORK = 'eip155:1';
    const { config } = await import('../config');
    expect(config.x402Network).toBe('eip155:1');
  });

  it('uses custom LOG_FILE', async () => {
    process.env.LOG_FILE = '/tmp/test.log';
    const { config } = await import('../config');
    expect(config.logFile).toBe('/tmp/test.log');
  });

  it('uses custom LOG_ERROR_FILE', async () => {
    process.env.LOG_ERROR_FILE = '/tmp/error.log';
    const { config } = await import('../config');
    expect(config.logErrorFile).toBe('/tmp/error.log');
  });
});

describe('validateConfig', () => {
  it('throws when X402_ENABLED=true without X402_PAYMENT_RECIPIENT', async () => {
    process.env.X402_ENABLED = 'true';
    delete process.env.X402_PAYMENT_RECIPIENT;
    await expect(import('../config')).rejects.toThrow('X402_PAYMENT_RECIPIENT is required');
  });

  it('throws on invalid LOG_LEVEL', async () => {
    process.env.LOG_LEVEL = 'verbose';
    await expect(import('../config')).rejects.toThrow('Invalid LOG_LEVEL');
  });

  it('accepts valid LOG_LEVEL', async () => {
    process.env.LOG_LEVEL = 'warn';
    const { config } = await import('../config');
    expect(config.logLevel).toBe('warn');
  });

  it('passes with X402_ENABLED=true and X402_PAYMENT_RECIPIENT set', async () => {
    process.env.X402_ENABLED = 'true';
    process.env.X402_PAYMENT_RECIPIENT = '0x1234';
    const { config } = await import('../config');
    expect(config.x402Enabled).toBe(true);
    expect(config.x402PaymentRecipient).toBe('0x1234');
  });

  it('passes with X402_ENABLED=false and no recipient', async () => {
    process.env.X402_ENABLED = 'false';
    delete process.env.X402_PAYMENT_RECIPIENT;
    const { config } = await import('../config');
    expect(config.x402Enabled).toBe(false);
  });

  it('includes both errors when multiple invalid', async () => {
    process.env.X402_ENABLED = 'true';
    delete process.env.X402_PAYMENT_RECIPIENT;
    process.env.LOG_LEVEL = 'invalid';
    try {
      await import('../config');
      expect.fail('should have thrown');
    } catch (e: unknown) {
      expect((e as Error).message)
        .toContain('X402_PAYMENT_RECIPIENT');
      expect((e as Error).message)
        .toContain('LOG_LEVEL');
    }
  });
});
