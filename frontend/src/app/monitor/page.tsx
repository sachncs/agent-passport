import { useEffect, useState } from "react"

import { Activity, Server } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/page-header"
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
    <>
      <PageHeader
        title="Monitor"
        description="Health, readiness, version, and Prometheus metrics. Auto-refreshes every 15 seconds."
      />
      {error && !health && <ErrorBlock message={error} />}
      {loading && !health && <LoadingBlock />}
      {(health || version) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                <Server className="h-4 w-4" /> Service
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {health?.service ?? "—"}
              </div>
              {health && (
                <Badge
                  variant={health.status === "ok" ? "default" : "destructive"}
                  className="mt-2"
                >
                  {health.status}
                </Badge>
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
              {version && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {version.node}
                </div>
              )}
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
              {version && (
                <div className="mt-1 text-xs text-muted-foreground">
                  x402: {version.x402 ? "enabled" : "disabled"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Operational endpoints</CardTitle>
          <CardDescription>Exempt from rate limiting, no payment required.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <Row method="GET" path="/health" description="Liveness — always 200 unless process is broken" />
            <Row method="GET" path="/ready" description="Readiness — 200 if Algorand is reachable, 503 if not" />
            <Row method="GET" path="/health/deep" description="Both — includes Algorand status, always 200" />
            <Row method="GET" path="/metrics" description="Prometheus text format" />
            <Row method="GET" path="/registry/status" description="Whether the on-chain contracts are configured" />
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
function Row({ method, path, description }: { method: string; path: string; description: string }) {
  return (
    <li className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3">
      <Badge variant="outline" className="font-mono text-[0.7rem]">{method}</Badge>
      <div>
        <code className="font-mono text-sm">{path}</code>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </li>
  )
}
