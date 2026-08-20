import { describe, expect, it, vi, beforeAll, afterEach, afterAll } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: vi.fn(),
}))

import * as NextNav from "next/navigation"
import { DashboardClient } from "@/app/dashboard/dashboard-client"

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function withQueryClient(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  )
}

function mockNav(pathname: string, searchParams: URLSearchParams) {
  vi.mocked(NextNav.usePathname).mockReturnValue(pathname)
  vi.mocked(NextNav.useSearchParams).mockReturnValue(
    searchParams as unknown as ReturnType<typeof NextNav.useSearchParams>,
  )
}

const WALLET = "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"

describe("DashboardClient", () => {
  it("renders the empty-state hero with wallet input", () => {
    mockNav("/dashboard", new URLSearchParams())
    withQueryClient(<DashboardClient />)
    expect(
      screen.getByRole("heading", { name: /one wallet, every service/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(/algorand wallet address/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /load report/i }),
    ).toBeInTheDocument()
  })

  it("disables submit until the wallet looks valid", async () => {
    mockNav("/dashboard", new URLSearchParams())
    withQueryClient(<DashboardClient />)
    const button = screen.getByRole("button", { name: /load report/i })
    expect(button).toBeDisabled()
    await userEvent.setup().type(
      screen.getByLabelText(/algorand wallet address/i),
      "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A",
    )
    expect(button).toBeEnabled()
  })

  it("renders the cover + all section headings when a valid wallet is in the URL", async () => {
    mockNav("/dashboard", new URLSearchParams(`?wallet=${WALLET}`))
    server.use(
      http.get("http://localhost/score", () =>
        HttpResponse.json({
          wallet: WALLET,
          trustScore: 76.2,
          riskLevel: "low",
          approved: true,
          recommendedLimit: 457.2,
          breakdown: {
            ageScore: 77.8,
            activityScore: 70,
            volumeScore: 70,
            velocityScore: 60,
            complianceScore: 100,
          },
          onChain: {
            balanceAlgo: 112.07,
            totalTxns: 5396,
            assetCount: 0,
            appCount: 0,
            accountAgeDays: 489,
            firstSeenRound: 53663184,
            lastSeenRound: 66470550,
          },
          explanation: ["Strong wallet"],
        }),
      ),
      http.get("http://localhost/sybil-check", () =>
        HttpResponse.json({
          wallet: WALLET,
          sybilRisk: 0.12,
          riskLevel: "low",
          confidence: 0.9,
          clusterSize: 1,
          signals: {
            creationClustering: 0.1,
            interactionDensity: 0.1,
            balanceSimilarity: 0.1,
            circularActivity: 0.1,
            timingRegularity: 0.1,
            amountFingerprint: 0.1,
            fundingCorrelation: 0.1,
            neighborhoodClustering: 0.1,
            hubScore: 0.1,
            intermediateDensity: 0.1,
            componentRatio: 0.1,
            temporalCorrelation: 0.1,
          },
          flaggedWallets: [],
          explanation: ["No signals"],
        }),
      ),
      http.get("http://localhost/reputation", () =>
        HttpResponse.json({
          wallet: WALLET,
          reputation: 64,
          breakdown: {
            successfulPayments: 5,
            successfulPurchases: 3,
            disputes: 0,
            refunds: 0,
            sponsorEndorsements: 1,
            serviceInteractions: 2,
            totalEvents: 11,
            positiveEvents: 10,
            negativeEvents: 0,
          },
          explanation: ["Solid"],
        }),
      ),
      http.get("http://localhost/delegation", () =>
        HttpResponse.json({
          wallet: WALLET,
          trustScore: 76.2,
          riskLevel: "low",
          approved: true,
          recommendedLimit: 457.2,
          delegation: {
            depth: 2,
            sponsorCount: 3,
            sponsorQuality: 80,
            delegationPath: [WALLET, "AAAA"],
            totalDelegatedAmount: 1_000_000,
            isTrustAnchor: false,
            trustedAncestors: 2,
          },
          explanation: [],
        }),
      ),
      http.get("http://localhost/underwrite", () =>
        HttpResponse.json({
          wallet: WALLET,
          approved: true,
          recommendedLimit: 457.2,
          riskLevel: "low",
          confidence: 0.8,
          compositeScore: 76.2,
          factors: [],
          explanation: [],
        }),
      ),
      http.get("http://localhost/passport", () =>
        HttpResponse.json({
          wallet: WALLET,
          trustScore: 76.2,
          reputation: 64,
          creditLimit: 457.2,
          sybilRisk: 0.12,
          overallRiskLevel: "low",
          onChain: {
            balanceAlgo: 112.07,
            totalTxns: 5396,
            assetCount: 0,
            appCount: 0,
            accountAgeDays: 489,
            firstSeenRound: 53663184,
            lastSeenRound: 66470550,
          },
          delegation: {},
          capabilities: {},
          summary: "OK",
          checksum:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          generatedAt: new Date().toISOString(),
        }),
      ),
    )
    withQueryClient(<DashboardClient />)
    expect(
      await screen.findByRole("heading", { name: /passport report/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("Summary")).toBeInTheDocument()
    expect(screen.getByText("Trust Score")).toBeInTheDocument()
    expect(screen.getByText("Sybil Risk")).toBeInTheDocument()
    expect(screen.getByText("Reputation")).toBeInTheDocument()
    expect(screen.getByText("Delegation")).toBeInTheDocument()
    expect(screen.getByText("Underwriting")).toBeInTheDocument()
    expect(await screen.findByText("76.2")).toBeInTheDocument()
  })

  it("shows an invalid-address error for malformed wallets", () => {
    mockNav(
      "/dashboard",
      new URLSearchParams("?wallet=not-a-valid-wallet"),
    )
    withQueryClient(<DashboardClient />)
    expect(
      screen.getByText(/isn't a valid 58-character base32/i),
    ).toBeInTheDocument()
  })
})