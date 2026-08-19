import { useState } from "react"

import { Search } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState, LoadingBlock, PageHeader } from "@/components/page-header"
import type { BazaarSearchResponse } from "@/lib/api-types"
export default function DiscoveryPage() {
  const [q, setQ] = useState("")
  const [submitted, setSubmitted] = useState<BazaarSearchResponse | null>(null)
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
    <>
      <PageHeader
        title="Bazaar"
        description="Search the x402 Bazaar catalog of agent services for trust, credit, or reputation needs."
      />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex items-end gap-2">
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
              <Search className="h-4 w-4" /> {loading ? "Searching…" : "Search"}
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
      {loading && <LoadingBlock rows={3} />}
      {submitted && submitted.total === 0 && (
        <EmptyState
          icon={Search}
          title="No services found"
          description={`Nothing in the catalog matches "${q}".`}
        />
      )}
      {submitted && submitted.results.length > 0 && (
        <div className="mt-4 space-y-3">
          {submitted.results.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{entry.name}</CardTitle>
                    <CardDescription>{entry.description}</CardDescription>
                  </div>
                  <Badge variant="secondary">{entry.category}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {entry.tags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {entry.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[0.65rem]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                {Object.keys(entry.pricing).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(entry.pricing).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="text-[0.65rem]">
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
    </>
  )
}
