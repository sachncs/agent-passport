import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { WalletLookup } from '@/components/WalletLookup';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Copy, Shield, Star, Activity, Scale, FileBadge } from 'lucide-react';
import { toast } from 'sonner';
import { walletAddress } from '@/lib/utils';
import type { PassportResponse, RiskLevel } from '@/types/api';
import { Link } from 'react-router-dom';

function riskColor(risk: RiskLevel): string {
  switch (risk) {
    case 'low': return 'text-emerald-500';
    case 'medium': return 'text-amber-500';
    case 'high': return 'text-orange-500';
    case 'critical': return 'text-red-500';
  }
}

export function PassportPage() {
  const [wallet, setWallet] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('wallet');
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['passport', wallet],
    queryFn: () => api.getPassport(wallet!),
    enabled: !!wallet,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Passport Viewer</h1>
        <p className="text-sm text-muted-foreground">
          Composite document combining trust score, reputation, credit
          limit, sybil risk, on-chain snapshot, and capabilities with a
          checksum for tamper detection.
        </p>
      </div>

      <WalletLookup value={wallet ?? ''} onSubmit={setWallet} size="lg" buttonText="Open" />

      {isLoading && <PassportSkeleton />}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load passport</AlertTitle>
          <AlertDescription>
            {error instanceof ApiError ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {data && <PassportCard data={data} onRefresh={refetch} />}
    </div>
  );
}

function PassportSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
}

function PassportCard({ data, onRefresh }: { data: PassportResponse; onRefresh: () => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <FileBadge className="h-5 w-5 text-primary" />
              <span className="wallet-mono">{walletAddress(data.wallet, 8, 8)}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => {
                      navigator.clipboard.writeText(data.wallet);
                      toast.success('Wallet copied');
                    }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy wallet</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Generated {new Date(data.generatedAt).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onRefresh()}>Refresh</Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/score?wallet=${data.wallet}`}>Score</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <PassportMetric
            icon={Shield}
            label="Trust"
            value={`${data.trustScore.toFixed(1)}`}
            risk={data.overallRiskLevel}
          />
          <PassportMetric
            icon={Star}
            label="Reputation"
            value={`${data.reputation.toFixed(1)}`}
          />
          <PassportMetric
            icon={Scale}
            label="Credit Limit"
            value={`${data.creditLimit.toFixed(2)} ALGO`}
          />
          <PassportMetric
            icon={Activity}
            label="Sybil Risk"
            value={`${(data.sybilRisk * 100).toFixed(0)}%`}
          />
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Overall
            </div>
            <div className={`mt-2 text-lg font-semibold ${riskColor(data.overallRiskLevel)}`}>
              <Badge variant={data.overallRiskLevel === 'low' ? 'success' : data.overallRiskLevel === 'critical' ? 'destructive' : 'warning'}>
                {data.overallRiskLevel}
              </Badge>
            </div>
          </div>
        </section>

        <Separator />

        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="onchain">On-chain</TabsTrigger>
            <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
            <TabsTrigger value="checksum">Checksum</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardContent className="pt-6 text-sm">
                {data.summary || 'No summary available.'}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="onchain">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <DataPoint label="Balance" value={`${data.onChain.balanceAlgo.toFixed(2)} ALGO`} />
                  <DataPoint label="Txns" value={data.onChain.totalTxns.toLocaleString()} />
                  <DataPoint label="Assets" value={data.onChain.assetCount.toString()} />
                  <DataPoint label="Apps" value={data.onChain.appCount.toString()} />
                  <DataPoint label="Age" value={`${data.onChain.accountAgeDays}d`} />
                  <DataPoint label="First" value={data.onChain.firstSeenRound.toString()} />
                  <DataPoint label="Last" value={data.onChain.lastSeenRound.toString()} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capabilities">
            <Card>
              <CardContent className="pt-6">
                {Object.keys(data.capabilities).length === 0
                  ? <p className="text-sm text-muted-foreground">No capabilities listed.</p>
                  : <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {Object.entries(data.capabilities).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                          <span className="font-mono">{k}</span>
                          <Badge variant={v ? 'success' : 'secondary'}>{v ? 'yes' : 'no'}</Badge>
                        </div>
                      ))}
                    </div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checksum">
            <Card>
              <CardContent className="pt-6">
                <p className="mb-2 text-sm text-muted-foreground">
                  The checksum is computed over the canonicalized passport
                  contents; any change to the document will produce a different
                  hash.
                </p>
                <code className="block break-all rounded-md border border-border bg-muted/30 p-3 font-mono text-xs">
                  {data.checksum}
                </code>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function PassportMetric({
  icon: Icon, label, value, risk,
}: { icon: typeof Shield; label: string; value: string; risk?: RiskLevel }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-2 text-lg font-semibold ${risk ? riskColor(risk) : ''}`}>
        {value}
      </div>
    </div>
  );
}

function DataPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}