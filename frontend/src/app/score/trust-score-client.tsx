"use client"

import { api, ApiError } from "@/lib/api"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  WalletRequiredAlert,
} from "@/components/page-header"
import { isValidWallet } from "@/lib/wallet"

import type { TrustScoreResponse, RiskLevel } from "@/lib/api-types"

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const map: Record<RiskLevel, string> = {
    low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    critical: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  }
  const label = risk.charAt(0).toUpperCase() + risk.slice(1)
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        map[risk]
      }
    >
      {label}
    </span>
  )
}

function ScoreBar({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const color =
    pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <div className="relative">
        <Progress value={pct} className="h-1.5" />
        <div
          className={
            "absolute inset-y-0 left-0 h-1.5 rounded-full " + color
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Stat({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-sm">{children}</div>
      </CardContent>
    </Card>
  )
}

function ScoreBody({ data }: { data: TrustScoreResponse }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-5xl font-bold tracking-tight">
              {data.trustScore.toFixed(1)}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Trust Score
            </div>
            <ScoreBar value={data.trustScore} className="mt-4" />
            <div className="mt-4 flex items-center justify-center">
              <RiskBadge risk={data.riskLevel} />
            </div>
          </CardContent>
        </Card>

        <Stat label="Approved">{data.approved ? "Yes" : "No"}</Stat>
        <Stat label="Recommended limit">
          {data.recommendedLimit.toFixed(2)} ALGO
        </Stat>
        <Stat label="Wallet">
          <span className="font-mono text-xs">
            {data.wallet.slice(0, 8)}…{data.wallet.slice(-6)}
          </span>
        </Stat>
      </div>

      {data.breakdown && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-medium">Sub-scores</h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Age</span>
                  <span className="font-mono">
                    {data.breakdown.ageScore.toFixed(1)}
                  </span>
                </div>
                <ScoreBar value={data.breakdown.ageScore} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Activity</span>
                  <span className="font-mono">
                    {data.breakdown.activityScore.toFixed(1)}
                  </span>
                </div>
                <ScoreBar value={data.breakdown.activityScore} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Volume</span>
                  <span className="font-mono">
                    {data.breakdown.volumeScore.toFixed(1)}
                  </span>
                </div>
                <ScoreBar value={data.breakdown.volumeScore} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Velocity</span>
                  <span className="font-mono">
                    {data.breakdown.velocityScore.toFixed(1)}
                  </span>
                </div>
                <ScoreBar value={data.breakdown.velocityScore} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Compliance</span>
                  <span className="font-mono">
                    {data.breakdown.complianceScore.toFixed(1)}
                  </span>
                </div>
                <ScoreBar value={data.breakdown.complianceScore} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {data.onChain && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-medium">On-chain</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  Balance
                </div>
                <div className="mt-1 text-sm">
                  {data.onChain.balanceAlgo.toFixed(2)} ALGO
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  Transactions
                </div>
                <div className="mt-1 text-sm">
                  {data.onChain.totalTxns.toLocaleString()}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  Assets
                </div>
                <div className="mt-1 text-sm">{data.onChain.assetCount}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  Apps
                </div>
                <div className="mt-1 text-sm">{data.onChain.appCount}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {data.explanation && data.explanation.length > 0 && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <h3 className="mb-3 text-sm font-medium">Explanation</h3>
            <Separator className="mb-3" />
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
      )}
    </div>
  )
}

export function TrustScoreClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")
  const valid = wallet && isValidWallet(wallet)

  const { data, isLoading, error } = useQuery<TrustScoreResponse>({
    queryKey: ["score", wallet],
    queryFn: () => {
      if (!valid) throw new Error("wallet is not valid")
      return api.getScore(wallet)
    },
    enabled: valid,
    staleTime: 30_000,
  })

  return (
    <>
      <PageHeader
        title="Trust Score"
        description="Composite 0–100 score with five weighted sub-scores. Cached for 60 s."
        badge={wallet ?? undefined}
      />
      {!wallet && <WalletRequiredAlert />}
      {wallet && !valid && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            That wallet address isn&apos;t a valid 58-character base32
            Algorand address.
          </CardContent>
        </Card>
      )}
      {valid && isLoading && <LoadingBlock rows={6} />}
      {valid && error && (
        <ErrorBlock
          message={
            error instanceof ApiError
              ? error.message
              : "Could not load trust score"
          }
        />
      )}
      {data && <ScoreBody data={data} />}
    </>
  )
}
