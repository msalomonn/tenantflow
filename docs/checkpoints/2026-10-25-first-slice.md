# First-slice checkpoint — 2026-10-25

Base commit: `a9bd42d0562f7223fc5edf1276ae6415c053622e` (foundation). Implementation source: the commit containing this checkpoint on `feat/2-tenant-isolation`; use its PR head for review.

Manuel approved constitution v1 and both MVP scopes. TF-00/TF-01, executable tasks T001–T008, are implemented locally. Review and merge are pending. No deployment occurred.

Delivered: pinned Node/React/API setup, local PostgreSQL and repeatable migrations, Better Auth sessions, separate database roles, transaction-local RLS context, atomic organization/owner creation, scoped project create/read routes, responsive workspace and tenant-switch isolation.

Validation: migration applied twice; `npm run typecheck`, `npm run build`, `npm test` (11 passed), and `npm run test:e2e` (4 passed). See [verification](../verification.md) for coverage and limits. CI results belong to the PR and are not implied by local results.

Workflow findings: an approved spec and explicit negative acceptance criteria drove the implementation. The first harness failed before the API existed. Browser checks surfaced real signup throttling; the test now respects Retry-After. A delayed-response case validates that switching organizations cannot retain or reveal a previous project's UI state. Infrastructure and authentication choices are recorded in an ADR. This validates the first workflow cycle locally; ENG-02 still needs PR review and merge evidence.

Next: TF-02 membership management and concurrent last-owner protection; TF-03 edit/archive. T011 includes CI already scaffolded here, but remains open until the complete MVP acceptance matrix is covered. T012 deployment remains open.

Resume: follow the README, inspect branch/status and the linked GitHub Issues, then implement the next approved task. Preserve `.env` and the database volume. Use synthetic data only.
