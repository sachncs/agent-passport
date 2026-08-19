"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  WalletRequiredAlert,
} from "@/components/page-header"

import type { UnderwriteResponse, RiskLevel } from "@/lib/api-types"

function RiskBadge({ risk }: { risk: RiskLevel }) {
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

function Body({ data }: { data: UnderwriteResponse }) {
  return (
    <div className="space-y-4">
      <div
        className={
          "rounded-xl border p-6 " +
          (data.approved
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-red-500/30 bg-red-500/5")
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-semibold">
              {data.approved ? "Approved" : "Denied"}
            </div>
            <RiskBadge risk={data.riskLevel} />
            <div className="text-xs text-muted-foreground">
              Composite {data.compositeScore.toFixed(1)} · Confidence{" "}
              {(data.confidence * 100).toFixed(0)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Recommended limit
            </div>
            <div className="text-2xl font-semibold">
              ${data.recommendedLimit.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {data.sanctions && data.sanctions.status !== "allowed" && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 text-sm">
            <strong>Sanctions: {data.sanctions.status}</strong>
            {data.sanctions.reason && (
              <span className="ml-2 text-muted-foreground">
                ({data.sanctions.reason})
              </span>
            )}
            <div className="text-xs text-muted-foreground">
              Provider: {data.sanctions.provider}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
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
                      variant={factor.status === "positive" ? "default" : factor.status === "negative" ? "destructive" : "secondary"}
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

      {data.explanation.length > 0 && (
        <Card>
          <CardContent className="pt-6 text-sm">
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
    </div>
  )
}

export function UnderwriteClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")
  const valid = wallet && isValidWallet(wallet)

  const { data, isLoading, error } = useQuery<UnderwriteResponse>({
    queryKey: ["underwrite", wallet],
    queryFn: () => {
      if (!valid) throw new Error("wallet is not valid")
      return api.underwrite(wallet)
    },
    enabled: valid,
    staleTime: 30_000,
  })

  return (
    <>
      <PageHeader
        title="Underwrite"
        description="Approve/deny + recommended credit limit, computed from a 4-factor composite and a $100k system-wide cap."
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
          message={error instanceof ApiError ? error.message : "Could not load underwriting decision"}
        />
      )}
      {data && <Body data={data} />}
    </>
  )
}
