"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
  variant?: "default" | "ghost" | "outline"
  size?: "default" | "xs" | "sm" | "icon" | "icon-xs" | "icon-sm"
}

export function CopyButton({
  value,
  label = "Copy",
  className,
  variant = "ghost",
  size = "icon-sm",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("text-muted-fg", className)}
      aria-label={copied ? "Copied" : label}
      onClick={() => {
        if (typeof navigator === "undefined" || !navigator.clipboard) return
        navigator.clipboard.writeText(value).then(() => setCopied(true))
      }}
    >
      {copied ? (
        <Check aria-hidden className="h-3.5 w-3.5 text-verified" />
      ) : (
        <Copy aria-hidden className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}
