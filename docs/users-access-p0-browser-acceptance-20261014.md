# Users & access P0 — final browser interaction acceptance

Date: 2026-10-14. This report supersedes the earlier browser-input blocker for the four requested functional flows. Independent preview only: `http://127.0.0.1:4460/system` and `http://localhost:4460/crm`; both point to the same synthetic MySQL database. The different hostnames isolate mock Robert and mock sales/manager browser sessions.

## Result

**Editing, saved-result query, deactivation/handover and EN/ID/ZH switching passed in the browser.** The existing 3000 application was not switched, restarted or written to. No GitHub push or server/public deployment was performed.

| Browser scenario                                      | Observed outcome                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit an existing mock account                         | Fenny display-name edit saved; Login ID and roles retained. Changes without a reason cannot be submitted. Closing a dirty form presents inline Keep editing/Discard choices; Keep editing retains the input.                                                                     |
| Response interruption after commit                    | A connection-drop injection returned a successful browser result; the database recorded one write. To deterministically exercise the uncertain-result UI, a test-only post-commit 503 was also used. Draft, operation ID and Check result remained accessible inside the editor. |
| Query a committed result                              | Query confirmed commit and showed the actual saved revision/name. Fixed the contradictory old “outcome unconfirmed” error: it now clears and the current record loads without silently overwriting other draft edits.                                                            |
| Failure before commit                                 | Test-only rollback returned 503; query remained unconfirmed. Explicitly closing the unresolved operation created a cancellation receipt. The saved revision/name remained unchanged; after reviewing the current version, a new operation saved the retained draft successfully. |
| Refresh and change language with an unresolved result | Chinese uncertain save → explicitly close/discard the form → refresh → switch to Indonesian → query the same operation ID. The durable committed result was found and the saved account name was correct.                                                                        |
| Disable a mock salesperson                            | Wigar first signed in and saw the one owned customer. Mock Robert disabled Wigar. Reloading the old sales browser session returned to sign-in. The customer's ownership and task deadline were retained pending handover.                                                        |
| Manager handover                                      | Mock Suki, CRM Manager without system administration, opened CRM handovers. Fadhil and Wigar appeared as separate cases. Only selected customer A and task A transferred first; task B remained with Fadhil. Wigar customer B transferred separately.                            |
| Independent handover drafts                           | Found and fixed shared recipient/reason state. Different reasons and recipients now belong to each case. Saving Fadhil's case retained Wigar's checked customer and independent reason; it did not clear the other draft.                                                        |
| Receiver permission check                             | Attempting to transfer task B to Zainul, who could not access its customer, was rejected. Selection/reason remained. Choosing eligible Tester then succeeded. No role or data-scope grant was added.                                                                             |
| Explicit completion                                   | Partial cases could not be marked complete. Once a case had no remaining work, the irrelevant receiving-owner field was hidden and a reason plus explicit confirmation was required. Both Fadhil/Wigar cases ended in `completed`.                                               |
| Immediate list consistency                            | Customer owners refreshed immediately after handover; task-owner display retained the separate remaining task until it too was transferred. Existing polling remains as fallback.                                                                                                |
| System access boundary                                | Suki visiting `/system` received “System management access denied”; no user directory or management controls were returned.                                                                                                                                                      |
| Three languages                                       | English, Indonesian and Chinese navigation, account form, status/error messages and all five P0 guide chapters rendered in their selected language. Names and human-entered reasons retained original text. No roles or credentials were edited to perform language checks.      |
| Keyboard basics                                       | Shift+Tab/Tab wrapped within the editor; Escape closed it without data changes when clean. ArrowLeft switched the language radio. ArrowDown opened the role picker; Escape closed only the picker and returned focus to its trigger, leaving the editor open.                    |
| Theme                                                 | Light/dark controls worked in the independent preview; the test restored light mode. No local-3000 preference was changed.                                                                                                                                                       |

## Fixes in this follow-up

1. Confirmed operation results now notify their owning form. Obsolete errors are cleared and the actual saved record is refreshed while drafts remain explicit.
2. Recipient, reason and selected items are isolated per handover case. Successful submission clears only that case's selected work/reason.
3. An empty recipient now says Select an owner in the selected language, instead of Unavailable option. Completed-work review hides the irrelevant recipient field and omits it from the completion request.
4. CRM refreshes the current filtered list on access/handover changes, rather than relying only on the polling delay.
5. Restore-review state also reloads after a resolved management operation. This is a consistency fix; the restored-database workflow itself remains covered by the earlier MySQL/API acceptance, not a new browser restore drill.
6. Added synthetic-only one-shot pre-commit and post-commit-HTTP failure hooks for deterministic browser verification. Normal operation cannot be faulted by these headers without the explicit synthetic fault environment. Regression covers HTTP failure after commit, replay and the disabled-hook boundary.

The online System Guide explains refreshed confirmed results and independent handover drafts in EN/ID/ZH. No HSK grading/content, customer classification, existing role definitions or notification policies were changed.

## Data evidence

Private evidence directory: `.local-backups/access-p0-20261014/`.

- Before/partial/after/final mock snapshots: `browser-data-*.json`.
- Both targeted cases: `completed`.
- Customer A/B final Owner: Tester.
- Task A/B final owner: Tester; unrelated booking task owner: **Zainul**, unchanged.
- All three task deadlines and statuses matched the pre-handover snapshot. No task was completed or rescheduled by the handover.
- Existing non-owner customer fields and all nine accounts' role assignments matched. The fixture initially omitted `businessNumber`; the existing list normalization filled it with each pre-existing test ID. This was not a classification/scoring change and is recorded rather than hidden as a strict byte-for-byte profile match.
- Display-name edits and deactivation occurred only in the synthetic preview. No credential reset, real account activation or broader access grant was performed through the browser.

The fresh fixture has no notification jobs or channels. The CRM banner counted missing channel references as “Notification failures”; these are fixture configuration-readiness issues, not ten actual sends. This pre-existing aggregate label was not changed by this follow-up, no real notification was sent, and historical records were not replayed. Distinguishing configuration problems from delivery failures is a separate presentation improvement.

## Automated checks

- Full root `npm test`, using independent native MySQL: **313 passed, 0 failed, 0 skipped**.
- `npm run lint`: passed.
- `npm run build`: passed; the active 3000 static directory was not replaced.
- Native SQL catalog: **248 statements**, check passed.
- `git diff --check`: passed.

Local logs: `browser-tests-final.log`, `browser-lint-final.log`, `browser-build-final.log`. These and the synthetic DB snapshots are evidence, not files to publish.

## Screenshots

All are private synthetic preview evidence:

- `browser-query-confirmed.png`: committed result, actual saved version, no obsolete error.
- `browser-closed-uncommitted.png`: closure blocks late execution and retains the original saved version.
- `browser-unknown-zh.png` / `browser-refresh-result-id.png`: Chinese uncertain state and Indonesian query after refresh.
- `browser-disabled-session.png`: old sales session no longer authorizes CRM access.
- `browser-partial-handover.png`: partial work plus another case's retained draft.
- `browser-recipient-scope-rejected.png`: receiver scope rejection without discarding input.
- `browser-guide-zh.png` / `browser-guide-id.png`: translated online P0 guidance.

## Limits and remaining work

- The browser viewport API initially accepted 390/768 requests without changing the effective viewport; `browser-layout-checks.json` records those failed attempts. A private same-origin iframe harness then supplied real CSS viewports: 390/390, 768/768 and 1280/1280 viewport/document widths. Editor bounds were 0–390, 48–768 and 560–1280; role popovers were 17–373, 69–747 and 581–1259. `browser-responsive-results.json` and `browser-responsive-*.png` retain the successful layout/keyboard evidence. This is responsive browser verification, not physical-mobile touch/virtual-keyboard certification.
- Keyboard basics are verified, not a formal screen-reader or WCAG AA certification.
- Actual company HTTPS proxy/certificate/browser behavior and the real-environment offline administrator recovery gate remain separately approved release work.
- Password reset and restoration credentials were exercised by the independent MySQL/API suite, not entered or changed through browser automation in this follow-up.
- No 3000 switch, GitHub synchronization, public deployment or real-user trial is authorized by this report.

Related: [P0 implementation acceptance](./users-access-p0-acceptance-20261014.md) · [Recovery runbook](./users-access-p0-runbook-20261014.md).

## Final protection check

The browser-run before/after comparison matched all 30 local-3000 table fingerprints and the environment-file hash; the five protected business/HSK source hashes also matched. The preview was restarted without fault injection. Test-only AI/Lark environment values are blank and no notification delivery was exercised.
