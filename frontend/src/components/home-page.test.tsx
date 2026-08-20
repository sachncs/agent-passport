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
      screen.getByRole("heading", {
        name: /trust, reputation, and underwriting/i,
      }),
    ).toBeInTheDocument()
  })

  it("renders the wallet command input", () => {
    render(<HomePage />)
    expect(
      screen.getByLabelText(/algorand wallet address/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /run report/i }),
    ).toBeInTheDocument()
  })

  it("renders the three capability lines", () => {
    render(<HomePage />)
    expect(screen.getByText(/for underwriters/i)).toBeInTheDocument()
    expect(screen.getByText(/for agent operators/i)).toBeInTheDocument()
    expect(screen.getByText(/for protocol teams/i)).toBeInTheDocument()
  })

  it("disables submit until the wallet looks valid", async () => {
    const user = userEvent.setup()
    render(<HomePage />)
    const button = screen.getByRole("button", { name: /run report/i })
    expect(button).toBeDisabled()
    const input = screen.getByLabelText(/algorand wallet address/i)
    await user.type(
      input,
      "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A",
    )
    expect(button).toBeEnabled()
  })

  it("offers a sample wallet link", () => {
    render(<HomePage />)
    expect(
      screen.getByRole("button", { name: /try a sample wallet/i }),
    ).toBeInTheDocument()
  })
})
