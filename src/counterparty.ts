import { scoreDelegation } from './delegation';
import { scoreWallet } from './trust-score';
import { isValidWallet } from './lib/constants';
import { checkSanctions } from './lib/sanctions';

export interface CounterpartyResult {
  allow: boolean;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  trustScore: number;
  onChainScore: number;
  delegationScore: number;
  explanation: string[];
  sanctions?: {
    status: 'allowed' | 'denied' | 'unknown';
    reason?: string;
    provider: string;
  };
}

// ── Pure math functions (exported for testing) ─────────────────

export function computeCombinedScore(onChainScore: number, delegationScore: number): number {
  return Math.round((0.6 * onChainScore + 0.4 * delegationScore) * 10) / 10;
}

export function computeConfidence(combinedScore: number): number {
  let confidence: number;
  if (combinedScore >= 60) {
    confidence = 0.7 + (combinedScore - 60) / 40 * 0.3;
  } else if (combinedScore >= 40) {
    confidence = 0.5 + (combinedScore - 40) / 20 * 0.2;
  } else {
    confidence = 0.3 + combinedScore / 40 * 0.2;
  }
  return Math.round(Math.max(0.3, Math.min(1.0, confidence)) * 100) / 100;
}

/**
 * Decides whether to allow a counterparty.
 *
 * Design rationale:
 * - Score threshold (40): minimum trust score for approval
 * - Confidence threshold (0.45): prevents low-confidence approvals
 *   A wallet with score 40 and confidence 0.30 has insufficient data
 *   to make a reliable decision — deny and request more data
 * - Combined threshold ensures both signal strength AND signal reliability
 */
export function decideAllow(combinedScore: number, confidence = 1.0): boolean {
  return combinedScore >= 40 && confidence >= 0.45;
}

export function classifyCounterpartyRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 70) return 'low';
  if (score >= 45) return 'medium';
  if (score >= 20) return 'high';
  return 'critical';
}

export function generateCounterpartyExplanation(
  onChainScore: number,
  delegationScore: number,
  combinedScore: number,
  allow: boolean,
  confidence: number
): string[] {
  const reasons: string[] = [];

  // On-chain assessment
  if (onChainScore >= 70) {
    reasons.push(`Strong on-chain history (score: ${onChainScore})`);
  } else if (onChainScore >= 40) {
    reasons.push(`Moderate on-chain history (score: ${onChainScore})`);
  } else {
    reasons.push(`Weak on-chain history (score: ${onChainScore})`);
  }

  // Delegation assessment
  if (delegationScore >= 70) {
    reasons.push(`Well-sponsored (delegation score: ${delegationScore})`);
  } else if (delegationScore >= 40) {
    reasons.push(`Moderately sponsored (delegation score: ${delegationScore})`);
  } else if (delegationScore > 0) {
    reasons.push(`Limited sponsorship (delegation score: ${delegationScore})`);
  } else {
    reasons.push('No delegation data available');
  }

  // Decision
  if (allow) {
    reasons.push(`Approved with ${Math.round(confidence * 100)}% confidence`);
  } else {
    reasons.push(`Denied — combined score ${combinedScore} below threshold`);
  }

  return reasons;
}

// ── Main function ──────────────────────────────────────────────

export async function checkCounterparty(buyer: string): Promise<CounterpartyResult | null> {
  if (!isValidWallet(buyer)) return null;

  const [onChainResult, delegationResult, sanctions] = await Promise.all([
    scoreWallet(buyer),
    scoreDelegation(buyer),
    checkSanctions(buyer),
  ]);

  const onChainScore = onChainResult?.trustScore ?? 0;
  const delegationScore = delegationResult?.trustScore ?? 0;

  const trustScore = computeCombinedScore(onChainScore, delegationScore);
  const confidence = computeConfidence(trustScore);
  const baseAllow = decideAllow(trustScore, confidence);
  // Sanctions fail-closed: denied or unknown screening -> deny.
  const allow = baseAllow && sanctions.status === 'allowed';
  const riskLevel = classifyCounterpartyRisk(trustScore);

  const explanation = generateCounterpartyExplanation(
    onChainScore,
    delegationScore,
    trustScore,
    allow,
    confidence
  );

  if (sanctions.status === 'denied') {
    explanation.push(`Denied — wallet on sanctions deny list (provider: ${sanctions.provider})`);
  } else if (sanctions.status === 'unknown') {
    explanation.push(`Denied — sanctions provider unavailable (${sanctions.provider})`);
  }

  return {
    allow,
    confidence,
    riskLevel,
    trustScore,
    onChainScore,
    delegationScore,
    explanation,
    sanctions: {
      status: sanctions.status,
      reason: sanctions.reason,
      provider: sanctions.provider,
    },
  };
}
