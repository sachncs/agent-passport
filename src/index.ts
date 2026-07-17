import * as dotenv from 'dotenv';
import type express from 'express';
import { config } from './config';
import { app } from './app';
import { logger, closeLoggerStreams } from './lib/logger';
import { initOperatorWallet } from './lib/operator-wallet';
import { stopMetricsCollectors } from './lib/metrics-collectors';
import { stopIdempotencySweeper } from './lib/idempotency';
import { stopDedupCleanup } from './reputation';

dotenv.config();

const PORT = config.port;

let server: ReturnType<typeof express.application.listen> | null = null;
let forcedShutdownTimer: NodeJS.Timeout | null = null;

function main() {
  if (!initOperatorWallet()) {
    logger.warn(
      'Operator wallet not initialized — on-chain /delegate, /revoke, /reputation/record will be no-ops',
    );
  }
  server = app.listen(PORT, () => {
    logger.info(`Agent Passport running on port ${PORT}`, {
      network: config.algoNetwork,
      port: PORT,
    });
  });
}

function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  stopMetricsCollectors();
  stopIdempotencySweeper();
  stopDedupCleanup();
  closeLoggerStreams();
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    // ponytail: .unref() so this timer doesn't keep the loop alive after a
    // successful server.close().
    forcedShutdownTimer = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
    forcedShutdownTimer.unref?.();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  // Best-effort drain — process must exit eventually; SIGTERM handler will
  // run too but Node exits on uncaughtException by default.
  gracefulShutdown('uncaughtException');
});

main();
