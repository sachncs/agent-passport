import { useEffect, useState } from "react"
import { Activity, Server, ShieldCheck } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/widgets"

import type { HealthResponse, VersionResponse } from "@/types/api"

type Status = "loading" | "ok" | "degraded"

export default function Monitor() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [version, setVersion] = useState<VersionResponse | null>(null)
  const [status, setStatus] = useState<Status>("loading")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const [h, v] = await Promise.all([api.health(), api.version()])
        if (cancelled) return
        setHealth(h)
        setVersion(v)
        setStatus(h.status === "ok" ? "ok" : "degraded")
        setError(null)
      } catch (e) {
        if (cancelled) return
        setStatus("degraded")
        setError(
          e instanceof ApiError
            ? e.message
            : "Service is unreachable",
        )
      }
    }
    tick()
    const id = setInterval(tick, 15_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <>
      <PageHeader
        title="Service Monitor"
        description="Health, readiness, version, and Prometheus metrics. Auto-refreshes every 15 seconds."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              <Server className="h-4 w-4" /> Service
            </div>
            {status === "loading" ? (
              <LoadingBlock />
            ) : status === "ok" ? (
              <>
                <div className="mt-1 text-2xl font-semibold">
                  {health?.service ?? "Agent Passport"}
                </div>
                <Badge variant="default" className="mt-2 gap-1">
                  <ShieldCheck className="h-3 w-3" /> ok
                </Badge>
              </>
            ) : (
              <>
                <div className="mt-1 text-2xl font-semibold text-destructive">
                  Degraded
                </div>
                <Badge variant="destructive" className="mt-2">unreachable</Badge>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              <Activity className="h-4 w-4" /> Version
            </div>
            <div className="mt-1 text-2xl font-mono font-semibold">
              {version?.version ?? "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {version?.node ?? ""}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Network
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {version?.network ?? "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              x402: {version?.x402 ? "enabled" : "disabled"}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && <ErrorBlock message={error} />}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Operational endpoints</CardTitle>
          <CardDescription>Exempt from rate limiting, no payment required.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <EndpointRow
              method="GET"
              path="/health"
              description="Liveness — always 200 unless process is broken"
            />
            <EndpointRow
              method="GET"
              path="/ready"
              description="Readiness — 200 if Algorand is reachable, 503 if not"
            />
            <EndpointRow
              method="GET"
              path="/health/deep"
              description="Both — includes Algorand status, always 200"
            />
            <EndpointRow
              method="GET"
              path="/metrics"
              description="Prometheus text format"
            />
            <EndpointRow
              method="GET"
              path="/registry/status"
              description="Whether the on-chain contracts are configured"
            />
          </ul>
        </CardContent>
      </Card>
    </>
  )
}

function EndpointRow({
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
