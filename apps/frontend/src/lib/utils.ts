import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function walletAddress(s: string, head = 6, tail = 6): string {
  if (!s || s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function formatAlgo(amount: number): string {
  return `${amount.toFixed(2)} ALGO`;
}

export function formatUSDC(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function riskColor(risk: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (risk) {
    case 'low': return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300';
    case 'medium': return 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300';
    case 'high': return 'bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-300';
    case 'critical': return 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300';
  }
}