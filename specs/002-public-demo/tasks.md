# TF-05 executable tasks

Issue #6 owns delivery status. Active scope for this branch: TF-05a / US1 only, based on planning PR#11. No hosting or spending authorization is inferred. Subsequent stories remain separate PRs.

## Setup and foundation

- [x] T001 Record TF-05a role invariants and fixtures in specs/002-public-demo/contracts/database-roles.md; verify .gitignore and .dockerignore protect local credentials/artifacts.
- [x] T002 Create isolated Docker PostgreSQL fixture and real migration CLI helpers in tests/portability/migrations.test.ts; create only unique ephemeral test resources and clean them after execution.

## US1 — portable database boundary (P1)

Independent evidence: fresh/upgrade migrations run twice as NOSUPERUSER/NOBYPASSRLS; real application flows and direct SQL reject unauthorized operations; previous concurrency tests pass on the resulting database.

- [x] T003 [US1] Add failing fresh/upgrade, least-privilege, escalation and migration-safety checks in tests/portability/migrations.test.ts before changing database behavior.
- [x] T004 [US1] Add db/migrations/004-definer-role.sql with explicit NOLOGIN/NOSUPERUSER/NOBYPASSRLS function ownership, narrowly scoped grants/policies and no runtime role membership; preserve migrations001–003.
- [x] T005 [US1] Add startup escalation checks in apps/api/src/app.ts and hook tests/portability into package.json and CI through npm run check.
- [x] T006 [US1] Verify legacy data/checksums survive upgrade, repeat migrations, reject unsafe existing role properties/membership, and run the established integration/concurrency suite under non-superuser-owned schema in tests/portability/migrations.test.ts.
- [x] T007 [US1] Record exact commands/red-green evidence, provider limits and recovery ownership needs in docs/checkpoints/2026-11-05-portable-roles.md and docs/adr/0006-portable-definer-role.md; update docs/verification.md and self-review the PR.

## US2 — production process and ingress (P1)

Independent evidence: built process starts without .env/development packages, correct bind/health/shutdown, and spoofed forwarding headers cannot bypass auth protections.

- [ ] T008 [US2] Add production build/start regressions under tests/production and implement environment-only startup in apps/api/src/server.ts and package.json.
- [ ] T009 [US2] Specify and test actual trusted ingress in specs/002-public-demo/contracts/deployment.md and apps/api/src/app.ts; verify production cookies/Origin and rate limits without blanket proxy trust.

## US3 — bounded demo (P2)

Independent evidence: concurrent creation cannot exceed quotas; authorized feedback and guarded whole-demo reset preserve consistency.

- [ ] T010 [US3] Add quota race/authorization tests under tests/integration, then migrations and enforcement in apps/api for 100 accounts,3 created organizations/account,50 projects including archived/organization,10 memberships/organization.
- [ ] T011 [US3] Add temporary-data/limit feedback in apps/web and desktop/mobile cases in tests/e2e; state no verification/recovery email.
- [ ] T012 [US3] Implement an operator-only weekly reset procedure with dry run, explicit demo target and maintenance gate in scripts/demo-reset.ts; test rollback/session invalidation under tests/integration and document in docs/demo.md.

## US4 — controlled release and recovery (P2)

Independent evidence: selected CI-passing commit deployed after provider/budget decision, database restored separately and smoke checks passed.

- [ ] T013 [US4] Record provider/region/budget approval in docs/deployment-proposal.md before paid provisioning; verify managed-role compatibility and private connection settings.
- [ ] T014 [US4] Add deployment configuration and separate migration job under deployment/; document manual release gating and credential boundaries in docs/demo.md.
- [ ] T015 [US4] Rehearse backup/restore to a separate target, invalidate restored sessions and record measured RPO/RTO in docs/checkpoints; target RPO<=24h and RTO<=2h remains unproven until measured.
- [ ] T016 [US4] Run deployed two-account desktop/mobile smoke and record commit/URL/time/screenshots in docs/verification.md; satisfy docs/release-checklist.md.

## Polish and dependencies

- [ ] T017 Update README.md, docs/demo.md and ADR status to match actual hosted behavior and limitations after release.

Order: T001→T002→T003→T004/T005→T006→T007. US2 follows the US1 boundary; US3 follows US2; US4 requires all plus provider/budget decision. Deliver one reviewable slice at a time. Independent opportunities: after T003, migration SQL and startup guard can be worked separately, but shared integration/database verification stays sequential. In US2/3, documentation and UI copy can be prepared alongside isolated runtime changes; deployment/recovery mutations stay sequential. No parallel agent execution is required for this branch.
