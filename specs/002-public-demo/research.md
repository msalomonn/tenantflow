# TF-05 hosting research and decisions

Consulted 2026-11-05 (America/Argentina/Buenos_Aires). Proposal only; no hosting account/resource was created. Prices are USD before taxes and currency conversion, and must be reconfirmed in the provider console before purchase.

## Recommendation and alternatives

| Option | Published pricing and planning estimate | Fit |
| --- | --- | --- |
| Render paid web + Postgres, Hobby workspace | Web US$7/month + DB US$6/month: US$13 compute baseline. Budget US$13–16 for the small deployment before overages/temporary recovery resources; propose a US$20 monthly review threshold | Recommended: one origin and managed DB recovery with predictable base cost; prove role compatibility first |
| Railway Hobby, app + PostgreSQL | US$5 monthly minimum includes US$5 usage; excess is billed. Planning envelope US$10–20, not a quote or measured usage | Alternative: flexible database setup and configurable usage limits; custom SQL roles make DB operations the user's responsibility |

[Render pricing](https://render.com/pricing) was verified through official indexed pricing tables; the dynamically rendered direct page did not expose all rows in the text reader. Reconfirm the selected storage allowance/overage and current plan IDs before provisioning. The budget envelope above is our allowance, not a guarantee or provider-enforced cap. Do not buy a paid workspace, domain, autoscaling or extra service by default.

[Railway pricing](https://docs.railway.com/pricing/plans): RAM US$10/GB-month, CPU US$20/vCPU-month, volume US$0.15/GB-month and egress US$0.05/GB. Example assumption: combined 0.75GB RAM, average 0.05 CPU, 2GB volume, 5GB egress and 1GB incremental backup yields about US$9.20/month. Real consumption is unmeasured. [Usage limits](https://docs.railway.com/pricing/cost-control) can stop workloads; an alert is not a cap. [Database support scope](https://docs.railway.com/databases) makes custom SQL role configuration operator-managed. Its [status page](https://status.railway.com/) reported public-network reachability problems on some networks when checked; recheck before choosing it, not a permanent reliability judgment.

Decision: propose Render with one paid web instance and paid Postgres18, same region, provider subdomain, one web replica, manual releases and no automatic scaling/storage growth without review. Use an operator billing alert/review threshold at US$20; confirm available controls before describing any enforced cap. Temporary restore resources count in this allowance. Provider/region/budget remain user choices, not unresolved implementation assumptions to hide.

## Database roles

Render supports [additional credentials/users](https://render.com/docs/postgresql-credentials) but [does not provide superuser access](https://render.com/docs/postgresql-pg-repack). Exact default BYPASSRLS/role-membership privileges were not established from the official docs. Do not assume incompatibility is proven, and do not assume deployment works unchanged.

Code inspection: migrations001/002 use FORCE RLS while the SECURITY DEFINER functions run as the migration owner. Existing policies only target tenantflow_app; the local administrator bypasses RLS. [PostgreSQL RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html) explains why an ordinary forced-RLS owner is insufficient. Plan a portable, explicitly privileged non-login function role and prove it under a non-superuser migration connection. Verify CREATE ROLE/ownership transfer and grants on the approved provider before releasing; if unavailable, revisit the provider/design without silently weakening runtime isolation.

## Production process and ingress

[Render web service requirements](https://render.com/docs/web-services) require a reachable bind/PORT. The current loopback-only server and `.env`-dependent start need changes. Build the server once, retain production runtime dependencies, and inject secrets without packaging local files.

[Express proxy guidance](https://expressjs.com/en/guide/behind-proxies/) makes ingress trust deployment-specific. Current socket-IP throttling is safe against caller headers but groups visitors behind the proxy. An unconditional trust-proxy setting is not acceptable. Verify provider ingress behavior and direct/private paths; keep exact APP_ORIGIN independent from forwarded headers. Single replica avoids pretending current in-process throttling is distributed.

## Recovery and operations

[Render recovery](https://render.com/docs/postgresql-backups): paid instances support PITR, with a three-day Hobby recovery window. Recovery creates a separate instance and excludes timestamps in the most recent ten minutes. Logical exports have a separate retention policy. A successful restore rehearsal must include function owners and runtime roles, not only table rows. Plan target RPO24h/RTO2h for the synthetic demo; these are proposed acceptance targets, not measured guarantees.

Use [same-region internal DB connections](https://render.com/docs/postgresql-creating-connecting), restrict external database access, and explicitly verify pg TLS settings against provider requirements. Never globally disable certificate validation to make connection tests pass. A migration/operator job gets administrative credentials; the web service never does.

## Demo lifecycle

D04 proposes small durable quotas to bound storage; auth throttling alone does not bound account/project growth. D05 chooses a weekly operator reset for a dedicated synthetic demo, with an explicit notice, dry run and restore test. This is simpler than per-user TTL deletion across shared organizations, which could violate last-owner relationships. It is a proposed product condition, not an enabled scheduled task.
