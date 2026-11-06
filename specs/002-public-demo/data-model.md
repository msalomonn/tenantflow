# TF-05 proposed data and role changes

Status: design only. Keep existing users, sessions, organizations, memberships and projects and their tenant relationships.

- **Definer role:** a non-login, non-superuser, non-bypass role owns only reviewed SECURITY DEFINER functions. Explicit privileges/policies permit their required operations; authenticated runtime roles cannot become this role. Migration identity owns schema/DDL separately. Verify function owner, schema privileges, PUBLIC revocation and FORCE RLS in fresh/upgrade/restore paths.
- **Demo capacity:** account cap is global to the dedicated demo; organization cap is based on immutable creator accounting, not current membership count. Add creator attribution for newly created organizations and a defined synthetic-fixture backfill before enforcing limits. A deleted/demoted member must not free another account's creator quota. Lock capacity rows/keys transactionally so concurrent signup/create/add cannot exceed D04. Count all project rows, including archived ones.
- **Demo maintenance state:** versioned environment identifier, maintenance flag and last completed reset time. Reset is whole-environment and atomic for app/auth data, invalidates sessions and recreates only approved synthetic fixtures. Concurrent creation is blocked during reset. Failure leaves the previous coherent dataset or recoverable maintenance state.
- **Recovery evidence:** commit, migration checksums, database identifier (no credentials), source backup timestamp, restore start/end, test result and operator. Store sanitized records in docs; secrets and backups never enter Git.

This design adds no public API for administrative credentials, reset, role management or backups. Existing membership routes continue to enforce the last-owner invariant.
