import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface KpiCardProps {
  label: string
  value: ReactNode
  caption?: ReactNode
  progress?: number
  className?: string
  size?: "default" | "sm"
}

export function KpiCard({
  label,
  value,
  caption,
  progress,
  className,
  size = "default",
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface-2/40 p-4 shadow-[var(--shadow-xs)]",
        size === "sm" && "p-3",
        className,
      )}
    >
      <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
        {label}
      </span>
      <div className="font-heading text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {progress !== undefined && (
        <div
          aria-hidden
          className="relative h-1 overflow-hidden rounded-full bg-surface-3"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-foreground/80 transition-[width] duration-(--duration)"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {caption && (
        <div className="text-xs text-muted-fg">{caption}</div>
      )}
    </div>
  )
}
