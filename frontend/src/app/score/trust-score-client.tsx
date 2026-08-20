"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ShieldAlert } from "lucide-react"

import { api } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"
import { CommandSurface } from "@/components/command-surface"
import { SubScoreCard } from "@/components/sub-score-card"
import { KpiCard } from "@/components/kpi-card"
import { RiskPill } from "@/components/risk-pill"
import { TrustScoreCard } from "@/components/report/trust-score-card"
import { ReportHeader } from "@/components/report/report-header"
import { AuditStrip } from "@/components/report/audit-strip"
import { EvidenceDrawer } from "@/components/report/evidence-drawer"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import type { TrustScoreResponse } from "@/lib/api-types"

export function TrustScoreClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return <CommandSurfaceEntry target="/score" />
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

function CommandSurfaceEntry({ target }: { target: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Trust score, in one glance.
      </h1>
      <p className="max-w-md text-sm text-muted-fg">
        A composite 0–100 from five weighted sub-scores — age, activity,
        volume, velocity, and compliance.
      </p>
      <CommandSurface target={target} cta="Load Score" />
    </div>
  )
}

function ScoreBody({ wallet }: { wallet: string }) {
  const { data, isLoading, error } = useQuery<TrustScoreResponse>({
    queryKey: ["score", wallet],
    queryFn: () => api.getScore(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8">
          <div className="flex items-center gap-2 text-xs text-muted-fg">
            <Spinner />
            <span>Verifying on-chain…</span>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Could not load trust score</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <ReportHeader
        wallet={wallet}
        risk={data.riskLevel}
        generatedAt={new Date().toISOString()}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
        <TrustScoreCard
          score={data.trustScore}
          risk={data.riskLevel}
        />
        <div className="flex flex-col gap-4">
          <KpiCard
            label="Approved"
            value={
              data.approved ? (
                <span className="text-verified-fg">Yes</span>
              ) : (
                <span className="text-risk-critical">No</span>
              )
            }
          />
          <KpiCard
            label="Recommended limit"
            value={`${data.recommendedLimit.toFixed(0)} ALGO`}
          />
        </div>
      </div>

      {data.breakdown && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <SubScoreCard label="Age" score={data.breakdown.ageScore} />
          <SubScoreCard
            label="Activity"
            score={data.breakdown.activityScore}
          />
          <SubScoreCard
            label="Volume"
            score={data.breakdown.volumeScore}
          />
          <SubScoreCard
            label="Velocity"
            score={data.breakdown.velocityScore}
          />
          <SubScoreCard
            label="Compliance"
            score={data.breakdown.complianceScore}
          />
        </div>
      )}

      {data.onChain && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <KpiCard
            label="Balance"
            value={`${data.onChain.balanceAlgo.toFixed(2)} ALGO`}
          />
          <KpiCard
            label="Transactions"
            value={data.onChain.totalTxns.toLocaleString()}
          />
          <KpiCard label="Assets" value={data.onChain.assetCount} />
          <KpiCard label="Apps" value={data.onChain.appCount} />
          <KpiCard
            label="Account age"
            value={`${data.onChain.accountAgeDays}d`}
          />
          <KpiCard
            label="First seen"
            value={data.onChain.firstSeenRound}
          />
          <KpiCard
            label="Last seen"
            value={data.onChain.lastSeenRound}
          />
          <KpiCard
            label="Risk"
            value={<RiskPill risk={data.riskLevel} size="sm" />}
          />
        </div>
      )}

      {data.explanation && data.explanation.length > 0 && (
        <EvidenceDrawer
          defaultOpen={["explanation"]}
          items={[
            {
              id: "explanation",
              title: "Why this score",
              count: `${data.explanation.length} drivers`,
              children: (
                <Accordion defaultValue={["0"]}>
                  {data.explanation.map((line, i) => (
                    <AccordionItem
                      key={i}
                      value={String(i)}
                      className="border-b border-border/40 last:border-b-0"
                    >
                      <AccordionTrigger className="py-2 text-sm font-normal hover:no-underline">
                        {line}
                      </AccordionTrigger>
                      <AccordionContent className="text-xs text-muted-fg">
                        {`This driver is one of the ${data.explanation!.length} weighted inputs to the composite score. Hover or expand for source detail.`}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ),
            },
          ]}
        />
      )}

      <AuditStrip />
    </div>
  )
}
