import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}))

import * as NextNav from "next/navigation"
import { AppSidebar, SidebarWrapper } from "@/components/sidebar"

const mockPath = (pathname: string) => {
  vi.mocked(NextNav.usePathname).mockReturnValue(pathname)
}

function activeLinks(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLAnchorElement>(
      "a[data-active], button[data-active]",
    ),
  ).map((el) => (el.textContent ?? "").trim())
}

describe("AppSidebar", () => {
  it("renders the brand", () => {
    mockPath("/")
    render(
      <SidebarWrapper>
        <AppSidebar />
      </SidebarWrapper>,
    )
    expect(screen.getByText("Agent Passport")).toBeInTheDocument()
  })

  it("renders all 11 nav items", () => {
    mockPath("/")
    const expectedLabels = [
      "Overview",
      "Trust Score",
      "Passport",
      "Underwrite",
      "Delegation",
      "Sybil Check",
      "Reputation",
      "Counterparty",
      "Endorse / Revoke",
      "Bazaar",
      "Monitor",
    ]
    const { container } = render(
      <SidebarWrapper>
        <AppSidebar />
      </SidebarWrapper>,
    )
    for (const label of expectedLabels) {
      const matches = Array.from(container.querySelectorAll("a, button")).filter(
        (el) => (el.textContent ?? "").trim() === label,
      )
      expect(
        matches.length,
        `expected nav item "${label}" to render exactly once`,
      ).toBeGreaterThan(0)
    }
  })

  it("highlights only Trust Score when on /score", () => {
    mockPath("/score")
    const { container } = render(
      <SidebarWrapper>
        <AppSidebar />
      </SidebarWrapper>,
    )
    const active = activeLinks(container)
    expect(active).toContain("Trust Score")
    expect(active).not.toContain("Overview")
    expect(active).not.toContain("Passport")
  })

  it("matches nested paths to their parent nav item", () => {
    mockPath("/counterparty/details")
    const { container } = render(
      <SidebarWrapper>
        <AppSidebar />
      </SidebarWrapper>,
    )
    const active = activeLinks(container)
    expect(active).toContain("Counterparty")
  })

  it("highlights Overview only on the home route", () => {
    mockPath("/")
    const { container } = render(
      <SidebarWrapper>
        <AppSidebar />
      </SidebarWrapper>,
    )
    const active = activeLinks(container)
    expect(active).toContain("Overview")
    expect(active.length).toBe(1)
  })

  it("renders the Service status footer link", () => {
    mockPath("/")
    const { container } = render(
      <SidebarWrapper>
        <AppSidebar />
      </SidebarWrapper>,
    )
    const serviceStatus = Array.from(
      container.querySelectorAll("a"),
    ).find((a) => (a.textContent ?? "").includes("Service status"))
    expect(serviceStatus).toBeDefined()
    expect(serviceStatus?.getAttribute("href")).toBe("/monitor")
  })
})