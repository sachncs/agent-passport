# Agent Passport — Frontend

Next.js 16 (App Router) + shadcn/ui v4 + Tailwind v4 console for
the Agent Passport trust & underwriting API.

## Stack

- **Next.js 16** (App Router, full SSR)
- **React 19**
- **shadcn/ui v4** (`base-nova` style, `@base-ui/react` primitives)
- **Tailwind CSS v4** (CSS-first config, no `tailwind.config.js`)
- **TanStack React Query** for all server state
- **next-themes** for dark/light persistence
- **Sonner** for toast notifications
- **Vitest** + **Testing Library** + **MSW** for tests

## Layout

```
frontend/
├── proxy.ts                # Next.js 16 proxy (replaces middleware)
├── next.config.ts          # reactStrictMode: true
├── components.json         # shadcn/ui registry config
├── vitest.config.ts
├── src/
│   ├── app/                # App Router routes + file conventions
│   │   ├── layout.tsx      # Root layout: theme, query, site-header
│   │   ├── loading.tsx     # Global Suspense fallback
│   │   ├── error.tsx       # Route error boundary
│   │   ├── global-error.tsx# Root layout crash boundary
│   │   ├── not-found.tsx   # 404
│   │   ├── page.tsx        # Home (Overview)
│   │   ├── score/          # Trust Score
│   │   ├── passport/       # Passport document
│   │   ├── underwrite/     # Underwriting decision
│   │   ├── delegation/     # Delegation graph
│   │   ├── sybil/          # Sybil Check
│   │   ├── reputation/     # Reputation log
│   │   ├── counterparty/   # Counterparty Check
│   │   ├── endorse/        # Endorse / Revoke (HMAC preview)
│   │   ├── discovery/      # Bazaar search
│   │   └── monitor/        # Service health / version
│   ├── components/         # App-level React components
│   │   ├── ui/             # shadcn/ui primitives
│   │   ├── home-page.tsx
│   │   ├── site-header.tsx     # Brand + theme toggle
│   │   ├── wallet-hero-input.tsx # Wallet address input with validation
│   │   ├── risk-badge.tsx   # Color-coded risk level pill
│   │   ├── stat.tsx         # Label-value card
│   │   ├── passport-section.tsx # Collapsible card section
│   │   ├── passport-sections.tsx # Composed dashboard sections
│   │   ├── page-header.tsx # PageHeader, EmptyState, LoadingBlock, ErrorBlock, WalletRequiredAlert
│   │   ├── query-provider.tsx
│   │   └── theme-provider.tsx
│   ├── hooks/
│   │   └── use-mobile.ts
│   ├── lib/
│   │   ├── api.ts          # Typed fetch client (X-Request-ID, Idempotency-Key, 30s timeout)
│   │   ├── api-types.ts    # Response types (mirrors backend OpenAPI shapes)
│   │   ├── utils.ts        # cn() helper
│   │   └── wallet.ts       # Algorand address validation
│   └── test-setup.ts       # jest-dom matchers, matchMedia polyfill
└── public/
```

## Commands

```bash
pnpm install
pnpm dev           # http://localhost:3000 (proxies API to backend on :3000)
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test          # 51 tests across 10 files
pnpm test:watch
pnpm test:ui
pnpm test:coverage
```

The dev server runs on port **3000** (same as the backend). It uses
Next.js rewrites to proxy every API call from `localhost:3000/<path>`
to `localhost:3000/<path>` on the backend — i.e. when you visit
`/score?wallet=...` in the browser, Next.js fetches it from the
Express service transparently. No CORS issues, no env vars required.

If you want a different port, set `PORT=<port>`. To point at a
backend on a different host/port, set `BACKEND_URL`.

## Environment

| Variable                    | Default              | Purpose                                  |
|-----------------------------|----------------------|------------------------------------------|
| `PORT`                      | `3000`               | Port the Next.js dev/start server binds to |
| `BACKEND_URL`               | `http://localhost:3000` | Backend URL that API requests are rewritten to |
| `NEXT_PUBLIC_API_BASE_URL`  | `""` (use rewrites)  | Client-side API base URL; leave empty for the same-origin proxy |

By default, `NEXT_PUBLIC_API_BASE_URL` is empty, so the browser
makes same-origin requests. The Next.js rewrites in
`next.config.ts` then forward them to `BACKEND_URL` on the server
side. This means:

- No CORS configuration needed in dev
- No env vars needed to get started
- The browser never sees the backend URL

If you want the browser to call the backend directly (e.g. in a
production deployment without a reverse proxy), set
`NEXT_PUBLIC_API_BASE_URL=http://your-backend:3000` and disable
the rewrites (or accept the double-hop).

## Conventions

- **Server `page.tsx` + Client `*-client.tsx`**: every page is a
  thin server wrapper around a client component that reads
  `useSearchParams()` and fetches via React Query.
- **No `force-dynamic` exports**: the data is all client-fetched
  through React Query, so the server components can prerender.
- **No `output: "export"`**: we want full SSR so that
  `loading.tsx`, `error.tsx`, and `proxy.ts` work.
- **shadcn primitives in `src/components/ui/`**: never import
  outside the `ui` directory; build feature-specific components
  on top.
- **MSW for tests**: API calls are intercepted by MSW handlers in
  `*.test.tsx` files; the `test-setup.ts` polyfills `matchMedia`
  and sets a default `NEXT_PUBLIC_API_BASE_URL` of
  `http://localhost`.

## Adding a page

1. `src/app/<route>/page.tsx` — server wrapper:

   ```tsx
   import { Suspense } from "react"
   import { MyClient } from "./my-client"
   export default function MyPage() {
     return <Suspense><MyClient /></Suspense>
   }
   ```

2. `src/app/<route>/my-client.tsx` — client component using
   `useSearchParams()` + `useQuery` against `api` in
   `src/lib/api.ts`. Render loading, error, and empty states via
   the helpers in `src/components/page-header.tsx`.

3. `src/app/<route>/my-client.test.tsx` — Vitest + Testing Library
   covering the four states (loading, error, success, empty).

4. Add a nav link in `src/components/site-header.tsx` if the page
   should appear in the header.

## Adding a component

```bash
pnpm dlx shadcn@latest add <component-name>
```

Primitives land in `src/components/ui/<name>.tsx` with their
dependencies. Don't edit them — copy the file and customize if
you need different behavior.