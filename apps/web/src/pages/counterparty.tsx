import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { WalletLookup } from '@/components/WalletLookup';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Briefcase, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export function CounterpartyPage() {
  const [buyer, setBuyer] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (b: string) => api.checkCounterparty(b),
    onSuccess: (data) => {
      toast.success(data.allow ? 'Counterparty allowed' : 'Counterparty denied');
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Counterparty check failed');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Counterparty Check</h1>
        <p className="text-sm text-muted-foreground">
          Merchant-side buyer risk: aggregate of on-chain, delegation, and
          trust signals.
        </p>
      </div>

      <WalletLookup
        value={buyer ?? ''}
        onSubmit={(w) => {
          setBuyer(w);
          mutation.mutate(w);
        }}
        size="lg"
        buttonText="Check"
      />

      {mutation.isPending && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Scoring counterparty…
          </CardContent>
        </Card>
      )}

      {mutation.error && (
        <Alert variant="destructive">
          <AlertTitle>Counterparty check failed</AlertTitle>
          <AlertDescription>
            {mutation.error instanceof ApiError ? mutation.error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {mutation.data && <CounterpartyCard data={mutation.data} />}
    </div>
  );
}

function CounterpartyCard({ data }: { data: import('@/types/api').CounterpartyCheckResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <span className="wallet-mono">{data.buyer.slice(0, 8)}…{data.buyer.slice(-6)}</span>
          <Badge variant={data.allow ? 'success' : 'destructive'} className="ml-2">
            {data.allow
              ? <><CheckCircle2 className="mr-1 h-3 w-3" /> allow</>
              : <><XCircle className="mr-1 h-3 w-3" /> deny</>}
          </Badge>
        </CardTitle>
        <CardDescription>
          Aggregate on-chain {data.onChainScore.toFixed(1)} ·
          Delegation {data.delegationScore.toFixed(1)} ·
          Trust {data.trustScore.toFixed(1)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <ScoreBar label="On-chain score" value={data.onChainScore} />
          <ScoreBar label="Delegation score" value={data.delegationScore} />
          <ScoreBar label="Trust score" value={data.trustScore} />
        </div>
        {data.explanation && data.explanation.length > 0 && (
          <ul className="space-y-1 rounded-md border border-border bg-muted/30 p-4 text-sm">
            {data.explanation.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={
            value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
          }
          style={{ width: `${Math.min(100, value)}%`, height: '100%' }}
        />
      </div>
    </div>
  );
}