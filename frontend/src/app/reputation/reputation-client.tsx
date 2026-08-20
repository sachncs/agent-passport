"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  WalletRequiredAlert,
} from "@/components/page-header"

import type { ReputationResponse } from "@/lib/api-types"

function Body({ data }: { data: ReputationResponse }) {
  const totalEvents = data.breakdown.totalEvents
  const positive = data.breakdown.positiveEvents
  const negative = data.breakdown.negativeEvents
  const positivePct = totalEvents > 0 ? (positive / totalEvents) * 100 : 0
  const negativePct = totalEvents > 0 ? (negative / totalEvents) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-5xl font-bold">{data.reputation.toFixed(1)}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Reputation
            </div>
            <Progress value={data.reputation} className="mt-4 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-medium">Event breakdown</h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
                <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  Total
                </div>
                <div className="font-mono text-sm">{totalEvents}</div>
              </div>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
                <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  Positive
                </div>
                <div className="font-mono text-sm">{positive}</div>
              </div>
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2">
                <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  Negative
                </div>
                <div className="font-mono text-sm">{negative}</div>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sentiment</span>
                <span className="font-mono">{positivePct.toFixed(0)}% positive</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="flex h-full">
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${positivePct}%` }}
                  />
                  <div
                    className="bg-red-500"
                    style={{ width: `${negativePct}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-3 text-sm font-medium">By event type</h3>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            <Tile label="Payments" value={data.breakdown.successfulPayments} positive />
            <Tile label="Purchases" value={data.breakdown.successfulPurchases} positive />
            <Tile label="Disputes" value={data.breakdown.disputes} negative />
            <Tile label="Refunds" value={data.breakdown.refunds} negative />
            <Tile label="Endorsements" value={data.breakdown.sponsorEndorsements} positive />
            <Tile label="Service" value={data.breakdown.serviceInteractions} positive />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Tile({ label, value, positive, negative }: { label: string; value: number; positive?: boolean; negative?: boolean }) {
  return (
    <div
      className={
        "rounded-md border p-2 " +
        (positive
          ? "border-emerald-500/30 bg-emerald-500/5"
          : negative
          ? "border-red-500/30 bg-red-500/5"
          : "border-border bg-muted/30")
      }
    >
      <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  )
}

export function ReputationClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")
  const valid = !!(wallet && isValidWallet(wallet))

  const { data, isLoading, error } = useQuery<ReputationResponse>({
    queryKey: ["reputation", wallet],
    queryFn: () => {
      if (!valid) throw new Error("wallet is not valid")
      return api.getReputation(wallet)
    },
    enabled: valid,
    staleTime: 30_000,
  })

  return (
    <>
      <PageHeader
        title="Reputation"
        description="On-chain reputation events with anti-gaming defenses (cycle detection, dedup, on-chain verification)."
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
          message={error instanceof ApiError ? error.message : "Could not load reputation"}
        />
      )}
      {data && <Body data={data} />}
    </>
  )
}
