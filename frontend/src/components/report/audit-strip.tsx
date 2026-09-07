"use client"

import { cn } from "@/lib/utils"
import { useNetwork } from "@/components/use-network"

interface AuditStripProps {
  modelVersion?: string
  cacheTtl?: string
  className?: string
  children?: React.ReactNode
}

export function AuditStrip({
  modelVersion = "v0.1",
  cacheTtl = "60 s",
  className,
  children,
}: AuditStripProps) {
  const network = useNetwork()

  return (
    <div
      role="note"
      aria-label="Audit & provenance"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 px-1 py-3 text-xs text-muted-fg",
        className,
      )}
    >
      <Item label="Network" value={network ?? "—"} />
      <Item label="Model" value={modelVersion} />
      <Item label="Cache" value={cacheTtl} />
      {children}
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="uppercase tracking-[0.14em]">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </span>
  )
}
