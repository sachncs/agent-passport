import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next/navigation", () => ({
  usePathname: () => "/score",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const setTheme = vi.fn()
vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "dark",
    setTheme,
  }),
}))

import { TopBar } from "@/components/topbar"

describe("TopBar", () => {
  it("renders the wallet search input", () => {
    render(<TopBar />)
    expect(screen.getByLabelText("Wallet address")).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/Algorand wallet address/i),
    ).toBeInTheDocument()
  })

  it("renders the Look up button", () => {
    render(<TopBar />)
    expect(
      screen.getByRole("button", { name: /look up/i }),
    ).toBeInTheDocument()
  })

  it("renders the theme toggle button", () => {
    render(<TopBar />)
    expect(
      screen.getByRole("button", { name: /toggle theme/i }),
    ).toBeInTheDocument()
  })

  it("toggles theme from dark to light when clicked", async () => {
    const user = userEvent.setup()
    render(<TopBar />)
    await user.click(screen.getByRole("button", { name: /toggle theme/i }))
    expect(setTheme).toHaveBeenCalledWith("light")
  })
})