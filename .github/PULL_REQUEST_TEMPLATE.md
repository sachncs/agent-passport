# Pull Request

<!--
Thanks for opening a pull request!

Please fill in every section below. Incomplete PRs are much slower to
review. If you are unsure about something, write a note in the relevant
section rather than leaving it blank.
-->

## Summary

<!-- One short paragraph explaining the change. -->

## Related Issue

<!-- Use "Fixes #123" or "Refs #123" so the issue is auto-linked. -->

Fixes #

## Changes

<!-- A bullet list of the changes in this PR. Group by area. -->

- …
- …

## Testing

<!-- How did you test this change? Include commands, expected vs actual
     output, and any new tests you added. -->

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `SKIP_E2E=1 npm test` passes
- [ ] I added new unit tests for the change
- [ ] I added or updated the OpenAPI / Postman specs (if endpoints changed)
- [ ] I added or updated `docs/` (if user-facing behaviour changed)
- [ ] I added a CHANGELOG entry under `[Unreleased]`

## Breaking Changes

<!-- If yes, describe the migration path. -->

- [ ] Yes (describe below)
- [ ] No

## Screenshots / Logs

<!-- Optional but helpful for UI / observability changes. -->

## Checklist

- [ ] My code follows the project's [contribution guide](../CONTRIBUTING.md)
- [ ] I have read the [code of conduct](../CODE_OF_CONDUCT.md)
- [ ] I have linked the related issue above
- [ ] My branch is up to date with `master`
- [ ] I have squashed / organised my commits logically
- [ ] New / changed code is covered by tests
- [ ] All new public APIs are documented (JSDoc / docstrings / README)
- [ ] No `TODO` / `FIXME` / `XXX` markers were added
- [ ] No new secrets, mnemonics, or keys are included
