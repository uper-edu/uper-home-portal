# Users & access P0 acceptance — 2026-10-14

**Result:** core implementation and independent MySQL/API acceptance pass. The four requested final browser functional flows also passed in the follow-up linked below; physical-mobile/server release gates remain. This is not approval to switch local 3000 or deploy.

## Environment and protection

- Independent standard MySQL 8.4.11, isolated native socket, newly named synthetic databases; no real customer import.
- Preview: `http://127.0.0.1:4460/system`, loopback only, synthetic accounts/customers/tasks, notifications simulated and preview worker disabled.
- Existing local 3000 database/environment were read only for protection checks. All **30 table counts and content fingerprints**, environment-file hash, and **5 protected business/HSK source hashes** matched before/after. No historical notification replay, account update, customer reassignment, deadline/config update or cutover was performed on 3000.
- No GitHub push or server/public deployment. Private environment files, credentials, checkpoints, backups and raw evidence remain ignored under `.local-backups/access-p0-20261014/`.

## P0 matrix

| Item                           | Evidence/result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Boundary                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrator recovery/restore | Existing stable account only; inactive enable must be explicit; stale confirmation rejected; owner-only independent recovery record; fresh password and session revocation; account-specific login lock cleared; no new business roles. Checkpoint detects changed authorization and altered checksum.                                                                                                                                                                                                        | Offline execution intentionally restricted to independent synthetic/non-3000 targets. Explicit re-enable reactivates retained roles, which require preview approval. Real maintenance execution remains separately gated. |
| Secure backup restore          | Empty target and backup checksum required; interrupted-restore barrier blocks startup; old sessions cleared; historical notifications held; business locked; fresh credentials and per-account authorization approval required; release revokes review sessions. Pre-role-table MySQL backups also get the gate and a serialization row, without automatic role/account seeding.                                                                                                                              | Checkpoint checksum is not proof of authorship. A trusted independent checkpoint or explicit human review is required. No claim of a production restore drill.                                                            |
| Reliable management            | Ten concurrent retries create one account/audit. Changed-content reuse conflicts. Lost response after commit is recoverable through durable receipt. Injected pre-commit failure rolls back changes. Password reset/self-change replay safely; secrets absent from receipts. Closing an unresolved operation is serialized against the original request, prevents late commit, creates one closure audit, and cannot undo a committed write.                                                                  | Browser persistence stores only actor/path/operation ID. Original secret input is not recoverable from browser storage. Final UI result-query/close flow still needs browser verification.                                |
| Disable/eligibility handover   | Access/session invalidation immediate; ownership and deadlines retained. System-only admin receives counts, not customer records. Selected customer/task transfers validate scope, recipient, current status and revision; partial transfers leave unrelated work unchanged; closure requires no remaining work. Parallel administrator removal retains one complete administrator.                                                                                                                           | Real customer records were not used. Final browser selection/closure walkthrough pending.                                                                                                                                 |
| Initial credentials/HTTPS      | New initialization refuses missing/publicly readable password files and fixed test passwords outside synthetic test mode. Existing initialized accounts unchanged. Verified local TLS test checks certificate rejection/explicit test CA trust, Secure/HttpOnly/SameSite cookie, Origin restrictions, trusted peer enforcement and overwritten forwarded headers. Login ID/email share account limit: ten concurrent wrong attempts yield five 401 and five 429. Distinct staff identity and logout verified. | Multi-source IP uses controlled test-harness source mapping. Actual company proxy/certificate and browser HTTPS not verified. Existing staff passwords were not silently replaced.                                        |

## Defects discovered and addressed

1. MySQL repeatable-read snapshots could let parallel alias logins exceed the failed-attempt threshold. Locked current reads now refresh the account and limit counters; role projection uses the transaction connection rather than requesting another pool connection.
2. A result query hidden behind the editor prevented resolving a lost save response from that form. The query status is now rendered inside the editor as well as the workspace.
3. Native discard confirmation interfered with browser automation. Replaced with an inline keep-editing/discard choice that preserves the draft. Final browser interaction remains unverified.
4. Reload retained operation metadata without retaining secret input. Explicit closure now resolves this safely: atomic committed-result return or cancellation tombstone, never merely deleting local metadata and issuing a new ID.
5. Parallel worker regression exposed an InnoDB deadlock in the idempotent expired-lease recovery UPDATE. Only that autocommit statement now retries a rolled-back deadlock up to three attempts. Other/unknown database errors and provider sends are not retried by this helper; unknown Lark outcomes remain unknown.
6. A backup predating `access_roles` could otherwise skip restore review. Restore now migrates and installs the security gate regardless of that table's presence, preserves the policy serialization row, and prevents default-account seeding after release.

## Automated results

- Full root suite (`npm test`, packaged npm CLI): **313 passed, 0 failed, 0 skipped** on the final source.
- `npm run lint`: passed.
- `npm run build`: passed; active 3000 serves its existing private build directory and was not replaced/restarted.
- Native SQL catalog: **248 statements**, check passed.
- `git diff --check`: passed.
- Additional `npm run test:mysql`: 8 unit checks passed; 7 separately gated legacy integration/live-AI jobs skipped. These skips are not counted as passes and are separate from the fully executed root suite above. No existing 4412 service or real AI key was used to force those jobs to run.
- Online guide adds five EN/ID/ZH chapters: administrator recovery, restore review, uncertain operations, initial credentials/HTTPS, and handover. Error/status/audit labels updated in three languages; names, notes and customer text remain untouched.

Raw logs: `acceptance-tests-final.log`, `lint-final-release.log`, `acceptance-build-final.log`, `mysql-unit.log`; protection evidence: `local3000-protection-before.json` / `local3000-protection-after.json`. These local evidence files are not source artifacts to publish.

## Browser evidence and remaining gates

Browser loaded the independent system page, reflected a synthetic disabled Fadhil account, and showed one pending staff handover with one customer/two tasks. Read-only DOM measurements at **390, 768 and 1280px** found no document horizontal overflow on the Users view. This does not certify every editor, language, theme or accessibility state.

The browser's automated click/keyboard actions stopped producing page changes while DOM reads/navigation/screenshots continued to work. Final editor/query/close/handover, three-language switching, keyboard focus and dark/narrow-screen interaction walkthroughs could not be completed. No browser security interstitial was bypassed and the user’s 3000 tab was not changed. Screenshot: private `system-final.png` (independent synthetic preview only).

Still required before claiming full UI acceptance/cutover readiness:

1. Repeat the complete browser workflow after input automation works, including lost-response recovery, cancelled delayed request, selected partial handover, draft protection, three languages, narrow viewports and keyboard operation.
2. Validate the actual HTTPS reverse proxy, real certificate/browser cookie behavior and real source-IP forwarding. Local verified-TLS simulation is not server deployment acceptance.
3. Separately approve and rehearse the offline maintenance tool’s real-environment execution gate and administrator identity/authorization procedure. Current tool intentionally cannot target 3000.
4. Execute the approved local cutover checklist only after those applicable gates and a separate switch authorization. No cutover is included in this task.

Implementation/recovery instructions: [P0 runbook](./users-access-p0-runbook-20261014.md).

## Browser follow-up

The previous browser-input blocker was cleared. Editing, uncertain-result query/closure, deactivation/selected handover, and EN/ID/ZH switching are now browser-verified. Two substantive UI defects were repaired: conflicting stale result errors and shared handover drafts. Earlier “pending browser” boundaries in this initial report are superseded only for those explicitly retested flows. The follow-up also verified real 390/768/1280px CSS viewports through a private iframe harness after the viewport tool failed to apply its override. See the [final browser acceptance](./users-access-p0-browser-acceptance-20261014.md) for exact coverage and remaining physical-device/server limits.
