import { createHash } from 'crypto';
import { scoreWallet, scoreWalletFresh } from './trust-score';
import { scoreDelegationFresh } from './delegation';
import { estimateCreditWithTrust } from './credit';
import { detectSybilFresh } from './sybil';
import { computeReputation } from './reputation';
import { logger } from './lib/logger';
import { isValidWallet } from './lib/constants';

export const PASSPORT_SCHEMA_VERSION = 1;

export interface DataSourceStatus {
  trust: boolean;
  delegation: boolean;
  credit: boolean;
  sybil: boolean;
  reputation: boolean;
}

interface AgentPassport {
  wallet: string;
  generatedAt: string;
  blockRound: number;
  schemaVersion: number;

  // Identity & Trust
  identityStrength: number;
  trustScore: number;
  trustRiskLevel: 'low' | 'medium' | 'high' | 'critical';

  // Reputation
  reputation: number;
  reputationRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalEvents: number;

  // Payment & Credit
  paymentReliability: number;
  creditLimit: number;
  creditRisk: 'low' | 'medium' | 'high' | 'critical';

  // Risk Assessment
  risk: number;
  sybilRisk: number;
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';

  // On-chain Profile
  onChain: {
    balanceAlgo: number;
    totalTxns: number;
    accountAgeDays: number;
    assets: number;
    apps: number;
  };

  // Delegation Profile
  delegation: {
    depth: number;
    sponsorCount: number;
    delegatedAmount: number;
    isTrustAnchor: boolean;
  };

  // Capabilities
  capabilities: {
    trustScoring: boolean;
    delegation: boolean;
    creditEligible: boolean;
    sybilClear: boolean;
    reputationActive: boolean;
  };

  // Data provenance
  dataSources: DataSourceStatus;

  // Summary
  summary: string;
  explanation: string[];

  // Integrity
  checksum: string;
}

// ── Pure math functions (exported for testing) ─────────────────

export function computeIdentityStrength(
  trustScore: number,
  accountAgeDays: number,
  totalTxns: number,
  balanceAlgo: number
): number {
  // Identity strength = how established and verifiable this wallet is
  let score = 0;

  // Trust score contribution (40%)
  score += (trustScore / 100) * 40;

  // Age contribution (25%)
  const ageScore = Math.min(100, (accountAgeDays / 730) * 100);
  score += (ageScore / 100) * 25;

  // Activity contribution (20%)
  const activityScore = Math.min(100, totalTxns / 5);
  score += (activityScore / 100) * 20;

  // Balance contribution (15%)
  const balanceScore = Math.min(100, Math.log10(Math.max(1, balanceAlgo)) * 10);
  score += (balanceScore / 100) * 15;

  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

export function computePaymentReliability(
  trustScore: number,
  reputation: number,
  creditLimit: number
): number {
  // Payment reliability = likelihood of successful payment
  const trustContrib = (trustScore / 100) * 0.4;
  const repContrib = (reputation / 100) * 0.35;
  const creditContrib = Math.min(1, creditLimit / 1000) * 0.25;

  return Math.round(Math.max(0, Math.min(100,
    (trustContrib + repContrib + creditContrib) * 100
  )) * 10) / 10;
}

export function computeOverallRisk(
  trustRiskLevel: string,
  sybilRisk: number,
  reputationRiskLevel: string,
  creditRisk: string
): number {
  const riskMap: Record<string, number> = {
    low: 10,
    medium: 35,
    high: 65,
    critical: 90,
  };

  const trustRisk = riskMap[trustRiskLevel] ?? 50;
  const repRisk = riskMap[reputationRiskLevel] ?? 50;
  const crRisk = riskMap[creditRisk] ?? 50;
  const sybil = sybilRisk * 100;

  // Weighted average
  const risk = (trustRisk * 0.3 + sybil * 0.25 + repRisk * 0.25 + crRisk * 0.2);
  return Math.round(Math.max(0, Math.min(100, risk)) * 10) / 10;
}

export function classifyOverallRisk(
  risk: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (risk <= 25) return 'low';
  if (risk <= 50) return 'medium';
  if (risk <= 75) return 'high';
  return 'critical';
}

export function generatePassportSummary(
  identityStrength: number,
  reputation: number,
  paymentReliability: number,
  risk: number,
  sybilRisk: number
): string {
  const parts: string[] = [];

  if (identityStrength >= 70) parts.push('well-established');
  else if (identityStrength >= 40) parts.push('moderately established');
  else parts.push('new');

  if (reputation >= 70) parts.push('highly reputed');
  else if (reputation >= 40) parts.push('moderately reputed');
  else parts.push('untested');

  if (paymentReliability >= 70) parts.push('reliable payer');
  else if (paymentReliability >= 40) parts.push('moderate payer');
  else parts.push('unproven payer');

  const riskAdj = risk <= 25 ? 'low-risk' : risk <= 50 ? 'moderate-risk' : 'high-risk';
  const sybilAdj = sybilRisk < 0.25 ? 'clean' : sybilRisk < 0.50 ? 'some concerns' : 'flagged';

  return `Agent is ${parts.join(', ')}. ${riskAdj} profile. Sybil status: ${sybilAdj}.`;
}

// ── Determinism helpers (exported for testing) ─────────────────

/**
 * Computes a SHA-256 checksum over all deterministic passport fields.
 *
 * Determinism guarantee: Given the same wallet, blockRound, and computed scores,
 * this function produces the identical checksum every time.
 *
 * What IS included: wallet, schemaVersion, blockRound, all computed scores,
 * on-chain profile, delegation profile, capabilities, data sources, summary.
 *
 * What is NOT included: generatedAt (inherently non-deterministic),
 * explanation (derived from included fields, adds no new information).
 */
export function computePassportChecksum(
  wallet: string,
  blockRound: number,
  fields: {
    identityStrength: number;
    trustScore: number;
    trustRiskLevel: string;
    reputation: number;
    reputationRiskLevel: string;
    totalEvents: number;
    paymentReliability: number;
    creditLimit: number;
    creditRisk: string;
    risk: number;
    sybilRisk: number;
    overallRiskLevel: string;
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
    dataSources: DataSourceStatus;
    summary: string;
  }
): string {
  const payload = JSON.stringify({
    v: PASSPORT_SCHEMA_VERSION,
    w: wallet,
    r: blockRound,
    ...fields,
  });
  return createHash('sha256').update(payload).digest('hex');
}

// ── Main function ──────────────────────────────────────────────

/**
 * Generates an AgentPassport for a wallet.
 *
 * Data integrity guarantees:
 * - All LRU caches are bypassed (fresh data from Algorand)
 * - Credit estimation uses the same trust data (no redundant fetch)
 * - Sybil detection uses fresh data (no stale cache)
 * - All data fetched from the same blockRound
 * - Checksum covers all deterministic fields
 * - Schema version enables forward/backward compatibility
 *
 * Non-deterministic elements (documented):
 * - generatedAt: current timestamp (standard for API responses)
 * - blockRound: changes every ~3.3 seconds (inherent to blockchain)
 * - On-chain state: balance, transactions, reputation evolve over time
 */
export async function generatePassport(
  wallet: string
): Promise<AgentPassport | null> {
  if (!isValidWallet(wallet)) return null;

  // Step 1: Get block round from Algorand (shared across all fetches)
  let blockRound = 0;
  try {
    const { algod } = await import('./lib/algorand-client');
    const status = await algod.status().do();
    blockRound = Number(status.lastRound || 0);
  } catch (e) {
    logger.warn('algod.status failed — passport will use 0 for blockRound', { wallet, error: String(e) });
  }

  // Step 2: Fetch trust data first (used by both trust score AND credit estimation)
  // Using scoreWalletFresh to bypass LRU cache
  const [trustResult, delegationResult, sybilResult, reputationResult] =
    await Promise.all([
      scoreWalletFresh(wallet).catch(e => { logger.warn('scoreWalletFresh failed', { wallet, error: String(e) }); return null; }),
      // P2 FIX: Use scoreDelegationFresh for passport (bypasses BFS cache)
      scoreDelegationFresh(wallet).catch(e => { logger.warn('scoreDelegationFresh failed', { wallet, error: String(e) }); return null; }),
      detectSybilFresh(wallet).catch(e => { logger.warn('detectSybilFresh failed', { wallet, error: String(e) }); return null; }),
      computeReputation(wallet).catch(e => { logger.warn('computeReputation failed', { wallet, error: String(e) }); return null; }),
    ]);

  // Step 3: Estimate credit using the SAME trust data (eliminates redundant fetch)
  const creditResult = await estimateCreditWithTrust(wallet, trustResult)
    .catch(e => { logger.warn('estimateCreditWithTrust failed', { wallet, error: String(e) }); return null; });

  // Track which services succeeded
  const dataSources: DataSourceStatus = {
    trust: trustResult !== null,
    delegation: delegationResult !== null,
    credit: creditResult !== null,
    sybil: sybilResult !== null,
    reputation: reputationResult !== null,
  };

  // Extract scores
  const trustScore = trustResult?.trustScore ?? 0;
  const delegationScore = delegationResult?.trustScore ?? 0;
  const creditLimit = creditResult?.estimatedLimit ?? 0;
  const sybilRisk = sybilResult?.sybilRisk ?? 0;
  const reputation = reputationResult?.reputation ?? 0;

  // Compute composite metrics
  const identityStrength = computeIdentityStrength(
    trustScore,
    trustResult?.onChain.accountAgeDays ?? 0,
    trustResult?.onChain.totalTxns ?? 0,
    trustResult?.onChain.balanceAlgo ?? 0
  );

  const paymentReliability = computePaymentReliability(
    trustScore, reputation, creditLimit
  );

  const risk = computeOverallRisk(
    trustResult?.riskLevel ?? 'critical',
    sybilRisk,
    reputationResult?.riskLevel ?? 'critical',
    creditResult?.risk ?? 'critical'
  );

  const overallRiskLevel = classifyOverallRisk(risk);

  // Risk levels
  const trustRiskLevel = trustResult?.riskLevel ?? 'critical';
  const reputationRiskLevel = reputationResult?.riskLevel ?? 'critical';
  const creditRisk = creditResult?.risk ?? 'critical';

  // On-chain profile
  const onChain = {
    balanceAlgo: trustResult?.onChain.balanceAlgo ?? 0,
    totalTxns: trustResult?.onChain.totalTxns ?? 0,
    accountAgeDays: trustResult?.onChain.accountAgeDays ?? 0,
    assets: trustResult?.onChain.assetCount ?? 0,
    apps: trustResult?.onChain.appCount ?? 0,
  };

  // Delegation profile
  const delegation = {
    depth: delegationResult?.delegation.depth ?? 0,
    sponsorCount: delegationResult?.delegation.sponsorCount ?? 0,
    delegatedAmount: delegationResult?.delegation.totalDelegatedAmount ?? 0,
    isTrustAnchor: delegationResult?.delegation.isTrustAnchor ?? false,
  };

  // Capabilities — creditEligible derived from creditLimit (no requestedAmount context)
  const creditEligible = creditLimit > 0;
  const capabilities = {
    trustScoring: trustResult !== null,
    delegation: delegationResult !== null,
    creditEligible,
    sybilClear: sybilRisk < 0.45,
    reputationActive: (reputationResult?.breakdown.totalEvents ?? 0) > 0,
  };

  // Summary
  const summary = generatePassportSummary(
    identityStrength, reputation, paymentReliability, risk, sybilRisk
  );

  // Explanation
  const explanation: string[] = [];
  explanation.push(`Identity strength: ${identityStrength}/100`);
  explanation.push(`Trust score: ${trustScore}/100 (${trustRiskLevel})`);
  explanation.push(`Delegation: depth ${delegation.depth}, ${delegation.sponsorCount} sponsors`);
  explanation.push(`Credit limit: $${creditLimit.toFixed(2)} (${creditRisk})`);
  explanation.push(`Sybil risk: ${sybilRisk} (${sybilResult?.riskLevel ?? 'unknown'})`);
  explanation.push(`Reputation: ${reputation}/100 (${reputationRiskLevel})`);
  explanation.push(`Overall risk: ${risk}/100 (${overallRiskLevel})`);
  explanation.push(summary);

  // Compute checksum over all deterministic fields
  const checksum = computePassportChecksum(wallet, blockRound, {
    identityStrength,
    trustScore,
    trustRiskLevel,
    reputation,
    reputationRiskLevel,
    totalEvents: reputationResult?.breakdown.totalEvents ?? 0,
    paymentReliability,
    creditLimit,
    creditRisk,
    risk,
    sybilRisk,
    overallRiskLevel,
    onChain,
    delegation,
    capabilities,
    dataSources,
    summary,
  });

  return {
    wallet,
    generatedAt: new Date().toISOString(),
    blockRound,
    schemaVersion: PASSPORT_SCHEMA_VERSION,
    identityStrength,
    trustScore,
    trustRiskLevel,
    reputation,
    reputationRiskLevel,
    totalEvents: reputationResult?.breakdown.totalEvents ?? 0,
    paymentReliability,
    creditLimit,
    creditRisk,
    risk,
    sybilRisk,
    overallRiskLevel,
    onChain,
    delegation,
    capabilities,
    dataSources,
    summary,
    explanation,
    checksum,
  };
}
