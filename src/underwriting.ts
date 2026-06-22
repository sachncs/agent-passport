import { scoreWallet } from './trust-score';
import { scoreDelegation } from './delegation';
import { estimateCredit } from './credit';
import { detectSybil } from './sybil';
import { computeReputation } from './reputation';

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

// ── Pure math functions (exported for testing) ─────────────────

export function computeCompositeScore(factors: UnderwritingFactor[]): number {
  if (factors.length === 0) return 0;
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  return Math.round(Math.max(0, Math.min(100, weightedSum / totalWeight)) * 10) / 10;
}

export function classifyUnderwritingRisk(
  score: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 70) return 'low';
  if (score >= 45) return 'medium';
  if (score >= 20) return 'high';
  return 'critical';
}

export function computeUnderwritingLimit(
  compositeScore: number,
  creditLimit: number,
  sybilRisk: number,
  reputation: number
): number {
  // Start with credit limit as base
  let limit = creditLimit;

  // Apply composite score multiplier (0.5 – 1.5)
  const scoreMultiplier = 0.5 + (compositeScore / 100) * 1.0;
  limit *= scoreMultiplier;

  // Apply sybil penalty (0.3 – 1.0)
  const sybilMultiplier = 1.0 - (sybilRisk * 0.7);
  limit *= sybilMultiplier;

  // Apply reputation bonus (1.0 – 1.3)
  const reputationMultiplier = 1.0 + (reputation / 100) * 0.3;
  limit *= reputationMultiplier;

  return Math.round(Math.max(0, Math.min(10000, limit)) * 100) / 100;
}

export function decideApproval(
  compositeScore: number,
  sybilRisk: number,
  reputation: number
): boolean {
  // Deny if sybil risk is critical
  if (sybilRisk >= 0.70) return false;
  // Deny if composite score is too low
  if (compositeScore < 30) return false;
  // Deny if reputation is critical with low score
  if (reputation < 10 && compositeScore < 50) return false;
  return true;
}

export function computeUnderwritingConfidence(
  factors: UnderwritingFactor[]
): number {
  // Confidence based on how many factors have data (non-zero score)
  const factorsWithData = factors.filter(f => f.score > 0).length;
  const totalFactors = factors.length;
  if (totalFactors === 0) return 0.40;
  const coverage = factorsWithData / totalFactors;
  return Math.round(Math.max(0.40, Math.min(0.95, 0.40 + coverage * 0.55)) * 100) / 100;
}

export function generateUnderwritingExplanation(
  factors: UnderwritingFactor[],
  approved: boolean,
  compositeScore: number,
  recommendedLimit: number
): string[] {
  const reasons: string[] = [];

  if (approved) {
    reasons.push(`Approved with composite score ${compositeScore}`);
  } else {
    reasons.push(`Denied — composite score ${compositeScore} below threshold`);
  }

  reasons.push(`Recommended limit: $${recommendedLimit.toFixed(2)}`);

  const positiveFactors = factors.filter(f => f.status === 'positive');
  const negativeFactors = factors.filter(f => f.status === 'negative');

  if (positiveFactors.length > 0) {
    reasons.push(`Strong signals: ${positiveFactors.map(f => f.name).join(', ')}`);
  }
  if (negativeFactors.length > 0) {
    reasons.push(`Weak signals: ${negativeFactors.map(f => f.name).join(', ')}`);
  }

  const criticalFactors = factors.filter(f => f.score < 20);
  if (criticalFactors.length > 0) {
    reasons.push(`Critical concerns: ${criticalFactors.map(f => f.name).join(', ')}`);
  }

  return reasons;
}

// ── Main function ──────────────────────────────────────────────

export async function underwrite(
  wallet: string
): Promise<UnderwritingDecision | null> {
  if (!/^[A-Z2-7]{58}$/.test(wallet)) return null;

  // Fetch all 6 services in parallel
  const [trustResult, delegationResult, creditResult, sybilResult, reputationResult] =
    await Promise.all([
      scoreWallet(wallet),
      scoreDelegation(wallet),
      estimateCredit(wallet),
      detectSybil(wallet),
      computeReputation(wallet),
    ]);

  // Build factors from each service
  const factors: UnderwritingFactor[] = [];

  // Factor 1: Trust Score (weight: 0.25)
  const trustScore = trustResult?.trustScore ?? 0;
  factors.push({
    name: 'Trust Score',
    score: trustScore,
    weight: 0.25,
    contribution: trustScore * 0.25,
    status: trustScore >= 70 ? 'positive' : trustScore >= 40 ? 'neutral' : 'negative',
  });

  // Factor 2: Delegation (weight: 0.15)
  const delegationScore = delegationResult?.trustScore ?? 0;
  factors.push({
    name: 'Delegation Trust',
    score: delegationScore,
    weight: 0.15,
    contribution: delegationScore * 0.15,
    status: delegationScore >= 70 ? 'positive' : delegationScore >= 40 ? 'neutral' : 'negative',
  });

  // Factor 3: Credit Capacity (weight: 0.20)
  const creditScore = creditResult
    ? Math.min(100, (creditResult.estimatedLimit / 5000) * 100)
    : 0;
  factors.push({
    name: 'Credit Capacity',
    score: creditScore,
    weight: 0.20,
    contribution: creditScore * 0.20,
    status: creditScore >= 70 ? 'positive' : creditScore >= 40 ? 'neutral' : 'negative',
  });

  // Factor 4: Sybil Risk (weight: 0.15) — inverted (low sybil = high score)
  const sybilScore = sybilResult ? (1 - sybilResult.sybilRisk) * 100 : 50;
  factors.push({
    name: 'Sybil Resistance',
    score: sybilScore,
    weight: 0.15,
    contribution: sybilScore * 0.15,
    status: sybilScore >= 70 ? 'positive' : sybilScore >= 40 ? 'neutral' : 'negative',
  });

  // Factor 5: Reputation (weight: 0.15)
  const reputationScore = reputationResult?.reputation ?? 0;
  factors.push({
    name: 'Reputation',
    score: reputationScore,
    weight: 0.15,
    contribution: reputationScore * 0.15,
    status: reputationScore >= 70 ? 'positive' : reputationScore >= 40 ? 'neutral' : 'negative',
  });

  // Factor 6: On-chain Activity (weight: 0.10)
  const activityScore = trustResult
    ? Math.min(100, trustResult.breakdown.activityScore)
    : 0;
  factors.push({
    name: 'On-chain Activity',
    score: activityScore,
    weight: 0.10,
    contribution: activityScore * 0.10,
    status: activityScore >= 70 ? 'positive' : activityScore >= 40 ? 'neutral' : 'negative',
  });

  // Compute composite score
  const compositeScore = computeCompositeScore(factors);

  // Decision
  const sybilRisk = sybilResult?.sybilRisk ?? 0;
  const reputation = reputationResult?.reputation ?? 0;
  const approved = decideApproval(compositeScore, sybilRisk, reputation);
  const riskLevel = classifyUnderwritingRisk(compositeScore);

  // Recommended limit
  const creditLimit = creditResult?.estimatedLimit ?? 0;
  const recommendedLimit = approved
    ? computeUnderwritingLimit(compositeScore, creditLimit, sybilRisk, reputation)
    : 0;

  // Confidence
  const confidence = computeUnderwritingConfidence(factors);

  // Explanation
  const explanation = generateUnderwritingExplanation(
    factors, approved, compositeScore, recommendedLimit
  );

  return {
    wallet,
    approved,
    recommendedLimit,
    riskLevel,
    confidence,
    compositeScore,
    factors,
    explanation,
  };
}
