import { Activity, ShieldAlert } from "lucide-react"
import {
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts"

import { api, ApiError } from "@/lib/api"
import { useWalletQuery } from "@/hooks/useWalletQuery"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  RiskBadge,
  WalletLabel,
} from "@/components/widgets"

import type { SybilCheckResponse } from "@/types/api"

export default function Sybil() {
  const { wallet, query } = useWalletQuery<SybilCheckResponse>(
    "sybil",
    api.checkSybil,
  )
  const { data, isLoading, error } = query

  if (!wallet) {
    return (
      <>
        <PageHeader
          title="Sybil Check"
          description="Twelve signals (clustering, timing, amount fingerprint, balance, plus 4 graph-traversal signals)."
        />
        <EmptyState
          icon={Activity}
          title="Enter a wallet"
          description="Sybil detection runs wallet-history and graph-traversal signals. Use the search bar to look up a wallet."
        />
      </>
    )
  }

  if (isLoading) return <LoadingBlock rows={6} />
  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Sybil Check"
          description="Twelve signals (clustering, timing, amount fingerprint, balance, plus 4 graph-traversal signals)."
          badge={wallet}
        />
        <ErrorBlock
          message={
            error instanceof ApiError
              ? error.message
              : "Could not load sybil analysis"
          }
        />
      </>
    )
  }

  const radarData = [
    { name: "Creation", value: data.signals.creationClustering },
    { name: "Interaction", value: data.signals.interactionDensity },
    { name: "Balance", value: data.signals.balanceSimilarity },
    { name: "Circular", value: data.signals.circularActivity },
    { name: "Timing", value: data.signals.timingRegularity },
    { name: "Amount", value: data.signals.amountFingerprint },
    { name: "Funding", value: data.signals.fundingCorrelation },
    { name: "Neighborhood", value: data.signals.neighborhoodClustering },
    { name: "Hub", value: data.signals.hubScore },
  ]

  return (
    <>
      <PageHeader
        title="Sybil Check"
        description="Twelve signals (clustering, timing, amount fingerprint, balance, plus 4 graph-traversal signals)."
        badge={wallet}
      />

      {data.sybilRisk >= 0.45 && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <div>
              <strong>Elevated sybil risk.</strong> The wallet is part of a
              cluster with coordinated activity. Endorsements from this
              wallet should be treated with caution.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-5xl font-bold">
              {(data.sybilRisk * 100).toFixed(0)}%
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Sybil Risk
            </div>
            <Progress
              value={data.sybilRisk * 100}
              className="mt-4 h-2"
            />
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
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="100">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" />
                  <PolarRadiusAxis angle={30} domain={[0, 1]} />
                  <Radar
                    name="Signal"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="wallet-history" className="mt-4">
        <TabsList>
          <TabsTrigger value="wallet-history">Wallet-history</TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="explanation">Explanation</TabsTrigger>
        </TabsList>
        <TabsContent value="wallet-history">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                <SignalBar label="Creation clustering" value={data.signals.creationClustering} />
                <SignalBar label="Interaction density" value={data.signals.interactionDensity} />
                <SignalBar label="Balance similarity" value={data.signals.balanceSimilarity} />
                <SignalBar label="Circular activity" value={data.signals.circularActivity} />
                <SignalBar label="Timing regularity" value={data.signals.timingRegularity} />
                <SignalBar label="Amount fingerprint" value={data.signals.amountFingerprint} />
                <SignalBar label="Funding correlation" value={data.signals.fundingCorrelation} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="graph">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                <SignalBar label="Neighborhood clustering" value={data.signals.neighborhoodClustering} />
                <SignalBar label="Hub score" value={data.signals.hubScore} />
                <SignalBar label="Intermediate density" value={data.signals.intermediateDensity} />
                <SignalBar label="Component ratio" value={data.signals.componentRatio} />
                <SignalBar label="Temporal correlation" value={data.signals.temporalCorrelation} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="explanation">
          <Card>
            <CardContent className="pt-6 text-sm">
              {data.explanation.length === 0 ? (
                <p className="text-muted-foreground">No explanation provided.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.explanation.map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {data.flaggedWallets.length > 0 && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-medium">
              Flagged wallets ({data.flaggedWallets.length})
            </h3>
            <ul className="space-y-1 text-sm">
              {data.flaggedWallets.map((w, i) => (
                <li key={i}>
                  <WalletLabel wallet={w} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function SignalBar({ label, value }: { label: string; value: number }) {
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
