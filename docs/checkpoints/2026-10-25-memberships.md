# TF-02 checkpoint — 2026-10-25

Base: `840b5316784e29d81798fc52cf49a727d22c2bb1` (merged first slice). Branch: `feat/3-membership-management`. Source: the commit containing this checkpoint and its PR head. Issue #3, task T009, acceptance TF-A05/A07/A08; contract in `specs/001-tenant-isolation/contracts/memberships.md`.

Delivered: owner-only list/add/change/remove for already registered users; member UI and confirmation; shared organization row lock with post-wait authorization recheck and last-owner guard; direct database mutation denial; authoritative workspace-role refresh after changes/on focus. No email invitations, project editing, deployment or merge is included.

Validation commands: `npm run db:migrate` (additive migration 002), `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Local results: 29 integration cases and 8 desktop/mobile browser scenarios passed; type checking, production web build and a second migration run passed. CI on the PR is separate evidence. Limits are recorded in `docs/verification.md`. The first integration test failed before implementation. Browser tests exposed an ambiguous selector label, which was corrected. Signup rate limiting remains enabled.

Self-review focuses on serialized mutation paths, rechecking authority after a wait, exact target scoping, restricted function grants, no global user enumeration for nonowners, unchanged prior migration checksums and tenant-switch UI isolation. This is not independent reviewer approval.

Resume from the PR/issue state, preserve local `.env` and database data, and apply migrations before running a checkout. T010 project edit/archive and organization rename, T011 full hardening, and T012 deployment remain open.
