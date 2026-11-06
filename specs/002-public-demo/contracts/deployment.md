# TF-05 deployment contract

Proposed only. Implementation PRs must satisfy these interfaces before provision/public release.

| Boundary | Contract |
| --- | --- |
| Web process | NODE_ENV=production; provider PORT; explicit bind; built frontend/server; no required local .env, Vite server or migration execution |
| Runtime secrets | APP_ORIGIN is the exact HTTPS origin; BETTER_AUTH_SECRET remains stable across deploys; DATABASE_URL uses tenantflow_app, AUTH_DATABASE_URL uses tenantflow_auth. No administrator URL/password in the web environment |
| Migration job | Separate administrator/migration connection and role-creation secrets; advisory lock and existing checksum guard; fresh/upgrade/repeat preflight. Never run local setup against hosted data |
| Database | PostgreSQL18, same-region private connection, explicit TLS policy verified with Node pg; app/auth roles satisfy startup checks; function owner cannot be assumed superuser |
| Ingress | HTTPS edge, exact Origin independent of forwarded Host/Proto; accept client IP only from a verified ingress boundary. Reject/bound malformed chains and prove spoofing cannot evade rate limits; no blanket trust-proxy setting |
| Readiness | /api/health checks database; deployment does not route traffic to a failing build. Bounded shutdown and DB failure behavior are tested |
| Demo writes | Authenticate/authorize before quota feedback; atomically reserve capacity and roll back on failure. Safe quota errors with no foreign metadata, no silent deletion to free quota |
| Maintenance | Operator-only dry-run/apply, explicit demo target confirmation, maintenance admission gate, no endpoint. Protect against wrong environment and partial reset; no destructive command is enabled merely by creating this plan |
| Release | Selected commit with passing CI/audit, manual rollout until gate verified; no unreviewed branch auto-deploy. Secrets/log redaction and deployment source are verifiable |

Recovery: stop new writes, preserve original database, restore to a separate target, validate roles/functions and D02/D08, invalidate restored sessions, then repoint both runtime connections. App rollback is permitted only if schema compatibility is proven; otherwise forward-fix or restore a compatible pair. Do not execute down migrations or overwrite a live volume blindly.
