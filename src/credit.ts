import { scoreWallet } from './trust-score';
import { scoreDelegation } from './delegation';

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

// ── Pure math functions (exported for testing) ─────────────────

export function computeBalanceCapacity(balanceAlgo: number): number {
  return Math.min(1000, Math.max(0, balanceAlgo * 0.5));
}

export function computeActivityBonus(totalTxns: number): number {
  return Math.min(200, Math.max(0, totalTxns * 2));
}

export function computeAgeBonus(accountAgeDays: number): number {
  return Math.min(150, Math.max(0, (accountAgeDays / 365) * 150));
}

export function computeDelegationBonus(delegationScore: number): number {
  return Math.min(300, Math.max(0, delegationScore * 3));
}

export function computeRiskPenalty(velocityScore: number, complianceScore: number): number {
  let penalty = 0;
  if (velocityScore < 40) penalty += 50;
  if (complianceScore < 60) penalty += 100;
  return penalty;
}

export function computeCreditLimit(breakdown: {
  balanceCapacity: number;
  activityBonus: number;
  ageBonus: number;
  delegationBonus: number;
  riskPenalty: number;
}): number {
  const raw = breakdown.balanceCapacity + breakdown.activityBonus +
    breakdown.ageBonus + breakdown.delegationBonus - breakdown.riskPenalty;
  return Math.round(Math.max(0, Math.min(5000, raw)) * 100) / 100;
}

export function classifyCreditRisk(
  limit: number,
  requestedAmount?: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (requestedAmount && requestedAmount > 0) {
    const ratio = limit / requestedAmount;
    if (ratio >= 2.0) return 'low';
    if (ratio >= 1.2) return 'medium';
    if (ratio >= 0.8) return 'high';
    return 'critical';
  }

  if (limit >= 500) return 'low';
  if (limit >= 200) return 'medium';
  if (limit >= 50) return 'high';
  return 'critical';
}

export function computeCreditConfidence(dataPoints: number): number {
  return Math.round(Math.max(0.40, Math.min(0.95, 0.40 + dataPoints * 0.12)) * 100) / 100;
}

export function generateCreditExplanation(
  balanceAlgo: number,
  totalTxns: number,
  accountAgeDays: number,
  delegationScore: number,
  estimatedLimit: number,
  requestedAmount?: number,
  approved?: boolean
): string[] {
  const reasons: string[] = [];

  if (balanceAlgo > 100) {
    reasons.push(`Balance: ${balanceAlgo.toFixed(2)} ALGO — strong collateral base`);
  } else if (balanceAlgo > 1) {
    reasons.push(`Balance: ${balanceAlgo.toFixed(4)} ALGO — moderate collateral`);
  } else {
    reasons.push(`Balance: ${balanceAlgo.toFixed(6)} ALGO — minimal collateral`);
  }

  if (accountAgeDays > 365) {
    reasons.push(`${Math.floor(accountAgeDays / 365)}+ year account history`);
  } else if (accountAgeDays > 30) {
    reasons.push(`${Math.floor(accountAgeDays / 30)}-month account history`);
  } else {
    reasons.push('New account with limited history');
  }

  if (totalTxns > 100) {
    reasons.push(`${totalTxns} transactions — strong activity proof`);
  } else if (totalTxns > 10) {
    reasons.push(`${totalTxns} transactions — moderate activity`);
  } else {
    reasons.push(`${totalTxns} transactions — limited activity`);
  }

  if (delegationScore > 70) {
    reasons.push(`Well-sponsored (delegation score: ${delegationScore})`);
  } else if (delegationScore > 0) {
    reasons.push(`Moderately sponsored (delegation score: ${delegationScore})`);
  }

  if (requestedAmount && approved !== undefined) {
    if (approved) {
      reasons.push(`Request ($${requestedAmount}) within estimated capacity of $${estimatedLimit.toFixed(2)}`);
    } else {
      reasons.push(`Request ($${requestedAmount}) exceeds estimated capacity of $${estimatedLimit.toFixed(2)}`);
    }
  }

  return reasons;
}

// ── Main function ──────────────────────────────────────────────

export async function estimateCredit(
  wallet: string,
  requestedAmount?: number
): Promise<CreditEstimate | null> {
  if (!/^[A-Z2-7]{58}$/.test(wallet)) return null;

  const [onChainResult, delegationResult] = await Promise.all([
    scoreWallet(wallet),
    scoreDelegation(wallet),
  ]);

  const balanceAlgo = onChainResult?.onChain.balanceAlgo ?? 0;
  const totalTxns = onChainResult?.onChain.totalTxns ?? 0;
  const accountAgeDays = onChainResult?.onChain.accountAgeDays ?? 0;
  const velocityScore = onChainResult?.breakdown.velocityScore ?? 50;
  const complianceScore = onChainResult?.breakdown.complianceScore ?? 50;
  const delegationScore = delegationResult?.trustScore ?? 0;

  const breakdown = {
    balanceCapacity: computeBalanceCapacity(balanceAlgo),
    activityBonus: computeActivityBonus(totalTxns),
    ageBonus: computeAgeBonus(accountAgeDays),
    delegationBonus: computeDelegationBonus(delegationScore),
    riskPenalty: computeRiskPenalty(velocityScore, complianceScore),
  };

  const estimatedLimit = computeCreditLimit(breakdown);
  const risk = classifyCreditRisk(estimatedLimit, requestedAmount);
  const approved = requestedAmount && requestedAmount > 0
    ? estimatedLimit >= requestedAmount
    : true;

  // Count data points for confidence
  let dataPoints = 0;
  if (balanceAlgo > 1) dataPoints++;
  if (totalTxns > 10) dataPoints++;
  if (accountAgeDays > 30) dataPoints++;
  if (delegationScore > 0) dataPoints++;
  if (complianceScore >= 80) dataPoints++;
  const confidence = computeCreditConfidence(dataPoints);

  const explanation = generateCreditExplanation(
    balanceAlgo, totalTxns, accountAgeDays, delegationScore,
    estimatedLimit, requestedAmount, approved
  );

  return {
    wallet,
    estimatedLimit,
    risk,
    confidence,
    approved,
    breakdown,
    explanation,
  };
}
