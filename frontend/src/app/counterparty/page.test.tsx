import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

import CounterpartyPage from "@/app/counterparty/page"

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

import { beforeAll, afterEach, afterAll } from "vitest"

const WALLET = "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"

describe("CounterpartyPage", () => {
  it("renders the page header and form", () => {
    render(<CounterpartyPage />)
    expect(
      screen.getByRole("heading", { name: /counterparty check/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/buyer wallet/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^check$/i }),
    ).toBeInTheDocument()
  })

  it("shows a validation error for an invalid wallet", async () => {
    const user = userEvent.setup()
    render(<CounterpartyPage />)
    await user.type(screen.getByLabelText(/buyer wallet/i), "not-a-wallet")
    await user.click(screen.getByRole("button", { name: /^check$/i }))
    expect(
      await screen.findByText(/isn't a valid 58-character base32/i),
    ).toBeInTheDocument()
  })

  it("shows the Allow card on a successful allow response", async () => {
    server.use(
      http.post("http://localhost/counterparty-check", () =>
        HttpResponse.json({
          allow: true,
          trustScore: 92.1,
          onChainScore: 88.4,
          delegationScore: 75.0,
          explanation: ["Good history", "Active sponsor"],
        }),
      ),
    )
    const user = userEvent.setup()
    render(<CounterpartyPage />)
    await user.type(screen.getByLabelText(/buyer wallet/i), WALLET)
    await user.click(screen.getByRole("button", { name: /^check$/i }))
    expect(await screen.findByText(/^allow$/i)).toBeInTheDocument()
    expect(screen.getByText(/Trust 92\.1/)).toBeInTheDocument()
    expect(screen.getByText("Good history")).toBeInTheDocument()
  })

  it("shows the Deny card with the API error message on a 4xx", async () => {
    server.use(
      http.post("http://localhost/counterparty-check", () =>
        HttpResponse.json(
          { error: "Wallet sanctioned" },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    render(<CounterpartyPage />)
    await user.type(screen.getByLabelText(/buyer wallet/i), WALLET)
    await user.click(screen.getByRole("button", { name: /^check$/i }))
    expect(await screen.findByText("Wallet sanctioned")).toBeInTheDocument()
  })
})