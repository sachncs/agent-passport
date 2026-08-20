"use client"

import Link from "next/link"
import {
  Award,
  Gauge,
  Search,
  Shield,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { WalletHeroInput } from "@/components/wallet-hero-input"

interface Feature {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  tag: string
}

const FEATURES: Feature[] = [
  {
    href: "/dashboard",
    icon: Award,
    title: "Passport Report",
    description:
      "One scrollable document with trust, sybil, reputation, delegation, and underwriting for any wallet.",
    tag: "Recommended",
  },
  {
    href: "/score",
    icon: Gauge,
    title: "Trust Score",
    description:
      "Composite 0–100 score with five sub-scores (age, activity, volume, velocity, compliance).",
    tag: "Detailed view",
  },
  {
    href: "/underwrite",
    icon: Shield,
    title: "Underwrite",
    description:
      "Approve or deny plus a recommended credit limit, from a four-factor composite under a system cap.",
    tag: "For merchants",
  },
  {
    href: "/discovery",
    icon: Search,
    title: "Bazaar",
    description:
      "Search the x402 Bazaar catalog of agent services for trust, credit, or reputation needs.",
    tag: "Discovery",
  },
]

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="text-center">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Stateless · cached · on-chain verified
        </div>
        <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
          Trust and underwriting
          <br className="hidden sm:block" /> for AI agents on Algorand.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
          Paste any Algorand wallet and get the full report — composite trust
          score, sybil signals, reputation log, delegation graph, and an
          underwriting decision — in a single, scannable document.
        </p>
        <div className="mt-8">
          <WalletHeroInput wallet={null} />
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <div className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Tools
            </div>
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              Open a report, or jump straight to a focused view.
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="group block transition-transform hover:-translate-y-0.5"
            >
              <Card className="relative h-full overflow-hidden transition-colors group-hover:bg-accent/30">
                <CardContent className="flex h-full flex-col gap-4 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
                      {feature.tag}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-heading text-base font-semibold tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}