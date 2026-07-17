/**
 * OpenAPI 3.0 spec generated at runtime.
 *
 * Replaces a hand-maintained `docs/openapi.yaml` that drifted from the
 * actual routes. Every route in `src/app.ts` is described by a tiny
 * schema below; running the service publishes it at `/openapi.json`.
 */

import { packageVersion } from './build-info';

const servers = [
  { url: 'http://localhost:3000', description: 'Local dev' },
];

interface RouteSpec {
  method: string;
  path: string;
  summary: string;
  description?: string;
  params?: Array<{ name: string; in: 'query' | 'body'; required?: boolean; description: string; schema?: Record<string, unknown> }>;
  bodySchema?: Record<string, unknown>;
  x402Price?: number;
}

const ROUTES: RouteSpec[] = [
  { method: 'GET', path: '/score', summary: 'Composite trust score (0–100) for a wallet',
    params: [{ name: 'wallet', in: 'query', required: true, description: '58-char base32 Algorand address', schema: { type: 'string' } }],
    x402Price: 0.001 },
  { method: 'GET', path: '/delegation', summary: 'Delegated trust graph for a wallet',
    params: [{ name: 'wallet', in: 'query', required: true, description: 'Algorand address' }], x402Price: 0.001 },
  { method: 'POST', path: '/counterparty-check', summary: 'Merchant counterparty risk check',
    bodySchema: { type: 'object', required: ['buyer'], properties: { buyer: { type: 'string' } } }, x402Price: 0.002 },
  { method: 'POST', path: '/credit-estimate', summary: 'Credit capacity estimation',
    bodySchema: { type: 'object', required: ['wallet'], properties: { wallet: { type: 'string' }, amount: { type: 'number' } } }, x402Price: 0.002 },
  { method: 'GET', path: '/sybil-check', summary: 'Sybil-detection signal report',
    params: [{ name: 'wallet', in: 'query', required: true, description: 'Algorand address' }], x402Price: 0.003 },
  { method: 'GET', path: '/reputation', summary: 'On-chain reputation events',
    params: [{ name: 'wallet', in: 'query', required: true, description: 'Algorand address' }], x402Price: 0.001 },
  { method: 'POST', path: '/reputation/record', summary: 'Record an on-chain reputation event',
    bodySchema: { type: 'object', required: ['wallet', 'eventType'], properties: { wallet: { type: 'string' }, eventType: { type: 'string', enum: ['payment','purchase','dispute','refund','endorsement','service'] }, amount: { type: 'number' }, counterparty: { type: 'string' }, round: { type: 'number', description: 'Required when eventType is "dispute"' } } }, x402Price: 0.005 },
  { method: 'POST', path: '/reputation/subscribe', summary: 'Subscribe to reputation events for a wallet',
    bodySchema: { type: 'object', required: ['wallet', 'url'], properties: { wallet: { type: 'string' }, url: { type: 'string', format: 'uri' } } } },
  { method: 'GET', path: '/underwrite', summary: 'Underwriting decision and credit capacity',
    params: [{ name: 'wallet', in: 'query', required: true, description: 'Algorand address' }], x402Price: 0.01 },
  { method: 'GET', path: '/trust-graph', summary: 'Trust graph analytics & what-ifs',
    params: [{ name: 'wallet', in: 'query', required: true, description: 'Algorand address' }, { name: 'simulateSponsorLost', in: 'query', description: 'Wallet to simulate as lost' }], x402Price: 0.005 },
  { method: 'GET', path: '/passport', summary: 'Full passport document with sub-scores',
    params: [{ name: 'wallet', in: 'query', required: true, description: 'Algorand address' }], x402Price: 0.005 },
  { method: 'POST', path: '/delegate', summary: 'Submit on-chain delegation',
    bodySchema: { type: 'object', required: ['sponsor', 'agent', 'amount'], properties: { sponsor: { type: 'string' }, agent: { type: 'string' }, amount: { type: 'number', minimum: 0, exclusiveMinimum: true } } } },
  { method: 'POST', path: '/revoke', summary: 'Submit on-chain revocation',
    bodySchema: { type: 'object', required: ['sponsor', 'agent'], properties: { sponsor: { type: 'string' }, agent: { type: 'string' } } } },
  { method: 'GET', path: '/registry/status', summary: 'Whether the registry contract is configured' },
  { method: 'GET', path: '/verify', summary: 'Lightweight wallet verification flags',
    params: [{ name: 'wallet', in: 'query', required: true, description: 'Algorand address' }] },
  { method: 'GET', path: '/discovery/search', summary: 'Bazaar discovery',
    params: [{ name: 'q', in: 'query', description: 'Search query' }, { name: 'limit', in: 'query', description: 'Max results (default 20, max 100)' }] },
  { method: 'GET', path: '/health', summary: 'Liveness probe (always 200 unless process is dead)' },
  { method: 'GET', path: '/ready', summary: 'Readiness probe (503 when Algorand unreachable)' },
  { method: 'GET', path: '/metrics', summary: 'Prometheus metrics scrape' },
  { method: 'GET', path: '/version', summary: 'Service build metadata' },
  { method: 'GET', path: '/openapi.json', summary: 'This OpenAPI 3.0 spec' },
];

const paths: Record<string, Record<string, unknown>> = {};
for (const route of ROUTES) {
  if (!paths[route.path]) paths[route.path] = {};
  const op: Record<string, unknown> = {
    summary: route.summary,
    description: route.description,
    responses: {
      '200': { description: 'OK' },
      '400': { description: 'Bad request' },
      '404': { description: 'Wallet not found' },
      '429': { description: 'Rate-limited' },
      '500': { description: 'Server error' },
    },
  };
  if (route.x402Price) {
    op['x-x402-price'] = route.x402Price;
  }
  if (route.params) {
    op.parameters = route.params.map(p => ({
      name: p.name,
      in: p.in,
      required: p.required,
      description: p.description,
      schema: p.schema ?? { type: 'string' },
    }));
  }
  if (route.bodySchema) {
    op.requestBody = {
      required: true,
      content: { 'application/json': { schema: route.bodySchema } },
    };
  }
  paths[route.path][route.method.toLowerCase()] = op;
}

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Agent Passport API',
    version: packageVersion,
    description: 'Stateless trust scoring, delegation, credit, sybil, reputation, and underwriting for AI agents on Algorand.',
  },
  servers,
  paths,
} as const;