# UPER Home Portal maintenance

Canonical repository: `uper-edu/uper-home-portal` (private).

- Confirm the destination remote before any push. Do not push to the former personal repository unless explicitly requested.
- Never commit environment files containing credentials, runtime customer records in `data/`, logs, or local backups. `.env.example` contains placeholders only.
- Stage only reviewed source and documentation changes; do not blindly stage all files.
- Before syncing, follow the [final-version checks](#本地开发与验证范围).
- Confirm the delivery batch and its exact commit with the user before pushing to the canonical repository or releasing to company test. Production deployment requires separate explicit authorization.
- Keep lesson content and grading rules unchanged during infrastructure fixes unless the user requests content changes.

## 生产发布分支

- 生产发布分支固定为 `release`。Jenkins 生产构建、镜像和 TKE 发布只取 `release` 的已推送提交，不从 `main`、功能分支或本地未推送提交发布。
- `release` 只接收准备发布的代码。功能开发可在 `main` 或功能分支进行；进入生产前必须把已验证提交合入 `release`。
- 创建或更新 `release`、推送 `release`，以及触发生产发布，各自需要明确授权。本次规范本身不创建发布、不推送、不部署。
- 公司测试环境和本地 3000 不使用 `release` 作为开发分支。测试发布仍按当次授权的测试版本执行。

## 环境变量与业务开关

- 环境变量用于部署和基础设施所需的配置，例如运行环境、服务地址、连接参数、凭证注入和日志设置。禁止为已交付的业务功能、权限或管理操作新增环境变量开关。
- 业务确需启停时，沿用现有系统配置和权限。
- 凡需在任何环境的 `.env` 或模板中新增环境变量，必须先向用户单独说明变量名、用途、涉及环境、默认或缺失时的行为及运维影响，取得用户明确批准后才可实施。功能开发、合并或发布授权不能替代这项审批。获批后同步更新对应环境模板与发布手册。

## 跨平台兼容要求

- 本项目必须支持 **Windows 11、macOS 和 Linux**（例如 Ubuntu 22.04 LTS、Debian 13）。安装依赖、本地开发、构建、应用运行和自动化测试的公共入口须在三类系统上可用；不能以 WSL 或 Linux 容器测试代替 Windows 原生验证。
- 通用代码和脚本优先使用跨平台 API 处理文件路径、临时目录、文件 URL 和子进程参数；不得假定固定盘符、`/tmp`、特定 shell 或文件系统大小写行为。对按字节校验的文本，在仓库中明确换行规则，不修改预期指纹来掩盖差异。
- 平台实现可以不同，业务结果和安全要求必须一致。例如，私有凭证文件在 Windows 上应校验 ACL，在 macOS／Linux 上应校验 POSIX 权限；无法确认安全时拒绝操作，不得通过放宽权限或跳过失败用例来宣称兼容。
- 涉及平台差异的改动，按操作系统分别记录已验证的版本、命令和结果。没有实测的平台标注「未验证」，不得由单平台通过推断三端通过。仍遵守下文的本地 3000 和隔离授权要求。

## 本地开发与验证范围

- 默认在本地 `main` 开发，在本地 3000 按改动影响做定向验收。验收通过后，按可独立验证和回退的范围提交到本地 `main`。
- 本地代码提交累积成可以一起验收的交付批次后，核对范围、依赖和最终提交号。全量检查通过后，先请用户确认，再按授权批量同步 GitHub 和发布公司 test。
- 公司 test 使用已同步的确切提交构建发布包。切换前记录回退版本，切换后按本批改动做定向验收。
- 仅补记已完成发布和验收结果的文档提交，只核对文档差异并留在本地，随下一批实际代码改动一起同步 GitHub。纯验收记录不单独触发全量检查、构建或发布。
- 日常按改动风险做定向验证。文档、注释或不改变文件内容的 Git 历史整理，检查相关差异即可。文案、样式和单个交互，验证受影响的页面和状态。权限、数据库迁移、收退款、通知等高风险改动，验证关键流程、拒绝和失败场景，并遵守下述隔离要求。
- 对含代码或运行输入变更的交付批次，推送前对最终待推送版本执行一次 `npm test`、`npm run lint`、`npm run build` 和 `git diff --check`。同一版本已有可核对的通过记录时，直接复用。最终版本有变更时，按新版本执行。
- 验收报告先列实际验证的流程和结果，再列未验证项、跳过原因及其对验收的影响。全量测试统计放在这些信息之后。
- 默认只在本地3000环境开发和验证，不自行启动其他端口、独立服务或独立数据库进行开发与验收，也不自行先在其他环境开发后再合并到3000。
- 复杂改动确需隔离时（如数据破坏、迁移、故障注入或不可控通知），先向用户说明原因、范围、数据与通知风险及回到3000的方式，取得用户对本次独立环境的明确确认后再启动。风险理由本身不构成授权；未获确认前不执行依赖隔离环境的操作，也不改在3000冒险执行。
- 默认只验证中文电脑端，按改动选择必要的桌面布局、交互、权限及相关自动化测试。三语切换、英文／印尼文及移动端／窄屏测试，须用户明确要求后再执行，不因旧验收矩阵自动扩大范围。
- 保留现有三语与响应式设计能力；产品文案同步范围按本次授权执行，与测试范围分别判断。未测试的语言和设备明确列为未验证，不声称已通过。
- 保护现有数据、账号、密码、权限及配置，不为测试自行清空数据、停用通知工作进程或修改发送模式，不重放历史通知。危险测试需先确认安全执行方式。此规范维护不授权代码更新、运行环境切换、GitHub推送、服务器部署或通知实发。

## 数据库规范

- **本地开发完成时交付数据库变更 SQL。** 凡本次改动要求目标库变更表、列、索引，或执行初始化、数据修正、回填等一次性 DML，开发人员必须在提测或申请生产发布前，将已审查的增量 SQL 随代码放入 `sql/`，并在 `sql/README.md` 登记适用环境、前置版本、执行顺序、验证及回退方式。缺少 SQL 或执行说明，不得将该批次标为可提测、可发布。SQL 由获授权人员在相应测试库或生产库单独手动执行；测试库执行成功不代表生产库已执行或已获授权。
- **禁止启动时写库。** 所有环境均不得借应用启动、重启、容器入口、初始化容器、部署钩子或滚动发布自动执行数据库建表、结构迁移、种子导入、历史数据回填或其他 DDL／DML。启动只允许以只读方式检查数据库结构和必要的初始化状态；发现缺失或不匹配时，须明确报错并停止启动，不得自动补齐。本条不限制应用正常运行后由业务操作触发的写入。
- **变更必须单独手动执行 SQL。** 由具备相应权限的人员在核实目标环境、数据库、版本和变更范围后，通过数据库客户端手动执行已审查的 SQL，核对执行结果后再启动或发布；不得把执行 SQL 挂到启动或发布步骤里。
- **发现违规方案必须提醒并停止。** 任何人提出用启动、重启或发布触发 SQL，或发现现有启动路径仍会自动写库时，必须明确指出触发点及可能修改的结构或数据，停止相关启动或发布操作，并提醒改为先手动执行经审查的 SQL。不得因缺少手工步骤而绕过本要求。本条不授权改造旧迁移链或执行数据库变更。
- 禁止使用外键：新增或修改的 `CREATE TABLE`、`ALTER TABLE` 及迁移脚本不得包含 `FOREIGN KEY`、`REFERENCES` 或 `ON DELETE/ON UPDATE` 级联子句。表间关联只用普通列加索引，引用完整性由应用层在同一事务内校验与维护（沿用 `lockIdentityRegistry`、`SELECT ... FOR UPDATE` 等既有模式）。
- 存量 schema 中已有的外键（`schema.sql`、`schema-v2.sql`、`schema-v13.sql`、`schema-v15.sql` 中关联 `portal_leads` 的 5 处）仅在因业务需要改动对应表时顺带评审移除，不做单独的外键清理迁移；本规范不授权全局 schema 重构或存量数据迁移。
- 增量 SQL 统一放在 `sql/` 目录管理，命名用 `v` + 创建时刻时间戳：`v<YYYYMMDDHHMMSS>_<简短用途>.sql`（例 `v20261106115022_cms_cos_incremental.sql`）。禁止 `v1`、`v2`…`v20` 连续编号——并行开发会互相占用编号导致冲突；时间戳创建时取当前时刻，不复用、不改写已发布文件的时间戳。每次新增/移动/废弃增量必须同次提交更新 [`sql/README.md`](sql/README.md) 的登记表（文件、创建时间、目标结构、作用、执行方式、验证），保持目录对人和 AI 都自解释。增量必须自带结构门禁、可重复执行（已应用目标数据零变更）、不硬编码连接信息、不破坏目标库自己的业务内容与账号；细节见该 README。历史迁移文件（`cloud/mysql/schema*.sql` 与 `migrate.mjs`）保留原位，不得作为启动时写库的依据。

## Zentao bug fixes

- Use [commando-fix-zentao-bugs](.agents/skills/commando-fix-zentao-bugs/SKILL.md) for Zentao bug investigation, repair, and disposition.
- Default to manual confirmation: analyze each bug and its validity, present the final repair plan and obtain explicit human approval for that exact bug and plan before changing repair code. Explicit approval may cover an identified list of per-bug plans; implement and verify each bug separately. User-provided directions alone are not approval; material plan changes require renewed confirmation. Show remaining bugs and present the next unapproved bug for confirmation.
- Verify fixes directly on local port 3000 with focused tests. Isolation for data destruction, migration, fault injection, or uncontrolled notifications requires prior explicit user confirmation under the local development rules above; do not start it autonomously. Accumulate fixes, then run the required full checks for the final release source, back up and publish the batch. In company test, verify the deployed version, health/login, each bug's critical path, and environment differences rather than repeating the full local suite.
- Do not mark a repaired bug resolved in Zentao until local 3000 verification, canonical GitHub push, company-test deployment and targeted verification, and evidence upload have all succeeded. Local-only fixes remain pending delivery. Publishing and Zentao writes still require authorization; maintaining this workflow starts neither.
- Enable fully automatic repair only when the user explicitly requests that mode for the current task. Reading or maintaining the skill does not start a repair task.
- Read connection settings from `.zentao.local.json`. The user has explicitly authorized versioning the supplied project settings in this file; this exception does not authorize committing other credentials. Use this file as the sole source for all six connection settings on Windows and macOS; do not override it with environment variables, `.mcp.json`, or credential fallback files. Never copy credentials into logs or documentation. An empty `zentaoAssignee` defaults to the current bug reporter, and the resolved build defaults to `trunk`.
- Follow the skill's Windows PowerShell or macOS zsh/bash instructions as appropriate. Handle authorized comments and status transitions on the user's behalf and verify the result in Zentao.

## 管理工作区设计

修改CRM、CMS或系统管理的导航、布局、详情、编辑、保存反馈或响应式时，必须使用 [commando-uper-admin-workspace-design](.agents/skills/commando-uper-admin-workspace-design/SKILL.md)。纯后端、数据库及HSK题库任务不自动触发。此要求不授予发布或业务规则变更权限。

新增或改造管理端记录详情时执行[记录详情规范](docs/design/admin-record-detail-system.md)，复用详情操作区和适用页面的记录侧栏。

## 管理端搜索、下拉和内容页签

CRM、CMS 和系统管理新增或调整搜索、枚举下拉与内容页签时，必须遵循[共享控件规范](docs/design/admin-list-controls.md)。使用 `AdminSearchField`、`AdminSingleSelect` 与 `AdminDetailTabs`／`AdminContentNav` 对应接入，页面只定义业务选项和布局，不复制控件样式。验收应检查展开后的选项与键盘焦点，并区分页内切换和链接导航。

## 管理界面颜色执行要求

CRM、CMS和系统管理的颜色变更必须执行[全局颜色与状态规范](docs/design/admin-color-system.md)，复用 `src/components/admin-colors.css` 的语义变量及现有共享业务组件；不得按页面新增近似状态色。营销站主题不能改变管理业务状态。颜色只呈现已存在的状态，不授权新增任务、评级或业务规则。修改时检查文字、背景和边框的浅深色配对、键盘焦点及文字含义，报告未验证状态。无能力权限或当前客户范围权限时隐藏“记录进展”；可执行认领前置步骤时禁用并解释；保存中保留禁用反馈，服务端校验不变。

## 管理界面时间执行要求

CRM、CMS和系统管理的时间显示、输入、筛选与编辑必须执行[日期与时间规范](docs/design/admin-time-system.md)。普通具体时刻采用使用者浏览器当地时间，不重复显示时区；仅日期保留原日期；运营日历、SLA和通知规则保留配置时区。复用共享转换工具，界面换算不修改既有时刻、期限、通知计划或原文，不能把无偏移的本地输入直接当UTC。三语固定文案同步；按本次授权执行定向验收，不因规范维护自行发布或重放通知。

## 自然语言与对话处理

遵循[自然语言与对话处理开发规范](docs/development/natural-language-ai.md)。客户自由表达的意图、主体、否定／撤回、条件、历史引用、上下文和时间含义由大模型理解，不新增正则、关键词或固定句式替代业务语义，也不据此在普通AI咨询前分流预约／报名／人工请求。程序仍必须确定性校验权限、来源、格式、状态、幂等、并发及通知条件；明确产品按钮可按用户选择处理。AI提取不能直接确认客户约定、完成销售动作或绕过权限。模型失败不使用语言规则静默猜测肯定结论。既有语言规则逐项评审迁移，本规范本身不授权全局重构或删除安全保护。
