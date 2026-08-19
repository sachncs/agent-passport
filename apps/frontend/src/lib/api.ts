/**
 * API client for Agent Passport. Sends a signed X-Request-ID on every
 * request, attaches Idempotency-Key on mutating calls, and surfaces
 * typed errors. Built on fetch so it works in both browser and Node.
 */

import type {
  BazaarSearchResponse,
  CounterpartyCheckResponse,
  CreditEstimateResponse,
  DelegationResponse,
  HealthResponse,
  PassportResponse,
  ReputationResponse,
  SybilCheckResponse,
  TrustScoreResponse,
  UnderwriteResponse,
  VersionResponse,
  VerifyResponse,
} from "@/types/api"

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly requestId: string | undefined,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `web-${crypto.randomUUID().slice(0, 16)}`
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

interface FetchOpts {
  method?: "GET" | "POST"
  body?: unknown
  idempotencyKey?: string
  signal?: AbortSignal
  timeoutMs?: number
}

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Request-ID": newRequestId(),
  }
  let body: string | undefined
  if (opts.body !== undefined && opts.method !== "GET") {
    body = JSON.stringify(opts.body)
    headers["Content-Type"] = "application/json"
  }
  if (opts.method && opts.method !== "GET") {
    headers["Idempotency-Key"] =
      opts.idempotencyKey ?? newIdempotencyKey()
  }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? 30_000,
  )

  try {
    const res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body,
      signal: opts.signal ?? controller.signal,
    })
    const requestId = res.headers.get("x-request-id") ?? undefined
    if (!res.ok) {
      let errBody: unknown
      try {
        errBody = await res.json()
      } catch {
        // ignore
      }
      const message =
        errBody && typeof errBody === "object" && "error" in errBody
          ? String((errBody as { error: unknown }).error)
          : `HTTP ${res.status}`
      throw new ApiError(res.status, requestId, message, errBody)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  version: () => request<VersionResponse>("/version"),

  getScore: (wallet: string) =>
    request<TrustScoreResponse>(`/score?wallet=${encodeURIComponent(wallet)}`),
  getDelegation: (wallet: string) =>
    request<DelegationResponse>(`/delegation?wallet=${encodeURIComponent(wallet)}`),
  checkCounterparty: (buyer: string) =>
    request<CounterpartyCheckResponse>("/counterparty-check", {
      method: "POST",
      body: { buyer },
    }),
  estimateCredit: (wallet: string, amount?: number) =>
    request<CreditEstimateResponse>("/credit-estimate", {
      method: "POST",
      body: { wallet, amount },
    }),
  checkSybil: (wallet: string) =>
    request<SybilCheckResponse>(`/sybil-check?wallet=${encodeURIComponent(wallet)}`),
  getReputation: (wallet: string) =>
    request<ReputationResponse>(`/reputation?wallet=${encodeURIComponent(wallet)}`),
  recordReputationEvent: (
    wallet: string,
    eventType: string,
    options: { amount?: number; counterparty?: string; round?: number } = {},
  ) =>
    request("/reputation/record", {
      method: "POST",
      body: {
        wallet,
        eventType,
        amount: options.amount,
        counterparty: options.counterparty,
        round: options.round,
      },
    }),
  underwrite: (wallet: string) =>
    request<UnderwriteResponse>(`/underwrite?wallet=${encodeURIComponent(wallet)}`),
  getTrustGraph: (wallet: string, simulateLost?: string) => {
    const params = new URLSearchParams({ wallet })
    if (simulateLost) params.set("simulateSponsorLost", simulateLost)
    return request<unknown>(`/trust-graph?${params.toString()}`)
  },
  getPassport: (wallet: string) =>
    request<PassportResponse>(`/passport?wallet=${encodeURIComponent(wallet)}`),
  verify: (wallet: string) =>
    request<VerifyResponse>(`/verify?wallet=${encodeURIComponent(wallet)}`),
  discoverySearch: (q: string, limit = 20) =>
    request<BazaarSearchResponse>(
      `/discovery/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
}

export type Api = typeof api
