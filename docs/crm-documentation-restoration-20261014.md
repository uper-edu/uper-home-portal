# CRM documentation restoration — 2026-10-14

## Outcome and scope

CRM now has **System explanation** and **Operating guide**, available in English, Indonesian and Chinese. System explanation is the default. Technical references and the generated field index are collapsed. Existing operating instructions remain, reorganized under nine directory entries; all fourteen operating section anchors remain addressable.

This is a frontend/documentation change. No API, database schema, authentication, customer classification, HSK scoring or notification execution logic was modified in this task. No GitHub push or public deployment occurred.

## Historical audit and chapter mapping

The earlier illustrated handbook was replaced in commit `bba57d79f137d98977f35dcbd1bd4096ee4fef9f` during the worklist/trilingual rewrite. The old component had 2,479 lines; the replacement moved content into the operating guide. That rewrite removed the conceptual diagrams rather than preserving them beside the instructions.

| Earlier chapter | Current destination | Treatment |
|---|---|---|
| 1 System Architecture | System purpose and architecture; Core concepts | Restore responsibilities and object relationships; reflect MySQL and current account permissions |
| 2 Capture & Ingestion | Campaign-to-customer journey | Restore five-step journey, separate registration/assessment/participation/enrollment |
| 3 R1–R6 | Customer classification | Restore priority diagram and baseline decisions; distinguish registration and follow-up engines |
| 4 Level & Flags | AI and assessment; Classification | Explain self-report/diagnostic evidence and routing; do not imply certification |
| 5 Eight stages | Sales stages and contact arrangements | Restore stages; separate contact arrangements and task state |
| 6 Dynamic SLA | Tasks, deadlines and SLA | Replace fixed night promises with executable natural-duration calendar examples |
| 7 Daily SOP & filters | Follow-up; operating worklist/filter sections | Preserve current queue, task and draft behavior |
| 8 Data dictionary | Data dictionary and implementation | Replace a fixed field count with generated declarations and storage fields |
| 9 FAQ & script library | Operating troubleshooting and follow-up | Preserve safe operational guidance; do not restore invented seats, discounts or guarantees |
| 10 AI automation | AI and assessment evidence | Explicitly separate available functionality and unimplemented capabilities |

Old `chapter-1` through `chapter-10` links resolve to the appropriate current chapter. Existing `crm-guide-*` operating links remain. The former `crm-guide-fields` points to the data chapter. Direct documentation hashes select the documentation module on initial load. Unknown chapter links display a recovery message.

## Corrections and evidence boundaries

- Full follow-up classification checks R6 before buying signals. Its counter is not evidence of **consecutive** unsuccessful calls. A retained manually confirmed group may differ from a prediction.
- Registration classification has a separate baseline, including the exam-plan input. It does not execute the complete follow-up rollback chain.
- The current full classifier uses a fixed threshold of 3, while cadence filters read a configurable retry threshold. Documentation identifies the difference; this task does not unify those business implementations.
- Saved cadence parameters do not demonstrate that every legacy milestone has a server scheduler. Persisted current task deadlines remain authoritative. The server calendar/first-response behavior is explained separately from legacy cadence parameters.
- Reading, opening WhatsApp and AI replies do not complete tasks or prove human contact. Stopped/waiting customers can still have internal unfinished tasks and overdue facts.
- API acceptance does not prove Lark group receipt or staff reading. Historical frozen failures retain their audit without replay.
- Registration and assessment do not confirm attendance. Recorded stage/amount does not independently prove payment, profit, enrollment into a class or ROI.
- Live agent chat, automatic outbound calls, external WhatsApp automation and automatic class assignment are explicitly marked unimplemented.

## Field index and maintenance

`scripts/crm-documentation-dictionary.mjs` reads source contracts and a dated, structure-only schema snapshot; explicit `--refresh-storage` or `--verify-live-storage` reads local SQL/migration text; it never connects to MySQL or reads customer records. The current index contains **452 declaration entries across contracts and all 28 active storage tables**. These are not 452 independent customer form fields: the count includes nested paths and distinct contract/storage representations.

The index resolves local enum aliases, removes source comments from code types, deduplicates schema declarations and includes later migrations. Objects expand separately; the top search locates fields as well as both documentation parts. Business descriptions clarify principal customer/task/metric/security fields; other technical properties retain the owning declaration, type, source and writer context without inventing undocumented semantics. Optional means the declaration permits omission/null, not permission to skip a required business operation. Internal code identifiers remain verbatim in technical details.

Run `node scripts/crm-documentation-dictionary.mjs` after contract edits and review the accompanying explanations. After approved local schema edits, use `--refresh-storage` to refresh the structure snapshot, then regenerate the index. `--verify-live-storage` checks the snapshot against local SQL without a database connection. `--check` fails when the committed static index is stale. Each system chapter links to its implementation sources and related operating section.

## Validation

| Check | Result |
|---|---|
| Full root suite with isolated MySQL fixtures | **256 passed, 0 failed, 0 skipped** |
| Final targeted documentation/localization checks | **25 passed** |
| Type check | Passed |
| Independent Vite production build | Passed; output kept in private test directory |
| `git diff --check` | Passed |
| EN/ID/ZH × 390/768/1280px | Nine layout cases; no whole-page horizontal overflow |
| Light/dark and keyboard | Inspected; focused chapters, native fold Enter toggle and part selection work |
| Search | Nested field search finds the data chapter and matching object; both parts searchable |
| Navigation | Ten system chapters, nine operating directory entries, fourteen preserved operating sections; related links and old chapter-8 deep link checked in browser |
| Classification examples | Executed against unchanged baseline/full classifier functions |
| SLA examples | Monday daytime/night, Saturday rollover and Sunday start executed against current calendar function |
| Local3000 cutover | Static resources only; original frontend retained for rollback |
| Live data/config preservation | **28 tables, 447 rows: identical per-table hashes; `.env` hash unchanged** |
| Live browser | Existing Suki session opens both documentation parts; no customer writes required |

Browser acceptance used the private synthetic MySQL service on 127.0.0.1:4412, with notification workers disabled and model stubs. No real AI or Lark messages were sent for this documentation task. Tests use separate synthetic databases, not the 3000 database. Actual customer/staff input is neither translated nor included in generated documentation.

Private evidence, screenshots, logs and static rollback copy are retained under `.local-backups/crm-documentation-20261014/`; they are excluded from Git. The 3000 static path and environment were preserved. A browser reload is needed to obtain the new assets; do not refresh while holding an unsaved draft.

## Remaining verification

Real salesperson comprehension/usability sessions and a full assistive-technology audit remain unverified. Keyboard, contrast tokens and responsive inspection are internal checks, not a claim of universal WCAG conformance. Business behavior outside the documentation change was covered by synthetic regressions, not new external provider integration tests. The identified classifier/cadence threshold split remains a separate business-rule decision.

## Documentation-only GitHub synchronization

The synchronization contains the two documentation parts, diagrams, three-language operating content, static field index, its generator/tests and the dated source/schema metadata snapshot. The snapshot contains field names, types, nullability and source checksums only, with no customer values or secrets. Some MySQL implementation references describe the accepted local version; that runtime and its migration code are deliberately not included in this documentation-only change. This document is not evidence that the GitHub runtime has already switched to MySQL.

The CRM workbench patch is restricted to the documentation stylesheet, entry labels, document title and deep-link routing. Unsynced admin header, role/account, server, database and HSK changes remain outside this commit. Validation is repeated on the exact isolated submission tree using its own dependencies; the local3000 runtime and static resources are not replaced by this synchronization.

Submission verification on the isolated canonical-tree checkout: `npm test` **161 passed, 0 failed**; `npm run lint`, `npm run build` and dictionary `--check` passed. No live database or external provider configuration was used. This is separate from the earlier 256-test local MySQL acceptance. Credential scan and the reviewed 12-file allowlist passed.
