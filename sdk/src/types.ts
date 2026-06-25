/**
 * Type definitions for the Agent Passport SDK.
 */

import type { PaymentRequirements, PaymentProof } from './errors';

export interface AgentPassportConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onPaymentRequired?: (requirements: PaymentRequirements) => Promise<PaymentProof>;
  headers?: Record<string, string>;
}

export interface PaginationOptions {
  pageSize?: number;
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface TrustScoreResponse {
  wallet: string;
  trustScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  approved: boolean;
  recommendedLimit: number;
  breakdown: {
    ageScore: number;
    activityScore: number;
    volumeScore: number;
    velocityScore: number;
    complianceScore: number;
  };
  onChain: {
    balanceAlgo: number;
    totalTxns: number;
    assetCount: number;
    appCount: number;
    accountAgeDays: number;
    firstSeenRound: number;
    lastSeenRound: number;
  };
  explanation: string[];
}

export interface DelegationResponse {
  wallet: string;
  trustScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  approved: boolean;
  recommendedLimit: number;
  breakdown: {
    depthScore: number;
    sponsorQualityScore: number;
    sponsorCountScore: number;
    amountScore: number;
  };
  delegation: {
    depth: number;
    sponsorCount: number;
    sponsorQuality: number;
    delegationPath: string[];
    totalDelegatedAmount: number;
    isTrustAnchor: boolean;
    trustedAncestors: number;
  };
  explanation: string[];
}

export interface CounterpartyCheckResponse {
  allow: boolean;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  trustScore: number;
  onChainScore: number;
  delegationScore: number;
  explanation: string[];
}

export interface CreditEstimateResponse {
  wallet: string;
  estimatedLimit: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  approved: boolean;
  breakdown: {
    balanceCapacity: number;
    activityBonus: number;
    ageBonus: number;
    riskPenalty: number;
  };
  explanation: string[];
}

export interface SybilCheckResponse {
  wallet: string;
  sybilRisk: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
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
  };
  flaggedWallets: string[];
  explanation: string[];
}

export interface ReputationResponse {
  wallet: string;
  reputation: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
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
  explanation: string[];
}

export interface ReputationRecordResponse {
  wallet: string;
  eventType: string;
  amount: number;
  round: number;
  timestamp: number;
}

export interface UnderwriteResponse {
  wallet: string;
  approved: boolean;
  compositeScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedLimit: number;
  confidence: number;
  factors: {
    trustScore: number;
    delegationScore: number;
    sybilRisk: number;
    reputation: number;
  };
  explanation: string[];
}

export interface TrustGraphResponse {
  wallet: string;
  graph: {
    depth: number;
    nodeCount: number;
    edgeCount: number;
    clusteringCoefficient: number;
    hubScore: number;
    intermediateDensity: number;
  };
  exposure: {
    totalExposure: number;
    directExposure: number;
    transitiveExposure: number;
  };
  whatIf: {
    removalImpact: number;
    weakestLinkRisk: number;
  };
  explanation: string[];
}

export interface PassportResponse {
  wallet: string;
  generatedAt: string;
  blockRound: number;
  schemaVersion: number;
  identityStrength: number;
  trustScore: number;
  trustRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  reputation: number;
  reputationRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalEvents: number;
  paymentReliability: number;
  creditLimit: number;
  creditRisk: 'low' | 'medium' | 'high' | 'critical';
  risk: number;
  sybilRisk: number;
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  onChain: {
    balanceAlgo: number;
    totalTxns: number;
    accountAgeDays: number;
    assets: number;
    apps: number;
  };
  delegation: {
    depth: number;
    sponsorCount: number;
    delegatedAmount: number;
    isTrustAnchor: boolean;
  };
  capabilities: {
    trustScoring: boolean;
    delegation: boolean;
    creditEligible: boolean;
    sybilClear: boolean;
    reputationActive: boolean;
  };
  dataSources: {
    trust: boolean;
    delegation: boolean;
    credit: boolean;
    sybil: boolean;
    reputation: boolean;
  };
  summary: string;
  explanation: string[];
  checksum: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  network: string;
  x402: boolean;
  timestamp: string;
  algorand?: {
    connected: boolean;
    round?: number;
    error?: string;
  };
}

export interface EndorsementRequest {
  sponsor: string;
  agent: string;
  amount: number;
  idempotencyKey?: string;
}

export interface EndorsementResponse {
  txId: string;
  sponsor: string;
  agent: string;
  amount: number;
  round: number;
  timestamp: number;
}

export interface RevocationRequest {
  sponsor: string;
  agent: string;
  idempotencyKey?: string;
}

export interface RevocationResponse {
  txId: string;
  sponsor: string;
  agent: string;
  round: number;
  timestamp: number;
}

export interface CreatePassportOptions {
  wallet: string;
  refresh?: boolean;
}
