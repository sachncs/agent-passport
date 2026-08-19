import { api, ApiError } from "@/lib/api"
import { useWalletQuery } from "@/hooks/useWalletQuery"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
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

import type { TrustScoreResponse } from "@/types/api"

export default function TrustScore() {
  const { wallet, query } = useWalletQuery<TrustScoreResponse>(
    "score",
    api.getScore,
  )
  const { data, isLoading, error } = query

  if (!wallet) {
    return (
      <>
        <PageHeader
          title="Trust Score"
          description="Composite 0–100 score with five weighted sub-scores. Cached for 60 s."
        />
        <EmptyState
          icon={Progress}
          title="Enter a wallet"
          description="Use the search bar above to look up an Algorand address. The form accepts the standard 58-character base32 encoding (A–Z, 2–7)."
        />
      </>
    )
  }

  if (isLoading) return <LoadingBlock rows={6} />
  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Trust Score"
          description="Composite 0–100 score with five weighted sub-scores. Cached for 60 s."
          badge={wallet}
        />
        <ErrorBlock
          message={
            error instanceof ApiError
              ? error.message
              : "Could not load trust score"
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Trust Score"
        description="Composite 0–100 score with five weighted sub-scores. Cached for 60 s."
        badge={wallet}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="md:col-span-1">
          <CardContent className="pt-6 text-center">
            <div
              className="text-5xl font-bold tracking-tight"
              style={{ color: data.riskLevel === 'low' ? undefined : undefined }}
            >
              {data.trustScore.toFixed(1)}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Trust Score
            </div>
            <Progress
              value={data.trustScore}
              className="mt-4 h-2"
            />
            <div className="mt-4 flex items-center justify-center gap-2">
              <RiskBadge risk={data.riskLevel} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-sm">
            <KV label="Approved">{data.approved ? "Yes" : "No"}</KV>
            <div className="mt-2">
              <KV label="Recommended limit" mono>
                {formatAlgo(data.recommendedLimit)}
              </KV>
            </div>
            <div className="mt-2">
              <KV label="Wallet">
                <WalletLabel wallet={data.wallet} />
              </KV>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-sm">
            <KV label="Balance">
              {data.onChain
                ? `${data.onChain.balanceAlgo.toFixed(2)} ALGO`
                : "—"}
            </KV>
            <div className="mt-2">
              <KV label="Transactions">
                {data.onChain?.totalTxns.toLocaleString() ?? "—"}
              </KV>
            </div>
            <div className="mt-2">
              <KV label="Account age">
                {data.onChain ? `${data.onChain.accountAgeDays}d` : "—"}
              </KV>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-sm">
            <KV label="Apps opted-in">
              {data.onChain?.appCount.toLocaleString() ?? "—"}
            </KV>
            <div className="mt-2">
              <KV label="Assets held">
                {data.onChain?.assetCount.toLocaleString() ?? "—"}
              </KV>
            </div>
            <div className="mt-2">
              <KV label="Last seen round">
                {data.onChain?.lastSeenRound.toLocaleString() ?? "—"}
              </KV>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.breakdown && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-medium">Sub-scores</h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-5">
              <ScoreBar
                label="Age"
                value={data.breakdown.ageScore}
              />
              <ScoreBar
                label="Activity"
                value={data.breakdown.activityScore}
              />
              <ScoreBar
                label="Volume"
                value={data.breakdown.volumeScore}
              />
              <ScoreBar
                label="Velocity"
                value={data.breakdown.velocityScore}
              />
              <ScoreBar
                label="Compliance"
                value={data.breakdown.complianceScore}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {data.explanation && data.explanation.length > 0 && (
        <Card className="mt-4">
          <CardContent className="pt-6 text-sm">
            <h3 className="mb-3 text-sm font-medium">Explanation</h3>
            <Separator className="mb-3" />
            <ul className="space-y-1.5">
              {data.explanation.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function KV({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}
