import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import NotFound from "@/app/not-found"

describe("NotFound", () => {
  it("renders the heading and message", () => {
    render(<NotFound />)
    expect(
      screen.getByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/the route you tried to open doesn't exist/i),
    ).toBeInTheDocument()
  })

  it("renders a back-to-overview link", () => {
    render(<NotFound />)
    const link = screen.getByRole("link", { name: /back to overview/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute("href")).toBe("/")
  })
})