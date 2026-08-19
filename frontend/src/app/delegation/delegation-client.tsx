"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  WalletRequiredAlert,
} from "@/components/page-header"

import type { DelegationResponse } from "@/lib/api-types"

function RiskBadge({ risk }: { risk: DelegationResponse["riskLevel"] }) {
  const labels = { low: "Low", medium: "Medium", high: "High", critical: "Critical" } as const
  const map = {
    low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    critical: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  } as const
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        map[risk]
      }
    >
      {labels[risk]}
    </span>
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

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-sm">{children}</div>
      </CardContent>
    </Card>
  )
}

function Body({ data }: { data: DelegationResponse }) {
  const d = data.delegation
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Trust score">{data.trustScore.toFixed(1)}</Stat>
        <Stat label="Risk">
          <RiskBadge risk={data.riskLevel} />
        </Stat>
        <Stat label="Approved">{data.approved ? "Yes" : "No"}</Stat>
        <Stat label="Recommended limit">
          {data.recommendedLimit.toFixed(2)} ALGO
        </Stat>
        {d && (
          <>
            <Stat label="Depth">{d.depth}</Stat>
            <Stat label="Sponsors">{d.sponsorCount}</Stat>
            <Stat label="Sponsor quality">{d.sponsorQuality.toFixed(1)}</Stat>
            <Stat label="Trusted ancestors">{d.trustedAncestors}</Stat>
            <Stat label="Total delegated">
              {(d.totalDelegatedAmount / 1_000_000).toFixed(2)} ALGO
            </Stat>
            <Stat label="Trust anchor">
              {d.isTrustAnchor ? (
                <Badge>anchor</Badge>
              ) : (
                <Badge variant="secondary">no</Badge>
              )}
            </Stat>
          </>
        )}
      </div>

      {data.breakdown && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-medium">Sub-scores</h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
              <Bar label="Depth" value={data.breakdown.depthScore} />
              <Bar label="Sponsor quality" value={data.breakdown.sponsorQualityScore} />
              <Bar label="Sponsor count" value={data.breakdown.sponsorCountScore} />
              <Bar label="Amount" value={data.breakdown.amountScore} />
            </div>
          </CardContent>
        </Card>
      )}

      {d && d.delegationPath.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-medium">Delegation path</h3>
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function DelegationClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")
  const valid = wallet && isValidWallet(wallet)

  const { data, isLoading, error } = useQuery<DelegationResponse>({
    queryKey: ["delegation", wallet],
    queryFn: () => {
      if (!valid) throw new Error("wallet is not valid")
      return api.getDelegation(wallet)
    },
    enabled: valid,
    staleTime: 30_000,
  })

  return (
    <>
      <PageHeader
        title="Delegation Trust"
        description="Sponsor graph BFS with cycle detection, depth attenuation, and trust-anchor markers."
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
          message={error instanceof ApiError ? error.message : "Could not load delegation graph"}
        />
      )}
      {data && <Body data={data} />}
    </>
  )
}
