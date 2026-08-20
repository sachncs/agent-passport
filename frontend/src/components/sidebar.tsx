"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  Award,
  Gauge,
  HandCoins,
  LayoutDashboard,
  ScrollText,
  Search,
  Shield,
  Star,
  Users,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"

const NAV_ITEMS: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: ScrollText },
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

export function AppSidebar() {
  const pathname = usePathname()
  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Agent Passport"
              render={
                <Link href="/">
                  <Shield className="h-5 w-5" />
                  <span className="font-semibold tracking-tight">
                    Agent Passport
                  </span>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname.startsWith(item.href + "/")
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Service status"
              render={
                <Link href="/monitor">
                  <Activity className="h-4 w-4" />
                  <span>Service status</span>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>
}