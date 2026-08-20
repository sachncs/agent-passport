"use client"

import { useState } from "react"

import { Search } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Spinner } from "@/components/ui/spinner"

import type { BazaarSearchResponse } from "@/lib/api-types"

export default function DiscoveryPage() {
  const [q, setQ] = useState("")
  const [submitted, setSubmitted] =
    useState<BazaarSearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await api.discoverySearch(q)
      setSubmitted(data)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Search failed")
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
          Bazaar
        </h1>
        <p className="max-w-2xl text-sm text-muted-fg">
          Search the x402 Bazaar catalog of agent services for trust,
          credit, or reputation needs.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 py-5">
          <form
            onSubmit={submit}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="q">Search</Label>
              <Input
                id="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. trust, passport, x402, algorand"
              />
            </div>
            <Button type="submit" disabled={loading}>
              <Search className="h-4 w-4" />{" "}
              {loading ? "Searching…" : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-xs text-muted-fg">
            <Spinner />
            <span>Searching catalog…</span>
          </CardContent>
        </Card>
      )}

      {submitted && submitted.total === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-fg">
            Nothing in the catalog matches &ldquo;{q}&rdquo;.
          </CardContent>
        </Card>
      )}

      {submitted && submitted.results.length > 0 && (
        <div className="space-y-3">
          <div className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
            {submitted.total} result
            {submitted.total === 1 ? "" : "s"} for &ldquo;
            {submitted.query}&rdquo;
          </div>
          {submitted.results.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="space-y-3 py-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading text-base font-semibold text-foreground">
                      {entry.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-fg">
                      {entry.description}
                    </p>
                  </div>
                  <Badge variant="secondary">{entry.category}</Badge>
                </div>
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {entry.tags.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="text-[0.65rem]"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                {Object.keys(entry.pricing).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(entry.pricing).map(([k, v]) => (
                      <Badge
                        key={k}
                        variant="secondary"
                        className="font-mono text-[0.65rem]"
                      >
                        {k}: {v}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
