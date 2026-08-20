"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ShieldAlert } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { WalletHeroInput } from "@/components/wallet-hero-input"
import { PassportSection } from "@/components/passport-section"
import { RiskBadge } from "@/components/risk-badge"

import type { SybilCheckResponse } from "@/lib/api-types"

export function SybilClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Twelve signals, one verdict.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Clustering, timing, amount, balance, plus four graph-traversal
          signals — scored into a single sybil risk percentage.
        </p>
        <WalletHeroInput wallet={null} target="/sybil" />
      </div>
    )
  }

  if (!isValidWallet(wallet)) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          That wallet address isn&apos;t a valid 58-character base32
          Algorand address.
        </CardContent>
      </Card>
    )
  }

  return <SybilBody wallet={wallet} />
}

function SybilBody({ wallet }: { wallet: string }) {
  const { data, isLoading, error } = useQuery<SybilCheckResponse>({
    queryKey: ["sybil", wallet],
    queryFn: () => api.checkSybil(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner />
            <span>Loading…</span>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Could not load sybil analysis</AlertTitle>
        <AlertDescription>
          {error instanceof ApiError ? error.message : error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <PassportSection
        icon={ShieldAlert}
        title="Sybil Risk"
        subtitle="Twelve signals: clustering, timing, amount, balance, plus four graph-traversal signals."
        tone="amber"
        badge={<RiskBadge risk={data.riskLevel} size="lg" />}
      >
        <div className="flex items-baseline gap-4">
          <div className="font-heading text-6xl font-semibold tracking-tight tabular-nums">
            {(data.sybilRisk * 100).toFixed(0)}%
          </div>
          <div className="text-sm text-muted-foreground">
            confidence {(data.confidence * 100).toFixed(0)}% · cluster{" "}
            {data.clusterSize}
          </div>
        </div>
        <Progress
          value={data.sybilRisk * 100}
          className="mt-4 h-2"
        />
        {data.sybilRisk >= 0.45 && (
          <Alert className="mt-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Elevated sybil risk</AlertTitle>
            <AlertDescription>
              The wallet is part of a cluster with coordinated activity.
              Endorsements from this wallet should be treated with
              caution.
            </AlertDescription>
          </Alert>
        )}
      </PassportSection>

      <PassportSection
        icon={ShieldAlert}
        title="Signals"
        subtitle="Wallet-history and graph-traversal signals in detail."
        tone="primary"
      >
        <Tabs defaultValue="wallet-history">
          <TabsList>
            <TabsTrigger value="wallet-history">Wallet-history</TabsTrigger>
            <TabsTrigger value="graph">Graph</TabsTrigger>
            <TabsTrigger value="explanation">Explanation</TabsTrigger>
          </TabsList>
          <TabsContent value="wallet-history">
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
              <SignalBar
                label="Creation clustering"
                value={data.signals.creationClustering}
              />
              <SignalBar
                label="Interaction density"
                value={data.signals.interactionDensity}
              />
              <SignalBar
                label="Balance similarity"
                value={data.signals.balanceSimilarity}
              />
              <SignalBar
                label="Circular activity"
                value={data.signals.circularActivity}
              />
              <SignalBar
                label="Timing regularity"
                value={data.signals.timingRegularity}
              />
              <SignalBar
                label="Amount fingerprint"
                value={data.signals.amountFingerprint}
              />
              <SignalBar
                label="Funding correlation"
                value={data.signals.fundingCorrelation}
              />
            </div>
          </TabsContent>
          <TabsContent value="graph">
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
              <SignalBar
                label="Neighborhood clustering"
                value={data.signals.neighborhoodClustering}
              />
              <SignalBar label="Hub score" value={data.signals.hubScore} />
              <SignalBar
                label="Intermediate density"
                value={data.signals.intermediateDensity}
              />
              <SignalBar
                label="Component ratio"
                value={data.signals.componentRatio}
              />
              <SignalBar
                label="Temporal correlation"
                value={data.signals.temporalCorrelation}
              />
            </div>
          </TabsContent>
          <TabsContent value="explanation">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {data.explanation.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </PassportSection>

      {data.flaggedWallets.length > 0 && (
        <PassportSection
          icon={ShieldAlert}
          title={`Flagged wallets (${data.flaggedWallets.length})`}
          tone="primary"
        >
          <ul className="space-y-1 text-sm">
            {data.flaggedWallets.map((w, i) => (
              <li key={i}>
                <code className="rounded-md bg-muted/30 px-2 py-0.5 font-mono text-xs">
                  {w}
                </code>
              </li>
            ))}
          </ul>
        </PassportSection>
      )}
    </div>
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