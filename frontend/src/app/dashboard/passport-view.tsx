"use client"

import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import {
  Award,
  Gauge,
  ShieldCheck,
  ShieldAlert,
  Star,
  Users,
  Wallet,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

import {
  LoadingBlock,
  PageHeader,
  WalletRequiredAlert,
} from "@/components/page-header"
import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import type {
  DelegationResponse,
  ReputationResponse,
  SybilCheckResponse,
  TrustScoreResponse,
  UnderwriteResponse,
} from "@/lib/api-types"

type RiskLevel = "low" | "medium" | "high" | "critical"

function riskClasses(risk: RiskLevel) {
  const map: Record<RiskLevel, string> = {
    low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    critical: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  }
  return map[risk]
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const label = risk.charAt(0).toUpperCase() + risk.slice(1)
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        riskClasses(risk)
      }
    >
      {label}
    </span>
  )
}

function useWalletQuery<T>(
  key: string,
  fetcher: (wallet: string) => Promise<T>,
) {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")
  const valid = !!(wallet && isValidWallet(wallet))
  return useQuery<T>({
    queryKey: [key, wallet],
    queryFn: () => {
      if (!valid) throw new Error("wallet is not valid")
      return fetcher(wallet)
    },
    enabled: valid,
    staleTime: 30_000,
  })
}

export function PassportView() {
  const { data } = useWalletQuery("score", api.getScore)
  return (
    <section className="space-y-6">
      <PageHeader
        title="Passport"
        description="Trust, sybil, reputation, delegation, and credit for one wallet — in one document."
        badge={data?.wallet}
      />
      <PassportDocument />
    </section>
  )
}

function PassportDocument() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")
  const valid = !!(wallet && isValidWallet(wallet))

  if (!wallet) return <WalletRequiredAlert />
  if (!valid) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          That wallet address isn&apos;t a valid 58-character base32
          Algorand address.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <SummarySection />
        <Separator />
        <TrustScoreSection />
        <Separator />
        <SybilSection />
        <Separator />
        <ReputationSection />
        <Separator />
        <DelegationSection />
        <Separator />
        <UnderwriteSection />
      </CardContent>
    </Card>
  )
}

function SummarySection() {
  const { data, isLoading, error } = useWalletQuery<TrustScoreResponse>(
    "score",
    api.getScore,
  )
  return (
    <Section title="Summary" icon={Award}>
      {isLoading && <Skeleton className="h-12 w-full" />}
      {error && <InlineError error={error} />}
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Trust score" value={data.trustScore.toFixed(1)} />
          <Stat
            label="Approved"
            value={data.approved ? "Yes" : "No"}
            valueClassName={
              data.approved
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive"
            }
          />
          <Stat
            label="Credit limit"
            value={`${data.recommendedLimit.toFixed(0)} ALGO`}
          />
          <div className="flex flex-col gap-1">
            <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              Risk
            </span>
            <RiskBadge risk={data.riskLevel} />
          </div>
        </div>
      )}
    </Section>
  )
}

function TrustScoreSection() {
  const { data, isLoading, error } = useWalletQuery<TrustScoreResponse>(
    "score",
    api.getScore,
  )
  return (
    <Section title="Trust Score" icon={Gauge}>
      {isLoading && <LoadingBlock rows={5} />}
      {error && <InlineError error={error} />}
      {data?.breakdown && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <SubScore label="Age" value={data.breakdown.ageScore} />
          <SubScore label="Activity" value={data.breakdown.activityScore} />
          <SubScore label="Volume" value={data.breakdown.volumeScore} />
          <SubScore label="Velocity" value={data.breakdown.velocityScore} />
          <SubScore
            label="Compliance"
            value={data.breakdown.complianceScore}
          />
        </div>
      )}
    </Section>
  )
}

function SybilSection() {
  const { data, isLoading, error } = useWalletQuery<SybilCheckResponse>(
    "sybil",
    api.checkSybil,
  )
  return (
    <Section title="Sybil Risk" icon={ShieldAlert}>
      {isLoading && <LoadingBlock rows={3} />}
      {error && <InlineError error={error} />}
      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold tracking-tight">
              {(data.sybilRisk * 100).toFixed(0)}%
            </div>
            <RiskBadge risk={data.riskLevel} />
          </div>
          {data.explanation && data.explanation.length > 0 && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {data.explanation.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          )}
          {data.signals && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Signals
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {Object.entries(data.signals).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5"
                  >
                    <span className="text-xs">{key}</span>
                    <span className="font-mono text-xs">
                      {((value as number) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

function ReputationSection() {
  const { data, isLoading, error } = useWalletQuery<ReputationResponse>(
    "reputation",
    api.getReputation,
  )
  return (
    <Section title="Reputation" icon={Star}>
      {isLoading && <LoadingBlock rows={3} />}
      {error && <InlineError error={error} />}
      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold tracking-tight">
              {data.reputation.toFixed(1)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Positive"
              value={data.breakdown.positiveEvents.toLocaleString()}
            />
            <Stat
              label="Negative"
              value={data.breakdown.negativeEvents.toLocaleString()}
            />
            <Stat
              label="Total events"
              value={data.breakdown.totalEvents.toLocaleString()}
            />
            <Stat
              label="Disputes"
              value={data.breakdown.disputes.toLocaleString()}
            />
          </div>
          {data.explanation && data.explanation.length > 0 && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {data.explanation.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  )
}

function DelegationSection() {
  const { data, isLoading, error } = useWalletQuery<DelegationResponse>(
    "delegation",
    api.getDelegation,
  )
  return (
    <Section title="Delegation" icon={Users}>
      {isLoading && <LoadingBlock rows={3} />}
      {error && <InlineError error={error} />}
      {data?.delegation && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Depth" value={String(data.delegation.depth)} />
          <Stat
            label="Sponsors"
            value={data.delegation.sponsorCount.toLocaleString()}
          />
          <Stat
            label="Trust anchor"
            value={data.delegation.isTrustAnchor ? "Yes" : "No"}
            valueClassName={
              data.delegation.isTrustAnchor
                ? "text-emerald-600 dark:text-emerald-400"
                : ""
            }
          />
          <Stat
            label="Trusted ancestors"
            value={data.delegation.trustedAncestors.toLocaleString()}
          />
        </div>
      )}
    </Section>
  )
}

function UnderwriteSection() {
  const { data, isLoading, error } = useWalletQuery<UnderwriteResponse>(
    "underwrite",
    api.underwrite,
  )
  return (
    <Section title="Underwriting" icon={ShieldCheck}>
      {isLoading && <LoadingBlock rows={3} />}
      {error && <InlineError error={error} />}
      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge
              variant={data.approved ? "default" : "destructive"}
              className="px-3 py-1 text-sm"
            >
              {data.approved ? "Approve" : "Deny"}
            </Badge>
            <RiskBadge risk={data.riskLevel} />
            <span className="font-mono text-sm text-muted-foreground">
              score {data.compositeScore.toFixed(1)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat
              label="Recommended limit"
              value={`${data.recommendedLimit.toFixed(0)} ALGO`}
            />
            <Stat
              label="Confidence"
              value={`${(data.confidence * 100).toFixed(0)}%`}
            />
            <Stat label="Factors" value={String(data.factors.length)} />
          </div>
          {data.factors.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Factors
              </div>
              <ul className="space-y-1 text-sm">
                {data.factors.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span>
                      {f.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({f.status})
                      </span>
                    </span>
                    <span className="font-mono text-xs">
                      {f.score.toFixed(1)} × {(f.weight * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-3 py-2">
      <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={"font-mono text-sm font-medium " + (valueClassName ?? "")}>
        {value}
      </span>
    </div>
  )
}

function SubScore({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(1)}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  )
}

function InlineError({ error }: { error: Error }) {
  return (
    <Alert variant="destructive">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>Could not load this section</AlertTitle>
      <AlertDescription>
        {error instanceof ApiError ? error.message : error.message}
      </AlertDescription>
    </Alert>
  )
}