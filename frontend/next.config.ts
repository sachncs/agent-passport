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
    return API_PATHS.map((p) => ({
      source: `/${p}`,
      destination: `${BACKEND_URL}/${p}`,
    }))
  },
}

export default nextConfig