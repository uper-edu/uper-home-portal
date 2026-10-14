# System management card layout acceptance — 2026-10-14

## Delivered

Users and Roles share aligned information tracks within each grid row. Account status is separate from Login ID; the current-user marker no longer displaces the account fields. User cards label Login ID, login email and roles. Role cards label purpose and permission count. Edit actions share a bottom baseline. Long content wraps without truncation; additional roles use a keyboard- and touch-operable disclosure after two chips. Each row grows to its own content instead of imposing a global fixed card height. Unsupported-subgrid browsers retain a flexible footer fallback; that fallback was not separately browser-tested.

English, Indonesian and Chinese labels and the System management Guide were updated together. No server API, permission calculation, business rule, database migration, grading rule or customer data mutation is part of this change.

## Independent verification

- Dedicated local service 4418 / isolated MySQL; no customer data copied for layout fixtures.
- Existing synthetic accounts plus two layout-only users and four roles with zero permissions cover long name/email, multiple roles, disabled accounts, missing email and long responsibilities.
- 36 browser combinations: Users and Roles × 3 languages × light/dark × 390/768/1280 CSS pixels. All measured same-row information slots and action baselines aligned; no page horizontal overflow; edit buttons at least 40px high.
- Keyboard Enter opens additional roles; Tab proceeds to the correct edit action. Expanded cards retain alignment. Mobile editing opens the intended synthetic user; no changes saved.
- 293 automated regression tests passed, zero failed/skipped. Type check, production build and whitespace diff checks passed.
- This is internal browser verification, not a formal assistive-technology or human usability study.

## Local 3000 cutover

Verified frontend resources were copied after a private static-resource backup, with index.html replaced last. No backend restart, migration or notification replay was performed. The original nine users and five roles were visible; isolated layout fixtures were absent. Both card grids aligned and the Robert edit action opened the correct account without saving.

Read-only before/after fingerprints matched 27 tables, including customer records, conversations, assessments, follow-up tasks, roles and business/notification configuration. The .env file was byte-identical. Three tables changed during verification: crm_users, crm_sessions and portal_audit. Audit shows a concurrent Robert account update and sign-in; this update was preserved and was not produced or reverted by the layout work. Therefore this report does not claim a byte-identical account table.

Private evidence is retained under `.local-backups/access-card-layout-20261014/` (not for Git): browser matrix, expanded-keyboard measurement, screenshots, test/type/build logs, original static resources and read-only fingerprints.

## Trilingual role names

- `access_admin`: System Administrator / Administrator Sistem / 系统管理员. The five access-management permissions remain unchanged.
- `hr_reader`: HR Recruiter / Staf Rekrutmen / HR招聘专员. The role retains only `applications.read`; descriptions explicitly state read-only recruitment application access.
- Shared role-label fallbacks, built-in defaults, the System management Guide and the CRM guide reference use the updated names. Role identifiers and existing user assignments are unchanged.
- Both changes were verified through the existing role-management API in isolated 4418 and then local 3000. Before/after assertions confirmed unchanged grants, enabled state, user records and effective permissions (excluding the intended label change). The existing API records an audit event and revokes sessions for affected role members.
- Browser checks confirmed each role name in English, Indonesian and Chinese, and confirmed the local 3000 role cards. The final combined source passed 293 regression tests, type checking and production build.

Existing installations persist editable role names in MySQL. A code update changes new-install defaults and shared label fallbacks; it does not overwrite existing role configurations. Local 3000 has already received the audited name-only updates. For another existing installation, use the authorized role editor to update only these names while preserving IDs, descriptions, grants, enabled state and assignments. No database records or environment configuration are included in this source delivery.

## Synchronization boundary

This delivery includes only the card presentation components/styles, their workbench integration, the approved role labels and related online-guide/acceptance documentation. It excludes other pending cloud-trial configuration/docs, runtime data, credentials, environment files, local evidence/backups, HSK content and scoring changes. GitHub synchronization is separate from deployment; no public deployment is authorized or performed.
