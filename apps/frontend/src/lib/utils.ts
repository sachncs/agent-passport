import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAlgo(algo: number): string {
  return `${algo.toLocaleString(undefined, { maximumFractionDigits: 2 })} ALGO`
}

export function formatUSDC(amount: number): string {
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function truncateAddress(addr: string, head = 6, tail = 6): string {
  if (!addr || addr.length <= head + tail + 3) return addr
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

export function riskBgClass(risk: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (risk) {
    case 'low':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    case 'medium':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    case 'high':
      return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30'
    case 'critical':
      return 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
  }
}

export function riskLabel(risk: 'low' | 'medium' | 'high' | 'critical'): string {
  return risk.charAt(0).toUpperCase() + risk.slice(1)
}

export const WALLET_REGEX = /^[A-Z2-7]{58}$/

export function isValidWallet(s: string): boolean {
  return typeof s === 'string' && WALLET_REGEX.test(s)
}
