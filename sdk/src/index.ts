/**
 * Agent Passport TypeScript SDK
 *
 * Stateless wallet trust scoring for AI agents on Algorand.
 *
 * @example
 * ```typescript
 * import { AgentPassportClient } from '@agent-passport/sdk';
 *
 * const client = new AgentPassportClient({
 *   baseUrl: 'https://passport.example.com',
 *   apiKey: 'your-api-key',
 * });
 *
 * const score = await client.getScore('WALLET_ADDRESS_58_CHARS...');
 * console.log(score.trustScore);
 * ```
 */

import {
  AgentPassportError,
  AuthenticationError,
  PaymentRequiredError,
  NotFoundError,
  RateLimitError,
  IdempotencyError,
  ValidationError,
  ServerError,
  TimeoutError,
  ConnectionError,
} from './errors';
import type { PaymentRequirements, PaymentProof } from './errors';
import {
  AgentPassportConfig,
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
  HealthResponse,
  EndorsementRequest,
  EndorsementResponse,
  RevocationRequest,
  RevocationResponse,
  CreatePassportOptions,
} from './types';
import { computeBackoff, sleep, isRetryableStatus } from './retry';

export * from './errors';
export * from './types';

const WALLET_REGEX = /^[A-Z2-7]{58}$/;
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1_000;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function isWallet(s: string): boolean {
  return typeof s === 'string' && WALLET_REGEX.test(s);
}

export class AgentPassportClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;
  private retries: number;
  private retryDelay: number;
  private onPaymentRequired?: (requirements: PaymentRequirements) => Promise<PaymentProof>;
  private defaultHeaders: Record<string, string>;

  constructor(config: AgentPassportConfig) {
    if (!config || !config.baseUrl) {
      throw new Error('AgentPassportClient: baseUrl is required');
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.retries = config.retries ?? DEFAULT_RETRIES;
    this.retryDelay = config.retryDelay ?? DEFAULT_RETRY_DELAY;
    this.onPaymentRequired = config.onPaymentRequired;
    this.defaultHeaders = config.headers ?? {};
  }

  private validateWallet(wallet: string): void {
    if (!isWallet(wallet)) {
      throw new ValidationError(
        'Invalid Algorand wallet address. Must be 58-character base32 (A-Z, 2-7).',
      );
    }
  }

  private buildHeaders(idempotencyKey?: string, xPayment?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'agent-passport-sdk/0.2.0',
      ...this.defaultHeaders,
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    if (xPayment) {
      headers['x-payment'] = xPayment;
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    options: { idempotencyKey?: string; xPayment?: string } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.buildHeaders(options.idempotencyKey, options.xPayment);

    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    let lastError: AgentPassportError | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const requestId = response.headers.get('x-request-id') ?? undefined;

        if (response.status === 402 && this.onPaymentRequired) {
          const requirements = (await response.json()) as PaymentRequirements;
          const proof = await this.onPaymentRequired(requirements);
          const retryResponse = await fetch(url, {
            method,
            headers: this.buildHeaders(options.idempotencyKey, proof.paymentHeader),
            body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
          });
          const retryData = await retryResponse.json().catch(() => ({}));
          if (!retryResponse.ok) {
            throw AgentPassportClient.errorFromResponse(retryResponse, retryData, requestId);
          }
          return retryData as T;
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw AgentPassportClient.errorFromResponse(response, data, requestId);
        }

        return data as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof AgentPassportError) {
          // 4xx errors (except 408, 429) are not retried
          if (!isRetryableStatus(error.statusCode, RETRYABLE_STATUSES)) {
            throw error;
          }
          lastError = error;
        } else if (error instanceof Error && error.name === 'AbortError') {
          lastError = new TimeoutError();
        } else if (error instanceof Error) {
          lastError = new ConnectionError(error.message);
        } else {
          lastError = new ConnectionError('Unknown error');
        }

        if (attempt < this.retries) {
          await sleep(computeBackoff(attempt, this.retryDelay));
        }
      }
    }

    throw lastError ?? new ServerError('Request failed after retries');
  }

  static errorFromResponse(response: Response, data: any, requestId?: string): AgentPassportError {
    const message = (data && data.error) || `HTTP ${response.status}`;
    switch (response.status) {
      case 400: return new ValidationError(message, data, requestId);
      case 401: return new AuthenticationError(message, data, requestId);
      case 402: return new PaymentRequiredError(data, requestId);
      case 404: return new NotFoundError(message, data, requestId);
      case 408: return new TimeoutError(message, requestId);
      case 409:
        if (data && typeof data.error === 'string' && data.error.toLowerCase().includes('idempotency')) {
          return new IdempotencyError(message, data, requestId);
        }
        return new AgentPassportError(message, 409, data, requestId);
      case 429: {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        return new RateLimitError(message, retryAfter, requestId);
      }
      default:
        if (response.status >= 500) {
          return new ServerError(message, data, requestId);
        }
        return new AgentPassportError(message, response.status, data, requestId);
    }
  }

  // ── Health ────────────────────────────────────────────────────

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }

  // ── Trust Score ──────────────────────────────────────────────

  async getScore(wallet: string): Promise<TrustScoreResponse> {
    this.validateWallet(wallet);
    return this.request<TrustScoreResponse>('GET', `/score?wallet=${wallet}`);
  }

  // ── Delegation ──────────────────────────────────────────────

  async getDelegation(wallet: string): Promise<DelegationResponse> {
    this.validateWallet(wallet);
    return this.request<DelegationResponse>('GET', `/delegation?wallet=${wallet}`);
  }

  // ── Counterparty Check ──────────────────────────────────────

  async checkCounterparty(buyer: string): Promise<CounterpartyCheckResponse> {
    this.validateWallet(buyer);
    return this.request<CounterpartyCheckResponse>('POST', '/counterparty-check', { buyer });
  }

  // ── Credit Estimate ─────────────────────────────────────────

  async estimateCredit(wallet: string, amount?: number): Promise<CreditEstimateResponse> {
    this.validateWallet(wallet);
    const body: Record<string, unknown> = { wallet };
    if (amount !== undefined) body.amount = amount;
    return this.request<CreditEstimateResponse>('POST', '/credit-estimate', body);
  }

  // ── Sybil Check ─────────────────────────────────────────────

  async checkSybil(wallet: string): Promise<SybilCheckResponse> {
    this.validateWallet(wallet);
    return this.request<SybilCheckResponse>('GET', `/sybil-check?wallet=${wallet}`);
  }

  // ── Reputation ──────────────────────────────────────────────

  async getReputation(wallet: string): Promise<ReputationResponse> {
    this.validateWallet(wallet);
    return this.request<ReputationResponse>('GET', `/reputation?wallet=${wallet}`);
  }

  async recordReputationEvent(
    wallet: string,
    eventType: string,
    options: { amount?: number; counterparty?: string; idempotencyKey?: string } = {},
  ): Promise<ReputationRecordResponse> {
    this.validateWallet(wallet);
    const body: Record<string, unknown> = { wallet, eventType };
    if (options.amount !== undefined) body.amount = options.amount;
    if (options.counterparty) {
      this.validateWallet(options.counterparty);
      body.counterparty = options.counterparty;
    }
    return this.request<ReputationRecordResponse>('POST', '/reputation/record', body, {
      idempotencyKey: options.idempotencyKey,
    });
  }

  // ── Underwrite ──────────────────────────────────────────────

  async underwrite(wallet: string): Promise<UnderwriteResponse> {
    this.validateWallet(wallet);
    return this.request<UnderwriteResponse>('GET', `/underwrite?wallet=${wallet}`);
  }

  // ── Trust Graph ─────────────────────────────────────────────

  async getTrustGraph(wallet: string): Promise<TrustGraphResponse> {
    this.validateWallet(wallet);
    return this.request<TrustGraphResponse>('GET', `/trust-graph?wallet=${wallet}`);
  }

  // ── Passport ─────────────────────────────────────────────────

  async getPassport(wallet: string): Promise<PassportResponse> {
    this.validateWallet(wallet);
    return this.request<PassportResponse>('GET', `/passport?wallet=${wallet}`);
  }

  // ── Create Passport (explicit alias) ─────────────────────────

  async createPassport(options: CreatePassportOptions): Promise<PassportResponse> {
    this.validateWallet(options.wallet);
    return this.getPassport(options.wallet);
  }

  // ── Endorse (POST /delegate on-chain) ────────────────────────

  async endorse(req: EndorsementRequest): Promise<EndorsementResponse> {
    this.validateWallet(req.sponsor);
    this.validateWallet(req.agent);
    if (req.sponsor === req.agent) {
      throw new ValidationError('Sponsor and agent must be different wallets');
    }
    if (typeof req.amount !== 'number' || !Number.isFinite(req.amount) || req.amount <= 0) {
      throw new ValidationError('Amount must be a positive finite number');
    }
    return this.request<EndorsementResponse>(
      'POST',
      '/delegate',
      { sponsor: req.sponsor, agent: req.agent, amount: req.amount },
      { idempotencyKey: req.idempotencyKey },
    );
  }

  // ── Revoke (POST /revoke on-chain) ───────────────────────────

  async revoke(req: RevocationRequest): Promise<RevocationResponse> {
    this.validateWallet(req.sponsor);
    this.validateWallet(req.agent);
    return this.request<RevocationResponse>(
      'POST',
      '/revoke',
      { sponsor: req.sponsor, agent: req.agent },
      { idempotencyKey: req.idempotencyKey },
    );
  }
}

export default AgentPassportClient;
