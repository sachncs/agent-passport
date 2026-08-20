import { describe, expect, it, vi, beforeAll, afterEach, afterAll } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

vi.mock("next/navigation", () => ({
  usePathname: () => "/score",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () =>
    new URLSearchParams(
      "?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A",
    ),
}))

import { TrustScoreClient } from "@/app/score/trust-score-client"

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const WALLET = "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"

function withQueryClient(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  )
}

describe("TrustScoreClient", () => {
  it("renders the trust score value and wallet pill", async () => {
    server.use(
      http.get("http://localhost/score", () =>
        HttpResponse.json({
          wallet: WALLET,
          trustScore: 87.4,
          riskLevel: "low",
          approved: true,
          recommendedLimit: 1500,
          breakdown: {
            ageScore: 90,
            activityScore: 80,
            volumeScore: 85,
            velocityScore: 70,
            complianceScore: 95,
          },
        }),
      ),
    )
    withQueryClient(<TrustScoreClient />)
    expect(await screen.findByText("87.4")).toBeInTheDocument()
    expect(await screen.findByText(WALLET)).toBeInTheDocument()
  })

  it("shows a branded loading indicator while the request is pending", () => {
    server.use(
      http.get("http://localhost/score", async () => {
        await new Promise((r) => setTimeout(r, 1000))
        return HttpResponse.json({})
      }),
    )
    withQueryClient(<TrustScoreClient />)
    expect(screen.getByText(/verifying on-chain/i)).toBeInTheDocument()
  })

  it("renders the score, sub-scores, and risk pill on success", async () => {
    server.use(
      http.get("http://localhost/score", () =>
        HttpResponse.json({
          wallet: WALLET,
          trustScore: 87.4,
          riskLevel: "low",
          approved: true,
          recommendedLimit: 1500,
          breakdown: {
            ageScore: 90,
            activityScore: 80,
            volumeScore: 85,
            velocityScore: 70,
            complianceScore: 95,
          },
          explanation: ["Long history", "High volume", "No sanctions"],
        }),
      ),
    )
    withQueryClient(<TrustScoreClient />)
    expect(await screen.findByText("87.4")).toBeInTheDocument()
    expect(screen.getByText("Low")).toBeInTheDocument()
    expect(screen.getByText("1500 ALGO")).toBeInTheDocument()
    expect(screen.getByText("90.0")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /why this score/i }),
    ).toBeInTheDocument()
  })

  it("renders an error alert when the API returns a 5xx", async () => {
    server.use(
      http.get("http://localhost/score", () =>
        HttpResponse.json(
          { error: "Service unavailable" },
          { status: 503 },
        ),
      ),
    )
    withQueryClient(<TrustScoreClient />)
    await waitFor(() => {
      expect(screen.getByText("Service unavailable")).toBeInTheDocument()
    })
  })
})
