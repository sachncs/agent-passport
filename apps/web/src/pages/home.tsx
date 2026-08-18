import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import {
  Shield, Award, Scale, Users, Activity, Star, Search, Server,
  Briefcase, HandCoins,
} from 'lucide-react';

export function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Agent Passport</h1>
        <p className="max-w-3xl text-muted-foreground">
          Stateless trust scoring, delegation, credit, sybil, reputation, and
          underwriting for AI agents on Algorand. Browse a wallet, run
          scenarios, sign delegations, and explore the Bazaar — every
          endpoint on this site maps 1:1 to the public API at{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/openapi.json</code>.
        </p>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Tools</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ToolCard
            to="/score"
            icon={Shield}
            title="Trust Score Explorer"
            description="Composite 0–100 score with five sub-scores (age, activity, volume, velocity, compliance)."
          />
          <ToolCard
            to="/passport"
            icon={Award}
            title="Passport Viewer"
            description="Full passport document with credit limit, sybil risk, capabilities, and checksum."
          />
          <ToolCard
            to="/underwrite"
            icon={Scale}
            title="Underwriting Decision"
            description="Approve / deny + recommended credit limit with 4-factor breakdown + sanctions."
          />
          <ToolCard
            to="/delegation"
            icon={Users}
            title="Delegation Trust Graph"
            description="Sponsor tree with depth attenuation, sponsor quality, and trust-anchor markers."
          />
          <ToolCard
            to="/sybil"
            icon={Activity}
            title="Sybil Detection Report"
            description="Twelve signals (clustering, timing, balance similarity, funding correlation…)."
          />
          <ToolCard
            to="/reputation"
            icon={Star}
            title="Reputation Events"
            description="On-chain event log with score breakdown; record or subscribe to webhooks."
          />
          <ToolCard
            to="/counterparty"
            icon={Briefcase}
            title="Counterparty Check"
            description="Merchant-side buyer risk: aggregate of on-chain + delegation + trust signals."
          />
          <ToolCard
            to="/endorse"
            icon={HandCoins}
            title="Endorse / Revoke"
            description="Submit on-chain delegation or revocation (requires HMAC + Idempotency-Key)."
          />
          <ToolCard
            to="/discovery"
            icon={Search}
            title="Bazaar Discovery"
            description="Search registered agent services."
          />
          <ToolCard
            to="/monitor"
            icon={Server}
            title="Service Monitor"
            description="Health, readiness, version, and Prometheus metrics at a glance."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">About the model</h2>
        <Card>
          <CardHeader>
            <CardTitle>What you see on every wallet</CardTitle>
            <CardDescription>
              The trust score is the weighted sum of 5 sub-scores; the
              underwriting decision is the weighted sum of 4 factors (trust,
              delegation, sybil resistance, reputation) plus a
              credit-capacity base and a system-wide exposure cap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScorePreview />
            <Alert>
              <AlertDescription className="text-sm">
                State-changing endpoints (<code>/delegate</code>, <code>/revoke</code>,
                <code>/reputation/record</code>) require <strong>HMAC auth</strong>
                and an <strong>Idempotency-Key</strong>. The browser UI does not
                send them by default; use the SDK from a server for write
                operations.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ToolCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: typeof Shield;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className="block transition-transform hover:-translate-y-0.5">
      <Card className="h-full transition-colors hover:bg-accent/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function ScorePreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Score weights</span>
      </div>
      <ScoreBar label="Age" value={70} />
      <ScoreBar label="Activity" value={55} />
      <ScoreBar label="Volume" value={40} />
      <ScoreBar label="Velocity" value={80} />
      <ScoreBar label="Compliance" value={60} />
      <Separator />
      <div className="flex items-center justify-between">
        <Badge variant="secondary">Composite</Badge>
        <span className="font-mono text-sm">61.0 / 100</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <Progress
        value={value}
        indicatorClass={
          value >= 70 ? 'bg-emerald-500'
            : value >= 40 ? 'bg-amber-500'
            : 'bg-red-500'
        }
      />
    </div>
  );
}