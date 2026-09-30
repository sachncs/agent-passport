"use client"

import Link from "next/link"

import { useNetwork } from "@/components/use-network"

const UTILITY_LINKS = [
  { href: "/api/openapi.json", label: "OpenAPI" },
  { href: "/api/health", label: "/health" },
  { href: "/api/metrics", label: "/metrics" },
  { href: "/api/version", label: "/version" },
] as const

export function SiteFooter() {
  const network = useNetwork()

  return (
    <footer className="border-t border-border/80 px-4 py-8 text-sm text-muted-fg md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Agent Passport — evidence-led trust infrastructure for AI agents.
          </span>
          <span className="text-muted-fg">
            v1.0.0 · {network ?? "—"} · Read-oriented · 60 s cache
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
