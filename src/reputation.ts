import algosdk from 'algosdk';

const ALGOD_URL = process.env.ALGOD_URL || 'https://testnet-api.algonode.cloud:443';
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';

export const REPUTATION_APP_ID = parseInt(process.env.REPUTATION_APP_ID || '0', 10);

export type EventType = 'payment' | 'purchase' | 'dispute' | 'refund' | 'endorsement' | 'service';

export const EVENT_TYPE_MAP: Record<EventType, string> = {
  payment: 'p',
  purchase: 'u',
  dispute: 'd',
  refund: 'r',
  endorsement: 'e',
  service: 's',
};

export const EVENT_TYPES: EventType[] = ['payment', 'purchase', 'dispute', 'refund', 'endorsement', 'service'];

export interface ReputationEvent {
  wallet: string;
  eventType: EventType;
  amount: number;
  counterparty?: string;
  round: number;
  timestamp: number;
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

// ── Pure math functions (exported for testing) ─────────────────

export function computeReputationScore(breakdown: ReputationBreakdown): number {
  const positive =
    breakdown.successfulPayments * 10 +
    breakdown.successfulPurchases * 8 +
    breakdown.sponsorEndorsements * 15 +
    breakdown.serviceInteractions * 5;
  const negative =
    breakdown.disputes * 20 +
    breakdown.refunds * 12;

  if (positive + negative === 0) return 0;
  return Math.round(Math.min(100, (positive / (positive + negative)) * 100) * 10) / 10;
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

  const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL);
  try {
    const boxName = buildBoxKey(wallet, eventTypeChar);
    const boxResponse = await algod.getApplicationBoxByName(REPUTATION_APP_ID, boxName).do();
    const boxValue = boxResponse.value;

    if (boxValue.length < 16) return { count: 0, amount: 0 };

    const count = Number(Buffer.from(boxValue.slice(0, 8)).readBigUInt64BE(0));
    const amount = Number(Buffer.from(boxValue.slice(8, 16)).readBigUInt64BE(0));
    return { count, amount };
  } catch {
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

export async function recordEvent(
  wallet: string,
  eventType: EventType,
  amount: number = 0,
  counterparty?: string
): Promise<ReputationEvent | null> {
  if (!/^[A-Z2-7]{58}$/.test(wallet)) return null;
  if (!EVENT_TYPES.includes(eventType)) return null;
  if (amount < 0) return null;

  if (REPUTATION_APP_ID === 0) {
    // No contract deployed — return event without persisting
    const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL);
    const status = await algod.status().do();
    return {
      wallet,
      eventType,
      amount,
      counterparty,
      round: Number((status as any)['last-round'] || 0),
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL);
  const suggestedParams = await algod.getTransactionParams().do();

  const eventTypeChar = EVENT_TYPE_MAP[eventType];

  // Build app call transaction
  const appArgs = [
    new TextEncoder().encode('record'),
    new TextEncoder().encode(eventTypeChar),
    algosdk.encodeUint64(amount),
  ];

  const accounts = [wallet];

  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: algosdk.getApplicationAddress(REPUTATION_APP_ID),
    appIndex: REPUTATION_APP_ID,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs,
    accounts,
    suggestedParams,
  });

  // Note: This requires a funded sender account. For demo purposes, we return the event
  // without actually sending the transaction. In production, use a signer.
  const status = await algod.status().do();

  return {
    wallet,
    eventType,
    amount,
    counterparty,
    round: Number((status as any)['last-round'] || 0),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

export async function computeReputation(
  wallet: string
): Promise<ReputationResult | null> {
  if (!/^[A-Z2-7]{58}$/.test(wallet)) return null;

  // Try on-chain first, fall back to empty breakdown
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
