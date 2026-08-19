import type { NextConfig } from "next"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000"

const API_PATHS = [
  "health",
  "version",
  "ready",
  "metrics",
  "openapi.json",
  "score",
  "delegation",
  "sybil-check",
  "reputation",
  "underwrite",
  "trust-graph",
  "passport",
  "verify",
  "discovery/search",
  "reputation/record",
  "reputation/subscribe",
  "counterparty-check",
  "credit-estimate",
  "delegate",
  "revoke",
] as const

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // beforeFiles: API path rewrites take precedence over the
      // app router filesystem (e.g. /score/page.tsx). The array
      // form of rewrites() runs AFTER the filesystem check, which
      // means the app route shadows the rewrite and the page is
      // rendered instead of the request being proxied. Using
      // beforeFiles is the documented way to override a route
      // with an external proxy.
      beforeFiles: API_PATHS.map((p) => ({
        source: `/${p}`,
        destination: `${BACKEND_URL}/${p}`,
      })),
    }
  },
}

export default nextConfig