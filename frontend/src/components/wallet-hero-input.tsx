"use client"

import { CommandSurface } from "@/components/command-surface"

interface WalletHeroInputProps {
  wallet?: string | null
  target?: string
  caption?: string
  cta?: string
}

export function WalletHeroInput({
  wallet,
  target = "/dashboard",
  cta = "Load Report",
}: WalletHeroInputProps) {
  return <CommandSurface wallet={wallet ?? null} target={target} cta={cta} />
}
