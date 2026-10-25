# TenantFlow

A multi-tenant project workspace demonstrating authorization boundaries and organization-scoped data.

**Status:** TF-00/TF-01 implemented and verified locally; awaiting PR review. No public deployment yet. Constitution and MVP scope approved on October 25, 2026.

React + TypeScript, Node.js + Express, Better Auth and PostgreSQL with restricted runtime roles and row-level security. The first slice supports signup/sign-in, organizations, project creation/list/search and tenant switching. Membership administration and project edit/archive remain planned.

![TenantFlow workspace](docs/screenshots/workspace-desktop.png)

## Run locally

Requirements: **Node 24.22.1** (see `.node-version`) and Docker with Compose.

```sh
npm ci
npm run setup
npm run db:up
npm run db:migrate
npm run dev
```

Open http://localhost:4310. Create an account with a password of at least 12 characters, then create an organization and a project. Local signup does not send verification email. Use synthetic data.

Setup generates random local credentials in a gitignored `.env` and never overwrites it. Keep that file alongside the existing database volume; deleting it does not reset database passwords. PostgreSQL listens on local port 55432. Stop it with `docker compose stop db`; data persists in its volume.

## Verify

With PostgreSQL running and migrations applied:

```sh
npx playwright install chromium
npm run check
```

Stop an existing development server before the browser checks: Playwright owns port 4310 during the run. The checks type-check code, build the web bundle, run real-database integration tests and exercise Chromium at desktop and mobile sizes. Tests create synthetic accounts and organizations in the local database.

Local results: **17 integration tests and 4 browser scenarios passed**, plus type checking and production web build. [Verification and limits](docs/verification.md) distinguish the initial slice from the complete MVP. CI runs the same commands on pull requests; see the PR for its independent result.

## Engineering records

- [Architecture and trust boundaries](docs/architecture.md)
- [Identity decision](docs/adr/0002-identity.md)
- [MVP specification](specs/001-tenant-isolation/spec.md)
- [Implementation plan](specs/001-tenant-isolation/plan.md)
- [Tasks and completion checklist](specs/001-tenant-isolation/tasks.md)
- [First-slice checkpoint](docs/checkpoints/2026-10-25-first-slice.md)
- [Constitution](.specify/memory/constitution.md) and [approval](docs/governance.md)
- [Release checklist](docs/release-checklist.md) and [Spec Kit setup](docs/spec-kit.md)
- [Open work](https://github.com/msalomonn/tenantflow/issues)

The tentative full-MVP target is November 6, 2026; public release is November 13. Membership administration, last-owner concurrency protection, project editing/archiving and deployment remain open. This local slice is not a production-readiness claim.

The cross-project roadmap lives in [portfolio-engineering](https://github.com/msalomonn/portfolio-engineering).
