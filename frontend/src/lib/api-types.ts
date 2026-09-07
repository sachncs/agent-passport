export type RiskLevel = "low" | "medium" | "high" | "critical"
export type Status = "positive" | "neutral" | "negative"
export type SanctionsStatus = "allowed" | "denied" | "unknown"

export interface HealthResponse {
  status: string
  service: string
  version: string
  network: string
  x402: boolean
  timestamp: string
}

export interface VersionResponse extends HealthResponse {
  commit?: string
  node: string
  uptime: number
}

export interface TrustScoreBreakdown {
  ageScore: number
  activityScore: number
  volumeScore: number
  velocityScore: number
  complianceScore: number
}

export interface TrustScoreOnChain {
  balanceAlgo: number
  totalTxns: number
  assetCount: number
  appCount: number
  accountAgeDays: number
  firstSeenRound: number
  lastSeenRound: number
}

export interface TrustScoreResponse {
  wallet: string
  trustScore: number
  riskLevel: RiskLevel
  approved: boolean
  recommendedLimit: number
  breakdown?: TrustScoreBreakdown
  onChain?: TrustScoreOnChain
  explanation?: string[]
}

export interface DelegationResponse {
  wallet: string
  trustScore: number
  riskLevel: RiskLevel
  approved: boolean
  recommendedLimit: number
  breakdown?: {
    depthScore: number
    sponsorQualityScore: number
    sponsorCountScore: number
    amountScore: number
  }
  delegation?: {
    depth: number
    sponsorCount: number
    sponsorQuality: number
    delegationPath: string[]
    totalDelegatedAmount: number
    isTrustAnchor: boolean
    trustedAncestors: number
  }
  explanation?: string[]
}

export interface CounterpartyCheckResponse {
  buyer: string
  allow: boolean
  onChainScore: number
  delegationScore: number
  trustScore: number
  explanation?: string[]
}

export interface CreditEstimateResponse {
  wallet: string
  estimatedLimit: number
  requestedAmount?: number
  utilizationRatio?: number
  explanation?: string[]
}

export interface SybilSignals {
  creationClustering: number
  interactionDensity: number
  balanceSimilarity: number
  circularActivity: number
  timingRegularity: number
  amountFingerprint: number
  fundingCorrelation: number
  neighborhoodClustering: number
  hubScore: number
  intermediateDensity: number
  componentRatio: number
  temporalCorrelation: number
}

export interface SybilCheckResponse {
  wallet: string
  sybilRisk: number
  riskLevel: RiskLevel
  confidence: number
  clusterSize: number
  signals: SybilSignals
  flaggedWallets: string[]
  explanation: string[]
}

export interface ReputationResponse {
  wallet: string
  reputation: number
  breakdown: {
    successfulPayments: number
    successfulPurchases: number
    disputes: number
    refunds: number
    sponsorEndorsements: number
    serviceInteractions: number
    totalEvents: number
    positiveEvents: number
    negativeEvents: number
  }
  explanation?: string[]
}

export interface UnderwriteFactor {
  name: string
  score: number
  weight: number
  contribution: number
  status: Status
}

export interface UnderwriteResponse {
  wallet: string
  approved: boolean
  recommendedLimit: number
  riskLevel: RiskLevel
  confidence: number
  compositeScore: number
  factors: UnderwriteFactor[]
  explanation: string[]
  sanctions?: {
    status: SanctionsStatus
    reason?: string
    provider: string
  }
}

export interface PassportResponse {
  wallet: string
  trustScore: number
  reputation: number
  creditLimit: number
  sybilRisk: number
  overallRiskLevel: RiskLevel
  onChain: TrustScoreOnChain
  delegation: Record<string, unknown>
  capabilities: Record<string, boolean>
  summary: string
  checksum: string
  generatedAt: string
}

export interface VerifyResponse {
  valid: boolean
  wallet: string
  flags: Record<string, boolean>
  cached?: boolean
}

export interface BazaarEntry {
  id: string
  type: string
  category: string
  name: string
  description: string
  tags: string[]
  endpoints: Record<string, string>
  pricing: Record<string, string>
  health: string
}

export interface BazaarSearchResponse {
  query: string
  total: number
  results: BazaarEntry[]
}

export type ReputationEventType =
  | "payment"
  | "purchase"
  | "dispute"
  | "refund"
  | "endorsement"
  | "service"
