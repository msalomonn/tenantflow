# TF-01 implementation plan — initial slice implemented

## Shape

React/TypeScript web app and Node.js/TypeScript API in one app repo, modular by identity, organizations and projects. PostgreSQL stores memberships and project data. Runtime and package versions are pinned in `.node-version`, `package.json` and the lockfile. See [identity ADR](../../docs/adr/0002-identity.md).

Implemented layout: `apps/web`, `apps/api`, `db/migrations`, `tests/integration`, `tests/e2e`. The README documents repeatable setup, database migration, development and checks.

## Data and isolation contract

Users have a unique provider subject. Organizations have UUID IDs. Memberships have `(organization_id,user_id)` uniqueness and a constrained role. Projects carry `organization_id`; relationships use tenant-aware composite keys where appropriate. Organization creation and owner membership are one transaction.

Resolve the current user from a verified session. Treat a tenant ID from routing as a selection, never as authorization. Check current membership in the server transaction; filter queries by tenant and use PostgreSQL RLS as a second barrier. The API runtime role must not be a superuser, table owner or BYPASSRLS role. Apply request context transaction-locally and test connection reuse to detect leakage. Use a separate migration role. RLS does not replace route authorization.

TF-02 role changes and last-owner protection lock the relevant organization/membership rows in a transaction. Re-read authoritative membership for each request; avoid stale embedded role claims.

## HTTP contract

- `GET /api/me`; Better Auth `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`, `POST /api/auth/sign-out`.
- `GET/POST /api/organizations`.
- `GET/POST /api/organizations/:orgId/projects`.
- Implemented `GET /api/organizations/:orgId/projects/:projectId`.
- `PATCH /api/organizations/:orgId/projects/:projectId` for name/archive changes; `PATCH /api/organizations/:orgId` for owner/admin rename (TF-03).
- Owner-only `GET/POST /api/organizations/:orgId/members` and `PATCH/DELETE /api/organizations/:orgId/members/:userId`; see the TF-02 contract.

Use 401 for no valid session, 404 for resources outside accessible organizations, 403 for a disallowed action in an accessible organization, 400 for invalid input and 409 for conflicts such as last-owner removal. Do not return database errors or cross-tenant existence details.

## Verification

The full-MVP verification target is real PostgreSQL integration coverage for two users, two organizations and all roles. Attempt every read/write route with a foreign project ID, revoked membership, forged tenant context, pooled connection reuse and concurrent owner changes. The current local source passes 37 integration cases and 20 browser scenarios; see [current evidence and remaining cases](../../docs/verification.md). Use deterministic synthetic fixtures; do not rely solely on mocked repositories.

## Dependencies and decisions

TF-00 selected Better Auth with database-backed sessions and exact-origin CSRF checks; see the accepted identity ADR. The approved architecture uses local PostgreSQL with separate migration/auth/application roles. No dev-auth bypass exists. Paid hosting and public deployment remain separate decisions. The first slice does not require DocuMind.

Reference: [PostgreSQL row-security behavior](https://www.postgresql.org/docs/18/ddl-rowsecurity.html), consulted 2026-10-25. Table ownership and BYPASSRLS are particularly relevant to test configuration.

## TF-02 implementation sequence

Contract: [memberships](contracts/memberships.md). First add failing integration tests, then migration `002-membership-management.sql`, owner-only API routes in `apps/api/src/memberships.ts`, and the Members UI. Preserve migration 001 and its checksum. Reuse the existing transaction-local identity boundary. Add browser coverage and record checks/self-review before opening a PR. The membership row lock protocol serializes all changes per organization; direct table mutation stays denied. Existing project-role checks remain authoritative; project edit/archive and organization rename are outside this membership delivery.

T009a corrects the discovered UI recovery defect in the same PR: permanent browser regression first, then reload the authorized list after 403/404 access refresh. Separate mutation feedback from list-loading errors so the recovery does not erase the actionable message. Keep the keyed organization view and aborted requests, and verify actual actor revocation still removes controls/data. No API, dependency or schema changes are needed.

## TF-03 implementation sequence

Follow [P01–P07](contracts/project-lifecycle.md). Add failing real-DB tests before migration 003 and the lifecycle route module. Preserve prior migration checksums. Grant UPDATE only for names/archive timestamp, with role- and tenant-aware RLS. Lock each project before archive/rename to make terminal archive behavior deterministic. Keep archive idempotent; detail remains available to authorized readers while lists exclude archived records.

Extract the project view and shared dialogs into focused web modules. Bind request cancellation and forms to the keyed organization/role view; refresh authorization after denied/stale mutations. Organization rename uses the same verified transaction boundary. Add desktop/mobile lifecycle and late-response scenarios, inspect screenshots, update evidence and self-review before opening the TF-03 PR. T011/T012 remain separate hardening/release work.
