# TF-02 — owner-managed memberships

Scope: issue #3, task T009, approved TF-A05/A07/A08. Users already have accounts; no invitation email or global user directory. Project editing/archive remain TF-03.

## HTTP contract

All endpoints require a real session and current organization membership. Nonmembers receive 404, members with any role other than owner receive 403. Resolve authorization before looking up a target account. Mutations retain same-origin JSON and the 16 KiB request limit.

| Method | Path relative to `/api/organizations/:orgId` | Body | Success |
| --- | --- | --- | --- |
| GET | `/members` | none | 200 `{members:[{user_id,name,email,role}]}` |
| POST | `/members` | `{email,role}` | 201 `{member:{user_id,name,email,role}}` |
| PATCH | `/members/:userId` | `{role}` | 200 `{member:{user_id,name,email,role}}` |
| DELETE | `/members/:userId` | `{}` | 200 `{removed:true}` |

Roles: owner/admin/member/viewer. Add-by-email uses a trimmed lowercase exact match, not substring search. Unknown fields/roles and malformed identifiers return 400. Unknown registered email or target membership returns 404. Duplicate membership and removing/demoting the last owner return 409. A target's membership in a different organization never supplies authority or a match.

Self-removal and self-demotion are allowed when another owner remains. Setting the last owner's role to owner is an allowed no-op. Role changes and removals affect the next server request; the UI refreshes authoritative organization state after a successful mutation and on focus. A removed user's other organizations remain available.

## Database and concurrency

Keep direct membership writes and the global auth user table inaccessible to the app role. Narrow SECURITY DEFINER functions expose owner-only list/add/update/remove. Each membership operation locks the organization row first, then rechecks the actor's membership/role with fresh READ COMMITTED statements. It counts remaining owners while holding that lock. All membership mutations use this same order, including additions and requests made directly with the runtime DB role.

Functions have an empty search path, qualified relations and no PUBLIC execution. They derive actor and selected organization from transaction-local session context. This protects against omitted route checks; a compromised application that can forge DB identity and an administrator remain outside the boundary. Account deletion is disabled; adding it later must preserve ownership too.

## Verification and UI

Real Postgres checks cover every nonowner role, foreign organization/target, duplicate additions, self-demotion/removal, immediate revocation, denied direct table writes and simultaneous owner changes using distinct connections. Concurrent changes must leave at least one owner, with the losing attempt rejected after rechecking permissions/invariants.

The workspace exposes a Members view. Owners get an add form, per-member role controls and removal confirmation; others get a clear owner-only state. Loading/errors are accessible. Changing organization unmounts the old member view and aborts its request. Pending mutations cannot be resubmitted. Tests exercise add → role change → remove, last-owner rejection and a delayed tenant-switch response in desktop/mobile browsers.
