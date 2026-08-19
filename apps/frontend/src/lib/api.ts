/**
 * Lightweight fetch wrapper for the Agent Passport API.
 *
 * - baseUrl is configurable via Vite (VITE_API_BASE_URL)
 * - Sends Idempotency-Key on every mutating request (per C2 contract)
 * - Sends X-Request-ID for cross-service trace correlation
 * - On 401, throws so callers can surface a sign-in prompt (placeholder
 *   in this build; will integrate HMAC auth in v0.2)
 * - On 402, exposes the PaymentRequirements so the UI can prompt the
 *   user to attach a payment proof (x402 protocol)
 */

import type {
  TrustScoreResponse,
  DelegationResponse,
  CounterpartyCheckResponse,
  CreditEstimateResponse,
  SybilCheckResponse,
  ReputationResponse,
  ReputationRecordResponse,
  UnderwriteResponse,
  TrustGraphResponse,
  PassportResponse,
  VerifyResponse,
  BazaarSearchResponse,
  EndorseRequest,
  EndorseResponse,
  RevokeRequest,
  RevokeResponse,
} from '@/types/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE = ((import.meta as ImportMeta).env.VITE_API_BASE_URL as string | undefined) || '';

function newIdempotencyKey(): string {
  // 16 hex chars is well within the 8-255 char server-side limit.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return Math.random().toString(36).slice(2, 18).padEnd(16, '0');
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

interface FetchOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

async function request<T>(
  path: string,
  opts: FetchOpts = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-ID': newRequestId(),
  };
  let body: string | undefined;
  if (opts.body !== undefined && opts.method !== 'GET') {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }
  if (opts.method && opts.method !== 'GET') {
    headers['Idempotency-Key'] = opts.idempotencyKey || newIdempotencyKey();
  }
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers,
    body,
    signal: opts.signal,
  });
  const requestId = res.headers.get('x-request-id') ?? undefined;
  if (!res.ok) {
    let errBody: unknown = undefined;
    try { errBody = await res.json(); } catch { /* empty */ }
    const message = (errBody && typeof errBody === 'object' && 'error' in errBody)
      ? String((errBody as { error: unknown }).error)
      : `HTTP ${res.status}`;
    throw new ApiError(message, res.status, requestId, errBody);
  }
  return res.json() as Promise<T>;
}

// ── Read endpoints ─ ────────────────────────────────────────────

export const api = {
  health: () => request<{ status: string; service: string; version: string }>(
    '/health',
  ),
  version: () => request<import('@/types/api').ServiceInfo>('/version'),

  getScore: (wallet: string) => request<TrustScoreResponse>(
    `/score?wallet=${encodeURIComponent(wallet)}`,
  ),
  getDelegation: (wallet: string) => request<DelegationResponse>(
    `/delegation?wallet=${encodeURIComponent(wallet)}`,
  ),
  checkCounterparty: (buyer: string) => request<CounterpartyCheckResponse>(
    '/counterparty-check',
    { method: 'POST', body: { buyer } },
  ),
  estimateCredit: (wallet: string, amount?: number) => request<CreditEstimateResponse>(
    '/credit-estimate',
    { method: 'POST', body: { wallet, amount } },
  ),
  checkSybil: (wallet: string) => request<SybilCheckResponse>(
    `/sybil-check?wallet=${encodeURIComponent(wallet)}`,
  ),
  getReputation: (wallet: string) => request<ReputationResponse>(
    `/reputation?wallet=${encodeURIComponent(wallet)}`,
  ),
  recordReputationEvent: (
    wallet: string,
    eventType: string,
    options: { amount?: number; counterparty?: string; round?: number } = {},
  ) => request<ReputationRecordResponse>(
    '/reputation/record',
    {
      method: 'POST',
      body: {
        wallet,
        eventType,
        amount: options.amount,
        counterparty: options.counterparty,
        round: options.round,
      },
    },
  ),
  underwrite: (wallet: string) => request<UnderwriteResponse>(
    `/underwrite?wallet=${encodeURIComponent(wallet)}`,
  ),
  getTrustGraph: (wallet: string, simulateLost?: string) => request<TrustGraphResponse>(
    `/trust-graph?wallet=${encodeURIComponent(wallet)}`
    + (simulateLost ? `&simulateSponsorLost=${encodeURIComponent(simulateLost)}` : ''),
  ),
  getPassport: (wallet: string) => request<PassportResponse>(
    `/passport?wallet=${encodeURIComponent(wallet)}`,
  ),
  verify: (wallet: string) => request<VerifyResponse>(
    `/verify?wallet=${encodeURIComponent(wallet)}`,
  ),

  discoverySearch: (q: string, limit = 20) => request<BazaarSearchResponse>(
    `/discovery/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  ),

  // On-chain writes — caller is responsible for sending HMAC headers
  // (out of scope for v0.1 frontend).
  endorse: (req: EndorseRequest) => request<EndorseResponse>(
    '/delegate',
    { method: 'POST', body: { sponsor: req.sponsor, agent: req.agent, amount: req.amount }, idempotencyKey: req.idempotencyKey },
  ),
  revoke: (req: RevokeRequest) => request<RevokeResponse>(
    '/revoke',
    { method: 'POST', body: { sponsor: req.sponsor, agent: req.agent }, idempotencyKey: req.idempotencyKey },
  ),
};

export type Api = typeof api;