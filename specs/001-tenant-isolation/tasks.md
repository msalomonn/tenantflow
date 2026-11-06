# TenantFlow implementation decomposition

The table defines the backlog; the checklist records verified implementation progress. GitHub Issues own live status; see [issue index](../../docs/backlog.md#issue-index).

| ID | Work | Depends on | Acceptance/evidence |
| --- | --- | --- | --- |
| TF-00 | Choose identity/session approach; scaffold React/Node and PostgreSQL; pin dependencies | Approved constitution/MVP | ADR, repeatable startup, session/CSRF test plan |
| TF-01 | Authenticated organization/project create/list slice with isolation | TF-00 | TF-A01–A05 and A09 for initial routes, real DB + browser evidence |
| TF-02 | Membership management and full role matrix | TF-01 | TF-A05, A07, A08; concurrent last-owner test |
| TF-03 | Project edit/archive and complete UI states | TF-01 | TF-A03–A06, A09; tenant-switch cache test |
| TF-04 | Integration/E2E hardening and CI | TF-02, TF-03 | All TF-A criteria mapped to checks, dependency scan reviewed |
| TF-05 | Deploy, English docs, screenshots and demo | TF-04; hosting decision | Deployed smoke, no dev-auth mode, synthetic fixtures, release checklist |

For TF-01, implement schema/migrations, request identity+membership boundary, create/list routes, UI, negative integration tests and E2E as small dependent changes. Do not start unrelated full-app features before verifying the slice.

## Executable task checklist

T001–T008 were merged in PR #7 on 2026-10-25. T009/T009a merged in PR #8 on 2026-10-30. T010 merged in PR #9 on 2026-11-05. T011 is implemented and locally verified; its PR owns review/integration. See the [checkpoint](../../docs/checkpoints/2026-10-25-first-slice.md). Issue state remains authoritative for review/merge. Initial API modules are `apps/api/src/auth.ts` and `apps/api/src/app.ts`; later tasks can split route modules as their scope grows.

- [x] T001 Record identity/session choice, CSRF protections and supported dependency versions in docs/adr/0002-identity.md; implement only after initial scope approval. [TF-00]
- [x] T002 Create reproducible web/API/database startup under apps/web, apps/api and db/migrations with root setup instructions and lockfile. Depends T001. [TF-00]
- [x] T003 Add users/organizations/memberships/projects migrations and restricted runtime role in db/migrations; use atomic organization+owner creation. Depends T002. [TF-A02,A08]
- [x] T004 Add valid-session and current-membership request boundary in apps/api/src/auth and apps/api/src/organizations; request context must be transaction-local. Depends T001,T003. [TF-A01,A04,A05]
- [x] T005 Implement organization/project create/list endpoints in apps/api/src/projects with tenant-aware queries and documented status codes. Depends T004. [TF-A02–A05]
- [x] T006 Add real PostgreSQL integration cases in tests/integration for foreign IDs, forged tenant context, viewer writes and pooled context reuse. Depends T005. [TF-A01–A05]
- [x] T007 Build sign-in, organization switcher and create/list UI in apps/web/src; clear tenant-scoped caches on switching. Depends T005. [TF-A03,A09]
- [x] T008 Add first-slice browser scenario in tests/e2e; record commit, commands, result and workflow findings in docs/checkpoints. Depends T006,T007. [TF-A09; ENG-02]
- [x] T009 Implement owner-only membership routes in apps/api/src/memberships.ts, the Members UI, database operation functions and real concurrency/browser checks. Depends T008. [TF-A05,A07,A08]
- [x] T009a Fix membership error recovery in apps/web/src/Members.tsx: add failing permanent browser regressions for unknown email/stale target, preserve actionable error and input, automatically reload authorized members, retain revoked-access protection, and disambiguate confirmation selectors. Record red/green evidence in docs/checkpoints. Depends T009; issue #3 / PR #8. [TF-A07,A08,A09]
- [x] T010 Complete project rename/archive, owner/admin organization rename and UI states in apps/api/src/projects and apps/web/src with persistence tests. Depends T008. [TF-A03–A06,A09]
- [x] T011 Add application CI under .github/workflows and complete acceptance-to-test mapping in docs/verification.md. Depends T009,T010. [TF-04]
- [ ] T012 Implement deployment setup and docs/demo.md after hosting decision; satisfy docs/release-checklist.md and capture deployed smoke. Depends T011. [TF-05]
