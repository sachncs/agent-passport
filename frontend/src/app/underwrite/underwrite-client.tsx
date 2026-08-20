"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ShieldCheck } from "lucide-react"

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

import type { UnderwriteResponse } from "@/lib/api-types"

export function UnderwriteClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Approve, deny, or limit.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          A four-factor composite with a system-wide cap — underwriters
          and merchant integrations get a clear verdict in one call.
        </p>
        <WalletHeroInput wallet={null} target="/underwrite" />
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

  return <UnderwriteBody wallet={wallet} />
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
        <AlertTitle>Could not load underwriting decision</AlertTitle>
        <AlertDescription>
          {error instanceof ApiError ? error.message : error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <PassportSection
        icon={ShieldCheck}
        title="Underwriting Decision"
        subtitle="Approve / deny plus a recommended credit limit from a four-factor composite."
        tone="primary"
        badge={
          <Badge
            variant={data.approved ? "default" : "destructive"}
            className="px-3 py-1 text-sm"
          >
            {data.approved ? "Approve" : "Deny"}
          </Badge>
        }
      >
        <div className="flex flex-wrap items-baseline gap-4">
          <div className="font-heading text-5xl font-semibold tracking-tight tabular-nums">
            {data.recommendedLimit.toFixed(0)} ALGO
          </div>
          <RiskBadge risk={data.riskLevel} size="lg" />
          <div className="text-sm text-muted-foreground">
            composite{" "}
            <span className="font-mono">
              {data.compositeScore.toFixed(1)}
            </span>{" "}
            · confidence{" "}
            <span className="font-mono">
              {(data.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </PassportSection>

      {data.sanctions && data.sanctions.status !== "allowed" && (
        <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Sanctions: {data.sanctions.status}</AlertTitle>
          {data.sanctions.reason && (
            <AlertDescription>{data.sanctions.reason}</AlertDescription>
          )}
          <div className="text-xs">Provider: {data.sanctions.provider}</div>
        </Alert>
      )}

      <PassportSection
        icon={ShieldCheck}
        title="Factors"
        subtitle="The four weighted inputs to the composite."
        tone="primary"
      >
        <div className="space-y-3">
          {data.factors.map((factor, i) => (
            <div key={i} className="space-y-1.5">
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
                  {factor.score.toFixed(1)} ×{" "}
                  {factor.weight.toFixed(2)} ={" "}
                  {factor.contribution.toFixed(2)}
                </span>
              </div>
              <Progress value={factor.score} className="h-1.5" />
            </div>
          ))}
        </div>
      </PassportSection>

      {data.explanation.length > 0 && (
        <PassportSection
          icon={ShieldCheck}
          title="Explanation"
          tone="primary"
        >
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {data.explanation.map((line, i) => (
              <li key={i}>• {line}</li>
            ))}
          </ul>
        </PassportSection>
      )}

      <PassportSection
        icon={ShieldCheck}
        title="At a glance"
        tone="primary"
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Wallet" tone="muted">
            <span className="font-mono text-xs">
              {wallet.slice(0, 8)}…{wallet.slice(-6)}
            </span>
          </Stat>
          <Stat label="Composite" tone="muted">
            {data.compositeScore.toFixed(1)}
          </Stat>
          <Stat label="Confidence" tone="muted">
            {(data.confidence * 100).toFixed(0)}%
          </Stat>
        </div>
      </PassportSection>
    </div>
  )
}