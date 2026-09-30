"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, Menu, Moon, Sun, Terminal, X } from "lucide-react"
import { useTheme } from "next-themes"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/status-pill"

export function SiteHeader() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isDark = resolvedTheme === "dark"

  const navItems = [
    { href: "/dashboard", label: "Overview" },
    { href: "/score", label: "Trust profile" },
    { href: "/underwrite", label: "Underwriting" },
    { href: "/monitor", label: "Operations" },
  ] as const

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
          aria-label="Agent Passport — home"
        >
          <Logo size={28} variant="wordmark" />
        </Link>
        <nav className="ml-5 hidden items-center gap-5 text-sm text-muted-fg md:flex" aria-label="Product navigation">
          {navItems.map((item) => (
            <Link className="transition-colors hover:text-foreground" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/discovery" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-fg transition-colors hover:bg-muted hover:text-foreground sm:inline-flex">
            <Terminal className="h-3.5 w-3.5" aria-hidden="true" /> Developer tools
          </Link>
          <Link href="https://sachncs.github.io/agent-passport/docs/" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-fg transition-colors hover:bg-muted hover:text-foreground lg:inline-flex">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Docs
          </Link>
          <StatusPill />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
            suppressHydrationWarning
          >
            {mounted ? (
              isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            ) : (
              <span className="block h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile product navigation"
          className="border-t border-border/80 bg-background px-4 py-3 md:hidden"
        >
          <div className="mx-auto grid max-w-6xl gap-1">
            {navItems.map((item) => (
              <Link
                className="rounded-lg px-3 py-3 text-base text-muted-fg transition-colors hover:bg-muted hover:text-foreground"
                href={item.href}
                key={item.href}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              className="rounded-lg px-3 py-3 text-base text-muted-fg transition-colors hover:bg-muted hover:text-foreground"
              href="/discovery"
              onClick={() => setMobileOpen(false)}
            >
              Developer tools
            </Link>
            <Link
              className="rounded-lg px-3 py-3 text-base text-muted-fg transition-colors hover:bg-muted hover:text-foreground"
              href="https://sachncs.github.io/agent-passport/docs/"
              onClick={() => setMobileOpen(false)}
            >
              Documentation
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
