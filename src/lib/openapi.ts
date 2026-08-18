/**
 * OpenAPI 3.0 spec generated at runtime with full response schemas.
 * The schemas below mirror the TypeScript types in src/{trust-score,
 * delegation, sybil, credit, reputation, underwriting, passport,
 * trust-graph}.counterparty.ts and friends. Single source of truth:
 * any drift between these schemas and the actual response shape will
 * show up in openapi-typescript generation in apps/web.
 *
 * Generated at startup; served at /openapi.json. (M13)
 */

import { packageVersion } from './build-info';
import { config } from '../config';

const servers = [
  { url: 'http://localhost:3000', description: 'Local dev' },
  { url: 'https://api.passport.example.com', description: 'Production' },
];

// ── Response schemas (named) ────────────────────────────────────

const RiskLevel = {
  type: 'string',
  enum: ['low', 'medium', 'high', 'critical'],
} as const;

const WalletAddress = {
  type: 'string',
  pattern: '^[A-Z2-7]{58}$',
  description: '58-character base32 Algorand address',
  example: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A',
} as const;

const OnChainSnapshot = {
  type: 'object',
  properties: {
    balanceAlgo: { type: 'number' },
    totalTxns: { type: 'integer' },
    assetCount: { type: 'integer' },
    appCount: { type: 'integer' },
    accountAgeDays: { type: 'integer' },
    firstSeenRound: { type: 'integer' },
    lastSeenRound: { type: 'integer' },
  },
} as const;

const TrustScoreBreakdown = {
  type: 'object',
  properties: {
    ageScore: { type: 'number' },
    activityScore: { type: 'number' },
    volumeScore: { type: 'number' },
    velocityScore: { type: 'number' },
    complianceScore: { type: 'number' },
  },
} as const;

const TrustScoreResponse = {
  type: 'object',
  required: ['wallet', 'trustScore', 'riskLevel', 'approved', 'recommendedLimit'],
  properties: {
    wallet: WalletAddress,
    trustScore: { type: 'number', minimum: 0, maximum: 100 },
    riskLevel: RiskLevel,
    approved: { type: 'boolean' },
    recommendedLimit: { type: 'number' },
    breakdown: TrustScoreBreakdown,
    onChain: OnChainSnapshot,
    explanation: { type: 'array', items: { type: 'string' } },
  },
} as const;

const DelegationResponse = {
  type: 'object',
  properties: {
    wallet: WalletAddress,
    trustScore: { type: 'number' },
    riskLevel: RiskLevel,
    approved: { type: 'boolean' },
    recommendedLimit: { type: 'number' },
    breakdown: {
      type: 'object',
      properties: {
        depthScore: { type: 'number' },
        sponsorQualityScore: { type: 'number' },
        sponsorCountScore: { type: 'number' },
        amountScore: { type: 'number' },
      },
    },
    delegation: {
      type: 'object',
      properties: {
        depth: { type: 'integer' },
        sponsorCount: { type: 'integer' },
        sponsorQuality: { type: 'number' },
        delegationPath: { type: 'array', items: WalletAddress },
        totalDelegatedAmount: { type: 'number' },
        isTrustAnchor: { type: 'boolean' },
        trustedAncestors: { type: 'integer' },
      },
    },
    explanation: { type: 'array', items: { type: 'string' } },
  },
} as const;

const CounterpartyCheckResponse = {
  type: 'object',
  properties: {
    buyer: WalletAddress,
    allow: { type: 'boolean' },
    onChainScore: { type: 'number' },
    delegationScore: { type: 'number' },
    trustScore: { type: 'number' },
    explanation: { type: 'array', items: { type: 'string' } },
  },
} as const;

const CreditEstimateResponse = {
  type: 'object',
  properties: {
    wallet: WalletAddress,
    estimatedLimit: { type: 'number' },
    requestedAmount: { type: 'number' },
    utilizationRatio: { type: 'number' },
    explanation: { type: 'array', items: { type: 'string' } },
  },
} as const;

const SybilCheckResponse = {
  type: 'object',
  properties: {
    wallet: WalletAddress,
    sybilRisk: { type: 'number', minimum: 0, maximum: 1 },
    riskLevel: RiskLevel,
    confidence: { type: 'number' },
    clusterSize: { type: 'integer' },
    signals: {
      type: 'object',
      properties: {
        creationClustering: { type: 'number' },
        interactionDensity: { type: 'number' },
        balanceSimilarity: { type: 'number' },
        circularActivity: { type: 'number' },
        timingRegularity: { type: 'number' },
        amountFingerprint: { type: 'number' },
        fundingCorrelation: { type: 'number' },
        neighborhoodClustering: { type: 'number' },
        hubScore: { type: 'number' },
        intermediateDensity: { type: 'number' },
        componentRatio: { type: 'number' },
        temporalCorrelation: { type: 'number' },
      },
    },
    flaggedWallets: { type: 'array', items: WalletAddress },
    explanation: { type: 'array', items: { type: 'string' } },
  },
} as const;

const ReputationResponse = {
  type: 'object',
  properties: {
    wallet: WalletAddress,
    reputation: { type: 'number', minimum: 0, maximum: 100 },
    breakdown: {
      type: 'object',
      properties: {
        successfulPayments: { type: 'integer' },
        successfulPurchases: { type: 'integer' },
        disputes: { type: 'integer' },
        refunds: { type: 'integer' },
        sponsorEndorsements: { type: 'integer' },
        serviceInteractions: { type: 'integer' },
        totalEvents: { type: 'integer' },
        positiveEvents: { type: 'integer' },
        negativeEvents: { type: 'integer' },
      },
    },
    explanation: { type: 'array', items: { type: 'string' } },
  },
} as const;

const ReputationRecordResponse = {
  type: 'object',
  properties: {
    wallet: WalletAddress,
    eventType: {
      type: 'string',
      enum: ['payment', 'purchase', 'dispute', 'refund', 'endorsement', 'service'],
    },
    reputation: { type: 'number' },
    recorded: { type: 'boolean' },
  },
} as const;

const UnderwriteResponse = {
  type: 'object',
  properties: {
    wallet: WalletAddress,
    approved: { type: 'boolean' },
    recommendedLimit: { type: 'number' },
    riskLevel: RiskLevel,
    confidence: { type: 'number' },
    compositeScore: { type: 'number' },
    factors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          score: { type: 'number' },
          weight: { type: 'number' },
          contribution: { type: 'number' },
          status: {
            type: 'string',
            enum: ['positive', 'neutral', 'negative'],
          },
        },
      },
    },
    explanation: { type: 'array', items: { type: 'string' } },
    sanctions: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['allowed', 'denied', 'unknown'],
        },
        reason: { type: 'string' },
        provider: { type: 'string' },
      },
    },
  },
} as const;

const TrustGraphResponse = {
  type: 'object',
  properties: {
    wallet: WalletAddress,
    depth: { type: 'integer' },
    nodeCount: { type: 'integer' },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: WalletAddress,
          to: WalletAddress,
          amount: { type: 'number' },
          round: { type: 'integer' },
        },
      },
    },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          address: WalletAddress,
          trustScore: { type: 'number' },
          balanceAlgo: { type: 'number' },
          depth: { type: 'integer' },
        },
      },
    },
    paths: { type: 'array' },
    exposure: {
      type: 'object',
      properties: {
        totalExposure: { type: 'number' },
        directExposure: { type: 'number' },
        indirectExposure: { type: 'number' },
        exposureByDepth: { type: 'array' },
        maxLossIfSponsorFails: { type: 'number' },
      },
    },
    whatIfs: { type: 'array' },
    explanation: { type: 'array', items: { type: 'string' } },
  },
} as const;

const PassportResponse = {
  type: 'object',
  properties: {
    wallet: WalletAddress,
    trustScore: { type: 'number' },
    reputation: { type: 'number' },
    creditLimit: { type: 'number' },
    sybilRisk: { type: 'number' },
    overallRiskLevel: RiskLevel,
    onChain: OnChainSnapshot,
    delegation: { type: 'object' },
    capabilities: { type: 'object', additionalProperties: { type: 'boolean' } },
    summary: { type: 'string' },
    checksum: { type: 'string' },
    generatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const VerifyResponse = {
  type: 'object',
  properties: {
    valid: { type: 'boolean' },
    wallet: { type: 'string' },
    flags: { type: 'object', additionalProperties: { type: 'boolean' } },
    cached: { type: 'boolean' },
  },
} as const;

const HealthResponse = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    service: { type: 'string' },
    version: { type: 'string' },
    network: { type: 'string' },
    x402: { type: 'boolean' },
    timestamp: { type: 'string', format: 'date-time' },
  },
} as const;

const ErrorResponse = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' },
  },
  required: ['error'],
} as const;

// ── Route catalog ──────────────────────────────────────────────

interface RouteSpec {
  method: string;
  path: string;
  summary: string;
  description?: string;
  params?: Array<{ name: string; in: 'query' | 'path'; required?: boolean; description?: string; schema?: Record<string, unknown> }>;
  bodySchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  x402Price?: number;
}

const ROUTES: RouteSpec[] = [
  { method: 'GET', path: '/score', summary: 'Composite trust score (0-100) for a wallet',
    params: [{ name: 'wallet', in: 'query', required: true, description: '58-char base32 Algorand address', schema: { type: 'string', pattern: '^[A-Z2-7]{58}$' } }],
    responseSchema: TrustScoreResponse,
    x402Price: 0.001 },
  { method: 'GET', path: '/delegation', summary: 'Delegated trust graph for a wallet',
    params: [{ name: 'wallet', in: 'query', required: true }],
    responseSchema: DelegationResponse,
    x402Price: 0.001 },
  { method: 'POST', path: '/counterparty-check', summary: 'Merchant counterparty risk check',
    bodySchema: { type: 'object', required: ['buyer'], properties: { buyer: WalletAddress } },
    responseSchema: CounterpartyCheckResponse,
    x402Price: 0.002 },
  { method: 'POST', path: '/credit-estimate', summary: 'Credit capacity estimation',
    bodySchema: { type: 'object', required: ['wallet'], properties: { wallet: WalletAddress, amount: { type: 'number', minimum: 0 } } },
    responseSchema: CreditEstimateResponse,
    x402Price: 0.002 },
  { method: 'GET', path: '/sybil-check', summary: 'Sybil-detection signal report',
    params: [{ name: 'wallet', in: 'query', required: true }],
    responseSchema: SybilCheckResponse,
    x402Price: 0.003 },
  { method: 'GET', path: '/reputation', summary: 'On-chain reputation events',
    params: [{ name: 'wallet', in: 'query', required: true }],
    responseSchema: ReputationResponse,
    x402Price: 0.001 },
  { method: 'POST', path: '/reputation/record', summary: 'Record an on-chain reputation event',
    bodySchema: { type: 'object', required: ['wallet', 'eventType'], properties: {
      wallet: WalletAddress,
      eventType: { type: 'string', enum: ['payment','purchase','dispute','refund','endorsement','service'] },
      amount: { type: 'number' },
      counterparty: WalletAddress,
      round: { type: 'number', description: 'Required when eventType is "dispute"' },
    } },
    responseSchema: ReputationRecordResponse,
    x402Price: 0.005 },
  { method: 'POST', path: '/reputation/subscribe', summary: 'Subscribe to reputation events for a wallet',
    bodySchema: { type: 'object', required: ['wallet', 'url'], properties: { wallet: WalletAddress, url: { type: 'string', format: 'uri' } } } },
  { method: 'GET', path: '/reputation/subscribers', summary: 'List webhook subscribers',
    params: [{ name: 'wallet', in: 'query', description: 'Filter by wallet' }] },
  { method: 'DELETE', path: '/reputation/subscribe/:id', summary: 'Unsubscribe from reputation events' },
  { method: 'GET', path: '/underwrite', summary: 'Underwriting decision and credit capacity',
    params: [{ name: 'wallet', in: 'query', required: true }],
    responseSchema: UnderwriteResponse,
    x402Price: 0.01 },
  { method: 'GET', path: '/trust-graph', summary: 'Trust graph analytics and what-ifs',
    params: [
      { name: 'wallet', in: 'query', required: true },
      { name: 'simulateSponsorLost', in: 'query', description: 'Wallet to simulate as lost' },
    ],
    responseSchema: TrustGraphResponse,
    x402Price: 0.005 },
  { method: 'GET', path: '/passport', summary: 'Full passport document with sub-scores',
    params: [{ name: 'wallet', in: 'query', required: true }],
    responseSchema: PassportResponse,
    x402Price: 0.005 },
  { method: 'POST', path: '/delegate', summary: 'Submit on-chain delegation',
    bodySchema: { type: 'object', required: ['sponsor', 'agent', 'amount'], properties: {
      sponsor: WalletAddress, agent: WalletAddress, amount: { type: 'number', minimum: 0, exclusiveMinimum: true },
    } } },
  { method: 'POST', path: '/revoke', summary: 'Submit on-chain revocation',
    bodySchema: { type: 'object', required: ['sponsor', 'agent'], properties: { sponsor: WalletAddress, agent: WalletAddress } } },
  { method: 'GET', path: '/registry/status', summary: 'Whether the registry contract is configured' },
  { method: 'GET', path: '/verify', summary: 'Lightweight wallet verification flags',
    params: [{ name: 'wallet', in: 'query', required: true }],
    responseSchema: VerifyResponse },
  { method: 'GET', path: '/discovery/search', summary: 'Bazaar discovery',
    params: [
      { name: 'q', in: 'query', description: 'Search query' },
      { name: 'limit', in: 'query', description: 'Max results (default 20, max 100)' },
    ] },
  { method: 'GET', path: '/health', summary: 'Liveness probe', responseSchema: HealthResponse },
  { method: 'GET', path: '/ready', summary: 'Readiness probe (503 when Algorand unreachable)' },
  { method: 'GET', path: '/health/deep', summary: 'Deep health check with Algorand status' },
  { method: 'GET', path: '/metrics', summary: 'Prometheus metrics scrape' },
  { method: 'GET', path: '/version', summary: 'Service build metadata' },
  { method: 'GET', path: '/openapi.json', summary: 'This OpenAPI 3.0 spec' },
  { method: 'GET', path: '/dashboard', summary: 'Legacy HTML dashboard' },
];

const paths: Record<string, Record<string, unknown>> = {};
for (const route of ROUTES) {
  if (!paths[route.path]) paths[route.path] = {};
  const op: Record<string, unknown> = {
    summary: route.summary,
    description: route.description,
    responses: {
      '200': route.responseSchema
        ? { description: 'OK', content: { 'application/json': { schema: route.responseSchema } } }
        : { description: 'OK' },
      '400': { description: 'Bad request', content: { 'application/json': { schema: ErrorResponse } } },
      '401': { description: 'Unauthorized — HMAC auth failed or missing', content: { 'application/json': { schema: ErrorResponse } } },
      '404': { description: 'Wallet not found', content: { 'application/json': { schema: ErrorResponse } } },
      '409': { description: 'Idempotency conflict', content: { 'application/json': { schema: ErrorResponse } } },
      '413': { description: 'Body too large', content: { 'application/json': { schema: ErrorResponse } } },
      '429': { description: 'Rate-limited', content: { 'application/json': { schema: ErrorResponse } } },
      '500': { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } },
    },
  };
  if (route.x402Price) {
    op['x-x402-price'] = route.x402Price;
    if (config.x402Enabled) {
      op['x-x402-paid'] = true;
    }
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
    description:
      'Stateless trust scoring, delegation, credit, sybil, reputation, ' +
      'and underwriting for AI agents on Algorand. Single source of truth: ' +
      'apps/web consumes this spec via openapi-typescript codegen.',
  },
  servers,
  paths,
  components: {
    securitySchemes: {
      HmacAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Auth-Signature',
        description:
          'HMAC-SHA256 over METHOD\\nPATH\\nsha256(body)\\nTIMESTAMP\\nNONCE ' +
          'with the per-tenant secret. See docs/security/hmac-auth.md.',
      },
      IdempotencyKey: {
        type: 'apiKey',
        in: 'header',
        name: 'Idempotency-Key',
        description: 'Required on all mutating requests (POST/PUT/DELETE).',
      },
    },
    schemas: {
      WalletAddress,
      RiskLevel,
      TrustScoreResponse,
      DelegationResponse,
      CounterpartyCheckResponse,
      CreditEstimateResponse,
      SybilCheckResponse,
      ReputationResponse,
      UnderwriteResponse,
      TrustGraphResponse,
      PassportResponse,
      VerifyResponse,
      HealthResponse,
      ErrorResponse,
    },
  },
  security: [{ HmacAuth: [], IdempotencyKey: [] }],
} as const;