"use client"

import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { Gauge, ShieldAlert } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import { WalletHeroInput } from "@/components/wallet-hero-input"
import { PassportSection } from "@/components/passport-section"
import { RiskBadge } from "@/components/risk-badge"
import { Stat } from "@/components/stat"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import type { TrustScoreResponse } from "@/lib/api-types"

export function TrustScoreClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
          <Gauge className="h-6 w-6" />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Trust score, in one glance.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          A composite 0–100 from five weighted sub-scores — age,
          activity, volume, velocity, and compliance.
        </p>
        <WalletHeroInput wallet={null} target="/score" />
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

  return <ScoreBody wallet={wallet} />
}

function ScoreBody({ wallet }: { wallet: string }) {
  const { data, isLoading, error } = useQuery<TrustScoreResponse>({
    queryKey: ["score", wallet],
    queryFn: () => api.getScore(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })

  if (isLoading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error as Error} />
  if (!data) return null

  return (
    <div className="space-y-6">
      <PassportSection
        icon={Gauge}
        title="Trust Score"
        subtitle="Composite 0–100 from age, activity, volume, velocity, and compliance."
        tone="emerald"
        badge={<RiskBadge risk={data.riskLevel} size="lg" />}
      >
        <div className="flex items-baseline gap-4">
          <div className="font-heading text-6xl font-semibold tracking-tight tabular-nums">
            {data.trustScore.toFixed(1)}
          </div>
          <div className="text-sm text-muted-foreground">
            of 100 · {data.wallet.slice(0, 8)}…{data.wallet.slice(-6)}
          </div>
        </div>
      </PassportSection>

      {data.breakdown && (
        <PassportSection
          icon={Gauge}
          title="Sub-scores"
          subtitle="Five weighted inputs to the composite."
          tone="primary"
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <SubScore label="Age" value={data.breakdown.ageScore} />
            <SubScore label="Activity" value={data.breakdown.activityScore} />
            <SubScore label="Volume" value={data.breakdown.volumeScore} />
            <SubScore label="Velocity" value={data.breakdown.velocityScore} />
            <SubScore
              label="Compliance"
              value={data.breakdown.complianceScore}
            />
          </div>
        </PassportSection>
      )}

      <PassportSection
        icon={Gauge}
        title="Result"
        subtitle="Composite decision inputs."
        tone="primary"
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Approved" tone="muted">
            <span
              className={
                data.approved
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "font-semibold text-destructive"
              }
            >
              {data.approved ? "Yes" : "No"}
            </span>
          </Stat>
          <Stat label="Recommended limit" tone="muted">
            {data.recommendedLimit.toFixed(2)} ALGO
          </Stat>
          <Stat label="Wallet" tone="muted">
            <span className="font-mono text-xs">
              {data.wallet.slice(0, 8)}…{data.wallet.slice(-6)}
            </span>
          </Stat>
        </div>
      </PassportSection>

      {data.explanation && data.explanation.length > 0 && (
        <PassportSection icon={Gauge} title="Explanation" tone="primary">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {data.explanation.map((line, i) => (
              <li key={i}>• {line}</li>
            ))}
          </ul>
        </PassportSection>
      )}
    </div>
  )
}

function SubScore({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(1)}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  )
}

function LoadingBlock() {
  return (
    <Card>
      <CardContent className="space-y-3 py-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner />
          <span>Loading…</span>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  )
}

function ErrorBlock({ error }: { error: Error }) {
  return (
    <Alert variant="destructive">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>Could not load trust score</AlertTitle>
      <AlertDescription>
        {error instanceof ApiError ? error.message : error.message}
      </AlertDescription>
    </Alert>
  )
}