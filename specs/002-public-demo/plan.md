# Implementation Plan: TF-05 public demo

**Branch:** `docs/6-deployment-plan` | **Date:** 2026-11-05 (America/Argentina/Buenos_Aires) | **Spec:** [spec.md](spec.md)

## Summary

Prepare a small paid Render web/API + PostgreSQL deployment after proving portable role ownership, production startup, ingress behavior and demo limits locally. Planning was recorded in PR#11. TF-05a now implements the portable role boundary in a dependent branch; subsequent steps remain planned. Provider choice is a proposal; no resource or bill has been created.

## Technical context

Node 24.22.1, TypeScript, React/Express/Better Auth and existing pinned PostgreSQL 18 stack. Target Linux, one web replica, same origin, same-region private database. Existing verification: 43 integration and 24 Chromium desktop/mobile cases plus build/typecheck/audit. Demo scale is bounded by TF-D04, not a throughput guarantee. No new runtime provider is needed for email or AI.

## Constitution check

Pre-design: pass for planning. Requirements precede code; one app/issue/branch; security invariants and recovery have explicit evidence. The user authorized preparing this proposal. Hosting/spending/public app approval remains an execution gate under constitution section 9, not a reason to stop preparing the design.

Post-design: same result. Scope is one modular application and database, no shared runtime or unrelated features. All technical uncertainties are converted into explicit preflight tests and release gates; none is asserted as proven. No implementation or deployment completion is claimed.

## Existing gaps found in code

| Evidence | Required change |
| --- | --- |
| `apps/api/src/server.ts` binds 127.0.0.1 | Configurable production interface and provider PORT; preserve safe local defaults |
| `package.json` start requires `.env` and devDependency tsx | Build an executable server artifact with production dependencies; verify start without .env or development packages |
| Migration-owned SECURITY DEFINER functions + FORCE RLS | Explicit non-login definer role and narrow grants/policies, tested under a non-superuser migration role; preserve runtime RLS |
| `apps/api/src/app.ts` uses socket IP | Provider-aware, spoof-resistant ingress policy; safe fallback throttling until verified; do not trust arbitrary forwarding headers |
| No durable demo counters or reset mechanism | Atomic quota enforcement and guarded operator maintenance with dry-run evidence |
| Existing tests run development server | Add a production-artifact check and actual deployed HTTPS smoke |

## Implementation sequence

1. **TF-05a: portable database boundary.** First reproduce organization bootstrap failure with a normal migration owner under FORCE RLS. Add a new forward migration for a NOLOGIN/NOSUPERUSER/NOBYPASSRLS definer role, narrowly scoped table/schema/column privileges and explicit policies for that role. Retain existing function checks, empty search path and revoked PUBLIC execution. Runtime roles must not inherit or SET ROLE into it. Verify creator membership/ownership transfer permissions locally, then preflight them on the approved provider. Never edit migrations 001–003.
2. **TF-05b: production process and ingress.** Build server output; start with environment-only secrets, configurable bind and health/readiness. Verify production assets/CSP, shutdown, cookie flags and proxy-header spoofing. Keep one replica until rate-limit storage is verified for scaling. Runtime service gets only app/auth DB URLs and auth secret; migration/admin secrets belong to a separate operator job.
3. **TF-05c: bounded demo.** Implement D04/D05 with failing concurrency/authorization tests first. Define creator accounting explicitly because current memberships do not identify an organization creator. Count archived projects. Add a clear temporary-data notice, quota feedback, and guarded weekly reset procedure. Reset scheduling is enabled only for the approved dedicated demo.
4. **TF-05d: deployment and recovery.** After provider/budget approval, create app/database, verify role compatibility, configure private networking, secrets and manual release gating, migrate once, deploy the selected image/build. Rehearse recovery into a separate target with runtime isolation checks. Remove temporary resources only after validating recovery and retaining needed evidence.
5. **TF-05e: publication.** Execute D08, complete release checklist and README/demo instructions. Record URL, source SHA, observed results, recovery timing and limitations. Source visibility is not equivalent to this application release.

## Project structure and planned interfaces

Keep `apps/api`, `apps/web`, `db/migrations`, `scripts`, `tests/integration`, `tests/e2e`. Add deployment build/config, role/quota migrations and an operator script in later implementation PRs. [Runtime contract](contracts/deployment.md) defines secrets and operational boundaries; [data model](data-model.md) describes the proposed additions; [validation guide](quickstart.md) defines evidence.

See [executable tasks](tasks.md) for verified implementation progress. T012 remains open in the MVP package; issue #6 tracks the sequence above.
