import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { WalletLookup } from '@/components/WalletLookup';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Activity, ShieldAlert } from 'lucide-react';
import {
  Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts';
import { walletAddress } from '@/lib/utils';
import type { SybilCheckResponse } from '@/types/api';


export function SybilPage() {
  const [wallet, setWallet] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('wallet');
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ['sybil', wallet],
    queryFn: () => api.checkSybil(wallet!),
    enabled: !!wallet,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sybil Detection</h1>
        <p className="text-sm text-muted-foreground">
          Twelve signals (clustering, timing, balance similarity, funding
          correlation, plus 4 graph-traversal signals).
        </p>
      </div>

      <WalletLookup value={wallet ?? ''} onSubmit={setWallet} size="lg" buttonText="Check" />

      {isLoading && <SybilSkeleton />}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not run sybil check</AlertTitle>
          <AlertDescription>
            {error instanceof ApiError ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {data && <SybilCard data={data} />}
    </div>
  );
}

function SybilSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-7 w-48" /></CardHeader>
      <CardContent><Skeleton className="h-64 w-full" /></CardContent>
    </Card>
  );
}

function SybilCard({ data }: { data: SybilCheckResponse }) {
  const radarData = [
    { name: 'Clustering', value: data.signals.creationClustering },
    { name: 'Interaction', value: data.signals.interactionDensity },
    { name: 'Balance', value: data.signals.balanceSimilarity },
    { name: 'Circular', value: data.signals.circularActivity },
    { name: 'Timing', value: data.signals.timingRegularity },
    { name: 'Amount', value: data.signals.amountFingerprint },
    { name: 'Funding', value: data.signals.fundingCorrelation },
    { name: 'Hub', value: data.signals.hubScore },
    { name: 'Temp.', value: data.signals.temporalCorrelation },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="wallet-mono">{walletAddress(data.wallet, 8, 8)}</span>
            </CardTitle>
            <CardDescription>
              Risk {(data.sybilRisk * 100).toFixed(0)}% ·
              {' '}<Badge variant={
                data.riskLevel === 'low' ? 'success'
                  : data.riskLevel === 'critical' ? 'destructive'
                  : 'warning'
              }>{data.riskLevel}</Badge>
              {' '}· Confidence {(data.confidence * 100).toFixed(0)}% ·
              {' '}Cluster size {data.clusterSize}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.sybilRisk >= 0.45 && (
          <Alert variant="destructive" className="mb-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Elevated sybil risk</AlertTitle>
            <AlertDescription>
              The wallet is part of a cluster with coordinated activity.
              Treat endorsements from this wallet with caution.
            </AlertDescription>
          </Alert>
        )}
        <Tabs defaultValue="radar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="radar">Radar</TabsTrigger>
            <TabsTrigger value="signals">Signals</TabsTrigger>
            <TabsTrigger value="graph">Graph signals</TabsTrigger>
            <TabsTrigger value="flagged">Flagged ({data.flaggedWallets.length})</TabsTrigger>
            <TabsTrigger value="explain">Explain</TabsTrigger>
          </TabsList>

          <TabsContent value="radar">
            <div className="h-80 w-full">
              <ResponsiveContainer>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={120}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" />
                  <PolarRadiusAxis angle={30} domain={[0, 1]} />
                  <Radar
                    name="Signal"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="signals" className="space-y-3">
            <SignalRow label="Creation clustering" value={data.signals.creationClustering} />
            <SignalRow label="Interaction density" value={data.signals.interactionDensity} />
            <SignalRow label="Balance similarity" value={data.signals.balanceSimilarity} />
            <SignalRow label="Circular activity" value={data.signals.circularActivity} />
            <SignalRow label="Timing regularity" value={data.signals.timingRegularity} />
            <SignalRow label="Amount fingerprint" value={data.signals.amountFingerprint} />
            <SignalRow label="Funding correlation" value={data.signals.fundingCorrelation} />
          </TabsContent>

          <TabsContent value="graph" className="space-y-3">
            <SignalRow label="Neighborhood clustering" value={data.signals.neighborhoodClustering} />
            <SignalRow label="Hub score" value={data.signals.hubScore} />
            <SignalRow label="Intermediate density" value={data.signals.intermediateDensity} />
            <SignalRow label="Component ratio" value={data.signals.componentRatio} />
            <SignalRow label="Temporal correlation" value={data.signals.temporalCorrelation} />
          </TabsContent>

          <TabsContent value="flagged">
            {data.flaggedWallets.length === 0
              ? <p className="text-sm text-muted-foreground">No wallets flagged.</p>
              : <ul className="space-y-1 text-sm font-mono">
                  {data.flaggedWallets.map((w, i) => (
                    <li key={i} className="rounded-md border border-border bg-muted/30 px-3 py-1.5">
                      {w}
                    </li>
                  ))}
                </ul>}
          </TabsContent>

          <TabsContent value="explain">
            <ul className="space-y-1 rounded-md border border-border bg-muted/30 p-4 text-sm">
              {data.explanation.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SignalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(2)}</span>
      </div>
      <Progress
        value={value * 100}
        indicatorClass={
          value >= 0.7 ? 'bg-red-500' : value >= 0.4 ? 'bg-amber-500' : 'bg-emerald-500'
        }
      />
    </div>
  );
}