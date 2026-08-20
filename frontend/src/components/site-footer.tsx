import Link from "next/link"

const UTILITY_LINKS = [
  { href: "/openapi.json", label: "OpenAPI" },
  { href: "/health", label: "/health" },
  { href: "/metrics", label: "/metrics" },
  { href: "/version", label: "/version" },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 px-4 py-6 text-xs text-muted-fg md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Agent Passport — trust &amp; underwriting for AI agents on Algorand.
          </span>
          <span className="text-muted-fg">
            v0.1 · Mainnet · Stateless · 60 s cache
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {UTILITY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-fg underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
