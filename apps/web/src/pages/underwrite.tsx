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
import { Scale, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { UnderwriteResponse } from '@/types/api';

export function UnderwritePage() {
  const [wallet, setWallet] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('wallet');
  });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['underwrite', wallet],
    queryFn: () => api.underwrite(wallet!),
    enabled: !!wallet,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Underwriting</h1>
        <p className="text-sm text-muted-foreground">
          Binary approve / deny decision + recommended credit limit,
          computed from a 4-factor composite score, credit capacity,
          and a system-wide exposure cap.
        </p>
      </div>

      <WalletLookup value={wallet ?? ''} onSubmit={setWallet} size="lg" buttonText="Underwrite" />

      {isLoading && <UnderwriteSkeleton />}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not underwrite wallet</AlertTitle>
          <AlertDescription>
            {error instanceof ApiError ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {data && <UnderwriteCard data={data} onRefresh={refetch} />}
    </div>
  );
}

function UnderwriteSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-7 w-48" /></CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
}

function UnderwriteCard({ data, onRefresh }: { data: UnderwriteResponse; onRefresh: () => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              {data.approved
                ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                : <ShieldAlert className="h-5 w-5 text-red-500" />}
              {data.approved ? 'Approved' : 'Denied'}
            </CardTitle>
            <CardDescription>
              Composite {data.compositeScore.toFixed(1)} · Risk{' '}
              <Badge variant={
                data.riskLevel === 'low' ? 'success'
                  : data.riskLevel === 'critical' ? 'destructive'
                  : 'warning'
              }>{data.riskLevel}</Badge>
              {' '}· Confidence {(data.confidence * 100).toFixed(0)}%
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onRefresh()}>Refresh</Button>
            <WhatIfDialog wallet={data.wallet} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <BigMetric label="Recommended Limit">
            <span className="font-mono text-2xl font-bold">
              ${data.recommendedLimit.toFixed(2)}
            </span>
          </BigMetric>
          <BigMetric label="Sanctions">
            <SanctionsBadge status={data.sanctions?.status} reason={data.sanctions?.reason} />
          </BigMetric>
          <BigMetric label="Risk Level">
            <Badge variant={
              data.riskLevel === 'low' ? 'success'
                : data.riskLevel === 'critical' ? 'destructive'
                : 'warning'
            } className="text-base">{data.riskLevel}</Badge>
          </BigMetric>
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Factors</h3>
          <div className="space-y-3">
            {data.factors.map((factor, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{factor.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {factor.score.toFixed(1)} × {factor.weight.toFixed(2)} = {factor.contribution.toFixed(2)}
                  </span>
                </div>
                <Progress
                  value={factor.score}
                  indicatorClass={
                    factor.status === 'positive' ? 'bg-emerald-500'
                      : factor.status === 'negative' ? 'bg-red-500'
                      : 'bg-amber-500'
                  }
                />
              </div>
            ))}
          </div>
        </section>

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

function WhatIfDialog({ wallet }: { wallet: string }) {
  const [amount, setAmount] = useState('100');
  const [estimate, setEstimate] = useState<{ estimatedLimit: number; utilizationRatio?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.estimateCredit(wallet, parseFloat(amount));
      setEstimate(result);
    } catch (err) {
      const e = err as Error;      setError(err instanceof ApiError ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Scale className="mr-2 h-3.5 w-3.5" />
          What-if credit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Estimate credit capacity</DialogTitle>
          <DialogDescription>
            Ask the service to size a hypothetical credit against the wallet's
            on-chain collateral.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Requested amount (USD)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
            />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {estimate && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Estimated Limit</div>
              <div className="font-mono text-2xl font-bold">${estimate.estimatedLimit.toFixed(2)}</div>
              {estimate.utilizationRatio !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  Utilization: {(estimate.utilizationRatio * 100).toFixed(1)}%
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading}>
            {loading ? 'Calculating…' : 'Estimate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SanctionsBadge({ status, reason }: { status?: string; reason?: string }) {
  if (!status) return <Badge variant="secondary">n/a</Badge>;
  if (status === 'allowed') return <Badge variant="success">allowed</Badge>;
  if (status === 'denied') return (
    <div className="space-y-1">
      <Badge variant="destructive">denied</Badge>
      {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
    </div>
  );
  return <Badge variant="warning">{status}</Badge>;
}

function BigMetric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}