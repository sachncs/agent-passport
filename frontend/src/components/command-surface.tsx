"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Check, ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { isValidWallet } from "@/lib/wallet"
import { Button } from "@/components/ui/button"

const SAMPLE_WALLET = "7ZUECA7P3TGQUZ5V4R5D4S3DMBJMA3ZIJQN2W3CK4OWQ4J4F6Q7V"

interface CommandSurfaceProps {
  wallet?: string | null
  target?: string
  cta?: string
  className?: string
  compact?: boolean
}

export function CommandSurface({
  wallet,
  target = "/dashboard",
  cta = "Run Report",
  className,
  compact = false,
}: CommandSurfaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(wallet ?? "")
  const [touched, setTouched] = useState(false)

  const trimmed = value.trim()
  const valid = trimmed.length === 0 ? null : isValidWallet(trimmed)
  const showError = touched && valid === false
  const remaining = Math.max(0, 58 - trimmed.length)

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
      className={cn("mx-auto w-full max-w-2xl", className)}
      aria-label="Load wallet report"
    >
      <div
        className={cn(
          "flex flex-col gap-2 rounded-xl border border-border bg-surface-2/60 p-2 shadow-[var(--shadow-sm)] ring-1 ring-foreground/5 sm:flex-row sm:items-stretch sm:p-1.5",
        )}
      >
        <div className="relative flex-1">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Algorand address — 58 chars A–Z, 2–7"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Algorand wallet address"
            aria-invalid={showError || undefined}
            className={cn(
              "w-full rounded-lg border border-transparent bg-background/40 px-3 font-mono text-sm text-foreground placeholder:text-muted-fg/70",
              "focus:border-info/40 focus:outline-none focus:ring-2 focus:ring-info/30",
              "h-11",
            )}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={!isValidWallet(trimmed)}
          className="h-11 px-5"
        >
          {cta}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Button>
      </div>

      <div
        className={cn(
          "mt-2 flex items-center justify-between gap-3 text-xs",
          compact ? "min-h-[1.25rem]" : "min-h-[1.5rem]",
        )}
      >
        <div className="flex items-center gap-2 text-muted-fg">
          {valid === true ? (
            <span className="inline-flex items-center gap-1.5 text-verified-fg">
              <Check aria-hidden className="h-3 w-3" />
              Valid
            </span>
          ) : showError ? (
            <span className="inline-flex items-center gap-1.5 text-destructive">
              <ShieldAlert aria-hidden className="h-3 w-3" />
              Not a valid Algorand address.
            </span>
          ) : trimmed.length > 0 ? (
            <span>{remaining} chars remaining</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setValue(SAMPLE_WALLET)
            setTouched(false)
          }}
          className="text-muted-fg underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Try a sample wallet →
        </button>
      </div>
    </form>
  )
}
