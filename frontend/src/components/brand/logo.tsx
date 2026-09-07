import { cn } from "@/lib/utils"

interface LogoProps {
  size?: number
  variant?: "mark" | "wordmark" | "full"
  className?: string
}

const TAGLINE = "Trust & underwriting for AI agents on Algorand"

export function Logo({
  size = 28,
  variant = "mark",
  className,
}: LogoProps) {
  if (variant === "mark") {
    return (
      <Mark
        size={size}
        aria-label="Agent Passport"
        className={className}
      />
    )
  }

  const wordmarkSize = Math.round(size * 0.42)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      <Mark
        size={size}
        aria-hidden="true"
      />
      {variant === "wordmark" ? (
        <span
          className="leading-none"
          style={{ fontSize: wordmarkSize }}
        >
          Agent Passport
        </span>
      ) : (
        <span className="flex flex-col leading-tight">
          <span
            className="leading-none"
            style={{ fontSize: wordmarkSize }}
          >
            Agent Passport
          </span>
          <span
            className="font-normal text-muted-fg"
            style={{ fontSize: Math.round(wordmarkSize * 0.45) }}
          >
            {TAGLINE}
          </span>
        </span>
      )}
    </span>
  )
}

function Mark({
  size,
  className,
  ...props
}: {
  size: number
  className?: string
} & React.SVGProps<SVGSVGElement>) {
  const stroke = Math.max(1, size / 16)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      className={cn("shrink-0 text-foreground", className)}
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <line x1="7" y1="9" x2="17" y2="9" />
      <line x1="7" y1="13" x2="13" y2="13" />
      <circle cx="17" cy="16" r="1.25" />
    </svg>
  )
}
