"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ShieldAlert } from "lucide-react"

import { api } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"
import { CommandSurface } from "@/components/command-surface"
import { KpiCard } from "@/components/kpi-card"
import { ReputationSummary } from "@/components/report/reputation-summary"
import { ReportHeader } from "@/components/report/report-header"
import { AuditStrip } from "@/components/report/audit-strip"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import type { ReputationResponse } from "@/lib/api-types"

export function ReputationClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return <ReputationEntry target="/reputation" />
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

  return <ReputationBody wallet={wallet} />
}

function ReputationEntry({ target }: { target: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Reputation, event by event.
      </h1>
      <p className="max-w-md text-sm text-muted-fg">
        A composite reputation score from a positive/negative event log
        with cycle detection, dedup, and on-chain verification.
      </p>
      <CommandSurface target={target} cta="Load Reputation" />
    </div>
  )
}

function ReputationBody({ wallet }: { wallet: string }) {
  const { data, isLoading, error } = useQuery<ReputationResponse>({
    queryKey: ["reputation", wallet],
    queryFn: () => api.getReputation(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8">
          <div className="flex items-center gap-2 text-xs text-muted-fg">
            <Spinner />
            <span>Aggregating reputation events…</span>
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
        <AlertTitle>Could not load reputation</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <ReportHeader wallet={wallet} />

      <div className="rounded-xl border border-border bg-surface-2/60 p-5 shadow-[var(--shadow-sm)] ring-1 ring-foreground/5">
        <div className="flex items-baseline gap-3">
          <span className="font-heading text-5xl font-semibold tracking-tight tabular-nums text-foreground md:text-6xl">
            {data.reputation.toFixed(1)}
          </span>
          <span className="text-sm text-muted-fg">
            from {data.breakdown.totalEvents.toLocaleString()} events
          </span>
        </div>
      </div>

      <ReputationSummary
        positive={data.breakdown.positiveEvents}
        negative={data.breakdown.negativeEvents}
        total={data.breakdown.totalEvents}
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiCard
          label="Payments"
          value={data.breakdown.successfulPayments.toLocaleString()}
        />
        <KpiCard
          label="Purchases"
          value={data.breakdown.successfulPurchases.toLocaleString()}
        />
        <KpiCard
          label="Disputes"
          value={data.breakdown.disputes.toLocaleString()}
        />
        <KpiCard
          label="Refunds"
          value={data.breakdown.refunds.toLocaleString()}
        />
        <KpiCard
          label="Endorsements"
          value={data.breakdown.sponsorEndorsements.toLocaleString()}
        />
        <KpiCard
          label="Service interactions"
          value={data.breakdown.serviceInteractions.toLocaleString()}
        />
      </div>

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
