"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ShieldAlert } from "lucide-react"

import { api } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"
import { CommandSurface } from "@/components/command-surface"
import { KpiCard } from "@/components/kpi-card"
import { SubScoreCard } from "@/components/sub-score-card"
import { DelegationPath } from "@/components/report/delegation-path"
import { ReportHeader } from "@/components/report/report-header"
import { AuditStrip } from "@/components/report/audit-strip"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import type { DelegationResponse } from "@/lib/api-types"

export function DelegationClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return <DelegationEntry target="/delegation" />
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

  return <DelegationBody wallet={wallet} />
}

function DelegationEntry({ target }: { target: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Sponsors, anchors, and trust.
      </h1>
      <p className="max-w-md text-sm text-muted-fg">
        Sponsor graph BFS with depth attenuation, cycle detection, and
        trust-anchor markers — full delegation path with depth and
        sponsor quality.
      </p>
      <CommandSurface target={target} cta="Load Delegation" />
    </div>
  )
}

function DelegationBody({ wallet }: { wallet: string }) {
  const { data, isLoading, error } = useQuery<DelegationResponse>({
    queryKey: ["delegation", wallet],
    queryFn: () => api.getDelegation(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8">
          <div className="flex items-center gap-2 text-xs text-muted-fg">
            <Spinner />
            <span>Walking sponsor graph…</span>
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
        <AlertTitle>Could not load delegation graph</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  const d = data.delegation
  const b = data.breakdown

  return (
    <div className="space-y-6">
      <ReportHeader wallet={wallet} risk={data.riskLevel} />

      <div className="rounded-xl border border-border bg-surface-2/60 p-5 shadow-[var(--shadow-sm)] ring-1 ring-foreground/5">
        <div className="flex items-baseline gap-3">
          <span className="font-heading text-5xl font-semibold tracking-tight tabular-nums text-foreground md:text-6xl">
            {data.trustScore.toFixed(1)}
          </span>
          <span className="text-sm text-muted-fg">
            / 100 delegation trust
          </span>
        </div>
      </div>

      {d && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <KpiCard label="Depth" value={d.depth} />
          <KpiCard
            label="Sponsors"
            value={d.sponsorCount.toLocaleString()}
          />
          <KpiCard
            label="Sponsor quality"
            value={`${(d.sponsorQuality * 100).toFixed(0)}%`}
            progress={d.sponsorQuality * 100}
          />
          <KpiCard
            label="Trusted ancestors"
            value={d.trustedAncestors.toLocaleString()}
          />
          <KpiCard
            label="Total delegated"
            value={`${d.totalDelegatedAmount.toLocaleString()} ALGO`}
          />
          <KpiCard
            label="Trust anchor"
            value={d.isTrustAnchor ? "Yes" : "No"}
          />
        </div>
      )}

      {b && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SubScoreCard label="Depth" score={b.depthScore} />
          <SubScoreCard
            label="Sponsor quality"
            score={b.sponsorQualityScore}
          />
          <SubScoreCard
            label="Sponsor count"
            score={b.sponsorCountScore}
          />
          <SubScoreCard label="Amount" score={b.amountScore} />
        </div>
      )}

      {d && (
        <Card>
          <CardContent className="space-y-3 py-5">
            <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
              Delegation path
            </span>
            <DelegationPath
              path={d.delegationPath}
              isTrustAnchor={d.isTrustAnchor}
            />
          </CardContent>
        </Card>
      )}

      {data.explanation && data.explanation.length > 0 && (
        <Card>
          <CardContent className="space-y-3 py-5">
            <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
              Why this score
            </span>
            <ul className="space-y-1.5 text-sm">
              {data.explanation.map((line, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border/60 bg-background/40 px-3 py-2"
                >
                  {line}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <AuditStrip />
    </div>
  )
}
