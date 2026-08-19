import { Link } from "react-router-dom"
import {
  Activity,
  Award,
  Gauge,
  HandCoins,
  Search,
  Shield,
  Star,
  Users,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/widgets"

interface Tool {
  to: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  status: "live" | "ready"
}

const TOOLS: Tool[] = [
  {
    to: "/score",
    icon: Gauge,
    title: "Trust Score",
    description:
      "Composite 0–100 score with five sub-scores (age, activity, volume, velocity, compliance).",
    status: "live",
  },
  {
    to: "/passport",
    icon: Award,
    title: "Passport",
    description:
      "Full document combining trust, delegation, sybil, reputation, credit, capabilities, and a SHA-256 checksum.",
    status: "live",
  },
  {
    to: "/underwrite",
    icon: Shield,
    title: "Underwrite",
    description:
      "Approve/deny decision with recommended credit limit, four weighted factors, and a $100k system cap.",
    status: "live",
  },
  {
    to: "/delegation",
    icon: Users,
    title: "Delegation Graph",
    description:
      "Sponsor graph BFS with depth attenuation, cycle detection, and trust-anchor markers.",
    status: "live",
  },
  {
    to: "/sybil",
    icon: Activity,
    title: "Sybil Check",
    description:
      "Twelve signals (clustering, timing, amount, balance, plus 4 graph-traversal signals).",
    status: "live",
  },
  {
    to: "/reputation",
    icon: Star,
    title: "Reputation",
    description:
      "Event log with anti-gaming defenses (cycle detection, dedup, on-chain verification).",
    status: "live",
  },
  {
    to: "/counterparty",
    icon: HandCoins,
    title: "Counterparty Check",
    description:
      "Buyer risk check for merchant integrations: 60% on-chain + 40% delegation trust.",
    status: "live",
  },
  {
    to: "/discovery",
    icon: Search,
    title: "Bazaar",
    description:
      "Search the x402 Bazaar catalog of agent services for trust, credit, or reputation needs.",
    status: "live",
  },
]

export default function Home() {
  return (
    <>
      <PageHeader
        title="Agent Passport"
        description="Stateless trust and underwriting for AI agents on Algorand. Every wallet, every endpoint, every algorithm — one consistent view of who to trust and how much."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((tool) => (
          <Link
            key={tool.to}
            to={tool.to}
            className="group block transition-transform hover:-translate-y-0.5"
          >
            <Card className="h-full transition-colors group-hover:bg-accent/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <tool.icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">{tool.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{tool.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
