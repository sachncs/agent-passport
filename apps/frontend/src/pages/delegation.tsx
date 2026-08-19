import { Users, Anchor } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { useWalletQuery } from "@/hooks/useWalletQuery"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  RiskBadge,
  ScoreBar,
  WalletLabel,
} from "@/components/widgets"
import { formatAlgo } from "@/lib/utils"

import type { DelegationResponse } from "@/types/api"

export default function Delegation() {
  const { wallet, query } = useWalletQuery<DelegationResponse>(
    "delegation",
    api.getDelegation,
  )
  const { data, isLoading, error } = query

  if (!wallet) {
    return (
      <>
        <PageHeader
          title="Delegation Trust"
          description="Sponsor graph BFS with cycle detection, depth attenuation, and trust-anchor markers."
        />
        <EmptyState
          icon={Users}
          title="Enter a wallet"
          description="Delegation trust inherits from sponsors. Use the search bar to look up a wallet."
        />
      </>
    )
  }

  if (isLoading) return <LoadingBlock rows={6} />
  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Delegation Trust"
          description="Sponsor graph BFS with cycle detection, depth attenuation, and trust-anchor markers."
          badge={wallet}
        />
        <ErrorBlock
          message={
            error instanceof ApiError
              ? error.message
              : "Could not load delegation graph"
          }
        />
      </>
    )
  }

  const d = data.delegation
  return (
    <>
      <PageHeader
        title="Delegation Trust"
        description="Sponsor graph BFS with cycle detection, depth attenuation, and trust-anchor markers."
        badge={wallet}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Depth">{d?.depth ?? 0}</Stat>
        <Stat label="Sponsors">{d?.sponsorCount ?? 0}</Stat>
        <Stat label="Sponsor quality">
          {d ? d.sponsorQuality.toFixed(1) : "—"}
        </Stat>
        <Stat label="Trusted ancestors">
          {d?.trustedAncestors ?? 0}
        </Stat>
        <Stat label="Total delegated">
          {d ? formatAlgo(d.totalDelegatedAmount / 1_000_000) : "—"}
        </Stat>
        <Stat label="Trust anchor">
          {d?.isTrustAnchor ? (
            <Badge variant="default" className="gap-1">
              <Anchor className="h-3 w-3" /> anchor
            </Badge>
          ) : (
            <Badge variant="secondary">no</Badge>
          )}
        </Stat>
        <Stat label="Trust score">
          {data.trustScore.toFixed(1)}
        </Stat>
        <Stat label="Risk">
          <RiskBadge risk={data.riskLevel} />
        </Stat>
      </div>

      {data.breakdown && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-medium">Sub-scores</h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
              <ScoreBar label="Depth" value={data.breakdown.depthScore} />
              <ScoreBar
                label="Sponsor quality"
                value={data.breakdown.sponsorQualityScore}
              />
              <ScoreBar
                label="Sponsor count"
                value={data.breakdown.sponsorCountScore}
              />
              <ScoreBar label="Amount" value={data.breakdown.amountScore} />
            </div>
          </CardContent>
        </Card>
      )}

      {d && d.delegationPath.length > 0 && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-medium">Delegation path</h3>
            <div className="flex flex-wrap items-center gap-2">
              {d.delegationPath.map((w, i) => (
                <span key={i} className="flex items-center gap-2">
                  <WalletLabel wallet={w} />
                  {i < d.delegationPath.length - 1 && (
                    <span className="text-muted-foreground">→</span>
                  )}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function Stat({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-lg font-semibold">{children}</div>
      </CardContent>
    </Card>
  )
}
