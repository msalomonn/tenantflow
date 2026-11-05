# TF-04 acceptance hardening checkpoint

Date: 2026-11-05, America/Argentina/Buenos_Aires. Branch: `chore/5-acceptance-hardening`. Baseline: `49c10c30f70cbbd4165be016c2e0c405724ceb3e`, merged TF-03 PR #9. Issue #5 and its PR own live integration status; this record does not claim deployment or merge.

## SDD and result

The user authorized continuing after TF-03 integration. H01–H05 and the execution plan were written before new tests/CI changes. Spec Kit prerequisites passed for `specs/001-tenant-isolation`; there is no feature checklists directory or `.specify/extensions.yml`, so no pre/post hooks apply. T011 is implemented; T012 remains open.

Mapped TF-A01–A09 to existing and new tests. Added six real-PostgreSQL cases for invalid/expired/revoked sessions, wrong passwords, unsafe origins/content types, runtime roles and production configuration/cookies; added two browser scenarios per viewport for session loss and inert/invalid names. Existing application behavior passed these assertions without application changes. The first combined run exposed signup throttling in the production-cookie harness; it now honors bounded Retry-After. A fixture typing error was also corrected. These were test harness corrections, not product defects.

CI now verifies setup preserves credentials and migrations repeat, and runs the full-lockfile npm advisory audit as a blocking step. No versions, lockfile, migrations, local credentials or volumes were replaced. No paid service or deployment was configured.

## Evidence and review

`npm run check`: TypeScript and production build, **43 integration cases and 24 desktop/mobile browser scenarios** passed. `npm run audit`: zero reported vulnerabilities. The [verification matrix](../verification.md) maps acceptance and limits; the [dependency review](../dependency-review.md) records command, lockfile fingerprint and raw output. Four new screenshots were visually inspected. Existing TF-03 screenshots are retained because application UI did not change.

Self-review covered the route/session matrix, test cleanup, actual session revocation, bounded throttling wait, inert-name assertions, audit inclusion/failure semantics and setup credential preservation. No blocking finding remains for this scoped delivery. This is implementing-agent self-review, not independent approval. Remote CI result and exact source commit are recorded in the PR after execution.

## Next step

Review/integrate TF-04, then resolve TF-05 hosting/cost choices and deployment/recovery design. Public quotas/retention, production proxy/TLS and deployed smoke remain unverified. All release checklist items must be evaluated against the eventual release commit/environment; this local hardening checkpoint is not a public-release signoff.
