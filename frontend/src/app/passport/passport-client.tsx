"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Download, Award, ShieldCheck, ShieldAlert } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ShieldAlert as ShieldAlertIcon } from "lucide-react"

import { WalletHeroInput } from "@/components/wallet-hero-input"
import { PassportSection } from "@/components/passport-section"
import { RiskBadge } from "@/components/risk-badge"
import { Stat } from "@/components/stat"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"

import type { PassportResponse } from "@/lib/api-types"

export function PassportClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Award className="h-6 w-6" />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          The official passport document.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          A tamper-evident JSON record combining trust, reputation,
          credit, sybil signals, delegation, capabilities, and a SHA-256
          checksum.
        </p>
        <WalletHeroInput wallet={null} target="/passport" />
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

  return <PassportBody wallet={wallet} />
}

function PassportBody({ wallet }: { wallet: string }) {
  const { data, isLoading, error } = useQuery<PassportResponse>({
    queryKey: ["passport", wallet],
    queryFn: () => api.getPassport(wallet),
    enabled: isValidWallet(wallet),
    staleTime: 30_000,
  })

  const downloadJson = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `passport-${wallet}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

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
        <ShieldAlertIcon className="h-4 w-4" />
        <AlertTitle>Could not load passport</AlertTitle>
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
        icon={Award}
        title="Passport"
        subtitle={`The complete trust + reputation + credit document. Includes a tamper-evident SHA-256 checksum.`}
        tone="primary"
        badge={
          <RiskBadge risk={data.overallRiskLevel} size="lg" />
        }
      >
        <div className="flex flex-wrap items-baseline gap-4">
          <div className="font-mono text-sm text-muted-foreground">
            {data.wallet.slice(0, 10)}…{data.wallet.slice(-6)}
          </div>
          <Button size="sm" variant="outline" onClick={downloadJson}>
            <Download className="h-4 w-4" /> JSON
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Trust score" tone="muted">
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {data.trustScore.toFixed(1)}
            </div>
            <Progress value={data.trustScore} className="mt-2 h-1.5" />
          </Stat>
          <Stat label="Reputation" tone="muted">
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {data.reputation.toFixed(1)}
            </div>
            <Progress value={data.reputation} className="mt-2 h-1.5" />
          </Stat>
          <Stat label="Credit limit" tone="muted">
            <div className="font-heading text-2xl font-semibold tabular-nums">
              ${data.creditLimit.toFixed(2)}
            </div>
          </Stat>
          <Stat label="Sybil risk" tone="muted">
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {(data.sybilRisk * 100).toFixed(0)}%
            </div>
            <Progress
              value={data.sybilRisk * 100}
              className="mt-2 h-1.5"
            />
          </Stat>
        </div>
      </PassportSection>

      <PassportSection
        icon={Award}
        title="Summary"
        subtitle="One-line human read of the document."
        tone="primary"
      >
        <p className="text-sm">{data.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            generated {new Date(data.generatedAt).toLocaleString()}
          </span>
          <span>·</span>
          <code className="font-mono text-[0.65rem]">
            {data.checksum.slice(0, 16)}…
          </code>
        </div>
      </PassportSection>

      <PassportSection
        icon={Award}
        title="Details"
        subtitle="On-chain facts, capabilities, and the raw JSON."
        tone="primary"
      >
        <Tabs defaultValue="onchain">
          <TabsList>
            <TabsTrigger value="onchain">On-chain</TabsTrigger>
            <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
            <TabsTrigger value="raw">Raw</TabsTrigger>
          </TabsList>
          <TabsContent value="onchain">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Balance" tone="muted">
                {data.onChain.balanceAlgo.toFixed(2)} ALGO
              </Stat>
              <Stat label="Transactions" tone="muted">
                {data.onChain.totalTxns.toLocaleString()}
              </Stat>
              <Stat label="Assets" tone="muted">
                {data.onChain.assetCount}
              </Stat>
              <Stat label="Apps" tone="muted">
                {data.onChain.appCount}
              </Stat>
              <Stat label="Account age" tone="muted">
                {data.onChain.accountAgeDays}d
              </Stat>
              <Stat label="First seen" tone="muted">
                {data.onChain.firstSeenRound}
              </Stat>
              <Stat label="Last seen" tone="muted">
                {data.onChain.lastSeenRound}
              </Stat>
              <Stat label="Wallet" tone="muted">
                <span className="font-mono text-xs">
                  {data.wallet.slice(0, 8)}…{data.wallet.slice(-6)}
                </span>
              </Stat>
            </div>
          </TabsContent>
          <TabsContent value="capabilities">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {Object.entries(data.capabilities).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <span className="font-mono text-sm">{k}</span>
                  {v ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="raw">
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-4 text-xs">
              {JSON.stringify(data, null, 2)}
            </pre>
          </TabsContent>
        </Tabs>
      </PassportSection>
    </div>
  )
}