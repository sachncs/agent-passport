import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import GlobalRouteError from "@/app/error"

describe("GlobalRouteError", () => {
  it("renders the error title and message", () => {
    const error = Object.assign(new Error("Network exploded"), {
      digest: "abc-123",
    })
    render(<GlobalRouteError error={error} reset={vi.fn()} />)
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByText("Network exploded")).toBeInTheDocument()
    expect(screen.getByText(/digest: abc-123/)).toBeInTheDocument()
  })

  it("falls back to a generic message when error.message is empty", () => {
    const error = new Error("")
    render(<GlobalRouteError error={error} reset={vi.fn()} />)
    expect(
      screen.getByText(/an unexpected error occurred/i),
    ).toBeInTheDocument()
  })

  it("calls reset when Try again is clicked", async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    const error = new Error("Boom")
    render(<GlobalRouteError error={error} reset={reset} />)
    await user.click(screen.getByRole("button", { name: /try again/i }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it("does not render the digest when missing", () => {
    const error = new Error("Boom")
    render(<GlobalRouteError error={error} reset={vi.fn()} />)
    expect(screen.queryByText(/digest:/i)).not.toBeInTheDocument()
  })
})