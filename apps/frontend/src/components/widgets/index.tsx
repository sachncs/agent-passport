import { cn, truncateAddress } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"

import type { RiskLevel } from "@/types/api"
import { riskBgClass, riskLabel } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  badge,
}: {
  title: string
  description: string
  badge?: string
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {badge && (
          <Badge variant="secondary" className="font-mono">
            {badge}
          </Badge>
        )}
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Icon className="h-10 w-10 text-muted-foreground" />
        <h3 className="text-base font-medium">{title}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="space-y-3 py-6">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-6 text-sm text-destructive">
        <strong className="font-semibold">Could not load</strong>
        <p className="mt-1 text-destructive/80">{message}</p>
      </CardContent>
    </Card>
  )
}

export function RiskBadge({
  risk,
  className,
}: {
  risk: RiskLevel
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        riskBgClass(risk),
        className,
      )}
    >
      {riskLabel(risk)}
    </span>
  )
}

export function ScoreBar({
  label,
  value,
  max = 100,
}: {
  label: string
  value: number
  max?: number
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const color =
    pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(1)}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div
        className={cn(
          "h-1.5 -mt-[14px] rounded-full",
          color,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function KV({
  label,
  value,
  mono = false,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm",
          mono && "font-mono",
        )}
      >
        {value}
      </div>
    </div>
  )
}

export function ExplanationList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Explanation</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {items.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function WalletLabel({ wallet }: { wallet: string }) {
  return (
    <span className="font-mono text-xs" title={wallet}>
      {truncateAddress(wallet, 8, 8)}
    </span>
  )
}
