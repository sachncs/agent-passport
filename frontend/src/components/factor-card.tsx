import { ArrowDownRight, ArrowUpRight, Equal } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Status } from "@/lib/api-types"

interface FactorCardProps {
  name: string
  score: number
  weight: number
  contribution: number
  status: Status
  className?: string
}

const STATUS_TONE: Record<Status, string> = {
  positive: "text-verified-fg",
  neutral: "text-muted-fg",
  negative: "text-risk-critical",
}

const STATUS_LABEL: Record<Status, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
}

export function FactorCard({
  name,
  score,
  weight,
  contribution,
  status,
  className,
}: FactorCardProps) {
  const DirectionIcon =
    status === "positive"
      ? ArrowUpRight
      : status === "negative"
        ? ArrowDownRight
        : Equal
  const pct = Math.max(0, Math.min(100, score))

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface-2/40 p-4 shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{name}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em]",
            STATUS_TONE[status],
          )}
          aria-label={`Status: ${STATUS_LABEL[status]}`}
        >
          <DirectionIcon aria-hidden className="h-3 w-3" />
          {STATUS_LABEL[status]}
        </span>
      </div>
      <div
        aria-hidden
        className="relative h-1 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-(--duration)",
            status === "positive"
              ? "bg-verified"
              : status === "negative"
                ? "bg-risk-critical"
                : "bg-foreground/70",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between font-mono text-xs tabular-nums text-muted-fg">
        <span>score {score.toFixed(1)}</span>
        <span>
          weight {(weight * 100).toFixed(0)}% · contribution{" "}
          {contribution.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
