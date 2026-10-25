# Authentication input-limit review fix — 2026-10-25

Reviewed source: `72bf8898a568c68ddb2302fb2d80d385ca1dc3c9`, TenantFlow PR #7. Fix source: the commit containing this checkpoint. Scope: one P2 review finding; no new MVP functionality, dependency or migration.

## Reproduction and acceptance

Authentication was mounted before the 16 KiB parser. A signup with a 32 KiB name returned 200 and persisted the name. The same oversized payload was rejected by the organization API. Regressions reproduced this with declared Content-Length and chunked transfer.

Acceptance: oversized authentication bodies return 413 before user/session creation; the limit also applies after decompression. Normal signup/sign-in/sign-out, cookies and revocation still work. Exactly 16 KiB of valid JSON is accepted; malformed JSON returns a safe 400 without echoing input.

## Change and evidence

Moved the existing bounded JSON parser before the auth handler. Inspection of the pinned adapter confirmed that it serializes an already-parsed request body; the positive auth tests verify that behavior rather than relying solely on library internals. Six regression cases were added; no raw credentials are logged.

`npm run typecheck`, `npm test` (17 passed), `npm run build`, and `npm run test:e2e` (4 passed, desktop/mobile) passed locally. Remote CI is recorded separately in the PR and final handoff. Existing screenshots are preserved because this fix does not change the UI.

The agent performed both implementation and technical self-review. This is not independent approval. The documentation PRs were reviewed without blocking findings; this checkpoint does not claim any PR was merged or any app deployed.

Next: check CI on the updated PR head, then integrate through the agreed personal-project workflow. Membership management and project edits remain subsequent tasks.
