"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Award,
  Download,
  ExternalLink,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { RiskBadge } from "@/components/risk-badge"
import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import {
  DelegationSection,
  ReputationSection,
  SummarySection,
  SybilSection,
  TrustScoreSection,
  UnderwritingSection,
} from "@/components/passport-sections"

import type { PassportResponse, TrustScoreResponse } from "@/lib/api-types"

export function PassportView() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")
  const valid = !!(wallet && isValidWallet(wallet))

  if (!wallet) return <DashboardEmpty />
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
    <div className="space-y-6">
      <PassportCover wallet={wallet} />
      <SummarySection />
      <TrustScoreSection />
      <SybilSection />
      <ReputationSection />
      <DelegationSection />
      <UnderwritingSection />
    </div>
  )
}

function DashboardEmpty() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Award className="h-6 w-6" />
      </div>
      <h2 className="font-heading text-2xl font-semibold tracking-tight">
        Load a wallet to see the full report.
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Trust, sybil, reputation, delegation, and underwriting — one
        scrollable document for any Algorand address.
      </p>
    </div>
  )
}

function PassportCover({ wallet }: { wallet: string }) {
  const score = useQuery<TrustScoreResponse>({
    queryKey: ["score", wallet],
    queryFn: () => api.getScore(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })

  const passport = useQuery<PassportResponse>({
    queryKey: ["passport", wallet],
    queryFn: () => api.getPassport(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })

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

  return (
    <Card className="relative overflow-hidden">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-primary"
      />
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              Passport Report
            </h1>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {wallet.slice(0, 10)}…{wallet.slice(-6)}
              <span className="block break-all">
                {wallet}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {score.data && <RiskBadge risk={score.data.riskLevel} size="lg" />}
            {passport.data && (
              <Button size="sm" variant="outline" onClick={downloadJson}>
                <Download className="h-4 w-4" /> JSON
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Cached for 60 s · stateless
          </span>
          {passport.data && (
            <>
              <span>·</span>
              <span>
                generated{" "}
                {new Date(passport.data.generatedAt).toLocaleString()}
              </span>
              <span>·</span>
              <code className="font-mono text-[0.65rem]">
                {passport.data.checksum.slice(0, 16)}…
              </code>
            </>
          )}
          {passport.error instanceof ApiError && (
            <span className="text-destructive">
              Passport fetch error: {passport.error.message}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/passport?wallet=${wallet}`} />}>
            <ExternalLink className="h-3.5 w-3.5" />
            Open full passport
          </Button>
          <Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/score?wallet=${wallet}`} />}>
            <ExternalLink className="h-3.5 w-3.5" />
            Trust score
          </Button>
          <Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/underwrite?wallet=${wallet}`} />}>
            <ExternalLink className="h-3.5 w-3.5" />
            Underwrite
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}