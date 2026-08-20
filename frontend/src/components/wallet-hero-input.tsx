"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, ShieldAlert, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isValidWallet } from "@/lib/wallet"

interface WalletHeroInputProps {
  /**
   * Wallet currently loaded from URL. When provided, the input is
   * pre-filled and the value persists on submit.
   */
  wallet?: string | null
  /**
   * Where to navigate after a valid submit. Defaults to /dashboard.
   */
  target?: string
  /**
   * Sub-headline shown above the input. Pass empty string to hide.
   */
  caption?: string
}

export function WalletHeroInput({
  wallet,
  target = "/dashboard",
  caption,
}: WalletHeroInputProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(wallet ?? "")
  const [touched, setTouched] = useState(false)

  const trimmed = value.trim()
  const valid = trimmed.length === 0 ? null : isValidWallet(trimmed)
  const showError = touched && valid === false

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!isValidWallet(trimmed)) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("wallet", trimmed)
    router.push(`${target}?${params.toString()}`)
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-2xl flex-col gap-2"
      aria-label="Load wallet report"
    >
      {caption !== "" && (
        <div className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          {caption ?? "Paste any Algorand wallet"}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Algorand address — 58 chars A–Z, 2–7"
            className="h-11 pl-9 font-mono text-sm"
            aria-label="Algorand wallet address"
            aria-invalid={showError || undefined}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-11 px-5"
          disabled={!isValidWallet(trimmed)}
        >
          Load Report
        </Button>
      </div>
      {showError && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-destructive">
          <ShieldAlert className="h-3.5 w-3.5" />
          Not a valid 58-character base32 Algorand address.
        </div>
      )}
      <div className="text-center text-[0.7rem] text-muted-foreground">
        The address is read from the URL so the report can be shared and reloaded.
      </div>
    </form>
  )
}