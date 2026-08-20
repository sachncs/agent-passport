import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Circle,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/lib/api-types"

interface RiskStyle {
  Icon: LucideIcon
  label: string
  classes: string
}

const RISK_STYLES: Record<RiskLevel, RiskStyle> = {
  low: {
    Icon: CheckCircle2,
    label: "Low",
    classes:
      "border-risk-low/30 bg-risk-low/[0.12] text-risk-low",
  },
  medium: {
    Icon: AlertTriangle,
    label: "Medium",
    classes:
      "border-risk-medium/30 bg-risk-medium/[0.12] text-risk-medium",
  },
  high: {
    Icon: AlertTriangle,
    label: "High",
    classes:
      "border-risk-high/30 bg-risk-high/[0.12] text-risk-high",
  },
  critical: {
    Icon: AlertOctagon,
    label: "Critical",
    classes:
      "border-risk-critical/30 bg-risk-critical/[0.12] text-risk-critical",
  },
}

interface RiskPillProps {
  risk: RiskLevel
  size?: "sm" | "default" | "lg"
  showIcon?: boolean
  className?: string
}

export function RiskPill({
  risk,
  size = "default",
  showIcon = true,
  className,
}: RiskPillProps) {
  const { Icon, label, classes } = RISK_STYLES[risk]
  const padding =
    size === "lg" ? "px-3 py-1 text-sm" : size === "sm" ? "px-2 py-0.5 text-[0.7rem]" : "px-2.5 py-0.5 text-xs"

  return (
    <span
      role="status"
      aria-label={`Risk: ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        padding,
        classes,
        className,
      )}
    >
      {showIcon ? (
        <Icon aria-hidden className={size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      ) : (
        <Circle aria-hidden className="h-3 w-3 opacity-0" />
      )}
      <span>{label}</span>
    </span>
  )
}
