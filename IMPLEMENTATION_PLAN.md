# Production remediation Ralph loop

This file is the execution source of truth. Each iteration takes the first ready unchecked item, reproduces the issue, implements the smallest complete fix, runs its acceptance checks, records evidence, and repeats.

## Loop rules

- Never mark a task complete only because code was written.
- Never weaken or skip a failing check.
- Do not log secrets, tokens, webhook URLs, emails, or raw request payloads.
- If an identical blocker survives three iterations, record the blocker and required external action.
- Production completion requires every task and gate below to be checked.

## Execution queue

- [x] REM-001 Test and configuration foundation
  - Acceptance: `npm test` works; `.env.example` matches runtime keys; configuration failures are tested.
  - Status: COMPLETE
  - Evidence: Node test runner, lockfile, corrected `.env.example`, and configuration-path tests; `npm run check` and `npm audit --omit=dev` pass.

- [x] REM-003/004 Reliable webhook delivery
  - Depends on: REM-001
  - Acceptance: response is immediate; `waitUntil` owns delivery; timeouts and HTTP failures are handled; transient failures retry within the function duration.
  - Status: COMPLETE
  - Evidence: shared `waitUntil` delivery, abort timeout, status handling, bounded retry, redacted diagnostics, and passing response-lifecycle tests.

- [x] REM-005/006 Signed-token contract and migration
  - Depends on: REM-001
  - Acceptance: valid tokens work; tampered, expired, malformed, and endpoint-swapped tokens do not deliver; unsigned delivery is disabled by default.
  - Status: COMPLETE
  - Evidence: opaque AES-256-GCM tokens are audience-bound and expiring; rotation and opt-in legacy migration are tested; unsigned delivery defaults off.

- [x] REM-007/008 Provider identifier and URL safety
  - Depends on: signed-token contract
  - Acceptance: Beehiiv, Mailchimp, ConvertKit, numeric IDs, and plus-addressed emails pass; placeholders, arrays, and oversized values fail.
  - Status: COMPLETE
  - Evidence: Beehiiv UUID, Mailchimp opaque, ConvertKit numeric, and plus-address fixtures pass; arrays and placeholders fail.

- [x] REM-009 Classifier correction
  - Depends on: REM-001
  - Acceptance: Outlook is a client; Gmail is an image proxy; explicit scanner signals remain detectable; uncertainty is represented as confidence.
  - Status: COMPLETE
  - Evidence: client, image-proxy, prefetch, scanner, suspicion, and confidence signals are separated and covered by regression tests.

- [x] REM-010 PostHog and operational documentation
  - Depends on: all implementation tasks
  - Acceptance: clean setup from README works and every emitted property is mapped and explained.
  - Status: COMPLETE
  - Evidence: README, homepage snippet, environment contract, token workflow, legacy migration, complete PostHog mapping, and interpretation guidance updated.

## Gates

- [x] GATE-001 Local quality: two consecutive clean `npm run check` runs, `git diff --check`, dependency audit, secret scan, and final diff review.
  - Evidence: two consecutive 25/25 test-and-syntax runs, zero production dependency vulnerabilities, clean diff check, tracked-tree credential scan, and independent final review.
- [x] GATE-002 Preview: real Vercel preview verifies image bytes, signed delivery, rejection paths, retry behavior, and logs.
  - Evidence: deployment `dpl_8KPCmMRBzP6ct3Kv9asoP75tnrFL` returned HTTP 200 with the exact 70-byte 1x1 PNG; delivered one signed `email_opened` v1 event with an idempotency header; retried a forced 503 exactly once with the same key; emitted no event for unsigned or tampered requests; logs exposed no subscriber data, token, or webhook URL.
- [x] GATE-003 Security: no unresolved critical, high, or medium finding; exposed historical webhook is confirmed rotated.
  - Evidence: independent follow-up adversarial review passed with no critical/high/medium findings; the configured Vercel webhook differs from the historical exposed credential, confirming rotation without disclosing either value.
- [ ] GATE-004 Production: exact reviewed artifact promoted, smoke-tested, observed, and rollback target recorded.

## Completion signal

Only write `RALPH_COMPLETE` after every item and gate above is checked with evidence.
