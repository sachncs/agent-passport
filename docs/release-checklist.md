# v1.0 release checklist

This is the single release gate for Agent Passport. Check every item against
the commit being released.

## Product and brand

- [ ] Canonical brand assets are used by both frontend surfaces.
- [ ] Light, dark, mobile, keyboard, and reduced-motion reviews pass.
- [ ] Marketing claims are source-backed or labelled illustrative.
- [ ] Metadata, favicon, sitemap, and social preview are verified.

## API and packages

- [ ] API lint, typecheck, tests, coverage, and build pass.
- [ ] OpenAPI and Postman match the implemented route inventory.
- [ ] TypeScript and Python SDKs build, test, and install cleanly.
- [ ] No undocumented breaking API or SDK changes are included.

## Operations and security

- [ ] Environment variables, metrics, alerts, and runbooks are documented.
- [ ] Deployment, persistence, scaling, shutdown, and backup assumptions are
      documented.
- [ ] Known limitations are reviewed and linked from the README.
- [ ] Security disclosure and support paths are reachable.

## OSS release

- [ ] CHANGELOG contains the release entry and migration notes.
- [ ] README and site no longer use preview or unfinished-work language.
- [ ] Fresh-clone setup succeeds using documented commands.
- [ ] `npm run release:check` passes.
- [ ] GitHub Actions, package metadata, license, and contributor guidance are
      reviewed before tagging.
