"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Award,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { PassportSection } from "@/components/passport-section"
import { RiskBadge } from "@/components/risk-badge"
import { Stat } from "@/components/stat"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import type {
  DelegationResponse,
  ReputationResponse,
  SybilCheckResponse,
  TrustScoreResponse,
  UnderwriteResponse,
} from "@/lib/api-types"

/**
 * Reusable per-section fetchers for the passport report. Each
 * section reads the wallet from URL search params (same shape as
 * the rest of the console) and renders its own loading / error /
 * success states.
 */

export function useWalletQuery<T>(
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

function SectionLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner />
        <span>Loading…</span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  )
}

function SectionError({ error }: { error: Error }) {
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

export function SummarySection() {
  const { data, isLoading, error } = useWalletQuery<TrustScoreResponse>(
    "score",
    api.getScore,
  )
  return (
    <PassportSection
      icon={Award}
      title="Summary"
      subtitle="Headline numbers across the report."
    >
      {isLoading && <SectionLoading rows={2} />}
      {error && <SectionError error={error} />}
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Trust score">{data.trustScore.toFixed(1)}</Stat>
          <Stat
            label="Approved"
            tone="muted"
          >
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
          <Stat label="Credit limit" tone="muted">
            {data.recommendedLimit.toFixed(0)} ALGO
          </Stat>
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Risk
            </span>
            <div>
              <RiskBadge risk={data.riskLevel} />
            </div>
          </div>
        </div>
      )}
    </PassportSection>
  )
}

export function TrustScoreSection() {
  const { data, isLoading, error } = useWalletQuery<TrustScoreResponse>(
    "score",
    api.getScore,
  )
  return (
    <PassportSection
      icon={Gauge}
      title="Trust Score"
      subtitle="Composite 0–100 with five weighted sub-scores."
      tone="emerald"
    >
      {isLoading && <SectionLoading rows={5} />}
      {error && <SectionError error={error} />}
      {data?.breakdown && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <SubScore label="Age" value={data.breakdown.ageScore} />
          <SubScore label="Activity" value={data.breakdown.activityScore} />
          <SubScore label="Volume" value={data.breakdown.volumeScore} />
          <SubScore
            label="Velocity"
            value={data.breakdown.velocityScore}
          />
          <SubScore
            label="Compliance"
            value={data.breakdown.complianceScore}
          />
        </div>
      )}
    </PassportSection>
  )
}

export function SybilSection() {
  const { data, isLoading, error } = useWalletQuery<SybilCheckResponse>(
    "sybil",
    api.checkSybil,
  )
  return (
    <PassportSection
      icon={ShieldAlert}
      title="Sybil Risk"
      subtitle="Twelve signals across clustering, timing, amount, balance, and graph traversal."
      tone="amber"
    >
      {isLoading && <SectionLoading rows={3} />}
      {error && <SectionError error={error} />}
      {data && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-semibold tracking-tight">
              {(data.sybilRisk * 100).toFixed(0)}%
            </div>
            <RiskBadge risk={data.riskLevel} size="lg" />
          </div>
          {data.explanation && data.explanation.length > 0 && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {data.explanation.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          )}
          {data.signals && (
            <div className="space-y-2">
              <div className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Signals
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(data.signals).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
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
    </PassportSection>
  )
}

export function ReputationSection() {
  const { data, isLoading, error } = useWalletQuery<ReputationResponse>(
    "reputation",
    api.getReputation,
  )
  return (
    <PassportSection
      icon={Star}
      title="Reputation"
      subtitle="Event log with anti-gaming defenses (cycle detection, dedup, on-chain verification)."
      tone="violet"
    >
      {isLoading && <SectionLoading rows={3} />}
      {error && <SectionError error={error} />}
      {data && (
        <div className="space-y-4">
          <div className="flex items-baseline gap-3">
            <div className="text-4xl font-semibold tracking-tight">
              {data.reputation.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">
              from {data.breakdown.totalEvents.toLocaleString()} events
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Positive" tone="muted">
              {data.breakdown.positiveEvents.toLocaleString()}
            </Stat>
            <Stat label="Negative" tone="muted">
              {data.breakdown.negativeEvents.toLocaleString()}
            </Stat>
            <Stat label="Total events" tone="muted">
              {data.breakdown.totalEvents.toLocaleString()}
            </Stat>
            <Stat label="Disputes" tone="muted">
              {data.breakdown.disputes.toLocaleString()}
            </Stat>
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
    </PassportSection>
  )
}

export function DelegationSection() {
  const { data, isLoading, error } = useWalletQuery<DelegationResponse>(
    "delegation",
    api.getDelegation,
  )
  return (
    <PassportSection
      icon={Users}
      title="Delegation"
      subtitle="Sponsor graph BFS with depth attenuation, cycle detection, and trust-anchor markers."
      tone="sky"
    >
      {isLoading && <SectionLoading rows={3} />}
      {error && <SectionError error={error} />}
      {data?.delegation && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Depth" tone="muted">
              {data.delegation.depth}
            </Stat>
            <Stat label="Sponsors" tone="muted">
              {data.delegation.sponsorCount.toLocaleString()}
            </Stat>
            <Stat label="Trust anchor" tone="muted">
              {data.delegation.isTrustAnchor ? (
                <Badge>anchor</Badge>
              ) : (
                <span className="text-muted-foreground">no</span>
              )}
            </Stat>
            <Stat label="Trusted ancestors" tone="muted">
              {data.delegation.trustedAncestors.toLocaleString()}
            </Stat>
          </div>
          {data.delegation.delegationPath.length > 0 && (
            <div>
              <div className="mb-2 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Delegation path
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {data.delegation.delegationPath.map((w, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <code className="rounded-md bg-muted/30 px-2 py-0.5 font-mono text-xs">
                      {w.slice(0, 8)}…{w.slice(-6)}
                    </code>
                    {i < data.delegation!.delegationPath.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PassportSection>
  )
}

export function UnderwritingSection() {
  const { data, isLoading, error } = useWalletQuery<UnderwriteResponse>(
    "underwrite",
    api.underwrite,
  )
  return (
    <PassportSection
      icon={ShieldCheck}
      title="Underwriting"
      subtitle="Approve / deny plus a recommended credit limit from a four-factor composite."
      tone="primary"
    >
      {isLoading && <SectionLoading rows={3} />}
      {error && <SectionError error={error} />}
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant={data.approved ? "default" : "destructive"}
              className="px-3 py-1 text-sm"
            >
              {data.approved ? "Approve" : "Deny"}
            </Badge>
            <RiskBadge risk={data.riskLevel} />
            <span className="text-sm text-muted-foreground">
              composite{" "}
              <span className="font-mono">
                {data.compositeScore.toFixed(1)}
              </span>{" "}
              ·{" "}
              <span className="font-mono">
                {(data.confidence * 100).toFixed(0)}%
              </span>{" "}
              confidence
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Recommended limit" tone="muted">
              {data.recommendedLimit.toFixed(0)} ALGO
            </Stat>
            <Stat label="Confidence" tone="muted">
              {(data.confidence * 100).toFixed(0)}%
            </Stat>
            <Stat label="Factors" tone="muted">
              {data.factors.length}
            </Stat>
          </div>
          {data.factors.length > 0 && (
            <div className="space-y-2">
              <div className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Factors
              </div>
              <ul className="space-y-1.5 text-sm">
                {data.factors.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
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
    </PassportSection>
  )
}