"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

export const HEALTH_QUERY_KEY = ["health"] as const

export function useHealth() {
  return useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: () => api.health(),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useNetwork(): string | undefined {
  const { data } = useHealth()
  return data?.network
}
