import { join } from 'path';
import express, { type Express } from 'express';
import { config } from '../../config';
import { isRegistryConfigured } from '../../registry';
import { isOperatorInitialized } from '../../lib/operator-wallet';
import { metricsEndpoint } from '../../lib/metrics';
import { getSanctionsProvider } from '../../lib/sanctions';
import { algod } from '../../lib/algorand-client';
import { buildInfo, packageVersion } from '../../lib/build-info';
import { openApiSpec } from '../../lib/openapi';

export interface SystemRouteOptions {
  publicDir: string;
}

/** Register framework-facing operational routes at the HTTP boundary. */
export function registerSystemRoutes(
  app: Express,
  options: SystemRouteOptions,
): void {
  app.get('/registry/status', (_req, res) => {
    res.json({
      configured: isRegistryConfigured(),
      appId: config.registryAppId,
    });
  });

  app.get('/metrics', metricsEndpoint);

  app.get('/version', (_req, res) => {
    res.json({
      service: 'Agent Passport',
      version: packageVersion,
      commit: config.gitCommit,
      node: process.version,
      startedAt: buildInfo.startedAt,
      network: config.algoNetwork,
      x402: config.x402Enabled,
      sanctionsProvider: getSanctionsProvider().name,
      uptime: Math.floor(process.uptime()),
    });
  });

  app.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  app.use('/static', express.static(options.publicDir));
  app.get('/dashboard', (_req, res) => {
    res.sendFile(join(options.publicDir, 'dashboard.html'));
  });

  app.get('/', (_req, res) => {
    res.json({
      service: 'Agent Passport',
      version: packageVersion,
      docs: '/openapi.json',
      dashboard: '/dashboard',
      health: '/health',
      ready: '/ready',
      metrics: '/metrics',
    });
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Agent Passport',
      version: packageVersion,
      network: config.algoNetwork,
      x402: config.x402Enabled,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', async (_req, res) => {
    const health: Record<string, unknown> = {
      status: 'ok',
      service: 'Agent Passport',
      network: config.algoNetwork,
      timestamp: new Date().toISOString(),
    };

    try {
      const status = await algod.status().do();
      health.algorand = {
        connected: true,
        round: Number(status.lastRound || 0),
      };
    } catch (error) {
      health.status = 'degraded';
      health.algorand = { connected: false, error: String(error) };
    }

    health.operator = {
      initialized: isOperatorInitialized(),
      registryConfigured: isRegistryConfigured(),
    };

    const contractsConfigured = config.registryAppId > 0
      || config.reputationAppId > 0;
    if (!isOperatorInitialized() && contractsConfigured) health.status = 'degraded';
    res.status(health.status === 'ok' ? 200 : 503).json(health);
  });

  app.get('/health/deep', async (_req, res) => {
    const health: Record<string, unknown> = {
      status: 'ok',
      service: 'Agent Passport',
      version: packageVersion,
      network: config.algoNetwork,
      x402: config.x402Enabled,
      timestamp: new Date().toISOString(),
    };

    try {
      const status = await algod.status().do();
      health.algorand = {
        connected: true,
        round: Number(status.lastRound || 0),
      };
    } catch (error) {
      health.status = 'degraded';
      health.algorand = { connected: false, error: String(error) };
    }

    res.status(health.status === 'ok' ? 200 : 503).json(health);
  });
}
