"use client"

import { Activity, AlertTriangle, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { useHealth } from "@/components/use-network"

type HealthState =
  | { kind: "loading" }
  | { kind: "ok"; network?: string }
  | { kind: "degraded"; label: string }
  | { kind: "down"; label: string }

function healthToState(health: { status: string; network?: string }): HealthState {
  if (health.status === "ok") {
    return { kind: "ok", network: health.network }
  }
  return { kind: "degraded", label: humanize(health.status) }
}

function humanize(status: string): string {
  if (!status) return "Unknown"
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function StatusPill() {
  const { data, isLoading, error } = useHealth()

  let state: HealthState
  if (error) state = { kind: "down", label: "Unreachable" }
  else if (isLoading || !data) state = { kind: "loading" }
  else state = healthToState(data)

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-fg"
    >
      <span className="sr-only">Service status:</span>
      <Indicator state={state} />
      <Label state={state} />
    </div>
  )
}

function Indicator({ state }: { state: HealthState }) {
  const base = "h-1.5 w-1.5 rounded-full"
  if (state.kind === "ok") {
    return <span className={cn(base, "bg-info animate-pulse")} aria-hidden />
  }
  if (state.kind === "loading") {
    return <span className={cn(base, "bg-muted-foreground/60")} aria-hidden />
  }
  if (state.kind === "down") {
    return (
      <XCircle
        aria-hidden
        className="h-3 w-3 text-risk-critical"
      />
    )
  }
  return (
    <AlertTriangle
      aria-hidden
      className="h-3 w-3 text-risk-medium"
    />
  )
}

function Label({ state }: { state: HealthState }) {
  if (state.kind === "ok") {
    return (
      <span className="text-foreground">
        Operational
        {state.network ? (
          <span className="ml-1.5 text-muted-fg">· {state.network}</span>
        ) : null}
      </span>
    )
  }
  if (state.kind === "loading") {
    return <span>Checking…</span>
  }
  if (state.kind === "down") {
    return (
      <span className="flex items-center gap-1.5 text-risk-critical">
        <Activity className="h-3 w-3" aria-hidden />
        {state.label}
      </span>
    )
  }
  return <span className="text-risk-medium">{state.label}</span>
}
