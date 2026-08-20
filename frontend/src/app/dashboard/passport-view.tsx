"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ShieldAlert } from "lucide-react"

import { api } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"
import { SubScoreCard } from "@/components/sub-score-card"
import { VerdictCard } from "@/components/report/verdict-card"
import { TrustScoreCard } from "@/components/report/trust-score-card"
import { SybilSummary } from "@/components/report/sybil-summary"
import { ReputationSummary } from "@/components/report/reputation-summary"
import { DelegationPath } from "@/components/report/delegation-path"
import { AuditStrip } from "@/components/report/audit-strip"
import { EvidenceDrawer } from "@/components/report/evidence-drawer"
import { ReportHeader } from "@/components/report/report-header"
import { WalletRequiredAlert } from "@/components/page-header"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import type {
  DelegationResponse,
  PassportResponse,
  ReputationResponse,
  SybilCheckResponse,
  TrustScoreResponse,
  UnderwriteResponse,
} from "@/lib/api-types"

export function PassportView() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) return <WalletRequiredAlert />
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

  return <Report wallet={wallet} />
}

function Report({ wallet }: { wallet: string }) {
  const score = useScore(wallet)
  const sybil = useSybil(wallet)
  const delegation = useDelegation(wallet)
  const reputation = useReputation(wallet)
  const underwrite = useUnderwrite(wallet)
  const passport = usePassport(wallet)

  const downloadJson = () => {
    if (!passport.data) return
    const blob = new Blob([JSON.stringify(passport.data, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `passport-${wallet}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isLoadingFirst = score.isLoading && !score.data
  if (isLoadingFirst) return <LoadingState />

  if (score.error && !score.data) {
    return (
      <ErrorState
        title="Could not load report"
        message={score.error.message}
      />
    )
  }

  if (!score.data || !underwrite.data) return null

  return (
    <div className="space-y-6">
      <ReportHeader
        wallet={wallet}
        risk={score.data.riskLevel}
        generatedAt={passport.data?.generatedAt}
        checksum={passport.data?.checksum}
        onDownloadJson={
          passport.data ? downloadJson : undefined
        }
      />

      <VerdictCard
        approved={underwrite.data.approved}
        recommendedLimit={underwrite.data.recommendedLimit}
        compositeScore={underwrite.data.compositeScore}
        confidence={underwrite.data.confidence}
        riskLabel={underwrite.data.riskLevel}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrustScoreCard
          score={score.data.trustScore}
          risk={score.data.riskLevel}
        />
        <SybilSummary
          sybilRisk={sybil.data?.sybilRisk ?? 0}
          clusterSize={sybil.data?.clusterSize ?? 0}
          risk={sybil.data?.riskLevel}
          signals={
            sybil.data
              ? Object.entries(sybil.data.signals).map(([name, value]) => ({
                  name,
                  value: value as number,
                }))
              : []
          }
        />
      </div>

      {reputation.data && (
        <ReputationSummary
          positive={reputation.data.breakdown.positiveEvents}
          negative={reputation.data.breakdown.negativeEvents}
          total={reputation.data.breakdown.totalEvents}
        />
      )}

      <EvidenceDrawer
        items={[
          {
            id: "sub-scores",
            title: "Trust sub-scores",
            count: "5 inputs",
            summary:
              "Weighted breakdown of the composite trust score.",
            children: score.data.breakdown ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <SubScoreCard
                  label="Age"
                  score={score.data.breakdown.ageScore}
                />
                <SubScoreCard
                  label="Activity"
                  score={score.data.breakdown.activityScore}
                />
                <SubScoreCard
                  label="Volume"
                  score={score.data.breakdown.volumeScore}
                />
                <SubScoreCard
                  label="Velocity"
                  score={score.data.breakdown.velocityScore}
                />
                <SubScoreCard
                  label="Compliance"
                  score={score.data.breakdown.complianceScore}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-fg">
                No breakdown available.
              </p>
            ),
          },
          {
            id: "delegation",
            title: "Delegation path",
            count: delegation.data?.delegation
              ? `${delegation.data.delegation.sponsorCount} sponsors`
              : undefined,
            summary:
              "BFS-walked sponsor chain with depth attenuation and cycle detection.",
            children: delegation.data?.delegation ? (
              <DelegationPath
                path={delegation.data.delegation.delegationPath}
                isTrustAnchor={delegation.data.delegation.isTrustAnchor}
              />
            ) : (
              <p className="text-sm text-muted-fg">
                No delegation on record.
              </p>
            ),
          },
          {
            id: "sybil",
            title: "Twelve sybil signals",
            count: sybil.data
              ? `${Math.round((sybil.data.sybilRisk ?? 0) * 100)}% risk`
              : undefined,
            summary:
              "Twelve signals across clustering, timing, amount, balance, and graph traversal.",
            children: sybil.data ? (
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {Object.entries(sybil.data.signals).map(([k, v]) => (
                  <li
                    key={k}
                    className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs"
                  >
                    <span className="font-mono">{k}</span>
                    <span className="font-mono tabular-nums">
                      {((v as number) * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : null,
          },
          {
            id: "reputation",
            title: "Reputation log",
            count: reputation.data
              ? `${reputation.data.breakdown.totalEvents} events`
              : undefined,
            summary:
              "Event log with anti-gaming defenses (cycle detection, dedup, on-chain verification).",
            children: reputation.data ? (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(reputation.data.breakdown)
                  .filter(([k]) => k !== "totalEvents")
                  .map(([k, v]) => (
                    <li
                      key={k}
                      className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs"
                    >
                      <span>{k}</span>
                      <span className="font-mono tabular-nums">
                        {v.toLocaleString()}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : null,
          },
          {
            id: "underwriting",
            title: "Underwriting factors",
            count: underwrite.data
              ? `${underwrite.data.factors.length} factors`
              : undefined,
            summary:
              "Four-factor composite under a system-wide cap.",
            children: underwrite.data ? (
              <ul className="space-y-2">
                {underwrite.data.factors.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm"
                  >
                    <span>{f.name}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-fg">
                      {f.score.toFixed(1)} × {(f.weight * 100).toFixed(0)}%
                      = {f.contribution.toFixed(2)} ({f.status})
                    </span>
                  </li>
                ))}
              </ul>
            ) : null,
          },
        ]}
      />

      <AuditStrip>
        {passport.data?.checksum && (
          <span className="inline-flex items-center gap-1.5">
            <span className="uppercase tracking-[0.14em]">
              sha256
            </span>
            <code className="font-mono text-foreground">
              {passport.data.checksum.slice(0, 16)}…
            </code>
          </span>
        )}
      </AuditStrip>
    </div>
  )
}

function useScore(wallet: string) {
  return useQuery<TrustScoreResponse>({
    queryKey: ["score", wallet],
    queryFn: () => api.getScore(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })
}

function useSybil(wallet: string) {
  return useQuery<SybilCheckResponse>({
    queryKey: ["sybil", wallet],
    queryFn: () => api.checkSybil(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })
}

function useDelegation(wallet: string) {
  return useQuery<DelegationResponse>({
    queryKey: ["delegation", wallet],
    queryFn: () => api.getDelegation(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })
}

function useReputation(wallet: string) {
  return useQuery<ReputationResponse>({
    queryKey: ["reputation", wallet],
    queryFn: () => api.getReputation(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })
}

function useUnderwrite(wallet: string) {
  return useQuery<UnderwriteResponse>({
    queryKey: ["underwrite", wallet],
    queryFn: () => api.underwrite(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })
}

function usePassport(wallet: string) {
  return useQuery<PassportResponse>({
    queryKey: ["passport", wallet],
    queryFn: () => api.getPassport(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })
}

function LoadingState() {
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

function ErrorState({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <Alert variant="destructive">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
