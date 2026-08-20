import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/lib/api-types"

const RISK_CLASSES: Record<RiskLevel, string> = {
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  critical: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
}

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

export function RiskBadge({
  risk,
  size = "default",
}: {
  risk: RiskLevel
  size?: "default" | "lg"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
        RISK_CLASSES[risk],
      )}
    >
      {RISK_LABEL[risk]}
    </span>
  )
}