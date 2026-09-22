# Public experience release audit

Status: completed for the v1.0 OSS release. This report records the evidence
behind the public-site and console readiness work; canonical operating
guidance remains in the linked documentation, not in this historical report.

## Verified surfaces

- Astro marketing site and documentation remain a separate static deployment
  under `/agent-passport/`.
- The Next.js console remains a separate self-hosted deployment and uses the
  same evidence-led brand tokens and canonical mark geometry.
- The public journey is expressed as **unknown agent → observable evidence →
  explainable decision → operational action**.
- Illustrative cards and demo values are labelled as illustrative and do not
  imply a hosted API, identity proof, repayment guarantee, sanctions service,
  or managed SaaS account.
- Source-derived inventory checks compare implemented routes with OpenAPI and
  Postman, and verify environment variables, metrics, alert rules, dashboard
  panels, and console routes.
- Built-site checks verify docs entry points, social metadata, favicon,
  sitemap output, the product journey, and the absence of preview language.
- The release workflow verifies brand synchronization, package versions,
  npm package contents, Python artifacts, API/frontend/site builds, tests,
  coverage, and documentation inventory before publishing.

## Current verification commands

```bash
npm run brand:check
npm run release:check
npm run site:inventory
npm run build:all
npm run test:coverage
npm run check --prefix site
```

Responsive and interaction checks cover the built site at mobile, tablet, and
desktop widths, including base-path navigation, the illustrative profile
interaction, language tabs, keyboard-visible controls, and reduced-motion
styles. The console has route-level loading, error, empty, and not-found
states, with component tests for the shared evidence surfaces.

## Boundaries

The release is OSS/self-hosted, not a hosted SaaS launch. Authentication,
billing, managed sanctions integrations, shared multi-replica state, and
external service-level guarantees remain explicitly documented future or
operator responsibilities. See [known limitations](../known-limitations.md),
[security](../security.md), and [operations](../operations.md).
