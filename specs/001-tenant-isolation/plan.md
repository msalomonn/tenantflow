# TF-01 implementation plan — proposed

## Shape

React/TypeScript web app and Node.js/TypeScript API in one app repo, modular by identity, organizations and projects. PostgreSQL stores memberships and project data. Pin framework/runtime versions during TF-00 after checking support and deployment compatibility.

Proposed layout: `apps/web`, `apps/api`, `db/migrations`, `tests/integration`, `tests/e2e`. A root command must eventually run the documented local stack. No code directories are claimed to exist yet.

## Data and isolation contract

Users have a unique provider subject. Organizations have UUID IDs. Memberships have `(organization_id,user_id)` uniqueness and a constrained role. Projects carry `organization_id`; relationships use tenant-aware composite keys where appropriate. Organization creation and owner membership are one transaction.

Resolve the current user from a verified session. Treat a tenant ID from routing as a selection, never as authorization. Check current membership in the server transaction; filter queries by tenant and use PostgreSQL RLS as a second barrier. The API runtime role must not be a superuser, table owner or BYPASSRLS role. Apply request context transaction-locally and test connection reuse to detect leakage. Use a separate migration role. RLS does not replace route authorization.

Role changes and last-owner protection lock the relevant organization/membership rows in a transaction. Re-read authoritative membership for each request; avoid stale embedded role claims.

## HTTP contract draft

- `GET /api/me`; `POST /api/logout` (identity mechanism finalized by TF-00).
- `GET/POST /api/organizations`.
- `GET/POST /api/organizations/:orgId/projects`.
- `PATCH /api/organizations/:orgId/projects/:projectId` for name/archive changes.
- `GET/POST/PATCH/DELETE` membership endpoints scoped to the organization, with exact routes finalized before the corresponding task.

Use 401 for no valid session, 404 for resources outside accessible organizations, 403 for a disallowed action in an accessible organization, 400 for invalid input and 409 for conflicts such as last-owner removal. Do not return database errors or cross-tenant existence details.

## Verification

Real PostgreSQL integration tests cover two users, two organizations and all roles. Attempt every read/write route with a foreign project ID, revoked membership, forged tenant context, pooled connection reuse and concurrent owner changes. A browser test covers the first vertical slice. Use deterministic synthetic fixtures; do not rely solely on mocked repositories.

## Dependencies and decisions

TF-00: choose an established identity library/provider, session/CSRF strategy and local development mode; record trade-offs and any hosting requirements. Do not invent cryptography or ship dev-auth bypasses. Infrastructure choices remain proposals until the initial review. The first slice does not require DocuMind.

Reference: [PostgreSQL row-security behavior](https://www.postgresql.org/docs/18/ddl-rowsecurity.html), consulted 2026-10-25. Table ownership and BYPASSRLS are particularly relevant to test configuration.
