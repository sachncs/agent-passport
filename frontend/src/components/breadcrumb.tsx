"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const LABELS: Record<string, string> = {
  "": "Overview",
  score: "Trust Score",
  passport: "Passport",
  underwrite: "Underwrite",
  delegation: "Delegation",
  sybil: "Sybil Check",
  reputation: "Reputation",
  counterparty: "Counterparty",
  endorse: "Endorse / Revoke",
  discovery: "Bazaar",
  monitor: "Monitor",
}

export function AppBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" />}>Overview</BreadcrumbLink>
        </BreadcrumbItem>
        {segments.length > 0 && <BreadcrumbSeparator />}
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/")
          const label = LABELS[segment] ?? segment
          const isLast = index === segments.length - 1
          return (
            <BreadcrumbItem key={href}>
              {isLast ? (
                <BreadcrumbPage>{label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href={href} />}>
                  {label}
                </BreadcrumbLink>
              )}
              {!isLast && <BreadcrumbSeparator />}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}