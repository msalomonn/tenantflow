# TF-05: Public portfolio demo

Status: proposed deployment specification, 2026-11-05 (America/Argentina/Buenos_Aires). Preparation is authorized; provider, spending and public application deployment await a decision. Making the GitHub repository public is a separate user-authorized action and does not provision hosting. Issue #6 owns delivery status.

## User outcome and scope

A recruiter can open a stable HTTPS URL and exercise TenantFlow with synthetic data. Authentication, organization switching, roles, membership and project lifecycle preserve the approved MVP behavior. The demo clearly explains that data is temporary and email verification/recovery are unavailable.

Proposed shape: one same-origin web/API instance and one PostgreSQL 18 database in the same region. Recommend paid Render web + Postgres, subject to role compatibility and provider/budget approval. No multi-region, HA, paid domain, email provider, DocuMind deployment or automatic scaling in this delivery.

## Acceptance

- TF-D01: a versioned production build starts from provider environment variables without a local .env, binds the assigned interface/port, serves built assets and passes database readiness. Migration credentials are absent from the web process.
- TF-D02: a fresh database and an upgraded existing database pass migrations twice; runtime app/auth roles retain existing restrictions. Organization bootstrap and owner operations work without relying on superuser-owned definer functions. Foreign-tenant, direct-SQL, last-owner and concurrent operations remain protected.
- TF-D03: deployed HTTPS sign-in/up/out works; cookies are Secure/HttpOnly/SameSite; exact-origin CSRF remains. Forwarded identity/host/protocol headers cannot bypass throttling or change trusted origin. Proxy trust is explicit and verified, never unconditional.
- TF-D04: proposed demo quotas are enforced atomically: 100 accounts globally, 3 organizations created per account, 50 projects including archived per organization, 10 memberships per organization. Existing authorization runs before quota feedback. Concurrent submissions at the limit cannot overshoot; safe errors are accessible. Auth body limits and throttling remain enabled.
- TF-D05: the demo states synthetic-only use and a weekly whole-demo reset. Reset is an operator-only maintenance operation in the dedicated demo database, with a dry run, explicit environment/target check, maintenance gate and recovery evidence. It is never available as a public HTTP route. Reset removes accounts/sessions and tenant data together, so no last-owner orphan remains. Backup retention is disclosed separately; no promise of immediate erasure from backups.
- TF-D06: only an explicitly selected commit with passing CI/audit can be released; automatic deployment is disabled until release gating is verified. Secrets exist only in the hosting secret store. Database is private, runtime roles cannot perform DDL, and old migrations keep their checksums.
- TF-D07: recovery is rehearsed on a separate database; validate role ownership/grants, migrations, tenant isolation and session handling before switching. Record measured recovery time and recovered timestamp. Proposed demo targets: RPO <=24 hours and RTO <=2 hours, subject to measured rehearsal; no SLA claim.
- TF-D08: desktop/mobile deployed smoke covers two isolated accounts, organizations, member/viewer behavior, rename/archive, reload, logout and denied requests. Evidence records commit, URL, time, environment and screenshots with synthetic data. Public README distinguishes demo limitations from product features.
- TF-D09: provider plan, selected region, estimated bill, monitoring threshold, recovery-resource allowance and stop/review threshold are recorded before creating paid resources. Reaching a budget review threshold requires operator action; do not present it as a provider-enforced invoice cap.

## Release boundary

D01–D09 and the release checklist must be evidenced before announcing the public app. This document adds requirements; it does not claim their implementation. Source repository visibility, license choice and GitHub presentation are independently tracked. Dates remain targets.

## Delivery stories

- US1 (P1): an operator migrates fresh/existing PostgreSQL using a non-superuser identity while users retain tenant and role isolation (TF-D02). This is TF-05a.
- US2 (P1): an operator runs the production artifact behind verified ingress (TF-D01/D03).
- US3 (P2): visitors use a bounded, temporary demo with clear feedback (TF-D04/D05).
- US4 (P2): an operator releases and recovers the hosted demo with measured evidence (TF-D06–D09).
