# Verification — TF-03

Date: 2026-11-05, America/Argentina/Buenos_Aires. Environment: macOS arm64, Node 24.22.1, Docker PostgreSQL 18, Playwright 1.64.1 Chromium. Source: the commit containing this record; exact source head and remote CI are recorded in the PR.

Local `npm run check` passed: TypeScript, production web build, **37 real-PostgreSQL integration cases and 20 desktop/mobile browser scenarios**. A strengthened concurrency case was then rerun successfully with the lifecycle integration file; the two lifecycle browser cases were rerun to capture the archive dialog at viewport size. No dependency changes, user data resets or public deployment were required.

| Acceptance / contract | Evidence |
| --- | --- |
| TF-A03/A04, P02/P06 | Tenant-scoped PATCH, guessed/foreign project IDs, forged headers, no unauthorized changes; default lists exclude archives. Existing delayed list tests plus a cancelled late mutation test keep the selected organization clear of stale data. |
| TF-A05, P02/P04 | All four roles: owner/admin/member project rename/archive; viewer 403; organization rename only owner/admin. Direct restricted-role SQL rejects foreign/viewer updates and tenant-column changes. |
| TF-A06, P01/P03 | Trimmed 1–120 code-point names, Unicode limits, null-byte/unknown-field rejection; repeated archive preserves timestamp; archived edit returns 409; detail retains metadata and DB row. Rename/archive and organization name persist across API-instance replacement. |
| TF-A08, P02/P06 | Real membership demotion and removal reject the next mutation; browser refreshes authoritative role/access and removes stale controls/forms. |
| TF-A09, P05/P06 | Edit prefill/cancel/save, organization rename, archive confirmation/cancel/success/reload, viewer controls, pending/error/empty states, draft retention after injected 503, stale archived-target recovery and list retry. Console/overflow checks accompany the main lifecycle scenario. |
| P03 concurrency | An admin transaction holds the project row; tests observe **three independent runtime connections waiting for locks** before releasing simultaneous archive/archive/rename requests. Both archives preserve one timestamp; rename either precedes archive or returns 409. |

`tests/integration/projects.test.ts` adds 8 cases. Before implementation, 7 failed (missing endpoints/UPDATE grants) and the existing unauthenticated/foreign rejection path passed. After implementation all 8 pass. The first lifecycle browser test also failed before UI changes because Edit did not exist. `tests/e2e/projects.spec.ts` adds four scenarios across two viewports; the original 12 browser scenarios still pass. Rate-limit waits honor real Retry-After values, not a test bypass.

The 503 cases are response fault injections. The late-edit test deliberately forces the workspace selector while a modal request is pending, verifies cancellation, then releases its response; it exercises the unmount boundary, not an ordinary click-through of a modal. Integration concurrency/revocation and persistence use real PostgreSQL. Fixtures are synthetic; integration fixtures are removed, while browser fixtures remain in the local database as before.

Screenshots visually inspected: [edited desktop](screenshots/projects-edited-desktop.png), [edited mobile](screenshots/projects-edited-mobile.png), [confirmation desktop](screenshots/projects-archive-confirm-desktop.png), [confirmation mobile](screenshots/projects-archive-confirm-mobile.png), [archived desktop](screenshots/projects-archived-desktop.png), [archived mobile](screenshots/projects-archived-mobile.png). Workspace/member screenshots were refreshed by the full suite. No screenshot contains production data or credentials.

Self-review covered API field/role/tenant boundaries, UPDATE column grants/RLS, archive serialization, request cancellation and UI recovery. No blocking finding remains for TF-03. This is implementing-agent self-review, not independent approval. [Checkpoint](checkpoints/2026-11-05-project-lifecycle.md) records SDD and handoff.

Limits: no restore/archive-browser UI, hard deletion, collaborative conflict detection, deployment, load test, new dependency/vulnerability audit, production cookie/proxy validation or email delivery. TF-04 owns the complete acceptance/dependency hardening pass; TF-05 owns deployment. Existing authorization assumptions and documented local-development limits remain.

---

## Historical TF-00 / TF-01 / TF-02 verification

The records below describe prior revisions; their pending-feature notes are historical. TF-02 merged in PR #8 on 2026-10-30.

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
