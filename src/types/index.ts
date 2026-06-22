export interface WalletTrustScore {
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

export interface DelegationTrustScore {
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

export interface CounterpartyResult {
  allow: boolean;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  trustScore: number;
  onChainScore: number;
  delegationScore: number;
  explanation: string[];
}

export interface CreditEstimate {
  wallet: string;
  estimatedLimit: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  approved: boolean;
  breakdown: {
    balanceCapacity: number;
    activityBonus: number;
    ageBonus: number;
    delegationBonus: number;
    riskPenalty: number;
  };
  explanation: string[];
}

export interface SybilResult {
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
  };
  flaggedWallets: string[];
  explanation: string[];
}

export interface ReputationBreakdown {
  successfulPayments: number;
  successfulPurchases: number;
  disputes: number;
  refunds: number;
  sponsorEndorsements: number;
  serviceInteractions: number;
  totalEvents: number;
  positiveEvents: number;
  negativeEvents: number;
}

export interface ReputationResult {
  wallet: string;
  reputation: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  breakdown: ReputationBreakdown;
  explanation: string[];
}

export interface UnderwritingFactor {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  status: 'positive' | 'neutral' | 'negative';
}

export interface UnderwritingDecision {
  wallet: string;
  approved: boolean;
  recommendedLimit: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  compositeScore: number;
  factors: UnderwritingFactor[];
  explanation: string[];
}

export interface TrustGraphResult {
  wallet: string;
  depth: number;
  nodeCount: number;
  edges: { from: string; to: string; amount: number; round: number }[];
  nodes: { address: string; trustScore: number; balanceAlgo: number; depth: number }[];
  paths: { path: string[]; depth: number; totalDelegated: number; weakestLink: number }[];
  exposure: {
    totalExposure: number;
    directExposure: number;
    indirectExposure: number;
    exposureByDepth: { depth: number; amount: number; wallets: number }[];
    maxLossIfSponsorFails: number;
  };
  whatIfs: {
    sponsorRemoved: string;
    originalScore: number;
    newScore: number;
    scoreImpact: number;
    affectedWallets: number;
    explanation: string[];
  }[];
  explanation: string[];
}

export interface AgentPassport {
  wallet: string;
  generatedAt: string;
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
  summary: string;
  explanation: string[];
}
