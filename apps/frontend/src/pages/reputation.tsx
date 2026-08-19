import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { useWalletQuery } from '@/hooks/useWalletQuery';
import { WalletLookup } from '@/components/WalletLookup';
import type { ReputationResponse } from '@/types/api';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Star, Plus, Webhook } from 'lucide-react';
import { toast } from 'sonner';

const EVENT_TYPES = [
  { value: 'payment', label: 'Payment' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'dispute', label: 'Dispute' },
  { value: 'refund', label: 'Refund' },
  { value: 'endorsement', label: 'Endorsement' },
  { value: 'service', label: 'Service' },
] as const;

export function ReputationPage() {
  const initial = (() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('wallet');
  })();
  const { wallet, setWallet, query } = useWalletQuery<ReputationResponse>(
    'reputation',
    api.getReputation,
    initial,
  );
  const { data, isLoading, error } = query;
  const qc = useQueryClient();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reputation</h1>
        <p className="text-sm text-muted-foreground">
          On-chain reputation events for a wallet, plus tools to record
          new events or subscribe to webhook notifications.
        </p>
      </div>

      <WalletLookup value={wallet ?? ''} onSubmit={setWallet} size="lg" buttonText="Load" />

      {isLoading && <ReputationSkeleton />}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load reputation</AlertTitle>
          <AlertDescription>
            {error instanceof ApiError ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          <RecordEventDialog wallet={wallet!} onRecorded={() => qc.invalidateQueries({ queryKey: ['reputation', wallet] })} />
          <SubscribeDialog wallet={wallet!} />
          <ReputationCard data={data} />
        </>
      )}
    </div>
  );
}

function ReputationSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-7 w-48" /></CardHeader>
      <CardContent><Skeleton className="h-32 w-full" /></CardContent>
    </Card>
  );
}

function ReputationCard({ data }: { data: ReputationResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          Reputation score
        </CardTitle>
        <CardDescription>
          Score {data.reputation.toFixed(1)} · Total events {data.breakdown.totalEvents}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Metric label="Successful payments">{data.breakdown.successfulPayments}</Metric>
          <Metric label="Purchases">{data.breakdown.successfulPurchases}</Metric>
          <Metric label="Disputes">{data.breakdown.disputes}</Metric>
          <Metric label="Refunds">{data.breakdown.refunds}</Metric>
          <Metric label="Endorsements">{data.breakdown.sponsorEndorsements}</Metric>
          <Metric label="Service interactions">{data.breakdown.serviceInteractions}</Metric>
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Sentiment</h3>
          <SentimentBar positive={data.breakdown.positiveEvents} negative={data.breakdown.negativeEvents} />
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

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm">{children}</div>
    </div>
  );
}

function SentimentBar({ positive, negative }: { positive: number; negative: number }) {
  const total = positive + negative || 1;
  const pct = (positive / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{positive} positive</span>
        <span>{negative} negative</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
        <div className="bg-emerald-500" style={{ width: `${pct}%` }} />
        <div className="bg-red-500" style={{ width: `${100 - pct}%` }} />
      </div>
    </div>
  );
}

function RecordEventDialog({ wallet, onRecorded }: { wallet: string; onRecorded: () => void }) {
  const [open, setOpen] = useState(false);
  const [eventType, setEventType] = useState<string>('payment');
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [round, setRound] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.recordReputationEvent(wallet, eventType, {
        amount: amount ? parseFloat(amount) : undefined,
        counterparty: counterparty || undefined,
        round: round ? parseInt(round, 10) : undefined,
      });
      toast.success('Event recorded');
      onRecorded();
      setOpen(false);
    } catch (err) {
      const e = err as Error;      setError(err instanceof ApiError ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-3.5 w-3.5" />
          Record event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record reputation event</DialogTitle>
          <DialogDescription>
            Add an event for <code className="wallet-mono text-xs">{wallet.slice(0, 8)}…{wallet.slice(-6)}</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="event-type">Event type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger id="event-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (optional)</Label>
            <Input id="amount" type="number" value={amount} onChange={ev => setAmount(ev.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="counterparty">Counterparty wallet (optional)</Label>
            <Input id="counterparty" value={counterparty} onChange={ev => setCounterparty(ev.target.value)} placeholder="58-char Algorand address" className="wallet-mono" />
          </div>
          {eventType === 'dispute' && (
            <div className="space-y-1.5">
              <Label htmlFor="round">Disputed transaction round</Label>
              <Input id="round" type="number" value={round} onChange={ev => setRound(ev.target.value)} placeholder="e.g. 12345678" />
            </div>
          )}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading}>
            {loading ? 'Recording…' : 'Record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubscribeDialog({ wallet }: { wallet: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      // We don't have a typed subscribe wrapper — fetch directly.
      const res = await fetch(`/reputation/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID().replace(/-/g, ''),
        },
        body: JSON.stringify({ wallet, url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new ApiError(err.error || `HTTP ${res.status}`, res.status);
      }
      const data = await res.json();
      setSecret(data.secret);
      toast.success('Subscriber registered');
    } catch (err) {
      const e = err as Error;      setError(err instanceof ApiError ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) { setSecret(null); setError(null); setUrl(''); }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Webhook className="mr-2 h-3.5 w-3.5" />
          Subscribe webhook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subscribe to reputation events</DialogTitle>
          <DialogDescription>
            POST events for this wallet to your URL. The server signs
            deliveries with HMAC-SHA256.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url">Callback URL</Label>
            <Input id="webhook-url" type="url" value={url} onChange={ev => setUrl(ev.target.value)} placeholder="https://your.app/hook" />
            <p className="text-xs text-muted-foreground">
              HTTPS required. Loopback / private hosts are rejected.
            </p>
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {secret && (
            <Alert>
              <AlertTitle>Subscriber created</AlertTitle>
              <AlertDescription className="break-all">
                Save this HMAC secret — it will not be shown again:
                <code className="mt-2 block rounded bg-muted p-2 text-xs">{secret}</code>
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading}>
            {loading ? 'Subscribing…' : 'Subscribe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}