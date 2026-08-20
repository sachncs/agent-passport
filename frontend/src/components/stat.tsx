import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function Stat({
  label,
  children,
  className,
  tone = "default",
}: {
  label: string
  children: ReactNode
  className?: string
  tone?: "default" | "muted"
}) {
  return (
    <Card className={cn(tone === "muted" && "bg-muted/30", className)}>
      <CardContent className="pt-6">
        <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-sm">{children}</div>
      </CardContent>
    </Card>
  )
}