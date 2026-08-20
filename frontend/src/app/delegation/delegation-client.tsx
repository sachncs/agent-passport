"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Users } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldAlert } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import { WalletHeroInput } from "@/components/wallet-hero-input"
import { PassportSection } from "@/components/passport-section"
import { RiskBadge } from "@/components/risk-badge"
import { Stat } from "@/components/stat"

import type { DelegationResponse } from "@/lib/api-types"

export function DelegationClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
          <Users className="h-6 w-6" />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Sponsors, anchors, and trust.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Sponsor graph BFS with cycle detection, depth attenuation, and
          trust-anchor markers.
        </p>
        <WalletHeroInput wallet={null} target="/delegation" />
      </div>
    )
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
        <CardContent className="space-y-3 py-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner />
            <span>Loading…</span>
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
        <AlertDescription>
          {error instanceof ApiError ? error.message : error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) return null
  const d = data.delegation

  return (
    <div className="space-y-6">
      <PassportSection
        icon={Users}
        title="Delegation Trust"
        subtitle="Sponsor graph BFS with cycle detection, depth attenuation, and trust-anchor markers."
        tone="sky"
        badge={<RiskBadge risk={data.riskLevel} size="lg" />}
      >
        <div className="flex flex-wrap items-baseline gap-4">
          <div className="font-heading text-5xl font-semibold tracking-tight tabular-nums">
            {data.trustScore.toFixed(1)}
          </div>
          <div className="text-sm text-muted-foreground">
            trust score ·{" "}
            <span className="font-mono">
              {wallet.slice(0, 8)}…{wallet.slice(-6)}
            </span>
          </div>
        </div>
      </PassportSection>

      {d && (
        <PassportSection
          icon={Users}
          title="Sponsor graph"
          subtitle="Depth, sponsor quality, and trust-anchor markers."
          tone="primary"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Depth" tone="muted">
              {d.depth}
            </Stat>
            <Stat label="Sponsors" tone="muted">
              {d.sponsorCount.toLocaleString()}
            </Stat>
            <Stat label="Sponsor quality" tone="muted">
              {d.sponsorQuality.toFixed(1)}
            </Stat>
            <Stat label="Trusted ancestors" tone="muted">
              {d.trustedAncestors.toLocaleString()}
            </Stat>
            <Stat label="Total delegated" tone="muted">
              {(d.totalDelegatedAmount / 1_000_000).toFixed(2)} ALGO
            </Stat>
            <Stat label="Trust anchor" tone="muted">
              {d.isTrustAnchor ? <Badge>anchor</Badge> : <span className="text-muted-foreground">no</span>}
            </Stat>
          </div>
        </PassportSection>
      )}

      {data.breakdown && (
        <PassportSection
          icon={Users}
          title="Sub-scores"
          tone="primary"
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Bar label="Depth" value={data.breakdown.depthScore} />
            <Bar
              label="Sponsor quality"
              value={data.breakdown.sponsorQualityScore}
            />
            <Bar
              label="Sponsor count"
              value={data.breakdown.sponsorCountScore}
            />
            <Bar label="Amount" value={data.breakdown.amountScore} />
          </div>
        </PassportSection>
      )}

      {d && d.delegationPath.length > 0 && (
        <PassportSection
          icon={Users}
          title="Delegation path"
          tone="primary"
        >
          <div className="flex flex-wrap items-center gap-2">
            {d.delegationPath.map((w, i) => (
              <span key={i} className="flex items-center gap-2">
                <code className="rounded-md bg-muted/30 px-2 py-0.5 font-mono text-xs">
                  {w.slice(0, 8)}…{w.slice(-6)}
                </code>
                {i < d.delegationPath.length - 1 && (
                  <span className="text-muted-foreground">→</span>
                )}
              </span>
            ))}
          </div>
        </PassportSection>
      )}

      <PassportSection icon={Users} title="At a glance" tone="primary">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Approved" tone="muted">
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
          <Stat label="Recommended limit" tone="muted">
            {data.recommendedLimit.toFixed(2)} ALGO
          </Stat>
          <Stat label="Wallet" tone="muted">
            <span className="font-mono text-xs">
              {wallet.slice(0, 8)}…{wallet.slice(-6)}
            </span>
          </Stat>
        </div>
      </PassportSection>
    </div>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(1)}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  )
}