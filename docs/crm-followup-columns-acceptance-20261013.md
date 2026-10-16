# Customer group and follow-up columns — 2026-10-13

> 历史功能验收摘要：已移除退役数据库的环境、启动／恢复步骤及专项测试结果。其余结果仅代表当次功能版本，不构成当前MySQL验收；现行配置与数据保护结论见[环境配置与验收基线](environment-configuration.md#mysql-迁移与验收基线)。

## Delivered

- Standard view now separates **Customer group / 客户分组** and **Follow-up / 跟进安排** (10 columns). Expanded view uses the same follow-up renderer instead of separate SLA and next-action columns (16 columns).
- One task selector supplies the action, state, deadline and task owner. It chooses the earliest confirmed deadline among unfinished tasks, then undated unfinished tasks, then historical tasks awaiting review. Completed/cancelled tasks are excluded. Sorting does not mutate source records.
- Empty state appears once as “No open tasks / 暂无待办”. Missing task data is reported as unavailable rather than as an empty task list. The redundant pointing icon is removed.
- Lead-level `nextAction` text remains a separately labeled note, including when there is no task. Notes and personal names retain their original language. Existing `nextFollowUpAt` and SLA fields do not fabricate pending tasks.
- Due today and overdue use the configured operating timezone. Historical placeholder dates, the epoch sentinel and invalid dates are not presented as confirmed deadlines.
- Additional pending tasks are counted, with a button opening the existing task drawer. A different task owner is shown explicitly; a matching customer owner is not repeated. The drawer uses the same task ordering and date descriptions, including its header deadline selection.
- No changes to classification, ownership, permissions, task creation/completion APIs, notifications or HSK rules.

## Verification

- `npm test`: **107 passed**, including **8 new focused tests** for task selection, empty states, manual notes, invalid/historical dates, timezone boundaries, multiple tasks, task owners and missing task data. These counts are the default regression suite; database opt-in suites were not enabled in that run.
- `npm run lint`, `npm run build` and `git diff --check`: passed.
- Actual CRM API checks passed: multiple-task selection, different task owner, history exclusion from dates, completed-task exclusion and note preservation.
- Browser checks on `127.0.0.1:4382`: English/light and Chinese/dark, standard and expanded views. Both views returned identical follow-up summaries. Three empty states appeared once each; original notes remained visible. The additional-task button opened the correct three tasks; historical work displayed no placeholder date.
- Customer profiles (including group, owner and notes) and task rows were byte-for-byte identical before and after the read-only browser acceptance. SHA-256: `5b196f2d64622e289788f055f3cddc75e6a15c0e5e921e19e011b5b70f7ee465`.
- Compared the build to the previously running 3000 frontend: non-CRM JavaScript was unchanged after normalizing generated filenames; 122 static assets were identical. Global CSS only lost three now-unused CRM utility rules; follow-up styles are scoped to the CRM component.

## Local 3000 update

Published the accepted frontend assets with the HTML entry replaced last, retaining old hashed files for already-open tabs. Backend process and database were not restarted or migrated. In a separate browser tab, local 3000 showed 30 existing customer rows, the two new column headings, zero repeated empty messages, zero obsolete action arrows and zero placeholder dates in follow-up cells. No customer records were edited.

The prior Owner-only search change is retained. No GitHub push or public deployment was performed. Private screenshots and checks are in `.local-backups/crm-followup-columns-20261013/` and must not be committed.

## Separate finding

Current database flows calculate the initial customer group at registration and accept explicit group updates, but do not consistently recompute it after subsequent business events. This was explained to the user and left unchanged to respect the requested classification boundary; automatic reclassification needs its own agreed rules and acceptance.
