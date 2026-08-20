import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { RiskPill } from "@/components/risk-pill"

describe("RiskPill", () => {
  it("renders the label and aria-label for low risk", () => {
    render(<RiskPill risk="low" />)
    expect(screen.getByText("Low")).toBeInTheDocument()
    expect(screen.getByLabelText("Risk: Low")).toBeInTheDocument()
  })

  it("renders the label for medium risk", () => {
    render(<RiskPill risk="medium" />)
    expect(screen.getByText("Medium")).toBeInTheDocument()
  })

  it("renders the label for high risk", () => {
    render(<RiskPill risk="high" />)
    expect(screen.getByText("High")).toBeInTheDocument()
  })

  it("renders the label for critical risk", () => {
    render(<RiskPill risk="critical" />)
    expect(screen.getByText("Critical")).toBeInTheDocument()
  })

  it("hides the icon when showIcon is false", () => {
    render(<RiskPill risk="low" showIcon={false} />)
    expect(screen.getByText("Low")).toBeInTheDocument()
  })
})
