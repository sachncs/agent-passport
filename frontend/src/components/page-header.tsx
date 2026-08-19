import { AlertCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function PageHeader({
  title,
  description,
  badge,
}: {
  title: string
  description: string
  badge?: string
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {badge && (
          <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
            {badge}
          </code>
        )}
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Icon className="h-10 w-10 text-muted-foreground" />
        <h3 className="text-base font-medium">{title}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="space-y-3 py-6">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-6 text-sm text-destructive">
        <strong className="font-semibold">Could not load</strong>
        <p className="mt-1">{message}</p>
      </CardContent>
    </Card>
  )
}

export function WalletRequiredAlert() {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Enter a wallet address</AlertTitle>
      <AlertDescription>
        Use the search bar above to look up an Algorand address. The
        form accepts the standard 58-character base32 encoding
        (A–Z, 2–7).
      </AlertDescription>
    </Alert>
  )
}
