# CRM documentation title and scope alignment — independent acceptance

Date: 2026-10-18 (America/Vancouver)
Base commit: `e21801a9fb291aab12ae4af93568ab6e66f9d5a5`
Status: ready for user review in an independent preview; not released.

## Changes

- All 25 chapter pages use their canonical English, Indonesian and Chinese title in the directory, breadcrumb and primary heading. Diagram viewpoints remain secondary text.
- Search has separate results. It no longer replaces group names or renumbers chapters according to matches.
- Sales process and campaign metrics has a direct operating-guide chapter. Keyboard accessibility remains a subordinate chapter under troubleshooting.
- Customer owner/stage editing instructions moved from account access to the customer workspace. Contact-preview instructions moved from assessment to follow-up. Connectivity, access-change and draft-recovery instructions moved into troubleshooting.
- Follow-up explicitly covers contact records, information notes and task handling; the unanswered-contact walkthrough is labelled as an example. Assessment explains its results/evidence scope; learning goals remain in Profile. The technical chapter states its storage, access, transaction and field-dictionary scope.
- AI consultation and assessment evidence are both visible in their shared system chapter. Existing AI flow text is reused without modifying provider or scoring logic.
- Existing chapter keys and link aliases remain intact.

## Verification

- Full `npm test`: 395 tests; 392 passed, 0 failed, 3 skipped.
- The skipped tests require independent native MySQL fixtures: source-review scenarios, persisted provider failover, and native campaign storage. This documentation-only change did not run those database scenarios and does not claim their acceptance.
- `npm run lint` (`tsc --noEmit`): passed.
- Full frontend/runtime package build: passed in ignored `build/crm-guide-title-review`; active `build/dev` was not replaced.
- `git diff --check`: passed.
- Added server-rendered checks cover all 25 chapters × three languages for matching canonical titles and relocated content.
- Browser checks on port 4514: Chinese entities diagram selection; English/Indonesian/Chinese follow-up navigation, breadcrumb, title and example subtitle; stable directory during search; visible AI consultation and assessment sections; direct metrics navigation.
- Indonesian 390px checks: AI and metrics chapters rendered, menu navigation worked, document scroll width equalled viewport width (390px); light/dark controls worked. This was targeted browser sampling, not every chapter/theme/viewport combination.

## Isolation and review

Preview: `http://127.0.0.1:4514/index.html?lang=zh#crm-guide-entities`

The preview is static and contains synthetic educational examples. It does not connect to CRM databases, write customer records or send notifications. No backend, permission, classification, HSK scoring or notification behavior was changed. Local 3000 and company test were not updated. No commit or push was performed. Preexisting `design-prototypes/` is excluded.

After user confirmation, a separate backed-up local 3000 cutover can be performed. This report does not authorize that cutover or a server deployment.
