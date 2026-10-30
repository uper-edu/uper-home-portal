# Questionnaire registration save reliability

Registration uses a submission ID distinct from customer identity. The browser keeps the ID, a SHA-256 input fingerprint generated submission time and the unresolved original form draft in visitor-scoped tab session storage. The draft is cleared when the corresponding save is confirmed, including read-only recovery after refresh; it is not put in persistent local storage or diagnostic logs. Repeated delivery uses the original ID. A new, deliberate submission uses a fresh ID.

`POST /api/portal/register` accepts `submissionId` (16–100 ASCII letters, digits, `_` or `-`). The server fingerprints the request excluding `submissionId` and the form-generated `submittedAt`; these are transport metadata, not selected answers. The visitor registry/session locks serialize concurrent registration. The original questionnaire fact and a `site_submissions` row of kind `registration` commit in the same transaction as the existing customer/event/first-contact behavior. Equal ID plus equal input returns the existing result. Changed input with the same ID returns409. New explicit IDs remain separate submissions even if answers match.

For older callers without an ID, an exact-input compatibility ID is derived from the fingerprint within the visitor scope. Repeated equal answers therefore do not append duplicate questionnaire facts. Such callers must provide a fresh explicit ID to express a new submission with unchanged answers. No historical rows are backfilled or rewritten.

`GET /api/portal/registrations/:submissionId` checks the current live visitor and optional visitor-scope guard, locks that session to avoid racing a pending write, and reads only the corresponding registration receipt. It verifies that the receipt belongs to the same visitor and currently associated customer, returns `Cache-Control: no-store` and an allowlisted public profile. It never resubmits answers, creates a customer/fact/event, or reads another action's receipt. Missing or inaccessible results are404; stale visitor scope is409. A404 is not proof that a transport-level save never happened and is not presented as confirmed failure.

The questionnaire distinguishes:
- Confirmed validation rejection: keep entries, allow correction and a new submission attempt.
- Unconfirmed save (disconnect, timeout, gateway5xx, invalid success body): keep the original ID and entries, disable editing of that unresolved attempt and offer **核对保存结果 / Check save result / Periksa hasil**.
- Explicit retry: **使用原提交重试 / Retry original submission / Ulangi kiriman awal** first queries the receipt; only if not found does that user action resend the original submission. Query failure never silently authorizes another write.
- Confirmed saved: use the server profile and continue to the original consultation/assessment branch.

No new sales task kinds, Tier recalculation rules, notification replay, owner permissions, assessment grading or real-channel policy is introduced. Existing first-contact creation on initial registration/identity release is retained. No schema migration is required; existing `site_submissions` storage is reused.

Verification requires isolated synthetic databases, simulated notifications and no copied customer/account data. Unit checks cover uncertainty and query-only behavior; native integration covers same/new/legacy requests, concurrency, scope isolation and failure at receipt insertion. Edge checks exercise normal translation OFF/ON, failure before commit, failure after commit, original-attempt retry and browser refresh. Previously skipped outreach fixtures must send current identity-comparison revisions, contain original submittedAt and preserve the current first-contact requirement.
