import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface PassportSectionProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  badge?: ReactNode
  /** Accent color for the leading stripe. Defaults to primary. */
  tone?: "primary" | "emerald" | "amber" | "orange" | "red" | "violet" | "sky"
  className?: string
  contentClassName?: string
  children: ReactNode
}

const TONE: Record<NonNullable<PassportSectionProps["tone"]>, string> = {
  primary: "bg-primary",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
}

export function PassportSection({
  icon: Icon,
  title,
  subtitle,
  badge,
  tone = "primary",
  className,
  contentClassName,
  children,
}: PassportSectionProps) {
  return (
    <Card
      className={cn("relative overflow-hidden", className)}
      data-size="sm"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1 rounded-l-xl",
          TONE[tone],
        )}
      />
      <CardContent className={cn("pt-5", contentClassName)}>
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Section
            </div>
            <h2 className="font-heading text-lg leading-tight font-semibold">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}