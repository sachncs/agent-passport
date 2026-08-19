"use client"

import { api, ApiError } from "@/lib/api"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Download, Award, ShieldCheck, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  WalletRequiredAlert,
} from "@/components/page-header"
import { isValidWallet } from "@/lib/wallet"

import type { PassportResponse, RiskLevel } from "@/lib/api-types"

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const map: Record<RiskLevel, string> = {
    low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    critical: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  }
  const label = risk.charAt(0).toUpperCase() + risk.slice(1)
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        map[risk]
      }
    >
      {label}
    </span>
  )
}

function PassportBody({ data }: { data: PassportResponse }) {
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `passport-${data.wallet}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-semibold">
              {data.trustScore.toFixed(1)}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Trust score
            </div>
            <Progress value={data.trustScore} className="mt-3 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-semibold">
              {data.reputation.toFixed(1)}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Reputation
            </div>
            <Progress value={data.reputation} className="mt-3 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-semibold">
              ${data.creditLimit.toFixed(2)}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Credit limit
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-semibold">
              {(data.sybilRisk * 100).toFixed(0)}%
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Sybil risk
            </div>
            <Progress value={data.sybilRisk * 100} className="mt-3 h-1.5" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Summary</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Generated {new Date(data.generatedAt).toLocaleString()} ·{" "}
                checksum{" "}
                <code className="font-mono text-[0.65rem]">
                  {data.checksum.slice(0, 16)}…
                </code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RiskBadge risk={data.overallRiskLevel} />
              <Button
                size="sm"
                variant="outline"
                onClick={downloadJson}
              >
                <Download className="h-4 w-4" /> JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{data.summary}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="onchain" className="mt-2">
        <TabsList>
          <TabsTrigger value="onchain">On-chain</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>
        <TabsContent value="onchain">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    Balance
                  </div>
                  <div className="mt-1 text-sm">
                    {data.onChain.balanceAlgo.toFixed(2)} ALGO
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    Transactions
                  </div>
                  <div className="mt-1 text-sm">
                    {data.onChain.totalTxns.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    Assets
                  </div>
                  <div className="mt-1 text-sm">{data.onChain.assetCount}</div>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    Apps
                  </div>
                  <div className="mt-1 text-sm">{data.onChain.appCount}</div>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    Account age
                  </div>
                  <div className="mt-1 text-sm">{data.onChain.accountAgeDays}d</div>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    First seen
                  </div>
                  <div className="mt-1 text-sm">{data.onChain.firstSeenRound}</div>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    Last seen
                  </div>
                  <div className="mt-1 text-sm">{data.onChain.lastSeenRound}</div>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                    Wallet
                  </div>
                  <div className="mt-1 font-mono text-xs">
                    {data.wallet.slice(0, 8)}…{data.wallet.slice(-6)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="capabilities">
          <Card>
            <CardContent className="pt-6">
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
    </div>
  )
}

export function PassportClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")
  const valid = wallet && isValidWallet(wallet)

  const { data, isLoading, error } = useQuery<PassportResponse>({
    queryKey: ["passport", wallet],
    queryFn: () => {
      if (!valid) throw new Error("wallet is not valid")
      return api.getPassport(wallet)
    },
    enabled: valid,
    staleTime: 30_000,
  })

  return (
    <>
      <PageHeader
        title="Passport"
        description="The complete trust + reputation + credit document. Includes a tamper-evident SHA-256 checksum."
        badge={wallet ?? undefined}
      />
      {!wallet && <WalletRequiredAlert />}
      {wallet && !valid && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            That wallet address isn&apos;t a valid 58-character base32
            Algorand address.
          </CardContent>
        </Card>
      )}
      {valid && isLoading && <LoadingBlock rows={6} />}
      {valid && error && (
        <ErrorBlock
          message={
            error instanceof ApiError
              ? error.message
              : "Could not load passport"
          }
        />
      )}
      {data && <PassportBody data={data} />}
    </>
  )
}
