import { Link } from "react-router-dom"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/widgets"

export default function NotFound() {
  return (
    <>
      <PageHeader
        title="Page not found"
        description="The route you tried to open doesn't exist on this service."
      />
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Check the sidebar for the list of available tools.
        </p>
        <Button asChild>
          <Link to="/">Back to overview</Link>
        </Button>
      </div>
    </>
  )
}
