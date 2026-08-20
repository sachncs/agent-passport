"use client"

import { useEffect, useState } from "react"

import { Activity } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import { Badge } from "@/components/ui/badge"

import { ErrorBlock, LoadingBlock } from "@/components/page-header"
import { PassportSection } from "@/components/passport-section"
import { Stat } from "@/components/stat"

import type { HealthResponse, VersionResponse } from "@/lib/api-types"

export default function MonitorPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [version, setVersion] = useState<VersionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const tick = async () => {
    try {
      const [h, v] = await Promise.all([api.health(), api.version()])
      setHealth(h as HealthResponse)
      setVersion(v)
      setError(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Service unreachable")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void tick()
    const id = setInterval(tick, 15_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="space-y-6">
      <PassportSection
        icon={Activity}
        title="Monitor"
        subtitle="Health, readiness, version, and Prometheus metrics. Auto-refreshes every 15 seconds."
        tone="primary"
        badge={
          health ? (
            <Badge
              variant={health.status === "ok" ? "default" : "destructive"}
            >
              {health.status}
            </Badge>
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Stat label="Service" tone="muted">
            <span className="font-mono text-base font-semibold">
              {health?.service ?? "—"}
            </span>
          </Stat>
          <Stat label="Version" tone="muted">
            <span className="font-mono text-base font-semibold">
              {version?.version ?? "—"}
            </span>
          </Stat>
          <Stat label="Network" tone="muted">
            <span className="font-mono text-base font-semibold">
              {version?.network ?? "—"}
            </span>
          </Stat>
        </div>
      </PassportSection>

      {error && !health && <ErrorBlock message={error} />}
      {loading && !health && <LoadingBlock />}

      <PassportSection
        icon={Activity}
        title="Operational endpoints"
        subtitle="Exempt from rate limiting, no payment required."
        tone="primary"
      >
        <ul className="space-y-2 text-sm">
          <Row
            method="GET"
            path="/health"
            description="Liveness — always 200 unless process is broken"
          />
          <Row
            method="GET"
            path="/ready"
            description="Readiness — 200 if Algorand is reachable, 503 if not"
          />
          <Row
            method="GET"
            path="/health/deep"
            description="Both — includes Algorand status, always 200"
          />
          <Row
            method="GET"
            path="/metrics"
            description="Prometheus text format"
          />
          <Row
            method="GET"
            path="/registry/status"
            description="Whether the on-chain contracts are configured"
          />
        </ul>
      </PassportSection>
    </div>
  )
}
function Row({
  method,
  path,
  description,
}: {
  method: string
  path: string
  description: string
}) {
  return (
    <li className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3">
      <Badge variant="outline" className="font-mono text-[0.7rem]">
        {method}
      </Badge>
      <div>
        <code className="font-mono text-sm">{path}</code>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </li>
  )
}