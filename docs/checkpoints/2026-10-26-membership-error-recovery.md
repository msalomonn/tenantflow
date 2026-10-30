# TF-02 mutation-error recovery — 2026-10-26

Base: `7011b3eebfb0b1a1ec1816612e099c18bd5dd463`. Branch: `feat/3-membership-management`. Source: the commit containing this checkpoint. Issue #3 / PR #8, T009a, TF-A07/A08/A09. No merge or deployment is claimed.

## Reproduction and specified outcome

An owner adds an unregistered email in Members. The API correctly returns 404, but the old handler clears the list and refreshes organizations without reloading members when ownership is unchanged. The member rows disappear until a manual refresh. A concurrently deleted target has the same failure path. A broad confirmation selector also fails when the success and loading status are simultaneously present.

The membership contract and plan now require automatic authoritative list recovery, persistent actionable feedback/input, and no restored member details after access revocation. This is a bounded correction within the approved membership scope, not a new feature package.

## Red → green

Before editing application code, the permanent `membership errors recover the authoritative list and keep actionable feedback` test failed on desktop: the owner's row was absent after the unknown-email response. After the fix, the recovery and revoked-access scenarios passed on desktop/mobile (4 cases).

`Members.tsx` separates mutation feedback from list-loading errors and schedules a list reload after the 403/404 organization-access refresh. Existing organization keys, abort handling and owner-only rendering remain in place. A specific success-message selector avoids ambiguity with the loading status.

## Final local validation

- Environment: macOS arm64, pinned Node 24.22.1, PostgreSQL 18 and Playwright Chromium; mobile is emulation, not a physical device.
- `npm run typecheck`, `npm run build`, `npm test`: passed; 29 integration cases.
- `node node_modules/@playwright/test/cli.js test --config ../../work/tf02-fix/playwright.config.mjs`: 12/12 browser scenarios passed. The temporary config selects the unchanged repository test directory, desktop/mobile projects, single worker and 30-second timeout; it only redirects test artifacts and reuses the existing local development server. CI uses the repository configuration and owns its server.
- New permanent checks cover duplicate/unknown-email failures, stale target removal, preserved input/error, successful retry, actor demotion (403) and removal (404). Existing cancellation, role changes, last-owner, tenant-switch and project flows also pass.
- `git diff --check`: passed. Generated screenshots were restored from their pre-run copies to avoid unrelated fixture changes.

Self-review checked error lifecycle, server-authoritative access refresh, lack of reload loops, organization-switch isolation and the regression assertions. No API, database, dependency or permission changes. No independent reviewer approval. Spec Kit prerequisites were checked; no feature checklists or pre/post implementation extension hooks are present. T010–T012 remain outside this correction. CI status belongs to the PR and must be checked against its new head.


## Visual evidence captured 2026-10-30

Application source: `89c19d138d490a32d2489dd51c5cba0d1b5b1012`. Four targeted browser scenarios passed (owner management and error recovery, each on desktop and Chromium mobile emulation). A temporary copy of the repository browser tests added screenshot calls after the assertions; it used the local development server and synthetic accounts. No application or permanent test code changed for these captures. Images were visually inspected before inclusion.

- Unknown-email 404: the error and entered email remain visible while both authorized members reload automatically, without clicking Refresh members: [desktop](../screenshots/membership-recovery-desktop.png), [mobile](../screenshots/membership-recovery-mobile.png). TF-A07/A09, T009a.
- Last-owner removal is rejected and the owner remains listed: [desktop](../screenshots/membership-last-owner-desktop.png), [mobile](../screenshots/membership-last-owner-mobile.png). TF-A07.

These captures show the resulting UI states. Automated assertions and the linked CI logs establish the behavior; still images alone do not establish concurrency or server authorization.
