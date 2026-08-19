import Link from "next/link"
import { AlertCircle } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <AlertCircle className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The route you tried to open doesn't exist on this service.
        Check the sidebar for the list of available tools.
      </p>
      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Back to overview
      </Link>
    </div>
  )
}
