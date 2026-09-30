"use client"

import { useSearchParams } from "next/navigation"
import { Award } from "lucide-react"

import { CommandSurface } from "@/components/command-surface"
import { PassportView } from "./passport-view"

export function DashboardClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return (
      <div className="space-y-14">
        <section className="mx-auto max-w-4xl text-center">
          <div className="console-eyebrow mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-verified/25 bg-verified-bg px-4 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Evidence workspace
          </div>
          <h1 className="font-heading text-5xl font-semibold tracking-[-0.04em] md:text-7xl md:leading-[1.02]">
            Make an agent legible.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            Start with an Algorand wallet. Get observable evidence, an explainable decision,
            and the operational detail behind it.
          </p>
          <div className="mt-10">
            <CommandSurface wallet={null} target="/dashboard" cta="Load Report" />
          </div>
        </section>
        <section className="console-panel mx-auto max-w-5xl p-6 md:p-8">
          <div className="mb-7 flex items-center gap-3">
            <Award className="h-5 w-5 text-verified" />
            <div>
              <p className="console-eyebrow">What the report gives you</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">One evidence surface for every decision.</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Trust", "Composite score with age, activity, volume, velocity, and compliance inputs."],
              ["Network", "Delegation, reputation, and Sybil-like signals around the wallet."],
              ["Action", "Underwriting outcome, recommended limit, and evidence you can explain."],
            ].map(([label, text]) => (
              <div key={label} className="rounded-xl border border-border/70 bg-background/40 p-5">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  return <PassportView />
}
