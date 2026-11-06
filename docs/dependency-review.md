# Dependency review — TF-04

Date: 2026-11-05, America/Argentina/Buenos_Aires. Node 24.22.1 / npm 11.19.1, macOS arm64. Exact source head and Linux CI result are recorded in the PR.

Command: `npm audit --package-lock-only --audit-level=info --include=dev --include=optional --include=peer --json` (also available without JSON as `npm run audit`).

Lockfile SHA-256: `1c979e5382ccf6ff2f25ad00930c35e072b2d8e266d31bab306bddf1980be3a7`.

Result: exit 0, **zero reported advisories** at every severity. The [raw report](evidence/2026-11-05-npm-audit.json) records 211 dependencies (103 production, 108 development; optional classifications overlap). No dependency versions or lockfile were changed, and no audit fixes were applied.

CI audits the lockfile including development, optional and peer dependencies and fails on any reported advisory or registry failure. The audit runs separately after the local acceptance command, so both `npm run check` and `npm run audit` are required before integration. This policy follows the [npm audit options](https://docs.npmjs.com/cli/v11/commands/npm-audit/).

This is a dated check of known npm advisories, not a security certification or a scan of operating systems, container images, package provenance, licenses or deployed infrastructure. Findings can change without a lockfile change. Repeat before release; production hosting, quotas, retention and deployed TLS/proxy validation remain TF-05.
