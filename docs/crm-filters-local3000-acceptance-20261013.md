# CRM unified filters: local 3000 verification

> 历史功能验收摘要：已移除退役数据库的环境、启动／恢复步骤及专项测试结果。其余结果仅代表当次功能版本，不构成当前MySQL验收；现行配置与数据保护结论见[环境配置与验收基线](environment-configuration.md#mysql-迁移与验收基线)。

Date: 2026-10-13. Local only; no GitHub push or public deployment.

## Delivered interface

- One filter area with ownership, unfinished-task timing, unread activity and six additional dimensions.
- Removed the redundant Customer classification / Contact history / Customer needs headings. Customer group, Sales stage, Contact status, Follow-up situation, Learning format and Buying signal now appear as six peer fields.
- Responsive grid: three columns on wide screens, two on medium screens, one on small screens. Fields in each row have equal widths and heights, aligned legends and consistent option spacing.
- English and Chinese retain the same selection logic. Names and customer-entered values are preserved.

## Local service and change boundary

The local 3000 server was already loading the unified filter API. The shared checkout was also being rebuilt and restarted by the separately authorized HSK task during this verification. Its subsequent build includes the filter layout update. Verified the actual served CRM page after restart; HTTP 200, staff login and filter requests work.

This task changed only the CRM filter component and this report. It did not replace the running service with the older isolated candidate, revert other work, edit HSK files, migrate CRM data or enable public access. Existing HSK work in the shared checkout is not part of this change set.

## Verification

| Check | Result |
| --- | --- |
| Isolated candidate regression suite | 75/75 passed; DB-dependent suites require their separate opt-in runs |
| Controlled-clock filter cases | Passed; operating timezone controls today, completed/cancelled/historical-hold tasks are excluded from overdue |
| Candidate lint and production build | Passed |
| Shared checkout type check and diff whitespace check | Passed |
| Local 3000 API versus independent SQL | Passed: leaders see all; sales defaults use their ownership; unassigned, today and overdue match task/customer records |
| Browser | Leader default all, Sales default mine in isolated environment, local 3000 owner/task controls, English/Chinese six-field layout verified |

At the 08:53 UTC read-only check, the leader view had 26 customers, unassigned 12, today 5 and overdue 0. These are timestamped observations, not fixed acceptance constants: live activity and time can change counts.

## Data preservation

A complete private backup of all 21 application tables was taken before verification. Before/after hashes matched for customer profiles, messages, conversations, ownership/classification, tasks, notification rules/channels/jobs/inbox, settings, local environment and legacy JSON. Login verification changed authentication audit/rate-limit records only.

The concurrent HSK task subsequently added synthetic customers. A final original-record comparison at 08:57 UTC confirmed all original 26 customer profiles and all original 29 tasks (owner, status and deadline) remained unchanged. Current totals were 28 customers and 31 tasks. All 11 notification rules, the channel and both settings records remained unchanged. No fixture from this task was inserted into the real CRM database on port 5449.

Private evidence is in `.local-backups/crm-filters-local3000-20261013/`: database backup, preservation hashes, original-record comparison, API verification, source hashes and screenshots. It contains local-only evidence and must not be committed. The independently built preview remains at `http://127.0.0.1:4376/crm`; the user-facing local CRM is `http://localhost:3000/crm`.
