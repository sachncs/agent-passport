import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import * as NextNav from "next/navigation"
import { AppBreadcrumb } from "@/components/breadcrumb"

const mockPathname = (pathname: string) => {
  vi.mocked(NextNav.usePathname).mockReturnValue(pathname)
}

describe("AppBreadcrumb", () => {
  it("renders Overview + current segment on /score", () => {
    mockPathname("/score")
    render(<AppBreadcrumb />)
    expect(screen.getByText("Overview")).toBeInTheDocument()
    expect(screen.getByText("Trust Score")).toBeInTheDocument()
  })

  it("renders Overview as the only crumb on /", () => {
    mockPathname("/")
    render(<AppBreadcrumb />)
    expect(screen.getByText("Overview")).toBeInTheDocument()
  })

  it("renders a multi-segment path with intermediate links", () => {
    mockPathname("/score/details")
    render(<AppBreadcrumb />)
    expect(screen.getByText("Overview")).toBeInTheDocument()
    expect(screen.getByText("Trust Score")).toBeInTheDocument()
    expect(screen.getByText("details")).toBeInTheDocument()
  })

  it("uses the route label map for known segments", () => {
    mockPathname("/counterparty")
    render(<AppBreadcrumb />)
    expect(screen.getByText("Counterparty")).toBeInTheDocument()
  })

  it("falls back to the raw segment when no label is known", () => {
    mockPathname("/totally-new-segment")
    render(<AppBreadcrumb />)
    expect(screen.getByText("totally-new-segment")).toBeInTheDocument()
  })
})

// suppress unused import
void React