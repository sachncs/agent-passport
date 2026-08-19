import { useEffect, useState } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import {
  Activity,
  Award,
  Gauge,
  HandCoins,
  LayoutDashboard,
  Moon,
  Search,
  Shield,
  Star,
  Sun,
  Users,
} from "lucide-react"

import { cn, truncateAddress } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { isValidWallet } from "@/lib/wallet"

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/score", label: "Trust Score", icon: Gauge },
  { to: "/passport", label: "Passport", icon: Award },
  { to: "/underwrite", label: "Underwrite", icon: Shield },
  { to: "/delegation", label: "Delegation", icon: Users },
  { to: "/sybil", label: "Sybil Check", icon: Activity },
  { to: "/reputation", label: "Reputation", icon: Star },
  { to: "/counterparty", label: "Counterparty", icon: HandCoins },
  { to: "/endorse", label: "Endorse / Revoke", icon: HandCoins },
  { to: "/discovery", label: "Bazaar", icon: Search },
  { to: "/monitor", label: "Monitor", icon: Activity },
]

const THEME_KEY = "agent-passport-theme"

export function Layout({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState("")
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark"
    return (localStorage.getItem(THEME_KEY) as "dark" | "light") ?? "dark"
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = wallet.trim()
    if (!isValidWallet(trimmed)) return
    const path = location.pathname === "/" ? "/score" : location.pathname
    window.location.href = `${path}?wallet=${trimmed}`
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
          <div className="flex h-14 items-center gap-2 border-b border-border px-4">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">Agent Passport</span>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <Link
              to="/monitor"
              className="block rounded-md bg-secondary/40 p-3 text-xs"
            >
              <div className="font-medium text-foreground">Service status</div>
              <HealthPill />
            </Link>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
            <form
              onSubmit={onSubmit}
              className="flex w-full max-w-2xl items-center gap-2"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="Enter Algorand wallet address (58 chars A-Z, 2-7)"
                className="font-mono text-xs"
                aria-label="Wallet address"
              />
              <Button type="submit" size="sm">
                Look up
              </Button>
            </form>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>

          <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground md:px-8">
            <Separator className="mb-3" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Agent Passport — trust and underwriting for AI agents on Algorand.</span>
              <span>
                <Link
                  to="/openapi.json"
                  className="underline-offset-2 hover:underline"
                >
                  OpenAPI
                </Link>
                {" · "}
                <Link
                  to="/health"
                  className="underline-offset-2 hover:underline"
                >
                  /health
                </Link>
                {" · "}
                <Link
                  to="/metrics"
                  className="underline-offset-2 hover:underline"
                >
                  /metrics
                </Link>
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

function HealthPill() {
  const [status, setStatus] = useState<"ok" | "degraded" | "loading">("loading")
  useEffect(() => {
    let cancelled = false
    const tick = () => {
      fetch("/health")
        .then(r => r.json())
        .then(d => {
          if (!cancelled) setStatus(d.status === "ok" ? "ok" : "degraded")
        })
        .catch(() => {
          if (!cancelled) setStatus("degraded")
        })
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const color =
    status === "ok"
      ? "bg-emerald-500"
      : status === "degraded"
      ? "bg-red-500"
      : "bg-amber-500"

  return (
    <div className="mt-1 flex items-center gap-2 text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
      <span className="capitalize">{status}</span>
    </div>
  )
}
