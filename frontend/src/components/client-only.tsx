"use client"

import { useEffect, useState, type ReactNode } from "react"

interface ClientOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Returns `fallback` during SSR + first paint, then renders `children`
 * after `useEffect` mounts on the client. Use to wrap libraries that
 * don't SSR cleanly (e.g. recharts ResponsiveContainer, which reports
 * width=-1 / height=-1 before its first measurement settles).
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])
  if (!mounted) return <>{fallback}</>
  return <>{children}</>
}
