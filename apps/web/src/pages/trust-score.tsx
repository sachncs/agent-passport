import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { WalletLookup } from '@/components/WalletLookup';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Copy, Info } from 'lucide-react';
import { toast } from 'sonner';
import { walletAddress } from '@/lib/utils';
import type { TrustScoreResponse, RiskLevel } from '@/types/api';
import { Link } from 'react-router-dom';


function riskVariant(risk: RiskLevel): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (risk) {
    case 'low': return 'success';
    case 'medium': return 'warning';
    case 'high': return 'destructive';
    case 'critical': return 'destructive';
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(value);
              toast.success(`${label} copied`);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TrustScorePage() {
  const [wallet, setWallet] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['score', wallet],
    queryFn: () => api.getScore(wallet!),
    enabled: !!wallet,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trust Score Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Composite 0–100 score with five sub-scores. On-chain data is fetched
          from Algorand testnet by default.
        </p>
      </div>
      <WalletLookup
        value={wallet ?? ''}
        onSubmit={setWallet}
        size="lg"
        buttonText="Score"
        autoFocus
      />

      {isLoading && <TrustScoreSkeleton />}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not score wallet</AlertTitle>
          <AlertDescription>
            {error instanceof ApiError ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {data && <TrustScoreCard data={data} onRefresh={() => refetch()} isRefreshing={isFetching} />}
    </div>
  );
}

function TrustScoreSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
}

function TrustScoreCard({
  data, onRefresh, isRefreshing,
}: {
  data: TrustScoreResponse;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <span className="wallet-mono">{walletAddress(data.wallet, 8, 8)}</span>
              <CopyButton value={data.wallet} label="Wallet" />
            </CardTitle>
            <CardDescription className="font-mono text-xs">{data.wallet}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/passport?wallet=${data.wallet}`}>View Passport</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/underwrite?wallet=${data.wallet}`}>Underwrite</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <ScoreBig score={data.trustScore} risk={data.riskLevel} />
          <Metric label="Risk Level">
            <Badge variant={riskVariant(data.riskLevel)} className="text-sm">
              {data.riskLevel}
            </Badge>
          </Metric>
          <Metric label="Approved">
            <Badge variant={data.approved ? 'success' : 'destructive'}>
              {data.approved ? 'Yes' : 'No'}
            </Badge>
          </Metric>
          <Metric label="Recommended Limit">
            <span className="font-mono text-lg font-semibold">
              {data.recommendedLimit.toFixed(2)} ALGO
            </span>
          </Metric>
        </section>

        <Separator />

        {data.breakdown && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Sub-scores</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <SubScore label="Age" value={data.breakdown.ageScore} />
              <SubScore label="Activity" value={data.breakdown.activityScore} />
              <SubScore label="Volume" value={data.breakdown.volumeScore} />
              <SubScore label="Velocity" value={data.breakdown.velocityScore} />
              <SubScore label="Compliance" value={data.breakdown.complianceScore} />
            </div>
          </section>
        )}

        {data.onChain && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">On-chain data</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Onchain label="Balance" value={`${data.onChain.balanceAlgo.toFixed(2)} ALGO`} />
              <Onchain label="Transactions" value={data.onChain.totalTxns.toLocaleString()} />
              <Onchain label="Assets" value={data.onChain.assetCount.toString()} />
              <Onchain label="Apps" value={data.onChain.appCount.toString()} />
              <Onchain label="Account Age" value={`${data.onChain.accountAgeDays}d`} />
              <Onchain label="Last Round" value={data.onChain.lastSeenRound.toLocaleString()} />
            </div>
          </section>
        )}

        {data.explanation && data.explanation.length > 0 && (
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              Explanation
            </h3>
            <ul className="space-y-1 rounded-md border border-border bg-muted/30 p-4 text-sm">
              {data.explanation.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreBig({ score, risk }: { score: number; risk: RiskLevel }) {
  return (
    <div className="md:col-span-1">
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
        <div className={`text-5xl font-bold tracking-tight ${riskColorClass(risk)}`}>
          {score.toFixed(1)}
        </div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Trust Score
        </div>
      </div>
    </div>
  );
}

function riskColorClass(risk: RiskLevel): string {
  switch (risk) {
    case 'low': return 'text-emerald-500';
    case 'medium': return 'text-amber-500';
    case 'high': return 'text-orange-500';
    case 'critical': return 'text-red-500';
  }
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <Progress
        value={value}
        indicatorClass={
          value >= 70 ? 'bg-emerald-500'
            : value >= 40 ? 'bg-amber-500'
            : 'bg-red-500'
        }
      />
    </div>
  );
}

function Onchain({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}