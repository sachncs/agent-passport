"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ShieldAlert } from "lucide-react"

import { api } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"
import { CommandSurface } from "@/components/command-surface"
import { SybilSummary } from "@/components/report/sybil-summary"
import { ReportHeader } from "@/components/report/report-header"
import { AuditStrip } from "@/components/report/audit-strip"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import type { SybilCheckResponse } from "@/lib/api-types"

export function SybilClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return <SybilEntry target="/sybil" />
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

function SybilEntry({ target }: { target: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Twelve signals, one verdict.
      </h1>
      <p className="max-w-md text-sm text-muted-fg">
        Sybil risk from twelve signals across clustering, timing, amount,
        balance, and graph traversal — with confidence and cluster
        size.
      </p>
      <CommandSurface target={target} cta="Load Sybil Analysis" />
    </div>
  )
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
        <CardContent className="space-y-4 py-8">
          <div className="flex items-center gap-2 text-xs text-muted-fg">
            <Spinner />
            <span>Computing twelve signals…</span>
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
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  const signals = Object.entries(data.signals).map(([name, value]) => ({
    name,
    value: value as number,
  }))

  return (
    <div className="space-y-6">
      <ReportHeader wallet={wallet} risk={data.riskLevel} />

      <SybilSummary
        sybilRisk={data.sybilRisk}
        clusterSize={data.clusterSize}
        risk={data.riskLevel}
        signals={signals}
      />

      {data.flaggedWallets.length > 0 && (
        <Card>
          <CardContent className="space-y-3 py-5">
            <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
              Flagged wallets
            </span>
            <p className="text-sm text-muted-fg">
              {data.flaggedWallets.length} wallet
              {data.flaggedWallets.length === 1 ? "" : "s"} sharing
              cluster characteristics with this address.
            </p>
            <ul className="space-y-1 font-mono text-xs text-muted-fg">
              {data.flaggedWallets.slice(0, 12).map((w) => (
                <li key={w}>
                  {w.slice(0, 12)}…{w.slice(-8)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data.explanation.length > 0 && (
        <Card>
          <CardContent className="space-y-3 py-5">
            <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
              Why this risk level
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
