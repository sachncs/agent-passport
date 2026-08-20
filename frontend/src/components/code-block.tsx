"use client"

import { useState, type ReactNode } from "react"
import { Copy } from "lucide-react"

import { cn } from "@/lib/utils"

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
  children?: ReactNode
}

export function CodeBlock({
  code,
  language = "bash",
  className,
  children,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-surface-2/80 ring-1 ring-foreground/5",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
          {language}
        </span>
        <button
          type="button"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard.writeText(code).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              })
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[0.7rem] font-medium text-muted-fg transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          <Copy aria-hidden className="h-3 w-3" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-foreground">
        <code className="font-mono">{children ?? code}</code>
      </pre>
    </div>
  )
}
