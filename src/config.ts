function safeParseInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validateConfig() {
  const errors: string[] = [];

  if (process.env.X402_ENABLED === 'true' && !process.env.X402_PAYMENT_RECIPIENT) {
    errors.push('X402_PAYMENT_RECIPIENT is required when X402_ENABLED=true');
  }

  if (process.env.LOG_LEVEL) {
    const normalized = process.env.LOG_LEVEL.toLowerCase();
    if (!['debug', 'info', 'warn', 'error'].includes(normalized)) {
      errors.push(`Invalid LOG_LEVEL: ${process.env.LOG_LEVEL}. Must be debug|info|warn|error`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n  - ${errors.join('\n  - ')}`);
  }
}

export const config = {
  port: safeParseInt(process.env.PORT, 3000),

  algodUrl: process.env.ALGOD_URL || 'https://testnet-api.algonode.cloud:443',
  algodToken: process.env.ALGOD_TOKEN || '',
  indexerUrl: process.env.INDEXER_URL || 'https://testnet-idx.algonode.cloud:443',
  indexerToken: process.env.INDEXER_TOKEN || '',

  algoNetwork: process.env.ALGO_NETWORK || 'testnet',
  registryAppId: safeParseInt(process.env.REGISTRY_APP_ID, 0),
  reputationAppId: safeParseInt(process.env.REPUTATION_APP_ID, 0),

  x402Enabled: process.env.X402_ENABLED === 'true',
  x402FacilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
  x402PaymentRecipient: process.env.X402_PAYMENT_RECIPIENT || '',
  x402Network: (process.env.X402_NETWORK || 'eip155:84532') as `${string}:${string}`,

  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS || '*',

  logLevel: ((process.env.LOG_LEVEL || 'info').toLowerCase()) as 'debug' | 'info' | 'warn' | 'error',
  logFile: process.env.LOG_FILE,
  logErrorFile: process.env.LOG_ERROR_FILE,
} as const;

validateConfig();
