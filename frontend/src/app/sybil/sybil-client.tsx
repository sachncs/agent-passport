"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ShieldAlert } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  WalletRequiredAlert,
} from "@/components/page-header"

import type { SybilCheckResponse, RiskLevel } from "@/lib/api-types"

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const labels = { low: "Low", medium: "Medium", high: "High", critical: "Critical" } as const
  const map = {
    low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    critical: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  } as const
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        map[risk]
      }
    >
      {labels[risk]}
    </span>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(2)}</span>
      </div>
      <Progress value={value * 100} className="h-1.5" />
    </div>
  )
}

function Body({ data }: { data: SybilCheckResponse }) {
  const radarData = [
    { name: "Creation", value: data.signals.creationClustering },
    { name: "Interaction", value: data.signals.interactionDensity },
    { name: "Balance", value: data.signals.balanceSimilarity },
    { name: "Circular", value: data.signals.circularActivity },
    { name: "Timing", value: data.signals.timingRegularity },
    { name: "Amount", value: data.signals.amountFingerprint },
    { name: "Funding", value: data.signals.fundingCorrelation },
  ]
  return (
    <div className="space-y-4">
      {data.sybilRisk >= 0.45 && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Elevated sybil risk</AlertTitle>
          <AlertDescription>
            The wallet is part of a cluster with coordinated activity.
            Endorsements from this wallet should be treated with caution.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-5xl font-bold">
              {(data.sybilRisk * 100).toFixed(0)}%
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Sybil risk
            </div>
            <Progress value={data.sybilRisk * 100} className="mt-4 h-2" />
            <div className="mt-4 flex items-center justify-center">
              <RiskBadge risk={data.riskLevel} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Confidence {(data.confidence * 100).toFixed(0)}% · Cluster size{" "}
              {data.clusterSize}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <pre className="text-xs">
              {JSON.stringify(radarData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="wallet-history">
        <TabsList>
          <TabsTrigger value="wallet-history">Wallet-history</TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="explanation">Explanation</TabsTrigger>
        </TabsList>
        <TabsContent value="wallet-history">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                <Bar label="Creation clustering" value={data.signals.creationClustering} />
                <Bar label="Interaction density" value={data.signals.interactionDensity} />
                <Bar label="Balance similarity" value={data.signals.balanceSimilarity} />
                <Bar label="Circular activity" value={data.signals.circularActivity} />
                <Bar label="Timing regularity" value={data.signals.timingRegularity} />
                <Bar label="Amount fingerprint" value={data.signals.amountFingerprint} />
                <Bar label="Funding correlation" value={data.signals.fundingCorrelation} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="graph">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                <Bar label="Neighborhood clustering" value={data.signals.neighborhoodClustering} />
                <Bar label="Hub score" value={data.signals.hubScore} />
                <Bar label="Intermediate density" value={data.signals.intermediateDensity} />
                <Bar label="Component ratio" value={data.signals.componentRatio} />
                <Bar label="Temporal correlation" value={data.signals.temporalCorrelation} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="explanation">
          <Card>
            <CardContent className="pt-6 text-sm">
              <ul className="space-y-1.5">
                {data.explanation.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {data.flaggedWallets.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-medium">
              Flagged wallets ({data.flaggedWallets.length})
            </h3>
            <ul className="space-y-1 text-sm">
              {data.flaggedWallets.map((w, i) => (
                <li key={i}>
                  <code className="rounded-md bg-muted/30 px-2 py-0.5 font-mono text-xs">
                    {w}
                  </code>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function SybilClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")
  const valid = wallet && isValidWallet(wallet)

  const { data, isLoading, error } = useQuery<SybilCheckResponse>({
    queryKey: ["sybil", wallet],
    queryFn: () => api.checkSybil(wallet!),
    enabled: !!valid,
    staleTime: 30_000,
  })

  return (
    <>
      <PageHeader
        title="Sybil Check"
        description="Twelve signals (clustering, timing, amount, balance, plus 4 graph-traversal signals)."
        badge={wallet ?? undefined}
      />
      {!wallet && <WalletRequiredAlert />}
      {wallet && !valid && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Invalid wallet address.
          </CardContent>
        </Card>
      )}
      {valid && isLoading && <LoadingBlock rows={6} />}
      {valid && error && (
        <ErrorBlock
          message={error instanceof ApiError ? error.message : "Could not load sybil analysis"}
        />
      )}
      {data && <Body data={data} />}
    </>
  )
}
