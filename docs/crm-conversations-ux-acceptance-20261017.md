# Conversations presentation acceptance — 2026-10-17

## Delivered scope

Implemented the approved compact session header, clear message stream and independent current follow-up summary in the local 4426 synthetic MySQL environment.

- Default to the session with the latest reliable message time. Only show the standard CRM session chooser when multiple nonempty sessions exist. Switching sessions does not mix their messages or task summaries.
- Customer and AI messages have explicit role labels and distinct restrained surfaces/alignment. Historical system receipts are lightweight event rows; unchanged receipt text can be expanded. Failure, interruption and pending states remain visible.
- Local operating-date separators and short message times replace repeated full timestamps. Each time retains its full recorded value in its accessible label and title. Missing original timestamps remain unknown, including legacy placeholder dates.
- Current linked tasks are displayed once per explicit task ID, with current state, owner and recorded deadline. Historical receipts remain separate, including repeated requests referencing the same task. Requests without task IDs are not silently merged.
- A 44px message-link icon retains the existing permission-controlled follow-up callback, source message and conversation reference. Opening it does not record contact or complete a task. There is no agent reply composer or generated summary.
- Internal session IDs are moved to the peer-level Conversation details disclosure. There are no nested disclosures.
- English, Indonesian and Chinese UI text and the online conversation guide were updated. Names, customer text, AI text, task actions and historical receipts are preserved verbatim.

## Automated checks

| Check | Result |
| --- | --- |
| Full suite with independent native MySQL test socket | 400 passed, 0 failed, 0 skipped |
| Final targeted conversation/time/disclosure/documentation regression after visual refinements | 33 passed, 0 failed, 0 skipped |
| TypeScript no-emit check | Passed |
| Independent test package build | Passed; output only under `build/p0-trust` |
| `git diff --check` | Passed |

New behavioral tests cover reliable session ordering, original unknown-time positions, duplicate message preservation, deduplicating task references without deduplicating evidence, missing task status, permission-dependent actions, trilingual states and the absence of a live reply editor.

## Browser and permission acceptance

Used simulated Sales Fadhil, simulated CRM Manager Robert and Sales Wigar for endpoint checks. Created three clearly named TEST customers only in the guarded independent database: Fadhil-owned, Wigar-owned and shared-pool. The browser exercised the Fadhil-owned and shared-pool records.

- Nine layout cases: English, Indonesian and Chinese at actual CSS widths 390, 768 and 1280. All had document width equal to viewport width, 11 unchanged messages, two distinct linked tasks, both duplicate customer messages retained, three visible reply-state indicators, no fabricated historical timestamp and no nested disclosures. Association targets measured approximately 44×44px; message text is 14px and wraps naturally.
- Shared CRM session selector supports keyboard activation/selection and Escape. The old session shows only its own original message and no unrelated task summary. The final singular option reads “1 message”.
- Enter expands the historical request receipt and exposes its unchanged original text; Space collapses it. Latest customer message scrolls to and focuses the most recent reliably dated customer article in the selected session.
- Activating the message-link icon enters the existing follow-up form with the original linked text. Selected task completions remain zero. The form was cancelled without saving; no contact or task mutation was performed.
- A shared-pool customer is readable but has no message-association action before claiming. A single-session customer has no unnecessary session selector.
- 27 read-only HTTP checks passed across lead detail, conversations and tasks: Sales can read their own and shared-pool records, cannot read the other Sales user's record, and Manager can read all three.
- Narrow dark-mode inspection passed. Sampled role/time/message/status text contrast against computed opaque ancestor backgrounds had minimum ratios 8.09:1 in dark mode and 6.05:1 in light mode. These are scoped checks, not a formal full-product accessibility certification.
- The updated online conversation guide rendered correctly in all three languages.

During inspection, corrected the singular session-option wording and removed empty bubbles for failed/pending replies with no text. No original message was deleted or rewritten.

## Data and runtime protection

- Guarded socket: `/private/tmp/uper-mysql-native-cleanup.sock`; database name must match `uper_trial_native_facts_tasks_browser_*`. Local3000's database socket was never selected.
- Fixture creation verified all pre-existing rows remained unchanged. After fixture preparation, before/after hashes matched for messages, conversations, leads, staff, tasks, rules, channels, settings, assessments, notification jobs and outbox.
- Local `.env.dev` and `build/dev/.uper-release.json` hashes matched. No local3000 restart, migration or resource switch was performed.
- No backend permission, task, classification or HSK scoring rule was changed in this round. No database migration was needed.
- Notifications stayed simulated with the worker disabled. No AI, Lark or WhatsApp request was sent, and no historical notification was replayed.
- No GitHub push or server/public deployment was performed.

Evidence is kept in the ignored local folder `.local-backups/crm-conversations-ux-20261017/`: automated test/build logs, guarded synthetic-fixture script and IDs, `permissions.json`, `browser-checks.json`, screenshots and `data-preservation.json`. No credentials or runtime customer records are included in this source report.

Independent test build: `425d1ebc6faf-146c9b776dde089a`; source digest `2b37f7d2da26d151d6d7eb3f5824fc5abd2b72312e71e3ef326f78df699a477a`; built at `2026-10-17T09:44:51.173Z`. This is a local dirty-source package, not a published commit.

## Limits

Acceptance used simulated roles and saved simulated failure/interruption records. No new live-provider failure test, screen-reader session or real-sales usability study was performed. Network-load retry behavior remains the existing implementation. Local3000 switching, GitHub synchronization and server deployment require separate instructions.
