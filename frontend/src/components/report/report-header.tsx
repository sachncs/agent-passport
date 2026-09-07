"use client"

import Link from "next/link"
import { Download, ExternalLink } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { WalletPill } from "@/components/wallet-pill"
import { RiskPill } from "@/components/risk-pill"
import type { RiskLevel } from "@/lib/api-types"

interface ReportHeaderProps {
  wallet: string
  risk?: RiskLevel
  generatedAt?: string
  checksum?: string
  onDownloadJson?: () => void
  className?: string
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function ReportHeader({
  wallet,
  risk,
  generatedAt,
  checksum,
  onDownloadJson,
  className,
}: ReportHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-14 z-20 -mx-4 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur md:-mx-8 md:px-8",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <WalletPill wallet={wallet} truncate={false} />
          {risk && <RiskPill risk={risk} size="sm" />}
        </div>
        <div className="flex items-center gap-1">
          {onDownloadJson && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownloadJson}
              aria-label="Download JSON"
            >
              <Download aria-hidden className="h-4 w-4" />
              JSON
            </Button>
          )}
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            render={<Link href={`/passport?wallet=${wallet}`} />}
          >
            <ExternalLink aria-hidden className="h-4 w-4" />
            Passport
          </Button>
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            render={<Link href={`/score?wallet=${wallet}`} />}
          >
            <ExternalLink aria-hidden className="h-4 w-4" />
            Score
          </Button>
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            render={<Link href={`/underwrite?wallet=${wallet}`} />}
          >
            <ExternalLink aria-hidden className="h-4 w-4" />
            Underwrite
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-fg">
        {generatedAt && <span>Generated {formatTimestamp(generatedAt)}</span>}
        {checksum && (
          <>
            <span aria-hidden>·</span>
            <code className="font-mono text-[0.7rem]">
              sha256 {checksum.slice(0, 16)}…
            </code>
          </>
        )}
        <span aria-hidden>·</span>
        <span>60 s cache · stateless</span>
      </div>
    </div>
  )
}
