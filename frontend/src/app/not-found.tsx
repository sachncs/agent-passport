import Link from "next/link"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Page not found</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              The route you tried to open doesn&apos;t exist on this service.
              Check the sidebar for the list of available tools.
            </p>
          </div>
          <Button asChild>
            <Link href="/">Back to overview</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}