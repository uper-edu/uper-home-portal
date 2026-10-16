# CRM goal and assessment display — 2026-10-13

> 历史功能验收摘要：已移除退役数据库的环境、启动／恢复步骤及专项测试结果。其余结果仅代表当次功能版本，不构成当前MySQL验收；现行配置与数据保护结论见[环境配置与验收基线](environment-configuration.md#mysql-迁移与验收基线)。

## Change

- Standard view uses **Goal & assessment / 学习目标与测评**, with three vertically stacked fields: goal, conclusion, and assessment source with score. Long content wraps within its field. The fixed green tick, repeated “Paper” labels and horizontal result badge are removed.
- Expanded view keeps its separate goal column and uses the same two assessment-summary fields under **Assessment / 测评结果**.
- Full assessment displays saved threshold outcomes as provisional paper results. Quick assessment displays the saved starting-point suggestion and review state, with its actual score scale. No grading or threshold calculation runs in the display helper.
- Teacher placement takes precedence and never appends the score from a separate paper. Missing teacher placement stays explicitly unrecorded.
- Missing, malformed, or contradictory structured evidence stays pending review. Legacy prose is not parsed to invent a level or assessment mode. Missing maximum scores are labeled unknown; self-reported levels remain distinct from assessment results.
- System summaries follow the selected CRM language rather than the language of the stored assessment prose. Original customer data and free-text values remain unchanged.

## Verification

- `npm test`: **115 passed**, including eight focused display tests covering full and quick assessments, teacher precedence, consistent score provenance, historical and malformed records, self-reported levels, localization and shared rendering. The default regression suite includes HSK scoring/media/version tests; database opt-in suites were not enabled in that command.
- TypeScript check, production build and `git diff --check`: passed. Build ran in an isolated source snapshot without environment files or customer data.
- Browser checks covered English/light, Chinese/dark, standard and expanded views. All 12 standard summaries had three fields; their last two fields matched the expanded view. No result tick, repeated source text, or mixed system-language prose remained.
- Synthetic customer profiles, including owners, classifications and saved assessments, were byte-for-byte unchanged after validation. Before/after SHA-256: `02a098ebd9ea746391af5de68d388fd37d6c813be1af7a9d36d6a7e29dc82af1`. No conversations, messages, follow-up tasks, business events or notification jobs were created by browsing.
- All 59 protected data-definition/server source files and 122 static assets remained identical. After normalizing build-generated asset names, 24 non-CRM JavaScript modules were unchanged; only the CRM module changed. The new styles are scoped to the assessment component.

## Local 3000 update

Installed the verified frontend assets, replacing the HTML entry last and retaining old hashed assets for already-open tabs. The backend process was not restarted; no database writes or migrations were performed on the real CRM.

Verified 30 existing rows on local 3000: the new header, three fields per summary, no ticks, no repeated source and English system summaries. Every other visible table field matched the pre-update baseline.

No public deployment or GitHub push was performed in this change. Private screenshots, before-build copies and acceptance evidence remain under `.local-backups/crm-assessment-20261013/` and must not be committed. Raw historical results remain available in the existing customer details; this change does not translate arbitrary teacher notes or alter saved records.
