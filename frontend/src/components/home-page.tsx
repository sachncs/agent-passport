"use client"

import { CommandSurface } from "@/components/command-surface"
import { CodeBlock } from "@/components/code-block"

const CAPABILITIES = [
  {
    audience: "For underwriters",
    text: "Approve, deny, or limit with a four-factor composite and sanctions check.",
  },
  {
    audience: "For agent operators",
    text: "Reputation log, sybil signals, and a delegation graph for any wallet.",
  },
  {
    audience: "For protocol teams",
    text: "Stateless API, sub-50 ms cached responses, OpenAPI and metrics exposed.",
  },
] as const

export default function HomePage() {
  return (
    <div className="space-y-24">
      <section className="pt-4 text-center md:pt-8">
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.1]">
          Trust, reputation, and underwriting
          <br className="hidden sm:block" /> for AI agents on Algorand.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm text-muted-fg md:text-base">
          Paste any Algorand wallet — get a complete trust report and a
          clear underwriting decision in a single, scannable document.
        </p>
        <div className="mt-10">
          <CommandSurface />
        </div>
      </section>

      <section>
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
            Stateless · 60 s cache · on-chain verified
          </span>
        </div>
        <CodeBlock
          language="http"
          code={`curl https://api.agentpassport.ai/passport?wallet=$WALLET`}
        />
      </section>
    </div>
  )
}
