# Agent Passport — Site

Premium product marketing site for the Agent Passport trust API. Static
output, deployed to GitHub Pages at `sachncs.github.io/agent-passport/`.

## Stack

- **[Astro 5](https://astro.build)** — static-first framework, islands architecture
- **[Tailwind CSS v4](https://tailwindcss.com)** — CSS-first configuration, `@theme` tokens
- **TypeScript** — strict mode via `astro/tsconfigs/strict`
- **[@fontsource-variable](https://fontsource.org)** — self-hosted Inter + JetBrains Mono + Instrument Serif
- **[@astrojs/sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/)** — auto-generated `sitemap-index.xml`

## Layout

```
site/
├── astro.config.mjs     # base: '/agent-passport', output: 'static'
├── public/              # favicon (SVG)
└── src/
    ├── layouts/
    │   └── BaseLayout.astro          # head, theme bootstrap, JSON-LD
    ├── pages/
    │   └── index.astro               # composes the page
    ├── styles/
    │   ├── globals.css               # Tailwind v4 import + utility bridges
    │   └── tokens.css                # color/ink/surface tokens (theme-aware)
    └── components/
        ├── brand/                    # Mark, Logo
        ├── layout/                   # Header (glass), Footer, Container
        ├── ui/                       # Button, Eyebrow, Pill, Reveal (pass-through)
        ├── mockups/                  # ScoreCard, DelegationGraph, SybilHeatmap, PassportDoc
        └── sections/                 # Hero, TrustStrip, ValueProps, ProductScore,
                                      # ProductDelegation, ProductSybil, Features,
                                      # HowItWorks, CodeSample, SDKs, Security,
                                      # Metrics, CTA
```

## Design system

`src/styles/tokens.css` defines the full design system:

- **Surfaces:** `canvas`, `surface-1/2/3` (3-tier elevation)
- **Ink:** `ink-1` (high contrast), `ink-2`, `ink-3` (muted)
- **Accent:** emerald (`oklch(0.78 0.16 162)`) — reserved for verdicts, CTAs, verified states
- **Hairline borders** preferred over shadows for restraint
- **Type:** Inter Variable (UI), JetBrains Mono Variable (code), Instrument Serif (editorial)

Tokens are theme-aware: `:root` defines the dark palette, `:root.light` (and `prefers-color-scheme: light`) overrides with the light palette. Tailwind utilities like `bg-surface-1` and `text-ink-1` automatically resolve to the active theme.

## Commands

```bash
cd site
npm install
npm run dev        # http://localhost:4321/agent-passport/
npm run build      # → site/dist/
npm run preview    # serve dist/ locally
npm run check      # astro check (types + a11y)
```

## Deployment

Pushed to `master` → `.github/workflows/site.yml` runs:

1. `npm ci` in `site/`
2. `npm run build` → `site/dist/`
3. `actions/upload-pages-artifact` with `path: site/dist`
4. `actions/deploy-pages` → `sachncs.github.io/agent-passport/`

The base path is set to `/agent-passport` in `astro.config.mjs`, so all asset URLs resolve at the project subpath. Local previews mount the same prefix.

## Conventions

- **Components are `.astro` files** with a TypeScript frontmatter section and an HTML template. No React, no client-side JS by default.
- **Mockups are stylized mock data**, not live API calls. The numbers come from the documented algorithm shapes in `../docs/concepts.md`.
- **Theme is system-preference-driven** with a header toggle that persists to `localStorage`. The `prefers-color-scheme` media query respects the user's OS.
- **Copy is written fresh from the docs**, not rendered from markdown. All external links go to GitHub, npm, or the docs tree.
- **The developer console at `../frontend/`** is a separate app. The public
  site links to the local-first documentation and clearly labels the console
  as a separately deployed surface.

## Adding a section

1. Create `src/components/sections/<Name>.astro`.
2. Use `Container` for max-width + gutters.
3. Add an `<Eyebrow>` + `<h2>` headline + supporting copy.
4. Compose mockups from `src/components/mockups/`.
5. Import and add to `src/pages/index.astro` in the desired order.
6. Run `npm run build` — no rebuild needed for the dev console or API server.
