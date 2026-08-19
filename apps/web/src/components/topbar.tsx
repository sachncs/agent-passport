"use client"

import { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Moon, Search, Sun } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { isValidWallet } from "@/lib/wallet"

export function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [wallet, setWallet] = useState(searchParams.get("wallet") ?? "")
  const [isDark, setIsDark] = useState(true)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = wallet.trim()
    if (!isValidWallet(trimmed)) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("wallet", trimmed)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
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
          onClick={() => setIsDark((d) => !d)}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  )
}
