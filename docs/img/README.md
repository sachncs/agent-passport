# docs/img/

This directory hosts optional visual assets for the developer and operations
console:

- `/dashboard` verdict-first report
- `/endorse` developer surface
- dark/light theme comparison

Regeneration procedure for a release (the public site is static and the
console is run locally or self-hosted):

1. Run `npm run dev --workspace=@agent-passport/web`, then open
   `http://localhost:3001/dashboard`, `/endorse`, etc.
2. Capture the screenshots with `npx playwright screenshot --viewport-size=1280,720
   http://localhost:3001/dashboard docs/img/dashboard-dark.png`.
3. Toggle the theme via the SiteHeader pill and capture the
   light variant alongside.
4. Optimize with `npx squoosh-cli --webp docs/img/dashboard-dark.png` if
   any file exceeds 500 KB.

The public marketing site is static and the console is a separate local or
self-hosted application; screenshots should be regenerated from the same
commit as the release notes that reference them.
