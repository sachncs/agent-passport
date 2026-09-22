# Agent Passport brand

The `brand/` directory is the canonical source for the public identity used by
the Astro site, the Next.js console, package documentation, and release assets.

## Direction

Agent Passport is editorial infrastructure: a calm, evidence-led layer that
turns observable agent behavior into decisions. The identity uses an evidence
folio, a visible record spine, and a single signal point. It should feel
precise and credible without implying identity proof, a security guarantee, or
an official passport document.

## Usage

The canonical files in this directory are the source of truth. Derived favicons
and the inline mark implementations in `site/` and `frontend/` are checked for
drift with:

```bash
npm run brand:check
```

The same check runs in CI and as part of `npm run release:check`.

- Use `assets/mark.svg` on dark or light surfaces where the accent signal is
  visible.
- Use `assets/mark-mono.svg` for monochrome contexts, documents, and embossing.
- Use `assets/wordmark.svg` for a compact product lockup.
- Use `assets/lockup-dark.svg` or `assets/lockup-light.svg` for launch,
  documentation, and social collateral.
- Keep clear space equal to the width of the signal point on all sides.
- Do not rotate, stretch, add gradients, or place the mark inside a literal
  passport/badge illustration.
- The product name is **Agent Passport**. The approved descriptor is
  **Evidence-led trust infrastructure for AI agents.**

Minimum mark size: 16 px in product UI and 24 px in marketing/navigation.
