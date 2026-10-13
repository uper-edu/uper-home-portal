# CRM single-select dropdowns — 2026-10-13

## Change

Owner, Tasks, Sort and Columns now share a custom single-select popup with the existing multi-select filters' typography, spacing, rounded border, shadow and light/dark colors. Each selected value has a checkmark and highlight. Selecting an option applies it immediately and closes the popup.

Owner supports case-insensitive option search when there are at least six choices. Names remain unchanged. The sales role still gets only its permitted scope choices; leaders retain the existing staff choices. No permissions, ownership, task filtering, sorting or column-display rules were changed.

All dropdowns share one open-state controller. Outside clicks and leaving the field close the popup; Escape restores trigger focus. Single-select options support Arrow Up/Down, Home/End and Enter. Search keeps normal Home/End text editing. Multi-select fields retain their existing checkbox and Done behavior.

Application source changes: `src/components/crm/CrmLeadFilters.tsx` and `src/components/crm/crm-lead-filters.css` only.

## Acceptance

- Existing filter rules: **5/5 tests passed**. Independent and root TypeScript checks passed; production builds and whitespace checks passed.
- Used the independent PostgreSQL-backed preview on `127.0.0.1:4376`, with synthetic customers and Fadhil/Robert test accounts.
- Sales default: four owned synthetic customers. Selecting Unassigned produced zero for the current fixture; Reset restored the four owned customers.
- Leader default: five synthetic customers. Searching Owner for `fadh`, navigating to Fadhil and confirming with Enter returned four customers. Personal names were not translated.
- Tasks: Arrow Down opened the popup, moved focus without selecting, and Enter applied the chosen task filter. Escape closed it and returned focus.
- Sort: End followed by Enter selected Earliest deadline. Reset restored Newest customer.
- Columns: Expanded changed the table layout. Reset left this independent display preference intact. Selecting Standard restored the standard table.
- Switching between controls left exactly one dialog open. The four popups computed to 13px type, 10px popup radius and the same shadow.
- Chinese, English and dark mode checked. At 390px, the popup aligns with its full-width trigger and stays inside the viewport; desktop and 824px layouts also checked.
- Local 3000 verified in a separate tab: all four controls open the correct dialog, exactly one at a time; the selected values are correct and there are no native selects left in the filter toolbar. No customer records were edited.

## Build boundary

During verification, concurrent changes appeared in `CrmUserGuide.tsx` and `portalChat.ts`. A separate build was prepared using their pre-task versions without modifying those working files. Its 24 non-CRM JavaScript modules matched the previous running build after normalization of generated filenames; global CSS and 122 static assets were unchanged.

Before cutover, the concurrency guard detected another build had already updated 3000, so this task did not overwrite it. The active CRM JavaScript matched the prepared current-source build byte-for-byte after normalizing the shared entry filename, and the active CRM stylesheet matched the independent acceptance build. The four popups were then verified on the actual local page.

During dropdown implementation, no server restart, migration, GitHub push or public deployment was performed by this task. Customer records, ownership and filter rules were not edited. The “Business overview · current results” heading was explained to the user; it was not renamed.

Private screenshots and comparison results are in `.local-backups/crm-dropdowns-20261013/`; these artifacts must not be committed.

## GitHub sync verification

On 2026-10-13, the live canonical remote `uper-edu/uper-home-portal` was checked: `main` already contained the dropdown source changes in commit `8c5c072e5a057f8f60babca8309259c2c9666f8a`. The remaining change for this sync is this acceptance document only.

An isolated snapshot of that commit passed `npm test` (99 passed, 0 failed), `npm run lint`, and `npm run build`. `git diff --check` also passed. No environment files or runtime customer records were copied into the snapshot, and no database integration opt-in variables were supplied. The 99 tests therefore do not constitute a new PostgreSQL integration run; the earlier independent database and browser acceptance is recorded above.

The sync does not rebuild or restart local 3000, change HSK source, migrate customer data, or deploy a public environment.
