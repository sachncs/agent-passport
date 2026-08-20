"use client"

import { useSearchParams } from "next/navigation"
import { Award } from "lucide-react"

import { WalletHeroInput } from "@/components/wallet-hero-input"
import { PassportView } from "./passport-view"

export function DashboardClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return (
      <div className="space-y-12">
        <section className="text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Passport report
          </div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
            One wallet, every service.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
            Type an address to load the full report — trust, sybil,
            reputation, delegation, and underwriting in a single document.
          </p>
          <div className="mt-8">
            <WalletHeroInput wallet={null} target="/dashboard" />
          </div>
        </section>
        <section className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-6 text-center">
          <Award className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            What you get
          </h2>
          <p className="text-xs text-muted-foreground">
            A composite trust score, twelve sybil signals, a reputation
            log, the full delegation path, and an underwriting decision —
            one scrollable page.
          </p>
        </section>
      </div>
    )
  }

  return <PassportView />
}