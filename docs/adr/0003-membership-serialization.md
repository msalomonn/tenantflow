# ADR 0003 — serialize owner-managed membership operations

Status: accepted implementation decision within approved TF-02 scope. Date: 2026-10-25.

Context: concurrent owners must not independently conclude another owner remains and both remove/demote themselves. Membership management also needs limited access to registered users without exposing the authentication schema to the app role.

Options: grant direct writes with recursive RLS membership policies; add application-only locking; expose narrowly scoped database operations with a shared organization row lock. Choose the last option: retain existing RLS policies/direct write restrictions and add owner-only list/mutation functions.

Every operation derives actor/organization from transaction-local context, checks owner authority, locks the organization row, and rechecks authority after waiting. Mutations count remaining owners while holding the same lock. Registered-user lookup is an exact normalized email match after authorization. Functions use an empty search path, qualified tables and revoked PUBLIC execution; the helper itself is not callable by the app role.

Trade-offs: owner management serializes within one organization, including short list operations. Different organizations remain independent. Security-definer functions require careful review and migration ownership; their small interface is preferable here to recursive policies or granting broad auth-table access. A compromised server capable of forging database identity and administrator operations remain outside the boundary. Account deletion stays disabled because its foreign-key cascade would require an ownership-transfer policy.

Validation: real database and HTTP concurrency tests, including two waiting connections and a revoked actor after lock acquisition. Direct runtime membership writes fail and nonowner function calls fail. Browser tests cover owner operations and cross-organization response races.

Revisit when adding account deletion, bulk membership changes, organization deletion or meaningful contention. New mutation paths must participate in the same lock and ownership checks.
