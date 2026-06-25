import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { config } from './config';
import { app } from './app';
import { logger } from './lib/logger';

const PORT = config.port;

let server: ReturnType<typeof express.application.listen> | null = null;

function main() {
  server = app.listen(PORT, () => {
    logger.info(`Agent Passport running on port ${PORT}`, {
      network: config.algoNetwork,
      port: PORT,
    });
  });
}

function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
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
  process.exit(1);
});

main();
