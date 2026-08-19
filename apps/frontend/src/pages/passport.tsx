import { CheckCircle2, XCircle, Award, Download, FileText, Shield } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { useWalletQuery } from "@/hooks/useWalletQuery"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  RiskBadge,
  WalletLabel,
} from "@/components/widgets"
import { formatAlgo, formatUSDC } from "@/lib/utils"

import type { PassportResponse } from "@/types/api"

export default function Passport() {
  const { wallet, query } = useWalletQuery<PassportResponse>(
    "passport",
    api.getPassport,
  )
  const { data, isLoading, error } = query

  if (!wallet) {
    return (
      <>
        <PageHeader
          title="Passport"
          description="Full document combining trust, delegation, sybil, reputation, credit, and a tamper-evident SHA-256 checksum."
        />
        <EmptyState
          icon={FileText}
          title="Enter a wallet"
          description="The passport is the canonical artifact produced for a wallet. Use the search bar above to fetch one."
        />
      </>
    )
  }

  if (isLoading) return <LoadingBlock rows={6} />
  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Passport"
          description="Full document combining trust, delegation, sybil, reputation, credit, and a tamper-evident SHA-256 checksum."
          badge={wallet}
        />
        <ErrorBlock
          message={
            error instanceof ApiError
              ? error.message
              : "Could not load passport"
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Passport"
        description="The complete trust + reputation + credit document. Includes a tamper-evident SHA-256 checksum."
        badge={wallet}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <BigNumber
          label="Trust score"
          value={data.trustScore.toFixed(1)}
          icon={<Shield className="h-4 w-4" />}
        />
        <BigNumber
          label="Reputation"
          value={data.reputation.toFixed(1)}
          icon={<Award className="h-4 w-4" />}
        />
        <BigNumber
          label="Credit limit"
          value={formatUSDC(data.creditLimit)}
          icon={<FileText className="h-4 w-4" />}
        />
        <BigNumber
          label="Sybil risk"
          value={`${(data.sybilRisk * 100).toFixed(0)}%`}
          icon={<Shield className="h-4 w-4" />}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Summary</CardTitle>
              <CardDescription>
                Generated {new Date(data.generatedAt).toLocaleString()} ·
                {" "}checksum{" "}
                <code className="font-mono text-xs">{data.checksum.slice(0, 16)}…</code>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <RiskBadge risk={data.overallRiskLevel} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadPassport(data)}
              >
                <Download className="h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{data.summary}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="onchain" className="mt-4">
        <TabsList>
          <TabsTrigger value="onchain">On-chain</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>
        <TabsContent value="onchain">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KV label="Balance">
                  {formatAlgo(data.onChain.balanceAlgo)}
                </KV>
                <KV label="Transactions">
                  {data.onChain.totalTxns.toLocaleString()}
                </KV>
                <KV label="Assets">
                  {data.onChain.assetCount}
                </KV>
                <KV label="Apps">
                  {data.onChain.appCount}
                </KV>
                <KV label="Account age">
                  {data.onChain.accountAgeDays}d
                </KV>
                <KV label="First seen">
                  {data.onChain.firstSeenRound}
                </KV>
                <KV label="Last seen">
                  {data.onChain.lastSeenRound}
                </KV>
                <KV label="Wallet">
                  <WalletLabel wallet={data.wallet} />
                </KV>
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
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
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
    </>
  )
}

function BigNumber({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}

function downloadPassport(p: PassportResponse) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `passport-${p.wallet}.json`
  a.click()
  URL.revokeObjectURL(url)
}
