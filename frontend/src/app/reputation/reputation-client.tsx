"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Star } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldAlert } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import { WalletHeroInput } from "@/components/wallet-hero-input"
import { PassportSection } from "@/components/passport-section"
import { Stat } from "@/components/stat"

import type { ReputationResponse } from "@/lib/api-types"

export function ReputationClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
          <Star className="h-6 w-6" />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Reputation, event by event.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          On-chain reputation events with anti-gaming defenses — cycle
          detection, dedup, on-chain verification.
        </p>
        <WalletHeroInput wallet={null} target="/reputation" />
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

  return <ReputationBody wallet={wallet} />
}

function ReputationBody({ wallet }: { wallet: string }) {
  const { data, isLoading, error } = useQuery<ReputationResponse>({
    queryKey: ["reputation", wallet],
    queryFn: () => api.getReputation(wallet),
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
        <AlertTitle>Could not load reputation</AlertTitle>
        <AlertDescription>
          {error instanceof ApiError ? error.message : error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  const total = data.breakdown.totalEvents
  const positivePct = total > 0 ? (data.breakdown.positiveEvents / total) * 100 : 0
  const negativePct = total > 0 ? (data.breakdown.negativeEvents / total) * 100 : 0

  return (
    <div className="space-y-6">
      <PassportSection
        icon={Star}
        title="Reputation"
        subtitle="On-chain reputation events with anti-gaming defenses."
        tone="violet"
      >
        <div className="flex items-baseline gap-4">
          <div className="font-heading text-6xl font-semibold tracking-tight tabular-nums">
            {data.reputation.toFixed(1)}
          </div>
          <div className="text-sm text-muted-foreground">
            from {total.toLocaleString()} events
          </div>
        </div>
        <Progress value={data.reputation} className="mt-4 h-2" />
      </PassportSection>

      <PassportSection
        icon={Star}
        title="Event breakdown"
        tone="primary"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sentiment</span>
            <span className="font-mono">
              {positivePct.toFixed(0)}% positive
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="flex h-full">
              <div
                className="bg-emerald-500"
                style={{ width: `${positivePct}%` }}
              />
              <div
                className="bg-red-500"
                style={{ width: `${negativePct}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total" tone="muted">
              {data.breakdown.totalEvents.toLocaleString()}
            </Stat>
            <Stat label="Positive" tone="muted">
              {data.breakdown.positiveEvents.toLocaleString()}
            </Stat>
            <Stat label="Negative" tone="muted">
              {data.breakdown.negativeEvents.toLocaleString()}
            </Stat>
            <Stat label="Disputes" tone="muted">
              {data.breakdown.disputes.toLocaleString()}
            </Stat>
          </div>
        </div>
      </PassportSection>

      <PassportSection
        icon={Star}
        title="By event type"
        tone="primary"
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <EventTile
            label="Payments"
            value={data.breakdown.successfulPayments}
            tone="emerald"
          />
          <EventTile
            label="Purchases"
            value={data.breakdown.successfulPurchases}
            tone="emerald"
          />
          <EventTile
            label="Disputes"
            value={data.breakdown.disputes}
            tone="red"
          />
          <EventTile
            label="Refunds"
            value={data.breakdown.refunds}
            tone="red"
          />
          <EventTile
            label="Endorsements"
            value={data.breakdown.sponsorEndorsements}
            tone="emerald"
          />
          <EventTile
            label="Service"
            value={data.breakdown.serviceInteractions}
            tone="emerald"
          />
        </div>
      </PassportSection>

      {data.explanation && data.explanation.length > 0 && (
        <PassportSection icon={Star} title="Explanation" tone="primary">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {data.explanation.map((line, i) => (
              <li key={i}>• {line}</li>
            ))}
          </ul>
        </PassportSection>
      )}
    </div>
  )
}

function EventTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "emerald" | "red" | "neutral"
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "red"
        ? "border-red-500/30 bg-red-500/5"
        : "border-border bg-muted/30"
  return (
    <div className={"rounded-md border p-3 " + cls}>
      <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-sm">{value.toLocaleString()}</div>
    </div>
  )
}