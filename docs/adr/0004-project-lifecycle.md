# ADR TF-0004: column-scoped lifecycle updates and retained archives

Status: accepted within the approved MVP. Date: 2026-11-05.

## Decision

Use PATCH for one operation at a time: rename a project or archive it. Keep the existing archived_at column as the durable marker and retain archived rows. Default lists exclude them; authorized detail includes archived metadata. Repeating archive returns the existing timestamp. A renamed project remains in its organization; an archived project cannot be renamed through the API. Restore, deletion and an archive browser remain outside TF-03.

Preserve migration checksums and add migration 003. Grant the runtime role UPDATE only on project name/archived_at and organization name; IDs, tenant references and creation timestamps remain unwritable. UPDATE RLS repeats membership and organization-context predicates for both the old and new row. The HTTP boundary still verifies session, origin, tenant membership and allowed role; client-selected organization IDs never grant authority.

Check project existence within the tenant before returning a viewer-specific 403. Lock the project row before inspecting its archive state, then perform the update in the same transaction. This orders simultaneous archive/rename and preserves the first archive timestamp. Concurrent renames use last committed write wins; no versioned collaborative editor is promised. Each new request reads authoritative membership; in-flight requests are not a real-time revocation subscription.

Organization rename is a narrow owner/admin UPDATE with the same transaction-local context and RLS, without touching memberships. Names use trimmed Unicode code-point length (1–120); null bytes and unknown fields are rejected before database writes. Error bodies do not reveal SQL or foreign resources.

## UI boundary and alternatives

A separate Projects component owns its dialogs, list and mutation controller. It is keyed by organization and current role. Changing either unmounts dialogs and aborts requests; the API helper also checks the signal after parsing a response. A late old response must not trigger session changes or update the selected workspace. Denied/stale writes refresh authoritative access/list state. Recoverable service errors preserve the draft in its dialog. Archive has confirmation, cancel and explicit retention wording.

Hard deletion was rejected because the approved acceptance criterion requires retained data. An optimistic update cache was unnecessary for this small UI and adds rollback/race complexity. Broader UPDATE grants would permit accidental tenant reassignment even with otherwise correct handlers. A new SECURITY DEFINER mutation function was unnecessary here because ordinary column grants and RLS express the project/organization matrix directly.

## Verification and revisit

Real PostgreSQL cases cover role matrix, guessed IDs, forged context, direct runtime updates, immutable tenant columns, next-request demotion/removal, idempotent archive, three overlapping row-lock waiters and API-instance replacement. Browser cases cover lifecycle, cancellation, errors, stale archived targets, changed roles and delayed responses during a forced workspace switch. User names and project contents are synthetic.

Revisit conflict detection/versioning if concurrent editing becomes a product requirement. Public operation, quotas, deployment, dependency review and the full acceptance audit stay in TF-04/TF-05.
