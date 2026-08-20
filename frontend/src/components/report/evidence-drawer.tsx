import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface EvidenceItem {
  id: string
  title: string
  count?: string
  summary?: string
  children: React.ReactNode
}

interface EvidenceDrawerProps {
  items: EvidenceItem[]
  defaultOpen?: string[]
  className?: string
}

export function EvidenceDrawer({
  items,
  defaultOpen,
  className,
}: EvidenceDrawerProps) {
  if (items.length === 0) return null
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-2/40 shadow-[var(--shadow-xs)] ring-1 ring-foreground/5",
        className,
      )}
    >
      <div className="border-b border-border/60 px-5 py-3">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-fg">
          Evidence
        </span>
        <span className="ml-3 text-xs text-muted-fg">
          Open a section to view underlying detail
        </span>
      </div>
      <Accordion defaultValue={defaultOpen}>
        {items.map((item) => (
          <AccordionItem
            key={item.id}
            value={item.id}
            className="border-b border-border/40 last:border-b-0"
          >
            <AccordionTrigger className="px-5 py-3 hover:no-underline">
              <span className="flex items-center gap-3">
                <ChevronRight
                  aria-hidden
                  className="h-3.5 w-3.5 text-muted-fg transition-transform group-aria-expanded/accordion-trigger:rotate-90"
                />
                <span className="text-sm font-medium text-foreground">
                  {item.title}
                </span>
                {item.count && (
                  <span className="text-xs text-muted-fg">
                    {item.count}
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              {item.summary && (
                <p className="mb-3 text-sm text-muted-fg">
                  {item.summary}
                </p>
              )}
              {item.children}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
