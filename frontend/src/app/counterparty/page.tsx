import { useState } from "react"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/page-header"
import type { CounterpartyCheckResponse } from "@/lib/api-types"
export default function CounterpartyPage() {
  const [buyer, setBuyer] = useState("")
  const [submitted, setSubmitted] = useState<CounterpartyCheckResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isValidWallet(buyer)) {
      setError("That wallet address isn't a valid 58-character base32 Algorand address.")
      return
    }
    setLoading(true)
    try {
      const data = await api.checkCounterparty(buyer)
      setSubmitted(data)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Counterparty check failed")
    } finally {
      setLoading(false)
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
            <Button type="submit" disabled={loading}>
              {loading ? "Checking…" : "Check"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {error && (
        <Card className="mt-4 border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}
      {submitted && (
        <div className="mt-4 space-y-4">
          <Card
            className={
              submitted.allow
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/30 bg-red-500/5"
            }
          >
            <CardContent className="flex items-center gap-3 py-4">
              <div className="text-lg font-semibold">
                {submitted.allow ? "Allow" : "Deny"}
              </div>
              <div className="text-xs text-muted-foreground">
                Trust {submitted.trustScore.toFixed(1)} · On-chain{" "}
                {submitted.onChainScore.toFixed(1)} · Delegation{" "}
                {submitted.delegationScore.toFixed(1)}
              </div>
            </CardContent>
          </Card>
          {submitted.explanation && submitted.explanation.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Explanation</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {submitted.explanation.map((line, i) => (
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
    </>
  )
}
