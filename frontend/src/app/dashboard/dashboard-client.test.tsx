import { describe, expect, it, vi, beforeAll, afterEach, afterAll } from "vitest"
import { render, screen } from "@testing-library/react"
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
  vi.mocked(NextNav.useSearchParams).mockReturnValue(searchParams as unknown as ReturnType<typeof NextNav.useSearchParams>)
}

const WALLET = "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"

describe("DashboardClient", () => {
  it("renders the page header and the wallet input form", () => {
    mockNav("/dashboard", new URLSearchParams())
    withQueryClient(<DashboardClient />)
    expect(
      screen.getByRole("heading", { name: /passport dashboard/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/wallet address/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^load$/i }),
    ).toBeInTheDocument()
  })

  it("shows WalletRequiredAlert when no wallet is in the URL", () => {
    mockNav("/dashboard", new URLSearchParams())
    withQueryClient(<DashboardClient />)
    expect(
      screen.getByText(/enter a wallet address/i),
    ).toBeInTheDocument()
  })

  it("renders the split layout (left aside + right passport)", () => {
    mockNav("/dashboard", new URLSearchParams())
    const { container } = withQueryClient(<DashboardClient />)
    const grid = container.querySelector(".grid.lg\\:grid-cols-\\[20rem_1fr\\]")
    expect(grid).toBeTruthy()
    expect(container.querySelector("aside")).toBeInTheDocument()
    expect(container.querySelector("section")).toBeInTheDocument()
  })

  it("fetches and renders the trust score when a valid wallet is in the URL", async () => {
    mockNav(
      "/dashboard",
      new URLSearchParams(`?wallet=${WALLET}`),
    )
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
    )
    withQueryClient(<DashboardClient />)
    expect(await screen.findByText("76.2")).toBeInTheDocument()
    expect(await screen.findByText(/112\.07 ALGO/)).toBeInTheDocument()
    expect(screen.getAllByText(WALLET).length).toBeGreaterThan(0)
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