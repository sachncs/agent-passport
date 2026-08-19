"use client"

import Link from "next/link"
import { Activity, Award, Gauge, HandCoins, Search, Shield, Star, Users } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Tool {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

const TOOLS: Tool[] = [
  {
    href: "/score",
    icon: Gauge,
    title: "Trust Score",
    description:
      "Composite 0–100 score with five sub-scores (age, activity, volume, velocity, compliance).",
  },
  {
    href: "/passport",
    icon: Award,
    title: "Passport",
    description:
      "Full document combining trust, delegation, sybil, reputation, credit, capabilities, and a SHA-256 checksum.",
  },
  {
    href: "/underwrite",
    icon: Shield,
    title: "Underwrite",
    description:
      "Approve/deny + recommended credit limit, computed from a 4-factor composite and a $100k system-wide cap.",
  },
  {
    href: "/delegation",
    icon: Users,
    title: "Delegation Graph",
    description:
      "Sponsor graph BFS with depth attenuation, cycle detection, and trust-anchor markers.",
  },
  {
    href: "/sybil",
    icon: Activity,
    title: "Sybil Check",
    description:
      "Twelve signals (clustering, timing, amount, balance, plus 4 graph-traversal signals).",
  },
  {
    href: "/reputation",
    icon: Star,
    title: "Reputation",
    description:
      "Event log with anti-gaming defenses (cycle detection, dedup, on-chain verification).",
  },
  {
    href: "/counterparty",
    icon: HandCoins,
    title: "Counterparty Check",
    description:
      "Buyer risk check for merchant integrations: 60% on-chain + 40% delegation trust.",
  },
  {
    href: "/discovery",
    icon: Search,
    title: "Bazaar",
    description:
      "Search the x402 Bazaar catalog of agent services for trust, credit, or reputation needs.",
  },
]

export default function HomePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Agent Passport
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Stateless trust and underwriting for AI agents on Algorand. Every
          wallet, every endpoint, every algorithm — one consistent view of
          who to trust and how much.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="block transition-transform hover:-translate-y-0.5"
          >
            <Card className="h-full transition-colors hover:bg-accent/40">
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
    </div>
  )
}
