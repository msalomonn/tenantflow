# TF-05a portable database roles

Date: 2026-11-05, America/Argentina/Buenos_Aires. Branch: feat/6-portable-database-roles, based on planning PR#11 at `5209ea8ff5417071da57a079c22b5fee401fab41`. The implementation PR is stacked on that planning branch; neither is implicitly merged by this checkpoint. Issue#6 remains the deployment tracker.

## SDD and scope

The user asked to continue repository changes. Used speckit-tasks and speckit-implement for active package specs/002-public-demo. Generated 17 tasks across four delivery stories and selected US1/TF-05a (T001–T007) as this independent slice. R01–R06 were written before implementation. No feature checklists or extension hooks are configured. Hosting choice, spending, production startup/ingress, demo quotas and public application deployment remain separate.

## Red/green record

Before implementation, the legacy upgrade regression ran in a unique disposable PostgreSQL18 container. The migration identity had CREATEROLE but no superuser/BYPASSRLS/CREATEDB. Migrations001–003 applied, but organization bootstrap failed with SQLSTATE42501 because the function owner was subject to forced RLS. The test expected the future migration to repair this and failed at its post-migration bootstrap assertion.

Migration004 now installs an explicit no-login function owner with limited grants/policies; a shared preflight/startup check rejects unsafe role attributes or direct/indirect runtime membership. Previous migrations/checksums and local data/credentials remain unchanged. The test fixture corrected TypeScript signatures and cleared inherited NODE_TEST_CONTEXT for its nested test process, then explicitly verified that all 43 integration cases actually ran.

The four portability scenarios cover fresh/repeated migration plus the complete existing authorization/concurrency suite, legacy failure→upgrade with archived data and checksum preservation, exact role/ACL/column privileges and escalation rejection, and transactional rollback/retry. The fixture reads the pinned image from compose.yaml, binds a unique loopback port and removes only its own temporary container. Administrative test access prepares fixtures/inspects results; all application requests use the restricted runtime roles and schema/functions are created by the ordinary migration identity.

Final local result: migration applied and repeated successfully; npm run check passed types/build, 43 integration cases, 4 portability scenarios (including another execution of all 43 integration cases on the ordinary-owner schema), and 24 browser scenarios. npm run audit reported zero vulnerabilities. Commands and acceptance mapping are in docs/verification.md; remote CI is recorded in the PR. Self-review is by the implementing agent, not independent reviewer approval. No UI behavior changed, so existing browser captures remain the visual reference; database evidence is test output and catalog assertions.

## Handoff

Review this slice after planning PR#11, then proceed to US2 production build/start and verified ingress. Provider capability checks remain unexecuted. No resource was provisioned and no public demo URL exists. Do not mark T012 in the original MVP package or the release checklist complete merely for this change.
