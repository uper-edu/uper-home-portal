# Conversation history, follow-up entry and system events — 2026-10-17

## Delivered

- The selected-session header shows its latest reliable activity time, source, message count and operating timezone. With multiple sessions, the visible Conversation history entry shows the total including the selected session. Choices show date/time, source and message count in recent-activity order. Single-session records have no redundant chooser.
- Customer messages now have a visible icon-and-text Record follow-up button beneath the original message. It reuses the existing permission-controlled callback and follow-up form with the original message/conversation association. Opening the form does not save contact, create a task or select tasks for completion.
- System events distinguish Advisor contact request recorded, Booking request recorded and Enrollment interest recorded. Unknown historical action types use a generic request-recorded label rather than guessing from free text. A request is not a confirmed appointment, completed enrollment or completed contact.
- Each event has a subdued View original receipt disclosure; its unchanged original content and a historical-context explanation are shown on demand. Removed the inherited divider that competed with the event title. Current linked-task status remains separate and deduplicated by task ID.
- Updated English, Indonesian and Chinese UI, operating guide and system implementation guide.

## Where the system records are stored

The existing server stores request acknowledgements in MySQL `messages`. `content` is the original response; `conversation_id` links to `conversations`; `metadata.followupAction` identifies handoff/booking/enrollment and `metadata.taskId` links to `followup_tasks`. Some existing acknowledgements have the stored role `assistant`; request metadata makes them system events in the viewer. Current task state comes from `followup_tasks`, not historical reply text. No records were moved, rewritten or migrated in this round.

In the interface: customer → Conversations → selected historical session → corresponding system event → View original receipt. This explanation is also available in System explanation → Data dictionary and implementation; operating instructions are under Conversations and human requests.

## Acceptance

| Check | Result |
| --- | --- |
| Full tests with independent MySQL | 401 passed, zero failed/skipped |
| Conversation, documentation and disclosure targeted tests | 30 passed, zero failed/skipped |
| TypeScript no-emit check | Passed |
| Independent test package build | Passed; only `build/p0-trust` replaced |
| Diff whitespace check | Passed |
| Owner/shared-pool/Manager read permissions | 27 HTTP checks passed |

Browser checks used simulated Sales Fadhil and newly named TEST fixtures in the guarded independent database on port 4426:

- Nine language/layout cases: English, Indonesian and Chinese at CSS widths 390, 768 and 1280. No whole-page horizontal overflow; no nested disclosures. All 12 messages and three linked tasks remained present. Four historical request events retained distinct message identities, including two handoff receipts for one task. Record follow-up buttons have visible translated text and approximately 44px minimum height.
- The history chooser is keyboard operable. Selecting the older session displays only its own original message and removes unrelated task summaries; selecting the recent session restores its records.
- Record follow-up opens the existing form with the exact linked customer text and zero task completions selected. Cancelled without saving.
- Enter/Space can open/close each of the handoff, booking and enrollment receipts; all three original texts were visible unchanged. Final computed receipt border is zero and its secondary disclosure text is 12px versus the 14px event title.
- Shared-pool records remain readable but do not expose a Record follow-up button before claiming; a single-session record has no history chooser.
- Narrow dark-mode visual inspection passed. Three-language operating and implementation-guide browser checks all passed.

## Data and environment protection

New fixtures were created only in the dedicated `uper_trial_native_facts_tasks_browser_*` database through `/private/tmp/uper-mysql-native-cleanup.sock`. Fixture preparation verified pre-existing protected rows were unchanged. After preparation, final hashes matched for messages, conversations, leads, staff, tasks, rules, channels, settings, assessments, notification jobs and outbox. Local `.env.dev` and `build/dev/.uper-release.json` hashes matched.

No backend business/permission/identity/classification/scoring logic or saved deadlines changed. The 4426 worker stayed disabled and notifications simulated; there were no external AI, WhatsApp or Lark calls or historical notification replays. Local3000 was not restarted, migrated or switched. No GitHub push or server deployment occurred.

Evidence: ignored `.local-backups/crm-conversation-actions-20261017/`, containing guarded synthetic fixtures, logs, permission results, browser checks, screenshots and hash verification. These are not staged for Git.

Final independent package: `425d1ebc6faf-a502a39b4cd67237`; source digest `9152dd6a64b39b2fac35ad8198766b6fca12433c546157e62ad0ac46953dd91c`; built at `2026-10-17T09:54:05.637Z`. This identifies a dirty-source local package, not a published commit.

Limits: internal simulated acceptance only; no real-sales usability research, live-provider failure exercise or formal screen-reader certification. The full suite preceded the final CSS-only divider removal; the final independent build and browser inspection verified that refinement.
