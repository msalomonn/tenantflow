# Verification — TF-00 / TF-01

Latest local validation: 2026-10-26, America/Mexico_City. Environment: local macOS arm64, Node 24.22.1, Docker PostgreSQL 18, Playwright 1.64.1 Chromium. Source: the commit containing this record and its PR head. Versions are locked and the database image is pinned by digest.

| Check | Evidence |
| --- | --- |
| `npm run db:migrate` twice | Repeatable migrations and SQL checksum guard |
| `npm run typecheck` | TypeScript source, tools and tests pass |
| `npm run build` | Production web bundle builds |
| `npm test` | 29 real-PostgreSQL API/integration cases pass |
| `npm run test:e2e` | 12 browser scenarios pass across desktop/mobile |

- TF-A01: real cookies, protected routes, browser sign-in/up/out and immediate revocation.
- TF-A02: atomic owner creation, including a failed membership insert with no partial organization.
- TF-A03/A04: scoped lists, foreign IDs, forged headers, forbidden writes, pooled context reuse and delayed browser responses.
- TF-A05: viewer read/write restriction; owner/member project creation; changed membership applied next request. Owner-only membership management and the full role matrix for current routes are covered in TF-02.
- TF-A06 (partial): names and persistence across API-instance replacement. Edit/archive remain TF-03.
- TF-A07/A08: duplicate additions, self-demotion/removal, immediate access revocation, tenant-scoped targets, simultaneous last-owner changes and rechecking an actor after waiting for a lock.
- TF-A09 (first slice): signup → organization → create/list/search → switch → reload → logout/login, plus console-error and horizontal-overflow checks.

Direct SQL tests use the restricted app role. The administrative test connection only prepares fixtures and inspects atomicity.

The initial harness failed before implementation existed; type checking found a missing CSS declaration. E2E exposed the real signup rate limit: tests now honor Retry-After rather than disabling it. The tenant-switch race is explicitly exercised.

Limits: no deployment, load test, email delivery, complete MVP or production cookie/proxy verification is claimed. Local evidence and remote CI are reported separately. Project edits/archive and organization rename remain open. Membership management is implemented, pending its PR integration.

Screenshots use synthetic data: [desktop](screenshots/workspace-desktop.png), [mobile](screenshots/workspace-mobile.png).

## Authentication body-limit regression

Review of `72bf8898a568c68ddb2302fb2d80d385ca1dc3c9` reproduced signup accepting a 32 KiB name. Before the fix, Content-Length and chunked signup regressions returned 200 instead of 413. Those unexpected signups consumed the real rate-limit bucket, so subsequent positive cases in that initial run received 429; throttling was not disabled.

The JSON parser now enforces a 16 KiB decoded-body limit before the authentication handler. The pinned Better Auth Node adapter supports an already-consumed `req.body`; this compatibility is covered by real signup, sign-in, sign-out and persisted-session checks. Oversized declared, chunked and gzip-expanded bodies return safe 413 JSON, create no user and set no session cookie. A valid body at exactly 16 KiB is accepted; malformed JSON returns safe 400 JSON. The six new tests clean up only their own synthetic accounts. No dependency or schema changes were needed.

This is an agent self-review and correction, not independent reviewer approval. See [review-fix checkpoint](checkpoints/2026-10-25-auth-body-limit.md).

## TF-02 evidence

The first membership contract test failed with 404 before the route existed. Twelve added PostgreSQL cases cover the owner/nonowner boundary, exact-email registration lookup, all roles for existing project writes, foreign organizations/targets, duplicates, last-owner guards, self-removal, next-request revocation, runtime table/function permissions, and disabled account deletion. The race tests hold the organization lock, confirm two HTTP operations are waiting on separate database connections, then release them and check one succeeds and one conflicts while an owner remains. Another test demotes a waiting actor and verifies its action is rejected.

Four additional desktop/mobile scenarios exercise member addition, role changes, removal, read-only UI, focus-driven refresh and delayed member responses after switching organizations. The initial browser run caught an ambiguous role-selector label; an explicit accessible name resolved it. Tests respect real signup throttling. See [membership contract](../specs/001-tenant-isolation/contracts/memberships.md) and [checkpoint](checkpoints/2026-10-25-memberships.md). This is technical self-review; CI on the PR is separate evidence.


## TF-02 mutation-error recovery — 2026-10-26

T009a / TF-A07/A08/A09 fixes the member list disappearing after an unknown-email 404. Before changing application code, the permanent browser regression failed because the owner's row was missing. The UI now reloads authorized members after revalidating access and preserves mutation feedback and entered email separately from list-loading errors. A stale target also recovers automatically; actor demotion/removal still hides management controls and member details. The role-confirmation selector now matches its specific message even while the loading status is visible; cancellation is also checked.

TypeScript, production build and all 29 integration cases passed. All 12 browser scenarios passed (desktop and Chromium mobile emulation), including four new recovery/revocation scenarios. Local browser execution used the repository tests with a temporary configuration that reuses the existing development server; CI runs the canonical `npm run check` with its own server. No manual refresh workaround is used in the regression. This is agent self-review, not independent reviewer approval. See [recovery checkpoint](checkpoints/2026-10-26-membership-error-recovery.md); remote CI and integration status remain on PR #8.
