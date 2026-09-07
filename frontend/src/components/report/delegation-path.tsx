import { Anchor } from "lucide-react"

import { cn } from "@/lib/utils"
import { WalletPill } from "@/components/wallet-pill"

interface DelegationPathProps {
  path: string[]
  isTrustAnchor?: boolean
  className?: string
}

export function DelegationPath({
  path,
  isTrustAnchor,
  className,
}: DelegationPathProps) {
  if (path.length === 0) {
    return (
      <p className="text-sm text-muted-fg">
        No delegation path on record.
      </p>
    )
  }

  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-2",
        className,
      )}
    >
      {path.map((wallet, i) => (
        <li key={`${wallet}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && (
            <span
              aria-hidden
              className="h-px w-3 bg-border-strong"
            />
          )}
          {i === path.length - 1 && isTrustAnchor ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-verified/30 bg-verified-bg px-2 py-1 text-xs font-medium text-verified-fg">
              <Anchor aria-hidden className="h-3 w-3" />
              <span className="font-mono">{`${wallet.slice(0, 8)}…${wallet.slice(-6)}`}</span>
              <span className="uppercase tracking-[0.14em]">
                Anchor
              </span>
            </span>
          ) : (
            <WalletPill wallet={wallet} showCopy={false} />
          )}
        </li>
      ))}
    </ol>
  )
}
