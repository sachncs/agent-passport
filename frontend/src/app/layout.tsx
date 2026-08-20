import type { Metadata } from "next"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import { QueryProvider } from "@/components/query-provider"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"

import "./globals.css"

export const metadata: Metadata = {
  title: "Agent Passport — Trust & Underwriting Console",
  description:
    "Stateless trust scoring, delegation, credit, sybil, reputation, " +
    "and underwriting for AI agents on Algorand.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
                <footer className="border-t border-border/60 px-4 py-4 text-xs text-muted-foreground md:px-8">
                  <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
                    <span>
                      Agent Passport — trust and underwriting for AI agents on
                      Algorand.
                    </span>
                    <span>
                      <a
                        href="/openapi.json"
                        className="underline-offset-2 hover:underline"
                      >
                        OpenAPI
                      </a>
                      {" · "}
                      <a
                        href="/health"
                        className="underline-offset-2 hover:underline"
                      >
                        /health
                      </a>
                      {" · "}
                      <a
                        href="/metrics"
                        className="underline-offset-2 hover:underline"
                      >
                        /metrics
                      </a>
                    </span>
                  </div>
                </footer>
              </div>
              <Toaster position="top-right" />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}