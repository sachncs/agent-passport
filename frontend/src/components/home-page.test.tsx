import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import HomePage from "@/components/home-page"

describe("HomePage", () => {
  it("renders the brand headline", () => {
    render(<HomePage />)
    expect(
      screen.getByRole("heading", { name: /trust and underwriting/i }),
    ).toBeInTheDocument()
  })

  it("renders the wallet hero input", () => {
    render(<HomePage />)
    expect(screen.getByLabelText(/algorand wallet address/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /load report/i }),
    ).toBeInTheDocument()
  })

  it("renders one card per feature", () => {
    render(<HomePage />)
    const expected = ["Passport Report", "Trust Score", "Underwrite", "Bazaar"]
    for (const title of expected) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it("links the Passport Report card to /dashboard", () => {
    render(<HomePage />)
    const card = screen.getByRole("link", { name: /passport report/i })
    expect(card.getAttribute("href")).toBe("/dashboard")
  })

  it("disables submit until the wallet looks valid", async () => {
    const user = userEvent.setup()
    render(<HomePage />)
    const button = screen.getByRole("button", { name: /load report/i })
    expect(button).toBeDisabled()
    const input = screen.getByLabelText(/algorand wallet address/i)
    await user.type(input, "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A")
    expect(button).toBeEnabled()
  })
})