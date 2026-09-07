"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col gap-4 py-12">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          {error.message || "An unexpected error occurred while rendering this page."}
          {error.digest && (
            <span className="mt-2 block font-mono text-xs opacity-80">
              digest: {error.digest}
            </span>
          )}
        </AlertDescription>
      </Alert>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}