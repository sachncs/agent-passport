import { ArrowDownRight, ArrowUpRight, Equal } from "lucide-react"

import { cn } from "@/lib/utils"

interface SubScoreCardProps {
  label: string
  score: number
  max?: number
  direction?: "up" | "down" | "flat"
  className?: string
}

function getToneClass(score: number, max = 100): string {
  const pct = (score / max) * 100
  if (pct >= 75) return "text-verified-fg"
  if (pct >= 50) return "text-foreground"
  if (pct >= 25) return "text-risk-medium"
  return "text-risk-high"
}

export function SubScoreCard({
  label,
  score,
  max = 100,
  direction,
  className,
}: SubScoreCardProps) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100))
  const DirectionIcon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : Equal
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface-2/40 p-3 shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
          {label}
        </span>
        {direction && (
          <DirectionIcon
            aria-hidden
            className="h-3 w-3 text-muted-fg"
          />
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "font-heading text-xl font-semibold tabular-nums",
            getToneClass(score, max),
          )}
        >
          {score.toFixed(1)}
        </span>
        <span className="text-xs tabular-nums text-muted-fg">
          / {max}
        </span>
      </div>
      <div
        aria-hidden
        className="relative h-1 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-foreground/80 transition-[width] duration-(--duration)"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
