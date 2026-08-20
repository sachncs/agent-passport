"use client"

import { useState } from "react"
import { HandCoins, ShieldCheck, ShieldAlert } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { isValidWallet } from "@/lib/wallet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { PassportSection } from "@/components/passport-section"
import { Stat } from "@/components/stat"

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
      <PassportSection
        icon={HandCoins}
        title="Counterparty Check"
        subtitle="Buyer risk check for merchant integrations: 60% on-chain + 40% delegation trust."
        tone="primary"
      >
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
      </PassportSection>

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
          <Card
            className={
              submitted.allow
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-red-500/40 bg-red-500/5"
            }
          >
            <CardContent className="flex flex-wrap items-center gap-4 py-5">
              <div className="flex items-center gap-2">
                {submitted.allow ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                )}
                <div className="font-heading text-2xl font-semibold tracking-tight">
                  {submitted.allow ? "Allow" : "Deny"}
                </div>
              </div>
<div className="text-xs text-muted-foreground">
              Trust {submitted.trustScore.toFixed(1)} · On-chain{" "}
              {submitted.onChainScore.toFixed(1)} · Delegation{" "}
              {submitted.delegationScore.toFixed(1)}
            </div>
            </CardContent>
          </Card>

          <PassportSection
            icon={HandCoins}
            title="Breakdown"
            tone="primary"
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Trust" tone="muted">
                {submitted.trustScore.toFixed(1)}
              </Stat>
              <Stat label="On-chain" tone="muted">
                {submitted.onChainScore.toFixed(1)}
              </Stat>
              <Stat label="Delegation" tone="muted">
                {submitted.delegationScore.toFixed(1)}
              </Stat>
              <Stat label="Wallet" tone="muted">
                <span className="font-mono text-xs">
                  {submitted.buyer
                    ? `${submitted.buyer.slice(0, 8)}…${submitted.buyer.slice(-6)}`
                    : "—"}
                </span>
              </Stat>
            </div>
          </PassportSection>

          {submitted.explanation && submitted.explanation.length > 0 && (
            <PassportSection
              icon={HandCoins}
              title="Explanation"
              tone="primary"
            >
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {submitted.explanation.map((line, i) => (
                  <li key={i}>• {line}</li>
                ))}
              </ul>
            </PassportSection>
          )}
        </div>
      )}
    </div>
  )
}