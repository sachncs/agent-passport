"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Award, Gauge, HandCoins, LayoutDashboard, Search, Shield, Star, Users } from "lucide-react"

const NAV_ITEMS: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/score", label: "Trust Score", icon: Gauge },
  { href: "/passport", label: "Passport", icon: Award },
  { href: "/underwrite", label: "Underwrite", icon: Shield },
  { href: "/delegation", label: "Delegation", icon: Users },
  { href: "/sybil", label: "Sybil Check", icon: Activity },
  { href: "/reputation", label: "Reputation", icon: Star },
  { href: "/counterparty", label: "Counterparty", icon: HandCoins },
  { href: "/endorse", label: "Endorse / Revoke", icon: HandCoins },
  { href: "/discovery", label: "Bazaar", icon: Search },
  { href: "/monitor", label: "Monitor", icon: Activity },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">Agent Passport</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors " +
                (active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground")
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/monitor"
          className="block rounded-md bg-sidebar-accent/40 p-3 text-xs"
        >
          <div className="font-medium text-foreground">Service status</div>
          <div className="mt-1 text-muted-foreground">auto-refreshes /health</div>
        </Link>
      </div>
    </aside>
  )
}
