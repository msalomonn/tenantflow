# ADR TF-0006: Explicit role for privileged database functions

Status: implemented in TF-05a, pending PR integration. Date: 2026-11-05, America/Argentina/Buenos_Aires. Acceptance: TF-D02 / R01–R06.

## Problem

Migrations001/002 create SECURITY DEFINER functions as the migration owner while forcing RLS on tenant tables. Local PostgreSQL migrations ran as a superuser, so bootstrap and member administration worked. An ordinary database owner cannot bypass FORCE RLS and has no applicable policies; the new regression reproduced organization creation failing with SQLSTATE42501.

## Decision

Forward migration004 transfers the four reviewed functions to tenantflow_definer: NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE and NOREPLICATION. It has schema usage, only the organization columns needed for bootstrap/locking, membership read/insert/role-update/delete, and auth.user id/name/email read. Role-specific policies authorize those operations while ENABLE/FORCE RLS and all runtime policies remain intact. The role has no project, auth.account or auth.session privileges.

The functions retain their existing actor/tenant/owner/last-owner checks, empty search path, PUBLIC execution revocations and existing runtime entry points. Their implementation does not change. The application role cannot call the internal owner-check helper directly. This remains a privileged function boundary: a compromised API able to forge transaction-local identity is outside RLS's protection, as documented previously.

The migration operator needs database/schema ownership, CREATEROLE/role administration and ownership-transfer permission, not superuser/BYPASSRLS. It receives explicit non-inherited SET rights on the definer role for maintenance. CREATE on the app schema is granted to the new function owner only inside the migration transaction and revoked before commit. An unsafe existing role is rejected, not silently repaired. Startup and migration preflight also reject runtime membership in the definer role, including indirect membership.

Role/grant/ownership changes share migration004's transaction and checksum entry. Old migrations are unchanged. A collision deliberately injected in the isolated test proves rollback leaves old owners/grants/checksums intact, followed by successful repair and retry.

## Alternatives and limits

Keeping a superuser/BYPASSRLS owner is not portable and gives the functions broader authority than they need. Disabling FORCE RLS weakens an existing invariant. Reimplementing membership transactions in application code would duplicate established concurrency safeguards. An explicit no-login role keeps that behavior with auditable grants.

Roles are cluster-wide: reserve these names for this application and review existing roles before sharing a database cluster. Future definer function changes require reviewing the role's grants and policies together. Hosted role administration and connection settings still require provider preflight. Restore must recreate/verify roles, memberships, function owners and ACLs, not just table data. This change does not claim Render compatibility was exercised remotely or that a backup was restored.

PostgreSQL18 references consulted: [role creation](https://www.postgresql.org/docs/18/sql-createrole.html), [membership grant options](https://www.postgresql.org/docs/18/sql-grant.html), [function ownership transfer](https://www.postgresql.org/docs/18/sql-alterfunction.html).
