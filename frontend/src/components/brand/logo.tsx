import { cn } from "@/lib/utils"

interface LogoProps {
  size?: number
  variant?: "mark" | "wordmark" | "full"
  className?: string
}

const TAGLINE = "Evidence-led trust infrastructure for AI agents"

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
      viewBox="0 0 64 64"
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
      <path d="M16 52V12h34v40H16Z" />
      <path d="M24 12v40" />
      <path d="M31 22h11M31 29h7M31 36h11" />
      <path d="M50 12h7v7" />
      <circle cx="50" cy="12" r="4.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
