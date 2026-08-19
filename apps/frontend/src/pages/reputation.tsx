import { useState } from "react"
import { Star, Plus, Webhook } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { useWalletQuery } from "@/hooks/useWalletQuery"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  RiskBadge,
} from "@/components/widgets"

import type { ReputationEventType, ReputationResponse } from "@/types/api"

const EVENT_TYPES: { value: ReputationEventType; label: string }[] = [
  { value: "payment", label: "Payment" },
  { value: "purchase", label: "Purchase" },
  { value: "dispute", label: "Dispute" },
  { value: "refund", label: "Refund" },
  { value: "endorsement", label: "Endorsement" },
  { value: "service", label: "Service" },
]

export default function Reputation() {
  const { wallet, query } = useWalletQuery<ReputationResponse>(
    "reputation",
    api.getReputation,
  )
  const { data, isLoading, error } = query

  if (!wallet) {
    return (
      <>
        <PageHeader
          title="Reputation"
          description="On-chain reputation events with anti-gaming defenses (cycle detection, dedup, on-chain verification)."
        />
        <EmptyState
          icon={Star}
          title="Enter a wallet"
          description="Reputation aggregates recorded events. Use the search bar to look up a wallet."
        />
      </>
    )
  }

  if (isLoading) return <LoadingBlock rows={6} />
  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Reputation"
          description="On-chain reputation events with anti-gaming defenses."
          badge={wallet}
        />
        <ErrorBlock
          message={
            error instanceof ApiError
              ? error.message
              : "Could not load reputation"
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Reputation"
        description="On-chain reputation events with anti-gaming defenses."
        badge={wallet}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-5xl font-bold">
              {data.reputation.toFixed(1)}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Reputation
            </div>
            <Progress
              value={data.reputation}
              className="mt-4 h-2"
            />
            <div className="mt-4 flex items-center justify-center">
              <RiskBadge
                risk={
                  data.reputation >= 70
                    ? "low"
                    : data.reputation >= 45
                    ? "medium"
                    : data.reputation >= 20
                    ? "high"
                    : "critical"
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Event breakdown</CardTitle>
              <RecordEventDialog wallet={wallet} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Stat label="Total" value={data.breakdown.totalEvents} />
              <Stat
                label="Positive"
                value={data.breakdown.positiveEvents}
                positive
              />
              <Stat
                label="Negative"
                value={data.breakdown.negativeEvents}
                negative
              />
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
              <Stat label="Payments" value={data.breakdown.successfulPayments} />
              <Stat label="Purchases" value={data.breakdown.successfulPurchases} />
              <Stat label="Disputes" value={data.breakdown.disputes} negative />
              <Stat label="Refunds" value={data.breakdown.refunds} negative />
              <Stat
                label="Endorsements"
                value={data.breakdown.sponsorEndorsements}
                positive
              />
              <Stat
                label="Service"
                value={data.breakdown.serviceInteractions}
                positive
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Stat({
  label,
  value,
  positive,
  negative,
}: {
  label: string
  value: number
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div
      className={
        "rounded-md border p-2 " +
        (positive
          ? "border-emerald-500/30 bg-emerald-500/5"
          : negative
          ? "border-red-500/30 bg-red-500/5"
          : "border-border bg-muted/30")
      }
    >
      <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  )
}

function RecordEventDialog({ wallet }: { wallet: string }) {
  const [open, setOpen] = useState(false)
  const [eventType, setEventType] =
    useState<ReputationEventType>("payment")
  const [amount, setAmount] = useState("")
  const [counterparty, setCounterparty] = useState("")
  const [round, setRound] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.recordReputationEvent(wallet, eventType, {
        amount: amount ? parseFloat(amount) : undefined,
        counterparty: counterparty || undefined,
        round: round ? parseInt(round, 10) : undefined,
      })
      setDone(true)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record event")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setDone(false); setError(null) }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" /> Record event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record reputation event</DialogTitle>
          <DialogDescription>
            Add an event for{" "}
            <span className="font-mono text-xs">{wallet}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {done && (
            <Badge variant="default">Event recorded</Badge>
          )}
          {error && <Badge variant="destructive">{error}</Badge>}
          <div className="space-y-1.5">
            <Label htmlFor="eventType">Event type</Label>
            <select
              id="eventType"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as ReputationEventType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {EVENT_TYPES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="counterparty">Counterparty (optional)</Label>
            <Input
              id="counterparty"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="58-char Algorand address"
              className="font-mono text-xs"
            />
          </div>
          {eventType === "dispute" && (
            <div className="space-y-1.5">
              <Label htmlFor="round">Disputed transaction round</Label>
              <Input
                id="round"
                type="number"
                value={round}
                onChange={(e) => setRound(e.target.value)}
                placeholder="e.g. 12345678"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Recording…" : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
