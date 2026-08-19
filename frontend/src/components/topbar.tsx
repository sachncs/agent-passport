"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Moon, Search, Sun } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AppBreadcrumb } from "@/components/breadcrumb"
import { isValidWallet } from "@/lib/wallet"

export function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [wallet, setWallet] = useState(searchParams.get("wallet") ?? "")
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = wallet.trim()
    if (!isValidWallet(trimmed)) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("wallet", trimmed)
    router.push(`${pathname}?${params.toString()}`)
  }

  const isDark = resolvedTheme === "dark"

  return (
    <header className="sticky top-0 z-30 flex flex-col gap-2 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <AppBreadcrumb />
      </div>
      <div className="flex items-center gap-3">
        <form
          onSubmit={submit}
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