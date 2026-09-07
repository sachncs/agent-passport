import { AlertOctagon, AlertTriangle, CheckCircle2, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

interface Signal {
  name: string
  value: number
}

interface SybilSummaryProps {
  sybilRisk: number
  clusterSize: number
  risk?: string
  signals?: Signal[]
  className?: string
}

function statusFor(value: number): {
  Icon: React.ComponentType<{ className?: string }>
  label: string
  tone: string
} {
  if (value < 0.25)
    return {
      Icon: CheckCircle2,
      label: "Normal",
      tone: "text-verified-fg",
    }
  if (value < 0.5)
    return {
      Icon: Circle,
      label: "Watch",
      tone: "text-muted-fg",
    }
  if (value < 0.75)
    return {
      Icon: AlertTriangle,
      label: "Elevated",
      tone: "text-risk-medium",
    }
  return {
    Icon: AlertOctagon,
    label: "High",
    tone: "text-risk-critical",
  }
}

export function SybilSummary({
  sybilRisk,
  clusterSize,
  risk,
  signals = [],
  className,
}: SybilSummaryProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-2/60 p-5 shadow-[var(--shadow-sm)] ring-1 ring-foreground/5",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
          Sybil risk
        </span>
        {risk && (
          <span className="text-xs uppercase tracking-[0.14em] text-muted-fg">
            {risk}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="font-heading text-4xl font-semibold tracking-tight tabular-nums text-foreground md:text-5xl">
          {(sybilRisk * 100).toFixed(0)}%
        </span>
        <span className="text-sm text-muted-fg">
          cluster {clusterSize.toLocaleString()}
        </span>
      </div>
      {signals.length > 0 && (
        <ul className="mt-5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {signals.map((s) => {
            const status = statusFor(s.value)
            const label = s.name
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (c) => c.toUpperCase())
              .trim()
            return (
              <li
                key={s.name}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-1.5"
              >
                <span className="flex items-center gap-2 text-xs">
                  <status.Icon
                    aria-hidden
                    className={cn("h-3 w-3", status.tone)}
                  />
                  <span className="text-foreground">{label}</span>
                </span>
                <span
                  className={cn(
                    "font-mono text-xs tabular-nums",
                    status.tone,
                  )}
                >
                  {(s.value * 100).toFixed(0)}%
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
