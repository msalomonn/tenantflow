# ADR TF-0002: Better Auth with database-backed sessions

Status: accepted implementation decision within the approved MVP. Date: 2026-10-25.

## Context and alternatives

The first slice needs real authentication that runs locally without a paid service. Hosted OIDC would require service setup; custom authentication would duplicate sensitive library work. We selected Better Auth 1.7.13 with its PostgreSQL adapter and email/password flow.

## Decision

The library owns password hashing, signed session cookies and session persistence/revocation. Require passwords of at least 12 characters. Disable cookie-cached session state to observe persisted revocation immediately. Keep built-in authentication throttling enabled.

Web and API share an origin. Mutations require the exact configured Origin and JSON; library security checks remain enabled. A shared JSON parser limits decoded bodies to 16 KiB before authentication, including chunked and compressed input. The pinned Node adapter accepts the parsed body; regression tests cover that integration. Cookies are HttpOnly, SameSite=Lax and Secure in production. No tokens in localStorage or development bypass. For this direct local server, a private rate-limit header is overwritten with the socket IP. A future reverse proxy needs an explicit trusted-proxy decision.

Separate database roles serve migrations, authentication and application operations. The API refuses privileged runtime roles. Membership authorization is read on every request and does not depend on cached identity claims.

## Consequences and validation

Real sessions work without external services. Email verification/recovery, distributed rate limits and production deployment remain release work. No email is sent. Local fixtures use synthetic accounts. Tests cover cookies, CSRF, role enforcement and sign-out; see [verification](../verification.md).

References consulted 2026-10-25: [Express](https://better-auth.com/docs/integrations/express), [PostgreSQL](https://better-auth.com/docs/adapters/postgresql), [email/password](https://better-auth.com/docs/authentication/email-password), [security](https://better-auth.com/docs/reference/security). Installed package types and migrations were inspected too.
