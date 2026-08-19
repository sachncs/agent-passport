import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import HomePage from "@/components/home-page"

describe("HomePage", () => {
  it("renders the brand heading", () => {
    render(<HomePage />)
    expect(
      screen.getByRole("heading", { name: /agent passport/i, level: 1 }),
    ).toBeInTheDocument()
  })

  it("renders a tool card for each entry", () => {
    render(<HomePage />)
    const expected = [
      "Trust Score",
      "Passport",
      "Underwrite",
      "Delegation Graph",
      "Sybil Check",
      "Reputation",
      "Counterparty Check",
      "Bazaar",
    ]
    for (const title of expected) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it("links each tool card to its route", () => {
    render(<HomePage />)
    expect(
      screen.getByRole("link", { name: /trust score/i }).getAttribute("href"),
    ).toBe("/score")
    expect(
      screen.getByRole("link", { name: /passport/i }).getAttribute("href"),
    ).toBe("/passport")
    expect(
      screen.getByRole("link", { name: /underwrite/i }).getAttribute("href"),
    ).toBe("/underwrite")
    expect(
      screen.getByRole("link", { name: /sybil check/i }).getAttribute("href"),
    ).toBe("/sybil")
  })
})