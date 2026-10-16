# CRM dropdown search scope — 2026-10-13

> 历史功能验收摘要：已移除退役数据库的环境、启动／恢复步骤及专项测试结果。其余结果仅代表当次功能版本，不构成当前MySQL验收；现行配置与数据保护结论见[环境配置与验收基线](environment-configuration.md#mysql-迁移与验收基线)。

## Change

Only Owner retains an option-search input, regardless of option count. Tasks, Sort, Columns and the six fixed multi-select dimensions show their complete option lists without search inputs. The customer search field in the main toolbar is unchanged.

Search state is explicitly scoped to Owner so it cannot filter another dropdown. Selection handlers, option values, role scope, reset behavior, filter rules and CSS remain unchanged. The only application source change is `src/components/crm/CrmLeadFilters.tsx`.

## Verification

- Isolated clean source snapshot: 99 tests passed, TypeScript check passed, production build passed, and `git diff --check` passed. Database integration opt-in variables were not supplied to this unit/regression run.
- Owner selection returned four matching synthetic customers. Selecting High intent returned two; adding Medium intent · online returned three. Reset restored the leader's default five customers. Escape closed every tested dropdown.
- An unmatched Owner search did not hide options in the other dropdowns.
- Built-output comparison against the previous local 3000 build found only the CRM JavaScript module changed after normalizing generated filenames. The other 25 modules/styles and 122 static assets were unchanged, including HSK functionality.
- Updated local 3000 frontend assets, publishing the new HTML entry last and retaining old hashed assets for already-open tabs. The backend process was not restarted; no database writes or migrations were performed by this change.
- Verified all ten dropdowns on the actual local 3000 page: Owner has one search input; the other nine each have zero. Existing customer data remained visible.

No public deployment or GitHub push. Private browser and build evidence is stored under `.local-backups/crm-owner-search-20261013/` and must not be committed.
