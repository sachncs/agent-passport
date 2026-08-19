import { Scale, ShieldCheck, ShieldAlert, AlertCircle } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { useWalletQuery } from "@/hooks/useWalletQuery"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  RiskBadge,
} from "@/components/widgets"
import { formatUSDC } from "@/lib/utils"

import type { UnderwriteResponse } from "@/types/api"

export default function Underwrite() {
  const { wallet, query } = useWalletQuery<UnderwriteResponse>(
    "underwrite",
    api.underwrite,
  )
  const { data, isLoading, error } = query

  if (!wallet) {
    return (
      <>
        <PageHeader
          title="Underwrite"
          description="Approve/deny + recommended credit limit, computed from a 4-factor composite and a $100k system-wide cap."
        />
        <EmptyState
          icon={Scale}
          title="Enter a wallet"
          description="Underwriting runs trust, delegation, sybil, and reputation factors in parallel and returns a composite decision."
        />
      </>
    )
  }

  if (isLoading) return <LoadingBlock rows={6} />
  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Underwrite"
          description="Approve/deny + recommended credit limit, computed from a 4-factor composite and a $100k system-wide cap."
          badge={wallet}
        />
        <ErrorBlock
          message={
            error instanceof ApiError
              ? error.message
              : "Could not load underwriting decision"
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Underwrite"
        description="Approve/deny + recommended credit limit, computed from a 4-factor composite and a $100k system-wide cap."
        badge={wallet}
      />

      <Card
        className={
          data.approved
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-destructive/30 bg-destructive/5"
        }
      >
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            {data.approved ? (
              <ShieldCheck className="h-8 w-8 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-8 w-8 text-destructive" />
            )}
            <div>
              <div className="text-2xl font-semibold">
                {data.approved ? "Approved" : "Denied"}
              </div>
              <div className="text-sm text-muted-foreground">
                Composite {data.compositeScore.toFixed(1)} · Risk{" "}
                <RiskBadge risk={data.riskLevel} className="ml-1" /> · Confidence{" "}
                {(data.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Recommended limit
            </div>
            <div className="text-2xl font-semibold">
              {formatUSDC(data.recommendedLimit)}
            </div>
          </div>
        </CardContent>
      </Card>

      {data.sanctions && data.sanctions.status !== "allowed" && (
        <Card className="mt-4 border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div>
              <strong>Sanctions: {data.sanctions.status}</strong>
              {data.sanctions.reason && (
                <span className="ml-2 text-muted-foreground">
                  ({data.sanctions.reason})
                </span>
              )}
              <div className="text-xs text-muted-foreground">
                Provider: {data.sanctions.provider}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Factors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.factors.map((factor, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{factor.name}</span>
                    <Badge
                      variant={
                        factor.status === "positive"
                          ? "default"
                          : factor.status === "negative"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-[0.65rem] uppercase"
                    >
                      {factor.status}
                    </Badge>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {factor.score.toFixed(1)} × {factor.weight.toFixed(2)} ={" "}
                    {factor.contribution.toFixed(2)}
                  </span>
                </div>
                <Progress value={factor.score} className="h-1.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="explanation" className="mt-4">
        <TabsList>
          <TabsTrigger value="explanation">Explanation</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>
        <TabsContent value="explanation">
          <Card>
            <CardContent className="pt-6 text-sm">
              {data.explanation.length === 0 ? (
                <p className="text-muted-foreground">No explanation provided.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.explanation.map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="raw">
          <Card>
            <CardContent className="pt-6">
              <pre className="overflow-x-auto rounded-md bg-muted/40 p-4 text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
