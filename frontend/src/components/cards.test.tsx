import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { KpiCard } from "@/components/kpi-card"
import { SubScoreCard } from "@/components/sub-score-card"
import { FactorCard } from "@/components/factor-card"

describe("KpiCard", () => {
  it("renders label and value", () => {
    render(<KpiCard label="Trust score" value="87.4" />)
    expect(screen.getByText("Trust score")).toBeInTheDocument()
    expect(screen.getByText("87.4")).toBeInTheDocument()
  })

  it("renders a progress bar when progress is provided", () => {
    const { container } = render(
      <KpiCard label="Trust score" value="80" progress={80} />,
    )
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })
})

describe("SubScoreCard", () => {
  it("renders label and score", () => {
    render(<SubScoreCard label="Age" score={90} />)
    expect(screen.getByText("Age")).toBeInTheDocument()
    expect(screen.getByText("90.0")).toBeInTheDocument()
    expect(screen.getByText("/ 100")).toBeInTheDocument()
  })

  it("respects max", () => {
    render(<SubScoreCard label="Custom" score={7} max={10} />)
    expect(screen.getByText("/ 10")).toBeInTheDocument()
  })
})

describe("FactorCard", () => {
  it("renders name, status pill, and weight/contribution footer", () => {
    render(
      <FactorCard
        name="Trust"
        score={75}
        weight={0.4}
        contribution={30}
        status="positive"
      />,
    )
    expect(screen.getByText("Trust")).toBeInTheDocument()
    expect(screen.getByText("Positive")).toBeInTheDocument()
    expect(screen.getByText(/weight 40%/)).toBeInTheDocument()
    expect(screen.getByText(/contribution 30\.00/)).toBeInTheDocument()
  })

  it("renders neutral status", () => {
    render(
      <FactorCard
        name="Volume"
        score={50}
        weight={0.2}
        contribution={10}
        status="neutral"
      />,
    )
    expect(screen.getByText("Neutral")).toBeInTheDocument()
  })

  it("renders negative status", () => {
    render(
      <FactorCard
        name="Sybil"
        score={20}
        weight={0.2}
        contribution={4}
        status="negative"
      />,
    )
    expect(screen.getByText("Negative")).toBeInTheDocument()
  })
})
