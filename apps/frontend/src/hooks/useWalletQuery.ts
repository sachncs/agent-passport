import { useMemo, useState } from "react"
import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import { isValidWallet } from "@/lib/wallet"

export interface UseWalletQueryResult<T> {
  wallet: string | null
  setWallet: (wallet: string) => void
  query: UseQueryResult<T, Error>
}

function readInitialWallet(): string | null {
  if (typeof window === "undefined") return null
  const url = new URL(window.location.href)
  const fromQuery = url.searchParams.get("wallet")
  if (fromQuery && isValidWallet(fromQuery)) return fromQuery
  return null
}

/**
 * Common "enter a wallet, fetch per-wallet data, render the result"
 * scaffold used by every per-wallet page.
 */
export function useWalletQuery<T>(
  key: string,
  fetcher: (wallet: string) => Promise<T>,
): UseWalletQueryResult<T> {
  const initial = useMemo(readInitialWallet, [])
  const [wallet, setWallet] = useState<string | null>(initial)

  const query = useQuery<T, Error>({
    queryKey: [key, wallet],
    queryFn: () => fetcher(wallet as string),
    enabled: Boolean(wallet),
    staleTime: 30_000,
  })

  return { wallet, setWallet, query }
}
