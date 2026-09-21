import type { Metadata } from "next"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import { QueryProvider } from "@/components/query-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ThemeProvider } from "@/components/theme-provider"

import "./globals.css"

export const metadata: Metadata = {
  title: "Agent Passport — Trust & Underwriting for AI Agents on Algorand",
  description:
    "Open-source trust scoring, delegation, credit, sybil, reputation, " +
    "and underwriting signals for AI agents on Algorand.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="font-sans"
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <TooltipProvider delay={150}>
              <div className="flex min-h-screen flex-col">
                <SiteHeader />
                <main className="flex-1 px-4 py-10 md:px-8 md:py-14">
                  <div className="mx-auto w-full max-w-5xl">{children}</div>
                </main>
                <SiteFooter />
              </div>
              <Toaster position="top-right" />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
