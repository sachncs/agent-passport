import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Server, Activity, ShieldCheck, RefreshCw } from 'lucide-react';

export function MonitorPage() {
  const { data: version } = useQuery({
    queryKey: ['version'],
    queryFn: () => api.version(),
    refetchInterval: 60_000,
  });
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Health, readiness, version, and Prometheus metrics.
          </p>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Server} label="Service">
          {version
            ? <span className="font-mono text-lg">{version.service}</span>
            : <Skeleton className="h-6 w-32" />}
        </Stat>
        <Stat icon={Activity} label="Network">
          {version ? <Badge variant="info">{version.network}</Badge> : <Skeleton className="h-6 w-24" />}
        </Stat>
        <Stat icon={ShieldCheck} label="Health">
          {health
            ? <Badge variant={health.status === 'ok' ? 'success' : 'destructive'}>{health.status}</Badge>
            : <Skeleton className="h-6 w-16" />}
        </Stat>
        <Stat icon={RefreshCw} label="Uptime">
          {version ? <span className="font-mono">{version.uptime}s</span> : <Skeleton className="h-6 w-16" />}
        </Stat>
      </section>

      {version && (
        <Card>
          <CardHeader>
            <CardTitle>Build</CardTitle>
            <CardDescription>Version metadata</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Data label="Version" value={version.version} />
            <Data label="Commit" value={version.commit ?? 'unknown'} />
            <Data label="Node" value={version.node} />
            <Data label="Network" value={version.network} />
            <Data label="x402" value={version.x402 ? 'enabled' : 'disabled'} />
            <Data label="Sanctions provider" value={version.sanctionsProvider} />
          </CardContent>
        </Card>
      )}

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Prometheus metrics</CardTitle>
          <CardDescription>
            Raw metrics scrape. Hook this into Grafana / Alertmanager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <code className="block rounded-md border border-border bg-muted/30 p-3 font-mono text-xs">
            GET /metrics
          </code>
          <p className="text-xs text-muted-foreground">
            Includes agent_passport_* counters and histograms. See
            docs/operations.md#5-observability for the full inventory.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href="/metrics" target="_blank" rel="noreferrer">Open /metrics</a>
          </Button>
        </CardContent>
      </Card>

      {health && health.status !== 'ok' && (
        <Alert variant="destructive">
          <AlertDescription>The health probe reported status: {health.status}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function Stat({
  icon: Icon, label, children,
}: { icon: typeof Server; label: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1">{children}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}