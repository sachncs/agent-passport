"use client"

import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Download, ShieldAlert, ShieldCheck } from "lucide-react"

import { api } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"
import { CommandSurface } from "@/components/command-surface"
import { KpiCard } from "@/components/kpi-card"
import { ReportHeader } from "@/components/report/report-header"
import { AuditStrip } from "@/components/report/audit-strip"
import { EvidenceDrawer } from "@/components/report/evidence-drawer"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import type { PassportResponse } from "@/lib/api-types"

export function PassportClient() {
  const searchParams = useSearchParams()
  const wallet = searchParams.get("wallet")

  if (!wallet) {
    return <PassportEntry target="/passport" />
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

function PassportEntry({ target }: { target: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        The official passport document.
      </h1>
      <p className="max-w-md text-sm text-muted-fg">
        A tamper-evident JSON record combining trust, reputation,
        credit, sybil signals, delegation, capabilities, and a
        SHA-256 checksum.
      </p>
      <CommandSurface target={target} cta="Open Passport" />
    </div>
  )
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
        <CardContent className="space-y-4 py-8">
          <div className="flex items-center gap-2 text-xs text-muted-fg">
            <Spinner />
            <span>Verifying on-chain…</span>
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
        <AlertTitle>Could not load passport</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <ReportHeader
        wallet={wallet}
        risk={data.overallRiskLevel}
        generatedAt={data.generatedAt}
        checksum={data.checksum}
        onDownloadJson={downloadJson}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Trust score"
          value={data.trustScore.toFixed(1)}
          progress={data.trustScore}
        />
        <KpiCard
          label="Reputation"
          value={data.reputation.toFixed(1)}
          progress={data.reputation}
        />
        <KpiCard
          label="Credit limit"
          value={`$${data.creditLimit.toFixed(2)}`}
        />
        <KpiCard
          label="Sybil risk"
          value={`${(data.sybilRisk * 100).toFixed(0)}%`}
          progress={data.sybilRisk * 100}
        />
      </div>

      <Card>
        <CardContent className="space-y-3 py-5">
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
            Summary
          </span>
          <p className="text-base text-foreground">{data.summary}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-fg">
            <span>
              Generated {new Date(data.generatedAt).toLocaleString()}
            </span>
            <span aria-hidden>·</span>
            <code className="font-mono text-[0.7rem]">
              sha256 {data.checksum}
            </code>
          </div>
        </CardContent>
      </Card>

      <EvidenceDrawer
        defaultOpen={["on-chain"]}
        items={[
          {
            id: "on-chain",
            title: "On-chain facts",
            count: `${Object.keys(data.onChain).length} fields`,
            children: (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <KpiCard
                  label="Balance"
                  value={`${data.onChain.balanceAlgo.toFixed(2)} ALGO`}
                />
                <KpiCard
                  label="Transactions"
                  value={data.onChain.totalTxns.toLocaleString()}
                />
                <KpiCard
                  label="Assets"
                  value={data.onChain.assetCount}
                />
                <KpiCard
                  label="Apps"
                  value={data.onChain.appCount}
                />
                <KpiCard
                  label="Account age"
                  value={`${data.onChain.accountAgeDays}d`}
                />
                <KpiCard
                  label="First seen"
                  value={data.onChain.firstSeenRound}
                />
                <KpiCard
                  label="Last seen"
                  value={data.onChain.lastSeenRound}
                />
                <KpiCard
                  label="Wallet"
                  value={`${wallet.slice(0, 8)}…${wallet.slice(-6)}`}
                />
              </div>
            ),
          },
          {
            id: "capabilities",
            title: "Capabilities",
            count: `${Object.keys(data.capabilities).length} checks`,
            children: (
              <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                {Object.entries(data.capabilities).map(([k, v]) => (
                  <li
                    key={k}
                    className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs"
                  >
                    <span className="font-mono">{k}</span>
                    {v ? (
                      <span className="inline-flex items-center gap-1.5 text-verified-fg">
                        <ShieldCheck aria-hidden className="h-3 w-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-fg">
                        <ShieldAlert aria-hidden className="h-3 w-3" />
                        Not verified
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ),
          },
          {
            id: "raw",
            title: "Raw JSON",
            count: `${Object.keys(data).length} top-level fields`,
            children: (
              <Tabs defaultValue="pretty">
                <TabsList>
                  <TabsTrigger value="pretty">Pretty</TabsTrigger>
                  <TabsTrigger value="raw">Raw</TabsTrigger>
                  <TabsTrigger value="download">Download</TabsTrigger>
                </TabsList>
                <TabsContent value="pretty">
                  <pre className="overflow-x-auto rounded-md border border-border/60 bg-background/40 p-4 text-xs">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </TabsContent>
                <TabsContent value="raw">
                  <pre className="overflow-x-auto rounded-md border border-border/60 bg-background/40 p-4 text-xs">
                    {JSON.stringify(data)}
                  </pre>
                </TabsContent>
                <TabsContent value="download">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadJson}
                  >
                    <Download className="h-4 w-4" />
                    Download passport-{wallet.slice(0, 8)}.json
                  </Button>
                </TabsContent>
              </Tabs>
            ),
          },
        ]}
      />

      <AuditStrip>
        <span className="inline-flex items-center gap-1.5">
          <span className="uppercase tracking-[0.14em]">
            sha256
          </span>
          <code className="font-mono text-foreground">
            {data.checksum}
          </code>
        </span>
      </AuditStrip>
    </div>
  )
}
