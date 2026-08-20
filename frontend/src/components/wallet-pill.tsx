import { cn } from "@/lib/utils"
import { CopyButton } from "@/components/copy-button"

interface WalletPillProps {
  wallet: string
  truncate?: boolean | number
  className?: string
  showCopy?: boolean
}

export function formatWallet(wallet: string, truncate: boolean | number = 8): string {
  if (!wallet) return ""
  if (!truncate) return wallet
  const head = typeof truncate === "number" ? truncate : 8
  const tail = Math.min(6, head)
  if (wallet.length <= head + tail + 1) return wallet
  return `${wallet.slice(0, head)}…${wallet.slice(-tail)}`
}

export function WalletPill({
  wallet,
  truncate = 8,
  className,
  showCopy = true,
}: WalletPillProps) {
  const display = formatWallet(wallet, truncate)
  const mono = truncate === false

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-surface-2/60 px-2 py-1 text-xs text-muted-fg",
        mono ? "font-mono break-all" : "font-mono",
        className,
      )}
    >
      <span className={mono ? "whitespace-pre-wrap break-all" : "truncate"}>
        {display}
      </span>
      {showCopy ? <CopyButton value={wallet} label="Copy wallet address" /> : null}
    </span>
  )
}
