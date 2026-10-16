# CRM compact filters acceptance — 2026-10-13

> 历史功能验收摘要：已移除退役数据库的环境、启动／恢复步骤及专项测试结果。其余结果仅代表当次功能版本，不构成当前MySQL验收；现行配置与数据保护结论见[环境配置与验收基线](environment-configuration.md#mysql-迁移与验收基线)。

Local only. No GitHub push or public deployment.

## Change

- Replaced expanded checkbox cards with six multi-select dropdowns, keeping the existing options and filter rules.
- Combined search, ownership, follow-up timing, unread activity, more filters and reset into a compact toolbar.
- Dropdowns support repeated selection without closing, search for longer option lists, selected counts, outside-click dismissal, keyboard navigation and Escape with focus restoration.
- Additional selected values appear as removable chips when the six fields are collapsed. Visible ownership, search and task controls are not duplicated as chips.
- Removed persistent explanatory paragraphs and the global option-search field. The operating timezone remains available on the follow-up control.
- One Reset filters action restores the role default: leaders see all accessible customers; sales see their own customers. It also resets task, unread, search, sort and all six additional dimensions. Column layout is an independent display preference.
- Result count, sorting and column controls sit outside the filter card, above the list.
- English, Chinese, light and dark themes are supported; personal names remain unchanged.

Source changes are limited to `CrmLeadFilters.tsx`, its scoped `crm-lead-filters.css`, one `isLight` prop in `CrmWorkbench.tsx`, and this report. The filter rule module and server runtime are byte-identical to the pre-change snapshot. No HSK source was edited by this task.

## Verification

| Verification | Result |
| --- | --- |
| Isolated regression suite | 75/75 passed; database suites use separate opt-in runs |
| Candidate and root TypeScript checks | Passed |
| Isolated production builds | Passed |
| Whitespace/diff check | Passed |
| Sales browser reset | Changed ownership, task, unread, search, sorting and additional selections; reset restored `mine`, empty conditions and original four accessible owned synthetic customers |
| Leader browser reset | Restored `all`, empty search and all five synthetic customers |
| Multi-select and search | Two customer groups returned three synthetic customers; option search retained selections; adding learning format preserved AND behavior; removing a hidden chip updated the result |
| Keyboard and dismissal | Escape closed the popup and restored trigger focus; Done closed it; search and checkbox controls remained usable |
| Responsive layout | At 800 px, collapsed card 102 px high; expanded card 192 px high, with six equal-width fields in two rows. At 390 px, two-column fields and the popup stayed within the viewport |
| Theme and language | Chinese and English controls verified; dark card uses dark background and readable foreground |
| Actual local 3000 | HTTP 200; compact controls visible; selecting two groups updated the results; reset restored leader ownership `all` and all 30 customers |

## Local build boundary

A CRM-only artifact was prepared and tested on loopback port 4381 with the independent database. Before applying it to 3000, the concurrency guard detected that another authorized task had rebuilt the shared local assets; this task aborted its planned file replacement.

The newly served CRM module was then compared with the accepted independent production build. After normalizing only the shared entry-module filename, the module contents are identical (SHA-256 `008cf917e6a4c761357dde5721d775b641a46c59eebdaf4923e6677e5454e436`). The current 3000 browser was refreshed and verified. No stale snapshot was copied over the other task's work, and no backend restart or migration was performed by this task. The locally prepared import-map release was used only in the isolated acceptance environment, not installed on 3000.

## Data preservation

Complete before/after private snapshots were compared, including message metadata and sequence values. All 21 tables and sequences are unchanged: 30 customers, 33 tasks, 100 messages, 11 notification rules and one channel. Customer profiles include their original ownership and classification. Environment and legacy JSON hashes also match.

Evidence is stored locally in `.local-backups/crm-compact-20261013/`, including snapshots, full comparison results, source/module checksums and screenshots. These private artifacts must not be committed. Test logs are under `/private/tmp/crm-compact-*.log`.

The active user-facing page is `http://localhost:3000/crm`. The independent preview remains at `http://127.0.0.1:4376/crm` and uses synthetic data.
