# Initial backlog

Planned work; GitHub Issues become the live status source after publication.

## TF-00: Select identity/session approach and bootstrap local stack

Depends on ENG-01 approval. Follow specs/001-tenant-isolation/plan.md. Record identity/session/CSRF ADR; pin dependencies and provide reproducible React/Node/PostgreSQL startup. No unverified dev-auth path in production.

## TF-01: Implement authenticated organization/project isolation slice

Depends on TF-00. Implement the first slice in specs/001-tenant-isolation/spec.md. Verify TF-A01–A05 and TF-A09 for create/list paths with real PostgreSQL, two tenants, negative access tests and browser evidence.

## TF-02: Implement membership management and full RBAC

Depends on TF-01. Verify TF-A05, TF-A07 and TF-A08, including concurrent last-owner protection and revocation on the next request.

## TF-03: Complete project editing, archive and UI states

Depends on TF-01. Verify TF-A03–A06 and TF-A09; test tenant-switch cache clearing, invalid input and persistent archive behavior.

## TF-04: Harden TenantFlow tests and CI

Depends on TF-02 and TF-03. Map all acceptance IDs to checks; cover negative integration/E2E flows and review dependency findings.

## TF-05: Deploy and document TenantFlow demo

Depends on TF-04 and hosting/cost decisions. Fulfill docs/release-checklist.md with deployed smoke evidence, synthetic demo data, English README and screenshots. Target 2026-11-13.
