import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  WalletRequiredAlert,
} from "@/components/page-header"
import { Inbox } from "lucide-react"

describe("PageHeader", () => {
  it("renders title and description", () => {
    render(
      <PageHeader
        title="Trust Score"
        description="Composite trust scoring"
      />,
    )
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Trust Score",
    )
    expect(screen.getByText("Composite trust scoring")).toBeInTheDocument()
  })

  it("renders badge when provided", () => {
    render(
      <PageHeader
        title="Score"
        description="x"
        badge="?wallet="
      />,
    )
    expect(screen.getByText("?wallet=")).toBeInTheDocument()
  })

  it("omits badge when not provided", () => {
    render(<PageHeader title="Score" description="x" />)
    expect(screen.queryByText("?wallet=")).not.toBeInTheDocument()
  })
})

describe("EmptyState", () => {
  it("renders icon, title, description", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing here"
        description="Try a different search"
      />,
    )
    expect(screen.getByText("Nothing here")).toBeInTheDocument()
    expect(screen.getByText("Try a different search")).toBeInTheDocument()
  })
})

describe("LoadingBlock", () => {
  it("renders the requested number of skeleton rows", () => {
    const { container } = render(<LoadingBlock rows={3} />)
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(3)
  })

  it("defaults to 4 rows", () => {
    const { container } = render(<LoadingBlock />)
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(4)
  })
})

describe("ErrorBlock", () => {
  it("renders the message in an alert", () => {
    render(<ErrorBlock message="Wallet not found" />)
    expect(screen.getByText("Wallet not found")).toBeInTheDocument()
    expect(screen.getByText("Could not load")).toBeInTheDocument()
  })
})

describe("WalletRequiredAlert", () => {
  it("renders prompt to enter wallet", () => {
    render(<WalletRequiredAlert />)
    expect(
      screen.getByText("Enter a wallet address"),
    ).toBeInTheDocument()
  })
})