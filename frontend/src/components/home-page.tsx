"use client"

import { CommandSurface } from "@/components/command-surface"
import { CodeBlock } from "@/components/code-block"

const CAPABILITIES = [
  {
    audience: "For underwriters",
    text: "Approve, deny, or limit with a four-factor composite and configured policy signals.",
  },
  {
    audience: "For agent operators",
    text: "Reputation log, sybil signals, and a delegation graph for any wallet.",
  },
  {
    audience: "For protocol teams",
    text: "Read-oriented service, process-local response cache, OpenAPI and Prometheus metrics.",
  },
] as const

export default function HomePage() {
  return (
    <div className="space-y-24">
      <section className="pt-4 text-center md:pt-8">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-verified/25 bg-verified-bg px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-verified">
          <span className="h-1.5 w-1.5 rounded-full bg-verified" /> Evidence before confidence
        </div>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-6xl md:leading-[1.02]">
          Make every agent
          <br className="hidden sm:block" /> legible.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm text-muted-fg md:text-base">
          Turn observable Algorand behavior into explainable trust, risk, and
          underwriting decisions your systems can act on.
        </p>
        <div className="mt-10">
          <CommandSurface />
        </div>
      </section>

      <section className="mx-auto max-w-4xl rounded-2xl border border-border bg-card/50 p-6 md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-verified">A decision surface</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">Unknown agent → evidence → action</h2>
          </div>
          <span className="text-xs text-muted-fg">Self-hosted console · no account required</span>
        </div>
        <ul className="mx-auto max-w-3xl divide-y divide-border/60">
          {CAPABILITIES.map((c) => (
            <li
              key={c.audience}
              className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-[10rem_1fr] sm:gap-6 sm:py-6"
            >
              <span className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
                {c.audience}
              </span>
              <span className="text-sm text-foreground md:text-base">
                {c.text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
            Wire format
          </h2>
          <span className="text-xs text-muted-fg">
            Developer path · local-first · illustrative request
          </span>
        </div>
        <CodeBlock
          language="http"
          code={`curl "http://localhost:3000/passport?wallet=$WALLET"`}
        />
      </section>
    </div>
  )
}
