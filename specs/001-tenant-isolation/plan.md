# TF-01 implementation plan — initial slice implemented

## Shape

React/TypeScript web app and Node.js/TypeScript API in one app repo, modular by identity, organizations and projects. PostgreSQL stores memberships and project data. Runtime and package versions are pinned in `.node-version`, `package.json` and the lockfile. See [identity ADR](../../docs/adr/0002-identity.md).

Implemented layout: `apps/web`, `apps/api`, `db/migrations`, `tests/integration`, `tests/e2e`. The README documents repeatable setup, database migration, development and checks.

## Data and isolation contract

Users have a unique provider subject. Organizations have UUID IDs. Memberships have `(organization_id,user_id)` uniqueness and a constrained role. Projects carry `organization_id`; relationships use tenant-aware composite keys where appropriate. Organization creation and owner membership are one transaction.

Resolve the current user from a verified session. Treat a tenant ID from routing as a selection, never as authorization. Check current membership in the server transaction; filter queries by tenant and use PostgreSQL RLS as a second barrier. The API runtime role must not be a superuser, table owner or BYPASSRLS role. Apply request context transaction-locally and test connection reuse to detect leakage. Use a separate migration role. RLS does not replace route authorization.

Planned TF-02 role changes and last-owner protection must lock the relevant organization/membership rows in a transaction. Re-read authoritative membership for each request; avoid stale embedded role claims.

## HTTP contract

- `GET /api/me`; Better Auth `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`, `POST /api/auth/sign-out`.
- `GET/POST /api/organizations`.
- `GET/POST /api/organizations/:orgId/projects`.
- Implemented `GET /api/organizations/:orgId/projects/:projectId`.
- Planned `PATCH /api/organizations/:orgId/projects/:projectId` for name/archive changes (TF-03).
- Planned `GET/POST/PATCH/DELETE` membership endpoints scoped to the organization, with exact routes finalized before the corresponding task.

Use 401 for no valid session, 404 for resources outside accessible organizations, 403 for a disallowed action in an accessible organization, 400 for invalid input and 409 for conflicts such as last-owner removal. Do not return database errors or cross-tenant existence details.

## Verification

The full-MVP verification target is real PostgreSQL integration coverage for two users, two organizations and all roles. Attempt every read/write route with a foreign project ID, revoked membership, forged tenant context, pooled connection reuse and concurrent owner changes. The initial slice passes 11 integration cases and 4 browser scenarios; see [current evidence and remaining cases](../../docs/verification.md). Use deterministic synthetic fixtures; do not rely solely on mocked repositories.

## Dependencies and decisions

TF-00 selected Better Auth with database-backed sessions and exact-origin CSRF checks; see the accepted identity ADR. The approved architecture uses local PostgreSQL with separate migration/auth/application roles. No dev-auth bypass exists. Paid hosting and public deployment remain separate decisions. The first slice does not require DocuMind.

Reference: [PostgreSQL row-security behavior](https://www.postgresql.org/docs/18/ddl-rowsecurity.html), consulted 2026-10-25. Table ownership and BYPASSRLS are particularly relevant to test configuration.
