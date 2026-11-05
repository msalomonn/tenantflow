# TF-03 project lifecycle checkpoint

Date: 2026-11-05, America/Argentina/Buenos_Aires. Branch: `feat/4-project-lifecycle`, based on main `ae24fa4` (integrated TF-02 PR #8). Issue #4 and its PR own live integration status. This checkpoint records implementation, not merge or deployment.

## Scope and SDD

Manuel authorized closing DocuMind DM-02 and implementing TenantFlow TF-03. DocuMind PR #10 was reviewed at `51ab4c2d61570a7fa95eeea17f672d412896463b` and merged as `3e20d4cfa54012c11519c8810900b3fbbc92926d`; issue #3 closed. No further DocuMind implementation is part of this branch.

For TenantFlow, P01–P07 were specified before application changes. Eight real-DB tests were added first: seven failed on missing endpoints/privileges; the existing denied-access test passed. The first browser lifecycle case failed because the Edit control did not exist. Implementation then added migration 003, lifecycle routes, project dialogs and cancellation/recovery. ADR TF-0004 records retained archive, permissions and concurrency choices. Spec Kit prerequisites passed; `.specify/extensions.yml` and feature checklists are absent, so no pre/post hooks or checklist gate apply. T010 is complete; T011/T012 remain open.

## Verified result

Writers can rename/archive projects; owners/admins can rename organizations. Repeated archive preserves its timestamp and hides the project from lists without deleting its row. Detail remains authorized and available. Denied/stale edits refresh access/list state; recoverable failures preserve input. Workspace/role changes cancel requests and close old dialogs. Existing migration checksums and local credentials/volumes are preserved.

`npm run check` passed: TypeScript, production build, 37 integration cases and 20 desktop/mobile browser scenarios. A follow-up targeted run passed the stronger concurrency assertion (three observed lock waiters) and the viewport-sized confirmation captures. `git diff --check` and local documentation links passed. Screenshots were visually inspected. Remote CI is recorded on the PR after execution, not inferred from local checks.

The implementing agent reviewed role/tenant isolation, column grants, archive/rename serialization, request cancellation, stale permissions and error recovery. No outstanding blocker was found for this scoped local delivery. This is self-review, not independent reviewer approval.

## Handoff

Review/integrate the TF-03 PR next. TF-04 remains the full acceptance/dependency hardening pass. TF-05 requires hosting/cost decisions, deployment and deployed smoke evidence. There is no new public deployment, restore UI or production-readiness claim. The application remains runnable at http://localhost:4310.
