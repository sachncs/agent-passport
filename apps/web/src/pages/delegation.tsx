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
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Users, Anchor, AlertTriangle } from 'lucide-react';
import { walletAddress } from '@/lib/utils';
import type { DelegationResponse } from '@/types/api';
import { isValidWallet } from '@/lib/wallet';

export function DelegationPage() {
  const [wallet, setWallet] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('wallet');
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ['delegation', wallet],
    queryFn: () => api.getDelegation(wallet!),
    enabled: !!wallet,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Delegation Trust</h1>
        <p className="text-sm text-muted-foreground">
          Sponsor tree, depth attenuation, sponsor quality, and trust-anchor
          markers.
        </p>
      </div>

      <WalletLookup value={wallet ?? ''} onSubmit={setWallet} size="lg" buttonText="Load" />

      {isLoading && <DelegationSkeleton />}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load delegation graph</AlertTitle>
          <AlertDescription>
            {error instanceof ApiError ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {data && <DelegationCard data={data} wallet={wallet!} />}
    </div>
  );
}

function DelegationSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-7 w-48" /></CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-32 w-full" />
      </CardContent>
    </Card>
  );
}

function DelegationCard({ data, wallet }: { data: DelegationResponse; wallet: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="wallet-mono">{walletAddress(data.wallet, 8, 8)}</span>
            </CardTitle>
            <CardDescription>
              Trust score {data.trustScore.toFixed(1)} ·
              {' '}<Badge variant={
                data.riskLevel === 'low' ? 'success'
                  : data.riskLevel === 'critical' ? 'destructive'
                  : 'warning'
              }>{data.riskLevel}</Badge>
            </CardDescription>
          </div>
          <SimulateSponsorLossDialog wallet={wallet} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.delegation && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Depth">{data.delegation.depth}</Metric>
            <Metric label="Sponsors">{data.delegation.sponsorCount}</Metric>
            <Metric label="Sponsor Quality">{data.delegation.sponsorQuality.toFixed(1)}</Metric>
            <Metric label="Trusted Ancestors">{data.delegation.trustedAncestors}</Metric>
            <Metric label="Total Delegated">
              {(data.delegation.totalDelegatedAmount / 1_000_000).toFixed(2)} ALGO
            </Metric>
            <Metric label="Trust Anchor">
              {data.delegation.isTrustAnchor
                ? <Badge variant="success"><Anchor className="mr-1 h-3 w-3" />anchor</Badge>
                : <Badge variant="secondary">no</Badge>}
            </Metric>
          </section>
        )}

        {data.breakdown && (
          <>
            <Separator />
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Score breakdown</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <BarRow label="Depth" value={data.breakdown.depthScore} />
                <BarRow label="Sponsor Quality" value={data.breakdown.sponsorQualityScore} />
                <BarRow label="Sponsor Count" value={data.breakdown.sponsorCountScore} />
                <BarRow label="Amount" value={data.breakdown.amountScore} />
              </div>
            </section>
          </>
        )}

        {data.explanation && data.explanation.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Explanation</h3>
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

function SimulateSponsorLossDialog({ wallet }: { wallet: string }) {
  const [lost, setLost] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ totalExposure: number; directExposure: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!isValidWallet(lost)) {
      setError('Invalid sponsor wallet');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api.getTrustGraph(wallet, lost);
      setResult({ totalExposure: r.exposure.totalExposure, directExposure: r.exposure.directExposure });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <AlertTriangle className="mr-2 h-3.5 w-3.5" />
          Simulate sponsor loss
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simulate losing a sponsor</DialogTitle>
          <DialogDescription>
            Re-runs the trust graph with the specified sponsor removed so you
            can see how exposure shifts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lost">Sponsor wallet to remove</Label>
            <Input
              id="lost"
              value={lost}
              onChange={(e) => setLost(e.target.value)}
              placeholder="Algorand address (58 chars)"
              className="wallet-mono"
            />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {result && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div>Direct exposure without sponsor: ${(result.directExposure / 1_000_000).toFixed(2)} ALGO</div>
              <div>Total exposure without sponsor: ${(result.totalExposure / 1_000_000).toFixed(2)} ALGO</div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading}>
            {loading ? 'Simulating…' : 'Simulate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm">{children}</div>
    </div>
  );
}

function BarRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(1)}</span>
      </div>
      <Progress
        value={value}
        indicatorClass={
          value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
        }
      />
    </div>
  );
}