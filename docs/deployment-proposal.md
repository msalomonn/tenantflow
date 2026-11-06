# TenantFlow deployment proposal

Prepared 2026-11-05 (America/Argentina/Buenos_Aires), after TF-04 merged in [PR #10](https://github.com/msalomonn/tenantflow/pull/10) as `1d86f90bed232e764bb7f60144d8733a21f1179a`.

**Recommendation:** Render paid web + PostgreSQL18 on the free Hobby workspace, provider subdomain, one region/replica. Planning allowance: US$13–16/month before tax and exceptional usage; propose review before exceeding US$20. This is not a guaranteed hard billing cap. [Pricing, alternatives and caveats](../specs/002-public-demo/research.md).

**Decision requested:** provider preference and monthly budget. Publishing GitHub source is separately authorized; public app creation and spending are not yet approved. No resources have been provisioned.

## Work before launch

1. Make database function ownership portable under managed non-superuser credentials without weakening RLS.
2. Build/start production without .env or development dependencies; verify host/port, cookies and ingress throttling.
3. Enforce proposed demo caps:100 accounts,3 created organizations/account,50 projects including archived/organization,10 memberships/organization. Show temporary-data/no-email-recovery notice and implement a guarded weekly whole-demo reset.
4. After approval, provision, preflight role capabilities, migrate, deploy a CI-verified commit and rehearse database recovery on a separate target.
5. Execute deployed desktop/mobile smoke, publish screenshots and complete release evidence.

Requirements: [TF-D01–D09](../specs/002-public-demo/spec.md). Execution sequence: [plan](../specs/002-public-demo/plan.md). Validation: [quickstart](../specs/002-public-demo/quickstart.md). Proposed decision: [ADR0005](adr/0005-demo-hosting-proposal.md).

This proposal is reviewable design. It does not mark T012 or the release checklist complete and does not invent a public demo URL.
