import { CheckCircle2, ShieldAlert, ShieldX } from "lucide-react"

import { cn } from "@/lib/utils"

interface VerdictCardProps {
  approved: boolean
  recommendedLimit: number
  compositeScore: number
  confidence: number
  riskLabel?: string
  unit?: string
  className?: string
}

export function VerdictCard({
  approved,
  recommendedLimit,
  compositeScore,
  confidence,
  riskLabel,
  unit = "ALGO",
  className,
}: VerdictCardProps) {
  const Icon = approved ? CheckCircle2 : ShieldX
  const accent = approved ? "border-verified/30" : "border-risk-critical/30"
  const tone = approved ? "text-verified-fg" : "text-risk-critical"

  return (
    <div
      role="region"
      aria-label={`Underwriting verdict: ${approved ? "Approved" : "Denied"}`}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-surface-2/60 p-6 shadow-[var(--shadow-sm)] ring-1 ring-foreground/5 md:p-8",
        accent,
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.16em]",
            accent,
            tone,
          )}
        >
          <Icon aria-hidden className="h-3.5 w-3.5" />
          {approved ? "Approve" : "Deny"}
        </div>
        {riskLabel && (
          <span className="text-xs uppercase tracking-[0.14em] text-muted-fg">
            Risk · {riskLabel}
          </span>
        )}
      </div>

      <div className="mt-6 flex items-baseline gap-3 font-heading">
        <span
          className={cn(
            "text-5xl font-semibold tracking-tight tabular-nums md:text-6xl",
            approved ? "text-foreground" : "text-foreground",
          )}
        >
          {recommendedLimit.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}
        </span>
        <span className="text-base font-medium text-muted-fg md:text-lg">
          {unit}
        </span>
      </div>
      <div className="mt-1 text-sm text-muted-fg">
        Recommended credit limit
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-5 md:grid-cols-3">
        <Stat label="Composite" value={compositeScore.toFixed(1)} />
        <Stat
          label="Confidence"
          value={`${(confidence * 100).toFixed(0)}%`}
        />
        <Stat
          label="Sanctions"
          value={
            <span className="inline-flex items-center gap-1 text-verified-fg">
              <ShieldAlert aria-hidden className="h-3 w-3" />
              Allowed
            </span>
          }
        />
      </dl>
    </div>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
        {label}
      </dt>
      <dd className="mt-1 font-heading text-base font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  )
}
