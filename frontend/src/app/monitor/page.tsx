"use client"

import { useEffect, useState } from "react"

import { api, ApiError } from "@/lib/api"
import { Badge } from "@/components/ui/badge"

import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

import type { HealthResponse, VersionResponse } from "@/lib/api-types"

const ENDPOINTS = [
  {
    method: "GET",
    path: "/health",
    description:
      "Liveness — always 200 unless process is broken",
  },
  {
    method: "GET",
    path: "/ready",
    description:
      "Readiness — 200 if Algorand is reachable, 503 if not",
  },
  {
    method: "GET",
    path: "/health/deep",
    description: "Both — includes Algorand status, always 200",
  },
  {
    method: "GET",
    path: "/metrics",
    description: "Prometheus text format",
  },
  {
    method: "GET",
    path: "/registry/status",
    description:
      "Whether the on-chain contracts are configured",
  },
] as const

export default function MonitorPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [version, setVersion] = useState<VersionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const [h, v] = await Promise.all([api.health(), api.version()])
        if (cancelled) return
        setHealth(h as HealthResponse)
        setVersion(v)
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(
          e instanceof ApiError ? e.message : "Service unreachable",
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void tick()
    const id = setInterval(tick, 15_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-info-fg">
          Developer surface
        </span>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Monitor
        </h1>
        <p className="max-w-2xl text-sm text-muted-fg">
          Health, readiness, version, and Prometheus metrics.
          Auto-refreshes every 15 seconds.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-fg">
              <span className="flex h-1.5 w-1.5 rounded-full bg-info">
                <span className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-info opacity-60" />
              </span>
              {health ? (
                <span className="text-foreground">{health.status}</span>
              ) : loading ? (
                <span>Checking…</span>
              ) : (
                <span className="text-risk-critical">Unreachable</span>
              )}
            </div>
            {loading && !health && <Spinner />}
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Cell label="Service" value={health?.service} />
            <Cell label="Version" value={version?.version} />
            <Cell label="Network" value={version?.network} />
            <Cell
              label="Uptime"
              value={
                version?.uptime
                  ? `${Math.floor(version.uptime / 60)}m`
                  : undefined
              }
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
            Operational endpoints
          </span>
          <p className="text-sm text-muted-fg">
            Exempt from rate limiting, no payment required.
          </p>
          <ul className="space-y-2 text-sm">
            {ENDPOINTS.map((e) => (
              <li
                key={e.path}
                className="flex items-start gap-3 rounded-md border border-border/60 bg-background/40 p-3"
              >
                <Badge
                  variant="outline"
                  className="border-info/30 bg-info-bg font-mono text-[0.7rem] text-info-fg"
                >
                  {e.method}
                </Badge>
                <div>
                  <code className="font-mono text-sm text-foreground">
                    {e.path}
                  </code>
                  <div className="text-xs text-muted-fg">
                    {e.description}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function Cell({
  label,
  value,
}: {
  label: string
  value: string | undefined
}) {
  return (
    <div className="space-y-1">
      <div className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
        {label}
      </div>
      <div className="font-mono text-sm tabular-nums text-foreground">
        {value ?? "—"}
      </div>
    </div>
  )
}
