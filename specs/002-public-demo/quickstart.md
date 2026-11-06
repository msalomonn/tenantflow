# TF-05 validation guide

This is a future validation procedure, not proof of a deployment. Complete local preparation before creating resources. Hosting/budget approval precedes paid execution.

## Baseline already available

Use a dedicated local test database, Node24.22.1 and Docker. From repository root:

```sh
npm ci
npm run setup
npm run db:up
npm run db:migrate
npm run db:migrate
npx playwright install chromium
npm run check
npm run audit
```

Keep the existing .env with its volume; setup must preserve it. Stop the development server before Playwright takes port4310. These baseline tests prove the local MVP, not D01–D09.

## Preparation evidence to add

1. Start the production artifact without .env/development dependencies, inject synthetic secrets at runtime, verify bind/readiness, built assets and shutdown. Test a separate non-superuser migration owner on fresh and existing databases, including repeat migration and existing RLS/owner races.
2. Test spoofed forwarding headers through the intended ingress shape, secure cookie behavior, wrong-origin rejection, real revocation and one-replica throttling. Document exactly which header source is trusted and why.
3. At quota boundaries, race two operations for one remaining slot and require one success only. Confirm foreign users cannot learn capacity. Dry-run and rehearse reset on a disposable demo target; verify session invalidation and no partial records.

## Approved-host validation

Record commit, region, provider configuration and time. Run migrations via the separate operator job, verify role properties/function ownership, and deploy the same checked artifact. With two synthetic accounts, execute signup/signin, organizations, all role restrictions, create/rename/archive, workspace switching, reload, sign-out, direct foreign requests and exact-origin negatives over HTTPS. Inspect desktop/mobile screenshots and browser console.

Take a recoverable snapshot/export, restore to an isolated target and measure recovery. Verify schema checksums, ownership/policies, restored sample data and invalidated sessions. Keep the original DB until validation succeeds. Record billing impact of temporary resources.

Only mark release checklist items complete when corresponding evidence exists. No production URL is available in this planning branch.
