# CRM filter appearance and responsive layout — 2026-10-13

> 历史功能验收摘要：已移除退役数据库的环境、启动／恢复步骤及专项测试结果。其余结果仅代表当次功能版本，不构成当前MySQL验收；现行配置与数据保护结论见[环境配置与验收基线](environment-configuration.md#mysql-迁移与验收基线)。

Local-only refinement of the accepted compact filter toolbar. No GitHub sync or public deployment.

## Findings and changes

- Search inherited a larger global form font. Native selects, multi-select buttons, labels and list controls used different sizes and weights. All now use 13px type and a 20px line height; field labels are muted, values use the primary text color.
- Native browser arrows and text-symbol arrows differed. All closed dropdown controls now use the same chevron, border, background, 8px radius and 38px height. Expanded buttons rotate the chevron.
- The previous flex wrapping depended on viewport width and could squeeze controls in narrow containers. Container-based grids now respond to the actual available space: six, three, two or one columns for additional filters; search and primary controls move to deliberate rows. Very narrow layouts put Reset on a separate row so English action labels cannot collide.
- Selected filters, focus indicators, light/dark colors, searchable checkboxes and the existing reset behavior are preserved. Apple theme form overrides are scoped back to the same CRM control geometry.

Only `src/components/crm/crm-lead-filters.css` was changed in application source. The React component, filter rules, server, ownership and HSK source were not edited.

## Verification

| Check | Result |
| --- | --- |
| Filter rule tests | 5/5 passed |
| Independent candidate type check and production build | Passed |
| Diff whitespace check | Passed |
| Synthetic CRM on 127.0.0.1:4376 | Chinese/English, multiple selection, result count, hidden-condition chips, Reset and Escape checked |
| Multi-select result | High intent plus Medium intent online returned three synthetic customers; reset restored Fadhil's four owned synthetic customers |
| Widths 1440, 1024, 824, 700, 560, 390 and 320 | No filter controls extended outside the filter area; responsive column count verified |
| Narrow English layout | At 320px, Unread and More filters share a row; Reset occupies the next row; text fits within each action |
| Dark theme and popup | Readable text; popup remained inside the viewport |
| Local 3000 | Updated stylesheet loaded; search, selects and buttons computed to 13px; outer controls computed to 38px |

## Build isolation

An initial build command accidentally ran in the main working directory. Before acceptance continued, the previous assets were reproduced with the original stylesheet, and the resulting HTML and content-hashed asset references matched the pre-change HTML exactly. That baseline was restored.

The final candidate was built to a temporary output directory and compared with the restored baseline. All 25 JavaScript modules are identical after normalizing generated asset filenames. Global CSS is byte-identical; the CRM stylesheet matches the independently tested build. The comparison also verified 122 non-code assets unchanged for the initial candidate. The final narrow-layout adjustment changes only CRM CSS.

The final local cutover copied new assets and atomically replaced HTML, retaining older cached assets. A pre-write check verified that another task had not replaced the running HTML. No backend or database configuration was changed.

Private evidence: `.local-backups/crm-filter-polish-20261013/` (responsive measurements, local computed styles, screenshots, baseline HTML and asset-isolation report). Do not commit these local artifacts.
