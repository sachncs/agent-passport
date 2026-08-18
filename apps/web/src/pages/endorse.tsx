import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { HandCoins, Undo2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { isValidWallet } from '@/lib/wallet';

export function EndorsePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Endorse / Revoke</h1>
        <p className="text-sm text-muted-foreground">
          Submit an on-chain delegation, or revoke one. These endpoints
          require HMAC auth and an Idempotency-Key — the browser UI
          does not send them, so transactions will be rejected at the
          server until the SDK is wired in.
        </p>
      </div>

      <Alert variant="warning">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Auth required</AlertTitle>
        <AlertDescription>
          Set <code className="text-xs">HMAC_SECRET</code> and send signed
          requests from a server. The form below is for staging the
          payload shape only.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="endorse">
        <TabsList>
          <TabsTrigger value="endorse">Endorse</TabsTrigger>
          <TabsTrigger value="revoke">Revoke</TabsTrigger>
        </TabsList>
        <TabsContent value="endorse">
          <EndorseForm />
        </TabsContent>
        <TabsContent value="revoke">
          <RevokeForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EndorseForm() {
  const [sponsor, setSponsor] = useState('');
  const [agent, setAgent] = useState('');
  const [amount, setAmount] = useState('1000');

  const mutation = useMutation({
    mutationFn: () => api.endorse({
      sponsor, agent,
      amount: parseFloat(amount),
      idempotencyKey: crypto.randomUUID().replace(/-/g, ''),
    }),
    onSuccess: () => toast.success('Delegation submitted'),
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Submit failed'),
  });

  const ready = isValidWallet(sponsor) && isValidWallet(agent) && sponsor !== agent && parseFloat(amount) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HandCoins className="h-5 w-5 text-primary" />
          Submit delegation
        </CardTitle>
        <CardDescription>
          Sponsor endorses Agent for the given ALGO amount. Requires the
          registry contract to be deployed and the operator wallet
          configured.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormRow label="Sponsor wallet">
          <Input value={sponsor} onChange={ev => setSponsor(ev.target.value)} placeholder="Algorand address (58 chars)" className="wallet-mono" />
        </FormRow>
        <FormRow label="Agent wallet">
          <Input value={agent} onChange={ev => setAgent(ev.target.value)} placeholder="Algorand address (58 chars)" className="wallet-mono" />
        </FormRow>
        <FormRow label="Amount (ALGO)">
          <Input type="number" value={amount} onChange={ev => setAmount(ev.target.value)} />
        </FormRow>
        <Button onClick={() => mutation.mutate()} disabled={!ready || mutation.isPending}>
          {mutation.isPending ? 'Submitting…' : 'Submit'}
        </Button>
        {Boolean(mutation.error) && (
          <Alert variant="destructive">
            <AlertDescription>
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Unknown error'}
            </AlertDescription>
          </Alert>
        )}
        {mutation.data && (
          <Alert>
            <AlertTitle>Submitted</AlertTitle>
            <AlertDescription>
              Transaction ID: <code className="font-mono">{mutation.data.txId}</code>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function RevokeForm() {
  const [sponsor, setSponsor] = useState('');
  const [agent, setAgent] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.revoke({
      sponsor, agent,
      idempotencyKey: crypto.randomUUID().replace(/-/g, ''),
    }),
    onSuccess: () => toast.success('Revocation submitted'),
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Submit failed'),
  });

  const ready = isValidWallet(sponsor) && isValidWallet(agent) && sponsor !== agent;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Undo2 className="h-5 w-5 text-primary" />
          Revoke delegation
        </CardTitle>
        <CardDescription>
          Removes the sponsorship on-chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormRow label="Sponsor wallet">
          <Input value={sponsor} onChange={ev => setSponsor(ev.target.value)} placeholder="Algorand address (58 chars)" className="wallet-mono" />
        </FormRow>
        <FormRow label="Agent wallet">
          <Input value={agent} onChange={ev => setAgent(ev.target.value)} placeholder="Algorand address (58 chars)" className="wallet-mono" />
        </FormRow>
        <Button onClick={() => mutation.mutate()} disabled={!ready || mutation.isPending}>
          {mutation.isPending ? 'Submitting…' : 'Revoke'}
        </Button>
        {Boolean(mutation.error) && (
          <Alert variant="destructive">
            <AlertDescription>
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Unknown error'}
            </AlertDescription>
          </Alert>
        )}
        {mutation.data && (
          <Alert>
            <AlertTitle>Submitted</AlertTitle>
            <AlertDescription>
              Transaction ID: <code className="font-mono">{mutation.data.txId}</code>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}