"use client"

import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts"

import { cn } from "@/lib/utils"

interface TrustScoreCardProps {
  score: number
  max?: number
  risk?: string
  className?: string
}

export function TrustScoreCard({
  score,
  max = 100,
  risk,
  className,
}: TrustScoreCardProps) {
  const pct = Math.max(0, Math.min(max, score))
  const data = [{ name: "score", value: pct, fill: "var(--verified)" }]

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-surface-2/60 p-5 shadow-[var(--shadow-sm)] ring-1 ring-foreground/5 md:flex-row md:items-center md:gap-6",
        className,
      )}
    >
      <div className="relative h-32 w-32 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={data}
            startAngle={90}
            endAngle={-270}
            innerRadius="78%"
            outerRadius="100%"
            barSize={8}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, max]}
              tick={false}
            />
            <RadialBar
              background={{ fill: "var(--surface-3)" }}
              dataKey="value"
              cornerRadius={8}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-3xl font-semibold tabular-nums text-foreground">
            {score.toFixed(1)}
          </span>
          <span className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-fg">
            / {max}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
          Trust score
        </span>
        <span className="text-sm text-foreground">
          Composite 0–100 from age, activity, volume, velocity, and
          compliance sub-scores.
        </span>
        {risk && (
          <span className="mt-2 inline-flex w-fit items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-fg">
            Risk · {risk}
          </span>
        )}
      </div>
    </div>
  )
}
