"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"

import { cn } from "@/lib/utils"

interface ReputationSummaryProps {
  positive: number
  negative: number
  total: number
  className?: string
}

export function ReputationSummary({
  positive,
  negative,
  total,
  className,
}: ReputationSummaryProps) {
  const safeTotal = Math.max(1, total)
  const positivePct = (positive / safeTotal) * 100
  const negativePct = (negative / safeTotal) * 100
  const data = [
    { name: "Positive", value: positive, fill: "var(--verified)" },
    { name: "Negative", value: negative, fill: "var(--risk-critical)" },
  ]

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-2/60 p-5 shadow-[var(--shadow-sm)] ring-1 ring-foreground/5",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
          Reputation events
        </span>
        <span className="text-xs uppercase tracking-[0.14em] text-muted-fg">
          {total.toLocaleString()} total
        </span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-3">
        <div
          aria-hidden
          className="h-full bg-verified transition-[width] duration-(--duration)"
          style={{ width: `${positivePct}%`, float: "left" }}
        />
        <div
          aria-hidden
          className="h-full bg-risk-critical transition-[width] duration-(--duration)"
          style={{ width: `${negativePct}%`, float: "left" }}
        />
      </div>
      <div className="mt-3 h-16">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" hide />
            <Bar dataKey="value" radius={[2, 2, 2, 2]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-xs tabular-nums">
        <span className="inline-flex items-center gap-1.5 text-verified-fg">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-verified"
          />
          {positive.toLocaleString()} positive
        </span>
        <span className="inline-flex items-center gap-1.5 text-risk-critical">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-risk-critical"
          />
          {negative.toLocaleString()} negative
        </span>
      </div>
    </div>
  )
}
