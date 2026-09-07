"use client"

import { useState } from "react"
import { ShieldCheck, ShieldAlert } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CodeBlock } from "@/components/code-block"

import type { CounterpartyCheckResponse } from "@/lib/api-types"

export default function CounterpartyPage() {
  const [buyer, setBuyer] = useState("")
  const [submitted, setSubmitted] =
    useState<CounterpartyCheckResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isValidWallet(buyer)) {
      setError(
        "That wallet address isn't a valid 58-character base32 Algorand address.",
      )
      return
    }
    setLoading(true)
    try {
      const data = await api.checkCounterparty(buyer)
      setSubmitted(data)
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Counterparty check failed",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-info-fg">
          Developer surface
        </span>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Counterparty Check
        </h1>
        <p className="max-w-2xl text-sm text-muted-fg">
          Buyer risk check for merchant integrations: 60% on-chain + 40%
          delegation trust.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 py-5">
          <form
            onSubmit={submit}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
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
          <CodeBlock
            language="http"
            code={`POST /counterparty-check
Content-Type: application/json

{
  "buyer": "${buyer || "<wallet>"}"
}`}
          />
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {submitted && (
        <div className="space-y-4">
          <div
            className={`rounded-xl border bg-surface-2/60 p-5 shadow-[var(--shadow-sm)] ring-1 ring-foreground/5 ${
              submitted.allow
                ? "border-verified/30"
                : "border-risk-critical/30"
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                {submitted.allow ? (
                  <ShieldCheck className="h-5 w-5 text-verified-fg" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-risk-critical" />
                )}
                <span
                  className={`font-heading text-3xl font-semibold tracking-tight ${
                    submitted.allow ? "text-verified-fg" : "text-risk-critical"
                  }`}
                >
                  {submitted.allow ? "Allow" : "Deny"}
                </span>
              </div>
              <span className="text-xs text-muted-fg">
                Trust {submitted.trustScore.toFixed(1)} · On-chain{" "}
                {submitted.onChainScore.toFixed(1)} · Delegation{" "}
                {submitted.delegationScore.toFixed(1)}
              </span>
            </div>
          </div>

          {submitted.explanation && submitted.explanation.length > 0 && (
            <Card>
              <CardContent className="space-y-3 py-5">
                <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
                  Explanation
                </span>
                <ul className="space-y-1.5 text-sm">
                  {submitted.explanation.map((line, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-border/60 bg-background/40 px-3 py-2"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
