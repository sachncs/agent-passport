/**
 * Hand-maintained response types for the Agent Passport API. The runtime
 * spec at /openapi.json is the source of truth; `pnpm codegen` regenerates
 * this file from it (when the API is running). Keep the manual fallback
 * in sync — drift will show up as missing fields in the UI.
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type Status = 'positive' | 'neutral' | 'negative';
export type SanctionsStatus = 'allowed' | 'denied' | 'unknown';

export interface WalletAddressBrand {
  readonly _wallet: unique symbol;
}
export type WalletAddress = string & WalletAddressBrand;

export interface ServiceInfo {
  service: string;
  version: string;
  commit?: string;
  node: string;
  startedAt: string;
  network: string;
  x402: boolean;
  sanctionsProvider: string;
  uptime: number;
}

export interface TrustScoreResponse {
  wallet: string;
  trustScore: number;
  riskLevel: RiskLevel;
  approved: boolean;
  recommendedLimit: number;
  breakdown?: {
    ageScore: number;
    activityScore: number;
    volumeScore: number;
    velocityScore: number;
    complianceScore: number;
  };
  onChain?: {
    balanceAlgo: number;
    totalTxns: number;
    assetCount: number;
    appCount: number;
    accountAgeDays: number;
    firstSeenRound: number;
    lastSeenRound: number;
  };
  explanation?: string[];
}

export interface DelegationResponse {
  wallet: string;
  trustScore: number;
  riskLevel: RiskLevel;
  approved: boolean;
  recommendedLimit: number;
  breakdown?: {
    depthScore: number;
    sponsorQualityScore: number;
    sponsorCountScore: number;
    amountScore: number;
  };
  delegation?: {
    depth: number;
    sponsorCount: number;
    sponsorQuality: number;
    delegationPath: string[];
    totalDelegatedAmount: number;
    isTrustAnchor: boolean;
    trustedAncestors: number;
  };
  explanation?: string[];
}

export interface CounterpartyCheckResponse {
  buyer: string;
  allow: boolean;
  onChainScore: number;
  delegationScore: number;
  trustScore: number;
  explanation?: string[];
}

export interface CreditEstimateResponse {
  wallet: string;
  estimatedLimit: number;
  requestedAmount?: number;
  utilizationRatio?: number;
  explanation?: string[];
}

export interface SybilCheckResponse {
  wallet: string;
  sybilRisk: number;
  riskLevel: RiskLevel;
  confidence: number;
  clusterSize: number;
  signals: {
    creationClustering: number;
    interactionDensity: number;
    balanceSimilarity: number;
    circularActivity: number;
    timingRegularity: number;
    amountFingerprint: number;
    fundingCorrelation: number;
    neighborhoodClustering: number;
    hubScore: number;
    intermediateDensity: number;
    componentRatio: number;
    temporalCorrelation: number;
  };
  flaggedWallets: string[];
  explanation: string[];
}

export interface ReputationResponse {
  wallet: string;
  reputation: number;
  breakdown: {
    successfulPayments: number;
    successfulPurchases: number;
    disputes: number;
    refunds: number;
    sponsorEndorsements: number;
    serviceInteractions: number;
    totalEvents: number;
    positiveEvents: number;
    negativeEvents: number;
  };
  explanation?: string[];
}

export interface UnderwriteFactor {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  status: Status;
}

export interface UnderwriteResponse {
  wallet: string;
  approved: boolean;
  recommendedLimit: number;
  riskLevel: RiskLevel;
  confidence: number;
  compositeScore: number;
  factors: UnderwriteFactor[];
  explanation: string[];
  sanctions?: {
    status: SanctionsStatus;
    reason?: string;
    provider: string;
  };
}

export interface TrustGraphResponse {
  wallet: string;
  depth: number;
  nodeCount: number;
  edges: Array<{ from: string; to: string; amount: number; round: number }>;
  nodes: Array<{
    address: string;
    trustScore: number;
    balanceAlgo: number;
    depth: number;
  }>;
  paths: unknown[];
  exposure: {
    totalExposure: number;
    directExposure: number;
    indirectExposure: number;
    exposureByDepth: unknown[];
    maxLossIfSponsorFails: number;
  };
  whatIfs: unknown[];
  explanation: string[];
}

export interface PassportResponse {
  wallet: string;
  trustScore: number;
  reputation: number;
  creditLimit: number;
  sybilRisk: number;
  overallRiskLevel: RiskLevel;
  onChain: {
    balanceAlgo: number;
    totalTxns: number;
    assetCount: number;
    appCount: number;
    accountAgeDays: number;
    firstSeenRound: number;
    lastSeenRound: number;
  };
  delegation: Record<string, unknown>;
  capabilities: Record<string, boolean>;
  summary: string;
  checksum: string;
  generatedAt: string;
}

export interface VerifyResponse {
  valid: boolean;
  wallet: string;
  flags: Record<string, boolean>;
  cached?: boolean;
}

export interface BazaarEntry {
  id: string;
  type: string;
  category: string;
  name: string;
  description: string;
  tags: string[];
  endpoints: Record<string, string>;
  pricing: Record<string, string>;
  health: string;
}

export interface BazaarSearchResponse {
  query: string;
  total: number;
  results: BazaarEntry[];
}

export interface ReputationEventType {
  type: 'payment' | 'purchase' | 'dispute' | 'refund' | 'endorsement' | 'service';
}

export interface ReputationRecordResponse {
  wallet: string;
  eventType: ReputationEventType['type'];
  reputation: number;
  recorded: boolean;
}

export interface EndorseRequest {
  sponsor: string;
  agent: string;
  amount: number;
  idempotencyKey: string;
}

export interface EndorseResponse {
  txId: string;
  sponsor: string;
  agent: string;
  amount: number;
}

export interface RevokeRequest {
  sponsor: string;
  agent: string;
  idempotencyKey: string;
}

export interface RevokeResponse {
  txId: string;
  sponsor: string;
  agent: string;
}