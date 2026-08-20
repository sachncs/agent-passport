import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { VerdictCard } from "@/components/report/verdict-card"
import { AuditStrip } from "@/components/report/audit-strip"

describe("VerdictCard", () => {
  it("renders Approve verdict with emerald styling", () => {
    render(
      <VerdictCard
        approved
        recommendedLimit={1250}
        compositeScore={78.4}
        confidence={0.92}
      />,
    )
    expect(
      screen.getByRole("region", { name: /underwriting verdict: approved/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("Approve")).toBeInTheDocument()
    expect(screen.getByText("1,250")).toBeInTheDocument()
    expect(screen.getByText("ALGO")).toBeInTheDocument()
    expect(screen.getByText("78.4")).toBeInTheDocument()
    expect(screen.getByText("92%")).toBeInTheDocument()
  })

  it("renders Deny verdict with risk-critical styling", () => {
    render(
      <VerdictCard
        approved={false}
        recommendedLimit={0}
        compositeScore={32.1}
        confidence={0.5}
      />,
    )
    expect(
      screen.getByRole("region", { name: /underwriting verdict: denied/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("Deny")).toBeInTheDocument()
  })
})

describe("AuditStrip", () => {
  it("renders the default network / model / cache items", () => {
    render(<AuditStrip />)
    expect(screen.getByText("Algorand Mainnet")).toBeInTheDocument()
    expect(screen.getByText("v0.1")).toBeInTheDocument()
    expect(screen.getByText("60 s")).toBeInTheDocument()
  })

  it("renders additional children", () => {
    render(
      <AuditStrip>
        <span>sha256 abc123</span>
      </AuditStrip>,
    )
    expect(screen.getByText("sha256 abc123")).toBeInTheDocument()
  })
})
