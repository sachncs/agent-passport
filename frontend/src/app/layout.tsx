import type { Metadata } from "next"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import { QueryProvider } from "@/components/query-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ThemeProvider } from "@/components/theme-provider"

import "./globals.css"

export const metadata: Metadata = {
  title: "Agent Passport — Evidence-led trust infrastructure",
  description:
    "Evidence-led, open-source trust scoring, delegation, credit, Sybil, " +
    "reputation, and underwriting signals for AI agents on Algorand.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Agent Passport — Evidence-led trust infrastructure",
    description:
      "Evidence-led, open-source trust and risk signals for AI agents on Algorand.",
    type: "website",
    siteName: "Agent Passport",
    images: [
      {
        url: "https://sachncs.github.io/agent-passport/social-preview.svg",
        width: 1200,
        height: 630,
        alt: "Agent Passport — evidence-led trust infrastructure for AI agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent Passport — Evidence-led trust infrastructure",
    description:
      "Evidence-led, open-source trust and risk signals for AI agents on Algorand.",
    images: ["https://sachncs.github.io/agent-passport/social-preview.svg"],
  },
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
