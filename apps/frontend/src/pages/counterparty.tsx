import { useState } from "react"
import { HandCoins, Check, X } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
} from "@/components/widgets"
import { isValidWallet } from "@/lib/wallet"

import type { CounterpartyCheckResponse } from "@/types/api"

export default function Counterparty() {
  const [buyer, setBuyer] = useState("")
  const [query, setQuery] = useState<{
    data: CounterpartyCheckResponse | null
    isLoading: boolean
    error: string | null
  }>({ data: null, isLoading: false, error: null })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidWallet(buyer)) {
      setQuery({ data: null, isLoading: false, error: "Invalid Algorand address" })
      return
    }
    setQuery({ data: null, isLoading: true, error: null })
    try {
      const data = await api.checkCounterparty(buyer)
      setQuery({ data, isLoading: false, error: null })
    } catch (e) {
      setQuery({
        data: null,
        isLoading: false,
        error:
          e instanceof ApiError
            ? e.message
            : "Could not check counterparty",
      })
    }
  }

  return (
    <>
      <PageHeader
        title="Counterparty Check"
        description="Buyer risk check for merchant integrations: 60% on-chain + 40% delegation trust."
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="buyer">Buyer wallet</Label>
              <Input
                id="buyer"
                value={buyer}
                onChange={(e) => setBuyer(e.target.value)}
                placeholder="Algorand address (58 chars A-Z, 2-7)"
                className="font-mono text-xs"
              />
            </div>
            <Button type="submit" disabled={query.isLoading}>
              {query.isLoading ? "Checking…" : "Check"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {query.error && (
        <Card className="mt-4 border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            {query.error}
          </CardContent>
        </Card>
      )}

      {query.isLoading && <LoadingBlock rows={4} />}

      {query.data && (
        <div className="mt-4 space-y-4">
          <Card
            className={
              query.data.allow
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-destructive/30 bg-destructive/5"
            }
          >
            <CardContent className="flex items-center gap-3 py-4">
              {query.data.allow ? (
                <Check className="h-6 w-6 text-emerald-500" />
              ) : (
                <X className="h-6 w-6 text-destructive" />
              )}
              <div>
                <div className="text-lg font-semibold">
                  {query.data.allow ? "Allow" : "Deny"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Trust {query.data.trustScore.toFixed(1)} · On-chain{" "}
                  {query.data.onChainScore.toFixed(1)} · Delegation{" "}
                  {query.data.delegationScore.toFixed(1)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-3 text-sm font-medium">Component scores</h3>
              <ScoreBar label="On-chain" value={query.data.onChainScore} />
              <div className="mt-3">
                <ScoreBar
                  label="Delegation"
                  value={query.data.delegationScore}
                />
              </div>
              <div className="mt-3">
                <ScoreBar label="Trust" value={query.data.trustScore} />
              </div>
            </CardContent>
          </Card>

          {query.data.explanation && query.data.explanation.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Explanation</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {query.data.explanation.map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!query.data && !query.isLoading && !query.error && (
        <EmptyState
          icon={HandCoins}
          title="Enter a buyer wallet"
          description="The endpoint returns an aggregate trust score and an allow/deny decision for merchant integrations."
        />
      )}
    </>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(1)}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  )
}
