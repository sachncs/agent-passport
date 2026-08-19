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
│   │   ├── layout.tsx      # Root layout: theme, query, sidebar, topbar
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
│   │   ├── sidebar.tsx     # AppSidebar + SidebarWrapper
│   │   ├── topbar.tsx
│   │   ├── breadcrumb.tsx  # AppBreadcrumb
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
pnpm dev           # http://localhost:3001 (with backend on :3000)
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test          # 58 tests across 12 files
pnpm test:watch
pnpm test:ui
pnpm test:coverage
```

## Environment

| Variable                    | Default              | Purpose                                  |
|-----------------------------|----------------------|------------------------------------------|
| `NEXT_PUBLIC_API_BASE_URL`  | `""` (same origin)   | Base URL for the Agent Passport backend  |

When `NEXT_PUBLIC_API_BASE_URL` is empty, the frontend calls the
backend at the same origin (use a reverse proxy in production).

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

4. Register the nav item in `src/components/sidebar.tsx` and
   add a label to `LABELS` in `src/components/breadcrumb.tsx`.

## Adding a component

```bash
pnpm dlx shadcn@latest add <component-name>
```

Primitives land in `src/components/ui/<name>.tsx` with their
dependencies. Don't edit them — copy the file and customize if
you need different behavior.