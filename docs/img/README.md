# docs/img/

This directory will host the visual assets that back the README
"Premium dark-first SaaS console" claim:

- `/dashboard` verdict-first report
- `/endorse` developer surface
- dark/light theme comparison

Regeneration procedure (once a hosted demo is live at
`https://sachncs.github.io/agent-passport/`):

1. Run `pnpm web:dev` in the repo root, then open
   `http://localhost:3001/dashboard`, `/endorse`, etc.
2. Capture the screenshots with `npx playwright screenshot --viewport-size=1280,720
   http://localhost:3001/dashboard docs/img/dashboard-dark.png`.
3. Toggle the theme via the SiteHeader pill and capture the
   light variant alongside.
4. Optimize with `npx squoosh-cli --webp docs/img/dashboard-dark.png` if
   any file exceeds 500 KB.

Until the demo is hosted, the README shows an ASCII terminal
capture of the same `/score` response so the claim is at least
textually verifiable.
