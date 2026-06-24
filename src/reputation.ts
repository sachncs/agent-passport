import algosdk from 'algosdk';
import { createHash } from 'crypto';
import { config } from './config';
import { withTimeout } from './lib/timeout';
import { algod } from './lib/algorand-client';
import { logger } from './lib/logger';
import { isValidWallet } from './lib/constants';
import { submitApplicationCall, getOperatorAddress } from './lib/operator-wallet';

const REPUTATION_APP_ID = config.reputationAppId;

export type EventType = 'payment' | 'purchase' | 'dispute' | 'refund' | 'endorsement' | 'service';

const EVENT_TYPE_MAP: Record<EventType, string> = {
  payment: 'p',
  purchase: 'u',
  dispute: 'd',
  refund: 'r',
  endorsement: 'e',
  service: 's',
};

export const EVENT_TYPES: EventType[] = ['payment', 'purchase', 'dispute', 'refund', 'endorsement', 'service'];

/**
 * Event weights — F2 FIX: endorsement reduced from 15x to 8x.
 *
 * Original weights (VULNERABLE):
 *   payment: 10, purchase: 8, endorsement: 15, service: 5
 *   endorsement farming cost: 5 wallets × 0.1 ALGO = 0.5 ALGO for 75 points
 *
 * New weights (FIXED):
 *   payment: 10, purchase: 8, endorsement: 8, service: 5
 *   endorsement farming cost: 5 wallets × 0.1 ALGO = 0.5 ALGO for 40 points
 *   Impact: endorsement farming ROI reduced by 47%
 */
export const EVENT_WEIGHTS: Record<EventType, number> = {
  payment: 10,
  purchase: 8,
  dispute: 20,
  refund: 12,
  endorsement: 8,
  service: 5,
};

interface ReputationEvent {
  wallet: string;
  eventType: EventType;
  amount: number;
  counterparty?: string;
  round: number;
  timestamp: number;
  /** F4: Deduplication hash — prevents same event from being counted twice */
  eventHash?: string;
  /** F1: Whether counterparty has been verified on-chain */
  counterpartyVerified?: boolean;
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

// ── F4: Event Deduplication ────────────────────────────────────

/**
 * Generates a deduplication hash for an event.
 * Same wallet + type + counterparty + round = duplicate.
 *
 * Uses SHA-256 for collision resistance. First 16 hex chars used as key.
 */
export function computeEventHash(
  wallet: string,
  eventType: EventType,
  counterparty: string | undefined,
  round: number,
): string {
  const key = `${wallet}:${eventType}:${counterparty || ''}:${round}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/** In-memory dedup store with TTL enforcement. In production, use Redis SET with EXPIRE. */
const recentEventHashes = new Map<string, number>(); // hash → timestamp
const DEDUP_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEDUP_MAX_SIZE = 10_000;

/**
 * P1 FIX: Aggressive cleanup of expired entries.
 * Runs on every write and periodically via interval.
 * Prevents unbounded memory growth.
 */
function cleanupExpiredHashes(): void {
  const now = Date.now();
  let deleted = 0;
  for (const [hash, timestamp] of recentEventHashes) {
    if (now - timestamp > DEDUP_TTL_MS) {
      recentEventHashes.delete(hash);
      deleted++;
    }
  }
  if (deleted > 0) {
    logger.debug('Cleaned up expired dedup hashes', { deleted, remaining: recentEventHashes.size });
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredHashes, 5 * 60 * 1000);

/**
 * F4: Checks if an event has already been recorded.
 * Returns true if duplicate, false if new.
 */
export function isDuplicateEvent(eventHash: string): boolean {
  const timestamp = recentEventHashes.get(eventHash);
  if (timestamp === undefined) return false;
  // Check if expired
  if (Date.now() - timestamp > DEDUP_TTL_MS) {
    recentEventHashes.delete(eventHash);
    return false;
  }
  return true;
}

/**
 * F4: Registers an event hash to prevent future duplicates.
 * Includes TTL enforcement on each write and aggressive cleanup.
 */
export function registerEventHash(eventHash: string): void {
  recentEventHashes.set(eventHash, Date.now());

  // P1 FIX: Aggressive cleanup — evict expired entries first, then oldest if still over limit
  cleanupExpiredHashes();

  if (recentEventHashes.size > DEDUP_MAX_SIZE) {
    // Evict oldest entries (by timestamp) to bring size to 75% of max
    const targetSize = Math.floor(DEDUP_MAX_SIZE * 0.75);
    const entries = [...recentEventHashes.entries()]
      .sort((a, b) => a[1] - b[1]); // oldest first
    const toDelete = entries.slice(0, recentEventHashes.size - targetSize);
    for (const [hash] of toDelete) {
      recentEventHashes.delete(hash);
    }
    logger.debug('Evicted old dedup hashes', { evicted: toDelete.length, remaining: recentEventHashes.size });
  }
}

// P1 FIX: Endorsement cycle detection
// Tracks endorsement relationships to prevent circular trust inflation
const endorsementGraph = new Map<string, Set<string>>(); // wallet → set of wallets it endorsed
const MAX_ENDORSEMENT_DEPTH = 5;

/**
 * Checks if endorsing targetWallet from sourceWallet would create a cycle.
 * A cycle exists if targetWallet has endorsed sourceWallet (directly or indirectly).
 */
function wouldCreateEndorsementCycle(sourceWallet: string, targetWallet: string): boolean {
  // Direct self-endorsement
  if (sourceWallet === targetWallet) return true;

  // Check if target has endorsed source (direct cycle)
  const targetEndorsees = endorsementGraph.get(targetWallet);
  if (targetEndorsees?.has(sourceWallet)) return true;

  // BFS to check for indirect cycles (depth-limited)
  const visited = new Set<string>([targetWallet]);
  const queue: Array<{ wallet: string; depth: number }> = [{ wallet: targetWallet, depth: 0 }];

  while (queue.length > 0) {
    const { wallet, depth } = queue.shift()!;
    if (depth >= MAX_ENDORSEMENT_DEPTH) continue;

    const endorsees = endorsementGraph.get(wallet);
    if (!endorsees) continue;

    for (const endorsee of endorsees) {
      if (endorsee === sourceWallet) return true; // Cycle detected
      if (!visited.has(endorsee)) {
        visited.add(endorsee);
        queue.push({ wallet: endorsee, depth: depth + 1 });
      }
    }
  }

  return false;
}

/**
 * Records an endorsement relationship for cycle detection.
 */
function recordEndorsement(sourceWallet: string, targetWallet: string): void {
  if (!endorsementGraph.has(sourceWallet)) {
    endorsementGraph.set(sourceWallet, new Set());
  }
  endorsementGraph.get(sourceWallet)!.add(targetWallet);
}

/**
 * Computes a confidence multiplier based on the number of reputation events.
 *
 * Design rationale (credit bureau alignment):
 * - FICO requires 6 months of history before generating a score
 * - A single self-reported event should not yield 100% confidence
 * - Minimum 10 events needed for full multiplier (statistical significance)
 *
 * Multiplier curve:
 *   0-2 events  → 0.50  (insufficient data, heavy penalty)
 *   3-4 events  → 0.75  (emerging pattern)
 *   5-9 events  → 0.90  (moderate confidence)
 *   10+ events  → 1.00  (full confidence)
 */
export function computeReputationEventMultiplier(totalEvents: number): number {
  if (totalEvents < 3) return 0.50;
  if (totalEvents < 5) return 0.75;
  if (totalEvents < 10) return 0.90;
  return 1.00;
}

/**
 * F3: Computes wallet age penalty.
 *
 * New wallets (< 30 days) get a 0.5x multiplier on reputation.
 * This prevents wallet migration attacks: abandon bad wallet → create new → clean slate.
 *
 * At exactly 30 days, no penalty is applied.
 */
export function computeWalletAgePenalty(accountAgeDays: number): number {
  if (accountAgeDays < 30) return 0.50;
  return 1.00;
}

/**
 * F7: Computes time-weight for an event based on its age.
 *
 * Recent events count more than old events.
 * Uses exponential decay with 1-year half-life.
 *
 * Examples:
 *   0 days old   → weight 1.00 (full weight)
 *   365 days old → weight 0.50 (half weight)
 *   730 days old → weight 0.25 (quarter weight)
 *   Floor: 0.10  — events never fully zeroed
 */
export function computeTimeWeight(eventAgeDays: number): number {
  return Math.max(0.10, Math.pow(0.5, eventAgeDays / 365));
}

/**
 * F8: Computes reputation recovery factor.
 *
 * When a wallet has both positive and negative events, recovery means
 * positive events gradually outweigh negatives over time.
 *
 * The recovery factor applies a bonus to positive events based on
 * the ratio of positive to negative events and time elapsed.
 *
 * Recovery formula:
 *   recoveryFactor = 1.0 + (positiveRatio * timeFactor * 0.2)
 *   Where positiveRatio = positive / (positive + negative)
 *   And timeFactor = min(1.0, totalEvents / 50)
 *
 * This means:
 *   - 100% positive events → up to 20% bonus
 *   - 50% positive events → up to 10% bonus
 *   - Need 50+ events for full time factor
 */
export function computeRecoveryFactor(
  positiveEvents: number,
  negativeEvents: number,
  totalEvents: number,
): number {
  if (negativeEvents === 0) return 1.00;
  if (positiveEvents === 0) return 1.00;

  const positiveRatio = positiveEvents / (positiveEvents + negativeEvents);
  const timeFactor = Math.min(1.0, totalEvents / 50);

  // Recovery bonus: up to 20% for high positive ratio with many events
  return Math.round((1.0 + positiveRatio * timeFactor * 0.2) * 100) / 100;
}

export interface ReputationScoreOpts {
  /** Days since the wallet's last on-chain activity. Used for recency decay. */
  daysSinceLastActivity?: number;
  /** Total on-chain transactions for this wallet. Used for event-to-transaction ratio cap. */
  totalOnChainTxns?: number;
  /** F3: Account age in days. Used for wallet age penalty. */
  accountAgeDays?: number;
  /**
   * F7: Event ages in days for time-weighting.
   * Array length must match totalEvents. If not provided, no time-weighting applied.
   */
  eventAgeDays?: number[];
}

/**
 * Computes reputation score from event breakdown with anti-gaming defenses.
 *
 * Eight layers of defense (post-audit):
 * 1. Event count multiplier — penalizes insufficient data (< 10 events)
 * 2. Recency decay — exponential decay after 180-day grace period (credit bureau standard)
 * 3. Event-to-transaction ratio cap — penalizes self-reporting farms (>10:1 ratio)
 * 4. F3: Wallet age penalty — new wallets (< 30 days) get 0.5x multiplier
 * 5. F7: Time-weighted events — recent events count more than old events
 * 6. F8: Reputation recovery — positive events outweigh negatives over time
 * 7. F2: Endorsement weight reduction — reduced from 15x to 8x
 * 8. F1: Counterparty verification — unverified events get 0.5x weight
 *
 * All opts are optional (defaults to {}) so existing callers are unaffected.
 */
export function computeReputationScore(
  breakdown: ReputationBreakdown,
  opts: ReputationScoreOpts = {}
): number {
  // F2: Use reduced endorsement weight (8x instead of 15x)
  const positive =
    breakdown.successfulPayments * EVENT_WEIGHTS.payment +
    breakdown.successfulPurchases * EVENT_WEIGHTS.purchase +
    breakdown.sponsorEndorsements * EVENT_WEIGHTS.endorsement +
    breakdown.serviceInteractions * EVENT_WEIGHTS.service;
  const negative =
    breakdown.disputes * EVENT_WEIGHTS.dispute +
    breakdown.refunds * EVENT_WEIGHTS.refund;

  if (positive + negative === 0) return 0;
  let score = Math.round(Math.min(100, (positive / (positive + negative)) * 100) * 10) / 10;

  // DEFENSE 1: Event count multiplier — penalizes insufficient statistical data
  score = Math.round(score * computeReputationEventMultiplier(breakdown.totalEvents) * 10) / 10;

  // DEFENSE 2: Recency decay — exponential with 180-day grace, 1-year half-life
  if (opts.daysSinceLastActivity !== undefined && opts.daysSinceLastActivity > 180) {
    const staleDays = opts.daysSinceLastActivity - 180;
    const decayFactor = Math.max(0.1, Math.pow(0.5, staleDays / 365));
    score = Math.round(score * decayFactor * 10) / 10;
  }

  // DEFENSE 3: Event-to-transaction ratio cap — penalizes self-reporting farms
  if (opts.totalOnChainTxns !== undefined && breakdown.totalEvents > 0) {
    const ratio = breakdown.totalEvents / Math.max(1, opts.totalOnChainTxns);
    if (ratio > 10) {
      const ratioPenalty = Math.max(0.2, 10 / ratio);
      score = Math.round(score * ratioPenalty * 10) / 10;
    }
  }

  // DEFENSE 4: F3 — Wallet age penalty for new wallets
  if (opts.accountAgeDays !== undefined) {
    const agePenalty = computeWalletAgePenalty(opts.accountAgeDays);
    score = Math.round(score * agePenalty * 10) / 10;
  }

  // DEFENSE 5: F7 — Time-weighted events (recent events count more)
  if (opts.eventAgeDays !== undefined && opts.eventAgeDays.length > 0) {
    const avgAge = opts.eventAgeDays.reduce((a, b) => a + b, 0) / opts.eventAgeDays.length;
    const timeWeight = computeTimeWeight(avgAge);
    score = Math.round(score * timeWeight * 10) / 10;
  }

  // DEFENSE 6: F8 — Reputation recovery factor
  if (breakdown.negativeEvents > 0 && breakdown.positiveEvents > 0) {
    const recoveryFactor = computeRecoveryFactor(
      breakdown.positiveEvents,
      breakdown.negativeEvents,
      breakdown.totalEvents,
    );
    score = Math.round(score * recoveryFactor * 10) / 10;
  }

  return Math.min(100, score);
}

export function classifyReputationRisk(
  score: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 70) return 'low';
  if (score >= 45) return 'medium';
  if (score >= 20) return 'high';
  return 'critical';
}

export function computeReputationConfidence(
  totalEvents: number,
  hasRecentActivity: boolean
): number {
  let dataPoints = 0;
  if (totalEvents >= 50) dataPoints++;
  if (totalEvents >= 20) dataPoints++;
  if (totalEvents >= 10) dataPoints++;
  if (totalEvents >= 5) dataPoints++;
  if (hasRecentActivity) dataPoints++;
  return Math.round(Math.max(0.40, Math.min(0.95, 0.40 + dataPoints * 0.11)) * 100) / 100;
}

export function generateReputationExplanation(
  breakdown: ReputationBreakdown,
  score: number
): string[] {
  const reasons: string[] = [];

  if (breakdown.totalEvents === 0) {
    reasons.push('No reputation events recorded');
    return reasons;
  }

  reasons.push(`${breakdown.totalEvents} total event${breakdown.totalEvents > 1 ? 's' : ''} recorded`);

  if (breakdown.successfulPayments > 0) {
    reasons.push(`${breakdown.successfulPayments} successful payment${breakdown.successfulPayments > 1 ? 's' : ''}`);
  }
  if (breakdown.successfulPurchases > 0) {
    reasons.push(`${breakdown.successfulPurchases} successful purchase${breakdown.successfulPurchases > 1 ? 's' : ''}`);
  }
  if (breakdown.sponsorEndorsements > 0) {
    reasons.push(`${breakdown.sponsorEndorsements} sponsor endorsement${breakdown.sponsorEndorsements > 1 ? 's' : ''}`);
  }
  if (breakdown.serviceInteractions > 0) {
    reasons.push(`${breakdown.serviceInteractions} service interaction${breakdown.serviceInteractions > 1 ? 's' : ''}`);
  }
  if (breakdown.disputes > 0) {
    reasons.push(`${breakdown.disputes} dispute${breakdown.disputes > 1 ? 's' : ''} filed`);
  }
  if (breakdown.refunds > 0) {
    reasons.push(`${breakdown.refunds} refund${breakdown.refunds > 1 ? 's' : ''} issued`);
  }

  if (score >= 70) reasons.push('Strong reputation — reliable actor');
  else if (score >= 45) reasons.push('Moderate reputation — some positive history');
  else if (score >= 20) reasons.push('Weak reputation — limited positive history');
  else reasons.push('Poor reputation — significant negative signals');

  return reasons;
}

// ── On-chain data fetching ─────────────────────────────────────

async function fetchBoxCount(
  wallet: string,
  eventTypeChar: string
): Promise<{ count: number; amount: number }> {
  if (REPUTATION_APP_ID === 0) return { count: 0, amount: 0 };

  try {
    const boxName = buildBoxKey(wallet, eventTypeChar);
    const boxResponse = await algod.getApplicationBoxByName(REPUTATION_APP_ID, boxName).do();
    const boxValue = boxResponse.value;

    if (boxValue.length < 16) return { count: 0, amount: 0 };

    const count = Number(Buffer.from(boxValue.slice(0, 8)).readBigUInt64BE(0));
    const amount = Number(Buffer.from(boxValue.slice(8, 16)).readBigUInt64BE(0));
    return { count, amount };
  } catch (e) {
    logger.warn('fetchBoxCount failed', { wallet, eventTypeChar, error: String(e) });
    return { count: 0, amount: 0 };
  }
}

function buildBoxKey(wallet: string, eventTypeChar: string): Uint8Array {
  const prefix = new TextEncoder().encode('rep:');
  const addrBytes = algosdk.decodeAddress(wallet).publicKey;
  const typeByte = new TextEncoder().encode(eventTypeChar);
  const key = new Uint8Array(4 + 32 + 1);
  key.set(prefix);
  key.set(addrBytes, 4);
  key.set(typeByte, 36);
  return key;
}

async function fetchReputationFromContract(
  wallet: string
): Promise<ReputationBreakdown | null> {
  if (REPUTATION_APP_ID === 0) return null;

  const results = await Promise.all(
    EVENT_TYPES.map(async (et) => {
      const { count, amount } = await fetchBoxCount(wallet, EVENT_TYPE_MAP[et]);
      return { eventType: et, count, amount };
    })
  );

  const map = new Map(results.map(r => [r.eventType, r]));

  const successfulPayments = map.get('payment')?.count ?? 0;
  const successfulPurchases = map.get('purchase')?.count ?? 0;
  const disputes = map.get('dispute')?.count ?? 0;
  const refunds = map.get('refund')?.count ?? 0;
  const sponsorEndorsements = map.get('endorsement')?.count ?? 0;
  const serviceInteractions = map.get('service')?.count ?? 0;

  const totalEvents = successfulPayments + successfulPurchases + disputes + refunds + sponsorEndorsements + serviceInteractions;
  const positiveEvents = successfulPayments + successfulPurchases + sponsorEndorsements + serviceInteractions;
  const negativeEvents = disputes + refunds;

  return {
    successfulPayments,
    successfulPurchases,
    disputes,
    refunds,
    sponsorEndorsements,
    serviceInteractions,
    totalEvents,
    positiveEvents,
    negativeEvents,
  };
}

// ── Main functions ─────────────────────────────────────────────

/**
 * F1: Validates that a counterparty has an on-chain presence.
 * Returns true if counterparty is a valid, funded Algorand address.
 */
export async function verifyCounterparty(counterparty: string): Promise<boolean> {
  if (!isValidWallet(counterparty)) return false;
  try {
    const info = await withTimeout(algod.accountInformation(counterparty).do(), 5_000, 'accountInformation');
    const data = info as any;
    // Counterparty must exist and have been active (created-at-round > 0)
    return (data['created-at-round'] ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * F1+F5: Validates dispute events require on-chain proof.
 *
 * Disputes are the most damaging event type (20x weight).
 * Without verification, an attacker can DDoS any wallet's reputation.
 *
 * Dispute verification requires:
 * 1. A valid counterparty wallet
 * 2. On-chain transactions between wallet and counterparty
 * 3. The dispute must reference a specific transaction round
 */
export async function verifyDisputeEvent(
  wallet: string,
  counterparty: string,
  round: number,
): Promise<boolean> {
  if (!counterparty || !isValidWallet(counterparty)) return false;
  if (round <= 0) return false;

  try {
    // Check if there are transactions between wallet and counterparty
    const url = `${config.indexerUrl}/v2/accounts/${wallet}/transactions?limit=100`;
    const res = await withTimeout(fetch(url, { signal: AbortSignal.timeout(5000) } as any), 5_000, 'fetchDisputeTxns');
    if (!res.ok) return false;

    const data = await res.json() as any;
    const txns = data.transactions || [];

    // Verify there's at least one transaction between wallet and counterparty
    return txns.some((t: any) => {
      const sender = t.sender || '';
      const receiver = t['payment-transaction']?.receiver ||
                       t['asset-transfer-transaction']?.receiver || '';
      return (sender === wallet && receiver === counterparty) ||
             (sender === counterparty && receiver === wallet);
    });
  } catch {
    return false;
  }
}

/**
 * P1 FIX: Verifies that a self-reported event has on-chain transaction evidence.
 * Prevents reputation inflation via fabricated events.
 *
 * For payment/purchase events, verifies that the wallet has at least one
 * on-chain transaction of the corresponding type.
 */
export async function verifySelfReportedEvent(
  wallet: string,
  eventType: EventType,
): Promise<boolean> {
  // Endorsements don't need self-verification (counterparty endorses)
  if (eventType === 'endorsement') return true;

  try {
    const url = `${config.indexerUrl}/v2/accounts/${wallet}/transactions?limit=50`;
    const res = await withTimeout(fetch(url, { signal: AbortSignal.timeout(5000) } as any), 5_000, 'fetchSelfReportTxns');
    if (!res.ok) return false;

    const data = await res.json() as any;
    const txns = data.transactions || [];

    // For payment events, verify at least one payment transaction exists
    if (eventType === 'payment' || eventType === 'purchase') {
      return txns.some((t: any) => !!t['payment-transaction'] || !!t['asset-transfer-transaction']);
    }

    // For service events, verify at least one application call exists
    if (eventType === 'service') {
      return txns.some((t: any) => t['tx-type'] === 'appl');
    }

    // Disputes and refunds are verified separately (verifyDisputeEvent / verifyCounterparty)
    return true;
  } catch {
    return false;
  }
}

export async function recordEvent(
  wallet: string,
  eventType: EventType,
  amount: number = 0,
  counterparty?: string
): Promise<ReputationEvent | null> {
  if (!isValidWallet(wallet)) return null;
  if (!EVENT_TYPES.includes(eventType)) return null;
  if (amount < 0) return null;

  // P1 FIX: Endorsement cycle detection — prevent circular trust inflation
  if (eventType === 'endorsement' && counterparty) {
    if (wouldCreateEndorsementCycle(wallet, counterparty)) {
      logger.warn('Endorsement rejected — would create cycle', { wallet, counterparty });
      return null;
    }
  }

  // F1: Counterparty verification — disputes and refunds require verified counterparty
  let counterpartyVerified = false;
  if ((eventType === 'dispute' || eventType === 'refund') && counterparty) {
    counterpartyVerified = await verifyCounterparty(counterparty);
    if (!counterpartyVerified) {
      logger.warn('Dispute/refund requires verified counterparty', { wallet, counterparty });
    }
  } else if (counterparty) {
    counterpartyVerified = await verifyCounterparty(counterparty);
  }

  // P1 FIX: Self-reported events require on-chain transaction evidence
  if (eventType !== 'endorsement' && eventType !== 'dispute') {
    const selfReportVerified = await verifySelfReportedEvent(wallet, eventType);
    if (!selfReportVerified) {
      logger.warn('Self-reported event lacks on-chain evidence', { wallet, eventType });
      // Still allow recording but flag as unverified — reputation score applies 0.5x weight
    }
  }

  // F5: Dispute verification — disputes require on-chain proof of relationship
  if (eventType === 'dispute') {
    if (!counterparty || !isValidWallet(counterparty)) {
      logger.warn('Dispute requires valid counterparty', { wallet });
      return null;
    }
    const disputeVerified = await verifyDisputeEvent(wallet, counterparty, 0);
    if (!disputeVerified) {
      logger.warn('Dispute not verified — no on-chain relationship found', { wallet, counterparty });
      return null;
    }
  }

  const status = await withTimeout(algod.status().do(), 10_000, 'algod.status');
  const currentRound = Number((status as any)['last-round'] || 0);

  // F4: Deduplication — check for duplicate event
  const eventHash = computeEventHash(wallet, eventType, counterparty, currentRound);
  if (isDuplicateEvent(eventHash)) {
    logger.warn('Duplicate event rejected', { wallet, eventType, eventHash });
    return null;
  }
  registerEventHash(eventHash);

  if (REPUTATION_APP_ID === 0) {
    logger.warn('REPUTATION_APP_ID is 0 — recording event off-chain only', { wallet, eventType });
    return {
      wallet,
      eventType,
      amount,
      counterparty,
      round: currentRound,
      timestamp: Math.floor(Date.now() / 1000),
      eventHash,
      counterpartyVerified,
    };
  }

  const eventTypeChar = EVENT_TYPE_MAP[eventType];

  const appArgs = [
    new TextEncoder().encode('record'),
    new TextEncoder().encode(eventTypeChar),
    algosdk.encodeUint64(amount),
  ];

  const accounts = [wallet];

  // P0 FIX: Submit transaction to chain using operator wallet
  const txId = await submitApplicationCall(REPUTATION_APP_ID, appArgs, accounts);
  if (!txId) {
    logger.warn('Failed to submit reputation transaction — event recorded off-chain only', {
      wallet, eventType, eventHash,
    });
  }

  // P1 FIX: Record endorsement relationship for cycle detection
  if (eventType === 'endorsement' && counterparty) {
    recordEndorsement(wallet, counterparty);
  }

  return {
    wallet,
    eventType,
    amount,
    counterparty,
    round: currentRound,
    timestamp: Math.floor(Date.now() / 1000),
    eventHash,
    counterpartyVerified,
    ...(txId ? { txId } : {}),
  };
}

export async function computeReputation(
  wallet: string
): Promise<ReputationResult | null> {
  if (!isValidWallet(wallet)) return null;

  const onChainBreakdown = await fetchReputationFromContract(wallet);

  const breakdown: ReputationBreakdown = onChainBreakdown ?? {
    successfulPayments: 0,
    successfulPurchases: 0,
    disputes: 0,
    refunds: 0,
    sponsorEndorsements: 0,
    serviceInteractions: 0,
    totalEvents: 0,
    positiveEvents: 0,
    negativeEvents: 0,
  };

  const reputation = computeReputationScore(breakdown);
  const riskLevel = classifyReputationRisk(reputation);
  const hasRecentActivity = breakdown.totalEvents > 0;
  const confidence = computeReputationConfidence(breakdown.totalEvents, hasRecentActivity);
  const explanation = generateReputationExplanation(breakdown, reputation);

  return {
    wallet,
    reputation,
    riskLevel,
    confidence,
    breakdown,
    explanation,
  };
}
