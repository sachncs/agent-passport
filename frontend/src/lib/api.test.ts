import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

import { api } from "@/lib/api"

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const WALLET = "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"

describe("api client", () => {
  it("GET requests include X-Request-ID and parse JSON", async () => {
    server.use(
      http.get("http://localhost/score", ({ request }) => {
        expect(request.headers.get("x-request-id")).toBeTruthy()
        return HttpResponse.json({
          wallet: WALLET,
          trustScore: 87.4,
          riskLevel: "low",
        })
      }),
    )
    const data = await api.getScore(WALLET)
    expect(data.trustScore).toBe(87.4)
  })

  it("encodes wallet query param", async () => {
    let seenPath: string | null = null
    server.use(
      http.get("http://localhost/score", ({ request }) => {
        seenPath = new URL(request.url).pathname + new URL(request.url).search
        return HttpResponse.json({})
      }),
    )
    await api.getScore("A B")
    expect(seenPath).toContain("A%20B")
  })

  it("POST sends JSON body and Idempotency-Key", async () => {
    type Seen = { idempotencyKey: string | null; body: unknown }
    const seen: Seen = { idempotencyKey: null, body: null }
    server.use(
      http.post("http://localhost/counterparty-check", async ({ request }) => {
        const text = await request.text()
        seen.idempotencyKey = request.headers.get("idempotency-key")
        seen.body = JSON.parse(text)
        return HttpResponse.json({ allow: true, trustScore: 90 })
      }),
    )
    const result = await api.checkCounterparty(WALLET)
    expect(result.allow).toBe(true)
    expect(seen.body).toEqual({ buyer: WALLET })
    expect(seen.idempotencyKey).toMatch(/^web-/)
  })

  it("throws ApiError with status + requestId on non-2xx", async () => {
    server.use(
      http.get("http://localhost/health", () =>
        HttpResponse.json(
          { error: "Service down" },
          { status: 503, headers: { "x-request-id": "req-42" } },
        ),
      ),
    )
    await expect(api.health()).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      requestId: "req-42",
      message: "Service down",
    })
  })

  it("falls back to 'HTTP <status>' when error body is not JSON", async () => {
    server.use(
      http.get("http://localhost/health", () =>
        new HttpResponse("not json", { status: 500 }),
      ),
    )
    await expect(api.health()).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "HTTP 500",
    })
  })

  it("rejects empty wallet on wallet-bound endpoints", () => {
    const expectRejected = (fn: () => unknown, pattern: RegExp) => {
      expect(fn).toThrow(pattern)
    }
    expectRejected(() => api.getScore(""), /getScore.*wallet is required/)
    expectRejected(
      () => api.getScore(undefined as unknown as string),
      /getScore.*wallet is required/,
    )
    expectRejected(() => api.getPassport(""), /getPassport.*wallet is required/)
    expectRejected(() => api.getDelegation(""), /getDelegation.*wallet is required/)
    expectRejected(() => api.checkSybil(""), /checkSybil.*wallet is required/)
    expectRejected(() => api.getReputation(""), /getReputation.*wallet is required/)
    expectRejected(() => api.underwrite(""), /underwrite.*wallet is required/)
    expectRejected(() => api.verify(""), /verify.*wallet is required/)
    expectRejected(() => api.getTrustGraph(""), /getTrustGraph.*wallet is required/)
  })

  it("does not reject empty wallet on non-wallet endpoints", async () => {
    server.use(
      http.get("http://localhost/version", () =>
        HttpResponse.json({ version: "0.1.0" }),
      ),
    )
    const v = await api.version()
    expect(v.version).toBe("0.1.0")
  })
})