import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ExternalLink, Tag } from 'lucide-react';

export function DiscoveryPage() {
  const [q, setQ] = useState('');
  const [active, setActive] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['discovery', active],
    queryFn: () => api.discoverySearch(active),
    enabled: true,
  });

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setActive(q.trim());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bazaar Discovery</h1>
        <p className="text-sm text-muted-foreground">
          Search registered agent services by name, description, category,
          or tag.
        </p>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search (e.g. trust, passport, x402)"
        />
        <Button type="submit"><Search className="mr-2 h-4 w-4" /> Search</Button>
      </form>

      {isLoading && (
        <Card><CardContent className="py-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-3 h-32 w-full" />
        </CardContent></Card>
      )}

      {error && (
        <Alert variant="destructive"><AlertDescription>{error instanceof ApiError ? error.message : 'Unknown error'}</AlertDescription></Alert>
      )}

      {data && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {data.total} result{data.total === 1 ? '' : 's'} for &ldquo;{data.query || '(all)'}&rdquo;
          </p>
          {data.results.map((entry) => (
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
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {entry.tags.map(t => (
                    <Badge key={t} variant="outline" className="gap-1">
                      <Tag className="h-2.5 w-2.5" />{t}
                    </Badge>
                  ))}
                </div>
                {Object.keys(entry.endpoints).length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Endpoints</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(entry.endpoints).map(([k, v]) => (
                        <code key={k} className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                          {k}: {v}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
                {Object.keys(entry.pricing).length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Pricing</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(entry.pricing).map(([k, v]) => (
                        <Badge key={k} variant="info">{k}: {v}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a href={entry.health} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" /> Health
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
          {data.results.length === 0 && (
            <Alert><AlertDescription>No services matched your query.</AlertDescription></Alert>
          )}
        </div>
      )}
    </div>
  );
}