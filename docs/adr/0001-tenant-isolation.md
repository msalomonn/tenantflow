# ADR TF-0001: Shared database with tenant-aware access

Status: proposed. Date: 2026-10-25.
Context: demonstrate secure isolation with a small operational footprint.
Options: database per tenant; schema per tenant; shared schema with explicit tenant keys.
Decision proposal: shared PostgreSQL schema, server membership checks and RLS as defense in depth. Use a restricted runtime role, transaction-local request context and tenant-aware constraints.
Trade-offs: inexpensive local/deploy setup and simpler migrations, but isolation must be verified on every path. Database/schema per tenant offer different isolation/operational trade-offs and are unnecessary for this MVP.
Validation: foreign-tenant read/write tests, pooled connection reuse, revoked membership and composite-reference attacks using the real runtime DB role.
Revisit: per-tenant compliance requirements or scaling/operational evidence that justifies physical separation.
