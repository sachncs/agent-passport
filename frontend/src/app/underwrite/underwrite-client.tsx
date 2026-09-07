"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ShieldAlert } from "lucide-react"

import { api } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"
import { CommandSurface } from "@/components/command-surface"
import { FactorCard } from "@/components/factor-card"
import { KpiCard } from "@/components/kpi-card"
import { VerdictCard } from "@/components/report/verdict-card"
import { ReportHeader } from "@/components/report/report-header"
import { AuditStrip } from "@/components/report/audit-strip"
import { EvidenceDrawer } from "@/components/report/evidence-drawer"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import type { UnderwriteResponse } from "@/lib/api-types"

export function UnderwriteClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return <CommandSurfaceEntry target="/underwrite" />
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

  return <UnderwriteBody wallet={wallet} />
}

function CommandSurfaceEntry({ target }: { target: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Approve, deny, or limit.
      </h1>
      <p className="max-w-md text-sm text-muted-fg">
        A four-factor composite with a system-wide cap — underwriters
        and merchant integrations get a clear verdict in one call.
      </p>
      <CommandSurface target={target} cta="Run Underwrite" />
    </div>
  )
}

function UnderwriteBody({ wallet }: { wallet: string }) {
  const { data, isLoading, error } = useQuery<UnderwriteResponse>({
    queryKey: ["underwrite", wallet],
    queryFn: () => api.underwrite(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8">
          <div className="flex items-center gap-2 text-xs text-muted-fg">
            <Spinner />
            <span>Computing verdict…</span>
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
        <AlertTitle>Could not load underwriting decision</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  const sanctions = data.sanctions

  return (
    <div className="space-y-6">
      <ReportHeader wallet={wallet} risk={data.riskLevel} />

      <VerdictCard
        approved={data.approved}
        recommendedLimit={data.recommendedLimit}
        compositeScore={data.compositeScore}
        confidence={data.confidence}
        riskLabel={data.riskLevel}
      />

      {sanctions && sanctions.status !== "allowed" && (
        <Alert className="border-risk-medium/30 bg-risk-medium/[0.08] text-risk-medium">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>
            Sanctions · {sanctions.status}
          </AlertTitle>
          {sanctions.reason && (
            <AlertDescription>{sanctions.reason}</AlertDescription>
          )}
          <div className="text-xs">Provider: {sanctions.provider}</div>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {data.factors.map((f, i) => (
          <FactorCard
            key={i}
            name={f.name}
            score={f.score}
            weight={f.weight}
            contribution={f.contribution}
            status={f.status}
          />
        ))}
      </div>

      <EvidenceDrawer
        items={[
          {
            id: "explanation",
            title: "Why this verdict",
            count: `${data.explanation.length} drivers`,
            children: data.explanation.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {data.explanation.map((line, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-foreground"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-fg">
                No driver-level explanation returned.
              </p>
            ),
          },
          {
            id: "summary",
            title: "At a glance",
            children: (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <KpiCard label="Wallet" value={wallet.slice(0, 8)} />
                <KpiCard
                  label="Composite"
                  value={data.compositeScore.toFixed(1)}
                />
                <KpiCard
                  label="Confidence"
                  value={`${(data.confidence * 100).toFixed(0)}%`}
                />
              </div>
            ),
          },
        ]}
      />

      <AuditStrip />
    </div>
  )
}
