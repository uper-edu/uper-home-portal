# CRM documentation structure and diagrams acceptance — 2026-10-14

## Scope and delivery

CRM documentation now has one chapter directory containing System explanation and Operating guide. Ten system chapters and nine operating groups retain all fourteen original operating sections. The selected chapter is shown in the main content area. Search, previous/next chapter, keyboard navigation and existing chapter links remain available.

CRM-facing documentation excludes CMS collections, media and public website submissions from its displayed dictionary. The full source dictionary remains intact: 452 entries across 28 database tables; the CRM documentation displays 431 entries and 25 storage tables. One architecture boundary explains that website content management is a separate workspace; CMS procedures and fixed staff membership lists were removed from CRM instructions.

Four accessible, responsive diagrams replace text-heavy explanations:

- Classification: actual evaluation sequence R6 → R1 → R2 → R3 → R4 → R5, separate from the R1–R6 definition index. Prediction, effective classification and manual confirmation remain distinct. No classification algorithm was changed.
- Acquisition: customer, sales and system swimlanes; registration, assessment, confirmed attendance and enrolment have separate evidence requirements. Skipping assessment does not imply a broken flow.
- SLA: four selectable calendar examples checked against the existing calculation function. The example calendar is explicitly illustrative; existing deadlines are not recalculated.
- Notifications: transactional event, policy snapshot, persistent job, eligibility recheck and delivery audit; owner routing, selected-task cancellation and delivery outcomes remain distinct.

English, Indonesian and Chinese content use the selected language. Customer names, conversations and staff notes are not translated or rewritten.

## Verification

- Full root suite using independent native MySQL fixtures: 271 passed, zero failed, zero skipped.
- Documentation and language suites after the final navigation adjustment: 40 passed.
- Type checking, production frontend build and diff whitespace check passed. The final frontend build used a separate private output directory.
- Four diagrams × three languages × 390/768/1280px: 36 layout cases, no whole-page horizontal overflow.
- Browser checks passed for chapter search, field result expansion, old chapter links, keyboard selection, SLA case switching and narrow-screen directory dismissal.
- The narrow-screen sticky directory button no longer overlaps the selected chapter heading.
- Expanded navigation has no internal scrolling or capped chapter-list height. All chapter links remain in normal document flow; users scroll the page for a long directory. Desktop and 390px browser checks confirmed uncropped lists and no horizontal overflow.
- Existing classification and SLA functions validated the documented examples; 39 protected source files remained unchanged.

No real customer data was imported into the independent fixture. AI responses were stubbed and notification workers disabled for documentation validation. No real notification was sent by these checks.

## Local 3000 cutover and preservation

Only frontend static assets were switched; the backend process and MySQL schema were unchanged. The original frontend was retained privately for rollback. The first switch fingerprinted all 28 tables (426 rows) identically before and after, with environment configuration unchanged. Normal staff sign-in afterward changed only authentication/session/audit tables; customer and configuration tables did not change.

The final navigation switch separately fingerprinted all 28 tables (428 rows) identically before and after, with environment configuration unchanged. These counts describe separate point-in-time snapshots; they are not a claim that a running application's authentication state never changes.

Private evidence is under `.local-backups/crm-doc-structure-20261014/` and `.local-backups/crm-doc-nav-20261014/`. It includes test logs, layout checks, screenshots, preservation hashes and rollback assets. Customer records, secrets and backups are excluded from this report.

At functional acceptance, no GitHub synchronization or public deployment was performed.

## Documentation-only synchronization validation

A clean copy of the canonical repository revision received only the seven reviewed documentation, diagram and test files. The submission passed `npm test` (176 tests), `npm run lint`, `npm run build` and `git diff --check`. These submission checks are distinct from the 271-test native MySQL functional acceptance above: the unchanged legacy database integration suites in the submission are environment-gated and were not enabled. This documentation synchronization does not include database migration or cleanup, administrative header changes, HSK changes, customer records, credentials, environment files or private evidence directories. No deployment is included.

## Limits

Real sales usability review, complete assistive-technology testing and a full WCAG audit were not performed. Browser keyboard and responsive checks do not substitute for those reviews. Classification priority remains a separate business review; no classification, assessment scoring, permissions, customer ownership or task deadline rules were changed in this documentation task.
