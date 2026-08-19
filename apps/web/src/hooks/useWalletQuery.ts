/**
 * Common "enter a wallet, fetch per-wallet data, render the result"
 * scaffold used by Trust Score, Passport, Underwrite, Delegation,
 * Sybil, and Reputation pages.
 */

import { useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

export interface UseWalletQueryResult<T> {
  wallet: string | null;
  setWallet: (wallet: string) => void;
  query: UseQueryResult<T, Error>;
}

export function useWalletQuery<T>(
  key: string,
  fetcher: (wallet: string) => Promise<T>,
  initial?: string | null,
): UseWalletQueryResult<T> {
  const [wallet, setWallet] = useState<string | null>(initial ?? null);
  const query = useQuery<T, Error>({
    queryKey: [key, wallet],
    queryFn: () => fetcher(wallet!),
    enabled: !!wallet,
    staleTime: 30_000,
  });
  return { wallet, setWallet, query };
}