# Verification — TF-00 / TF-01

Date: 2026-10-25, America/Mexico_City. Environment: local macOS arm64, Node 24.22.1, Docker PostgreSQL 18, Playwright 1.64.1 Chromium. Source: the commit containing this record and its PR head. Versions are locked and the database image is pinned by digest.

| Check | Evidence |
| --- | --- |
| `npm run db:migrate` twice | Repeatable migrations and SQL checksum guard |
| `npm run typecheck` | TypeScript source, tools and tests pass |
| `npm run build` | Production web bundle builds |
| `npm test` | 11 real-PostgreSQL API/integration cases pass |
| `npm run test:e2e` | 4 browser scenarios pass across desktop/mobile |

- TF-A01: real cookies, protected routes, browser sign-in/up/out and immediate revocation.
- TF-A02: atomic owner creation, including a failed membership insert with no partial organization.
- TF-A03/A04: scoped lists, foreign IDs, forged headers, forbidden writes, pooled context reuse and delayed browser responses.
- TF-A05: viewer read/write restriction; owner/member project creation; changed membership applied next request. Full membership management remains TF-02.
- TF-A06 (partial): names and persistence across API-instance replacement. Edit/archive remain TF-03.
- TF-A08 (partial): revocation and tenant-aware access; full membership mutation remains TF-02.
- TF-A09 (first slice): signup → organization → create/list/search → switch → reload → logout/login, plus console-error and horizontal-overflow checks.

Direct SQL tests use the restricted app role. The administrative test connection only prepares fixtures and inspects atomicity.

The initial harness failed before implementation existed; type checking found a missing CSS declaration. E2E exposed the real signup rate limit: tests now honor Retry-After rather than disabling it. The tenant-switch race is explicitly exercised.

Limits: no deployment, load test, email delivery, complete MVP or production cookie/proxy verification is claimed. Local evidence and remote CI are reported separately. Full last-owner concurrency, membership UI and project edits are open.

Screenshots use synthetic data: [desktop](screenshots/workspace-desktop.png), [mobile](screenshots/workspace-mobile.png).
