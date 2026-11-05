# Verification — TF-04

Date: 2026-11-05, America/Argentina/Buenos_Aires. Environment: macOS arm64, Node 24.22.1 / npm 11.19.1, Docker PostgreSQL 18, Playwright 1.64.1 Chromium. Baseline: merged TF-03 commit `49c10c30f70cbbd4165be016c2e0c405724ceb3e`. Exact source head and remote CI are recorded in the PR. This record covers local acceptance hardening, not deployment.

Local result: `npm run check` passed TypeScript, production web build, **43 integration cases and 24 desktop/mobile browser scenarios**; `npm run audit` reported zero vulnerabilities. Four new screenshots were visually inspected.

## Complete MVP acceptance mapping

Paths below are relative to the repository root. Commands: `npm run check` (types, production web build, integration and browser tests) and `npm run audit` (all lockfile dependencies).

| Criterion | Reproducible coverage |
| --- | --- |
| TF-A01 | `tests/integration/isolation.test.ts` real cookies and persisted sign-out; `boundaries.test.ts` checks absent/forged/expired/revoked sessions across every protected route and rejects incorrect passwords. `tests/e2e/boundaries.spec.ts` loses a real session while editing and verifies login replaces the workspace and dialog. |
| TF-A02 | `tests/integration/isolation.test.ts` verifies owner creation and deliberately fails owner insertion, checking the organization transaction rolls back. |
| TF-A03 | `isolation.test.ts` scoped lists and pooled context/rollback; `tests/e2e/workspace.spec.ts`, `memberships.spec.ts`, `projects.spec.ts` delay responses and switch organizations, asserting old lists/mutations cannot overwrite the current workspace. |
| TF-A04 | `isolation.test.ts`, `memberships.test.ts`, `projects.test.ts` exercise foreign/guessed IDs, forged tenant context and direct restricted-role SQL, with rejected reads/writes and unchanged data. |
| TF-A05 | `memberships.test.ts` and `projects.test.ts` cover owner/admin/member/viewer permissions for creation, editing, archive, organization rename and owner-only membership management. Browser cases verify controls and authoritative refresh after role changes. |
| TF-A06 | `isolation.test.ts` and `projects.test.ts` replace the API instance against persistent PostgreSQL; validate trimmed 1–120 code-point names, reject invalid fields, retain archived rows/timestamps and hide them from default lists. `boundaries.spec.ts` rejects whitespace/overlong drafts before sending a mutation and renders markup-like names as inert text. |
| TF-A07 | `memberships.test.ts` rejects duplicates and last-owner changes, including simultaneous updates/deletes and duplicate additions on independently blocked database connections. `memberships.spec.ts` covers corresponding UI feedback. |
| TF-A08 | `memberships.test.ts` and `projects.test.ts` enforce demotion/removal on the next request and reject foreign relationships; a waiting actor is rechecked after a lock. Browser tests verify access refresh never restores revoked details. |
| TF-A09 | `workspace.spec.ts` covers signup, organization/project creation, search, switching, reload and sign-in. Membership/lifecycle cases cover loading, empty, denied and recoverable error states, cancel/pending dialogs, console/overflow assertions and desktop/mobile rendering. |

Additional boundaries: `auth-body-limit.test.ts` covers declared/chunked/gzip-expanded oversized authentication bodies, malformed JSON and exact-size success. `boundaries.test.ts` checks exact Origin and JSON on every unsafe protected route, unsafe database runtime roles, production HTTPS/secret configuration and Secure/HttpOnly/SameSite cookie attributes. The latter uses a local HTTP harness configured for an HTTPS origin; it does **not** test deployed TLS/proxy behavior.

TF-04 adds six integration cases and two browser scenarios per viewport. The production-cookie test initially hit the real signup rate limit; its harness now honors bounded Retry-After before retrying. A fixture-header TypeScript error was corrected before the successful run. Existing application behavior satisfied the new assertions: no application, schema or dependency-version changes were needed. Browser fixtures remain synthetic local data; the new integration suite deletes its own accounts and organization.

CI now checks repeat setup preserves credentials byte-for-byte, applies migrations twice to a fresh runner database, and blocks on any npm advisory or registry failure. Local results and the clean Linux checkout execution are separate evidence. See [dependency review and raw audit](dependency-review.md).

New screenshots: [revoked session desktop](screenshots/hardening-session-desktop.png), [mobile](screenshots/hardening-session-mobile.png), [invalid draft desktop](screenshots/hardening-validation-desktop.png), [mobile](screenshots/hardening-validation-mobile.png). The capture shows the final safe UI; preceding assertions establish the transition and blocked mutation.

Limits: Chromium desktop/mobile emulation only; no Safari/Firefox, load test, deployed smoke, email delivery, production proxy/TLS, backup/restore rehearsal, public quotas/retention or licensing review. These remain release work. See [TF-04 checkpoint](checkpoints/2026-11-05-acceptance-hardening.md) and [release checklist](release-checklist.md).

---

# Historical verification — TF-03

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
