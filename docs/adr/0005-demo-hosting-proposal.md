# ADR TF-0005: Proposed single-provider public demo

Status: proposed, pending Manuel's provider/budget decision. Date: 2026-11-05 (America/Argentina/Buenos_Aires).

## Decision proposed

One Render paid web service serves the built React app and Express API on one HTTPS origin, with one same-region paid PostgreSQL18 database. Keep the provider subdomain, one web replica, manually selected releases and separate migration credentials. Use the [cost comparison](../../specs/002-public-demo/research.md) as a dated estimate, not a quote. Railway is the alternative if the provider compatibility preflight or cost choice favors it.

## Rationale and consequences

Same-origin delivery preserves cookie/CSRF assumptions and avoids a separate frontend deployment. Managed recovery reduces operational scope for the portfolio. The smallest tier is a starting hypothesis, not a capacity guarantee. Quotas, operator maintenance and measured restore evidence are required before advertising a public demo.

Existing definer functions must not implicitly depend on the development administrator's superuser privileges. A new role/grant design preserves forced RLS and must pass isolation/concurrency tests under a non-superuser migration identity. Ingress trust and production startup also need implementation. These are release preparation tasks; the local MVP remains verified.

No paid resources, budget authorization, deployment or new availability claim follows from accepting these documents into Git. Source repository visibility is a separate decision. Revisit this ADR if managed role capabilities cannot satisfy the boundary, measured resource needs exceed budget, or availability requirements grow. Never weaken authorization merely to fit a hosting tier.
