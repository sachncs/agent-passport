import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { Logo } from "@/components/brand/logo"

describe("Logo", () => {
  it("renders the brand mark as an svg with the right aria-label", () => {
    render(<Logo variant="mark" />)
    expect(
      screen.getByRole("img", { name: /agent passport/i }),
    ).toBeInTheDocument()
  })

  it("renders the wordmark variant", () => {
    render(<Logo variant="wordmark" />)
    expect(screen.getByText("Agent Passport")).toBeInTheDocument()
  })

  it("renders the full lockup with tagline", () => {
    render(<Logo variant="full" />)
    expect(screen.getByText("Agent Passport")).toBeInTheDocument()
    expect(
      screen.getByText(/trust & underwriting for ai agents/i),
    ).toBeInTheDocument()
  })
})
