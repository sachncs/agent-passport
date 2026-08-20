"use client"

import { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Search, ShieldCheck, ShieldAlert, Wallet } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { isValidWallet } from "@/lib/wallet"
import { api, ApiError } from "@/lib/api"
import { useQuery } from "@tanstack/react-query"

import type { TrustScoreResponse } from "@/lib/api-types"

interface WalletInputPanelProps {
  wallet: string | null
}

export function WalletInputPanel({ wallet }: WalletInputPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [input, setInput] = useState(wallet ?? "")
  const valid = !!(wallet && isValidWallet(wallet))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!isValidWallet(trimmed)) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("wallet", trimmed)
    router.push(`${pathname}?${params.toString()}`)
  }

  const { data, error } = useQuery<TrustScoreResponse>({
    queryKey: ["onchain-summary", wallet],
    queryFn: () => {
      if (!valid) throw new Error("wallet is not valid")
      return api.getScore(wallet)
    },
    enabled: valid,
    staleTime: 30_000,
  })

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Wallet className="h-4 w-4" />
            Wallet address
          </div>
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Algorand address (58 chars A-Z, 2-7)"
                className="pl-8 font-mono text-xs"
                aria-label="Wallet address"
              />
            </div>
            <Button type="submit" size="sm">
              Load
            </Button>
          </form>
          {wallet && (
            <div className="space-y-1.5">
              <div className="font-mono text-[0.7rem] break-all text-muted-foreground">
                {wallet}
              </div>
              {!valid && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Not a valid 58-char base32 address
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {valid && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Quick stats
            </div>
            {!data && !error && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
            {data?.onChain && (
              <dl className="space-y-1.5 text-sm">
                <Row label="Balance" value={`${data.onChain.balanceAlgo.toFixed(2)} ALGO`} />
                <Row label="Transactions" value={data.onChain.totalTxns.toLocaleString()} />
                <Row
                  label="Account age"
                  value={`${data.onChain.accountAgeDays.toLocaleString()} days`}
                />
                <Row label="Trust score" value={data.trustScore.toFixed(1)} />
              </dl>
            )}
            {error && (
              <div className="text-xs text-destructive">
                {error instanceof ApiError
                  ? error.message
                  : "Could not load stats"}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </aside>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs font-medium">{value}</dd>
    </div>
  )
}