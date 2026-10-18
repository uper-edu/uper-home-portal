# CRM customer-detail spacing acceptance — 2026-10-17

Scope: shared information rhythm across Follow-up, Conversations, Profile and Assessment. The Conversations structural redesign remains a proposal, not part of this implementation.

## Changes

- Customer group now uses one continuous facts grid. Removing the separate basis wrapper removes the extra gap between buying signals and classification source.
- Shared spacing: major sections 24px; subsections 16px; heading-to-content 12px; fact rows 8px; field label-to-control 4px.
- Single-line fact cells have a 24px minimum. Primary form controls, tabs and disclosure rows have a 44px minimum. Multiline content grows naturally; notes, messages and labels are not clipped or forced to a fixed height.
- Follow-up sections, form labels, task rows, assessment evidence and conversation message spacing follow the same information hierarchy. Removed the narrow-screen facts-grid gap override.
- English, Indonesian and Chinese workspace-guide text describes the behavior.

## Verification

- Independent MySQL simulated environment on 4426 only; no local3000 cutover, GitHub push or server deployment.
- Targeted presentation/documentation tests: 47 passed, zero failures/skips.
- Full test suite using the independent MySQL socket: 395 passed, zero failures/skips. Final CSS-only refinements were followed by targeted tests, type checking and rebuilding.
- Type checking, independent test package build and `git diff --check` passed.
- Browser walk-through: simulated Sales user Fadhil; four tabs in English at CSS 1280px, Indonesian at 768px and Chinese at 390px. No document horizontal overflow or nested disclosures in these cases.
- Supplementary loaded-message checks confirmed the actual original conversation text and 16px message spacing in all three languages; initial asynchronous loading snapshots were not treated as message-rendering evidence.
- Customer-group single-line cells measured approximately 24px, consecutive row gaps approximately 8px. Follow-up form grid gap 16px, label gap 4px, primary controls at least 44px. Keyboard disclosure activation/collapse retained the unsaved draft; the test draft was not submitted.
- The new workspace-guide paragraph rendered in all three languages.
- Before/after hashes matched for simulated leads, staff, tasks, rules, channels, settings, assessment attempts, notification jobs and outbox. Local `.env.dev` and `build/dev/.uper-release.json` also matched. No business-record save was performed during this presentation check.
- No scoring/classification logic, backend behavior, permissions or deadlines changed for this spacing task. No external messaging or AI call was used.

Evidence: ignored local folder `.local-backups/crm-detail-rhythm-20261017/`, including test/build logs, `browser-checks.json`, screenshots and `data-preservation.json`.

Independent build: `425d1ebc6faf-e4176f2f5c427dad`; source digest `b8c76b2ddf5c6ee78fa8a7d8c3db31206adfb069bbef780846fc53bcdc5a429e`; built at `2026-10-17T09:35:20.834Z`. This identifies a local dirty-source test package, not a published commit.

## Limits and next proposal

This is internal simulated browser acceptance, not real-sales usability research or a formal WCAG certification. Conversations still has competing metadata/actions and mixes historical system receipts with current linked-task status. A separate design proposal should simplify its header, reading timeline, role treatment and task-status presentation before implementation authorization.
