"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, Moon, Sun, Terminal } from "lucide-react"
import { useTheme } from "next-themes"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/status-pill"

export function SiteHeader() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isDark = resolvedTheme === "dark"

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
          aria-label="Agent Passport — home"
        >
          <Logo size={24} variant="wordmark" />
        </Link>
        <nav className="ml-5 hidden items-center gap-4 text-xs text-muted-fg md:flex" aria-label="Product navigation">
          <Link className="transition-colors hover:text-foreground" href="/dashboard">Overview</Link>
          <Link className="transition-colors hover:text-foreground" href="/score">Trust profile</Link>
          <Link className="transition-colors hover:text-foreground" href="/underwrite">Underwriting</Link>
          <Link className="transition-colors hover:text-foreground" href="/monitor">Operations</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/discovery" className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-fg transition-colors hover:bg-muted hover:text-foreground sm:inline-flex">
            <Terminal className="h-3.5 w-3.5" aria-hidden="true" /> Developer tools
          </Link>
          <Link href="https://sachncs.github.io/agent-passport/docs/" className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-fg transition-colors hover:bg-muted hover:text-foreground lg:inline-flex">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Docs
          </Link>
          <StatusPill />
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
    </header>
  )
}
