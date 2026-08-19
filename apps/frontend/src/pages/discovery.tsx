import { useState } from "react"
import { Search } from "lucide-react"

import { api, ApiError } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/widgets"

import type { BazaarSearchResponse } from "@/types/api"

export default function Discovery() {
  const [q, setQ] = useState("")
  const [query, setQuery] = useState<{
    data: BazaarSearchResponse | null
    isLoading: boolean
    error: string | null
  }>({ data: null, isLoading: false, error: null })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setQuery({ data: null, isLoading: true, error: null })
    try {
      const data = await api.discoverySearch(q)
      setQuery({ data, isLoading: false, error: null })
    } catch (e) {
      setQuery({
        data: null,
        isLoading: false,
        error:
          e instanceof ApiError
            ? e.message
            : "Could not search the Bazaar",
      })
    }
  }

  return (
    <>
      <PageHeader
        title="Bazaar Discovery"
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
            <Button type="submit" disabled={query.isLoading}>
              <Search className="h-4 w-4" />
              {query.isLoading ? "Searching…" : "Search"}
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

      {query.isLoading && <LoadingBlock rows={3} />}

      {query.data && query.data.total === 0 && (
        <EmptyState
          icon={Search}
          title="No services found"
          description={`Nothing in the catalog matches "${q}".`}
        />
      )}

      {query.data && query.data.results.length > 0 && (
        <div className="mt-4 space-y-3">
          {query.data.results.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">{entry.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entry.description}
                    </p>
                  </div>
                  <Badge variant="secondary">{entry.category}</Badge>
                </div>
                {entry.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {entry.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[0.65rem]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                {Object.keys(entry.pricing).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
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
