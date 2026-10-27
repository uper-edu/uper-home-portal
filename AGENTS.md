# UPER Home Portal maintenance

Canonical repository: `uper-edu/uper-home-portal` (private).

- Confirm the destination remote before any push. Do not push to the former personal repository unless explicitly requested.
- Never commit environment files containing credentials, runtime customer records in `data/`, logs, or local backups. `.env.example` contains placeholders only.
- Stage only reviewed source and documentation changes; do not blindly stage all files.
- Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check` before syncing.
- A request to sync code authorizes a push to the canonical repository, but does not authorize production deployment.
- Keep lesson content and grading rules unchanged during infrastructure fixes unless the user requests content changes.

## 本地开发与验证范围

- 默认只在本地3000环境开发和验证，不自行启动其他端口、独立服务或独立数据库进行开发与验收，也不自行先在其他环境开发后再合并到3000。
- 复杂改动确需隔离时（如数据破坏、迁移、故障注入或不可控通知），先向用户说明原因、范围、数据与通知风险及回到3000的方式，取得用户对本次独立环境的明确确认后再启动。风险理由本身不构成授权；未获确认前不执行依赖隔离环境的操作，也不改在3000冒险执行。
- 默认只验证中文电脑端，按改动选择必要的桌面布局、交互、权限及相关自动化测试。三语切换、英文／印尼文及移动端／窄屏测试，须用户明确要求后再执行，不因旧验收矩阵自动扩大范围。
- 保留现有三语与响应式设计能力；产品文案同步范围按本次授权执行，与测试范围分别判断。未测试的语言和设备明确列为未验证，不声称已通过。
- 保护现有数据、账号、密码、权限及配置，不为测试自行清空数据、停用通知工作进程或修改发送模式，不重放历史通知。危险测试需先确认安全执行方式。此规范维护不授权代码更新、运行环境切换、GitHub推送、服务器部署或通知实发。

## Zentao bug fixes

- Use [fix-zentao-bugs](.agents/skills/fix-zentao-bugs/SKILL.md) for Zentao bug investigation, repair, and disposition.
- Default to manual confirmation: analyze each bug and its validity, present the final repair plan and obtain explicit human approval for that exact bug and plan before changing repair code. Explicit approval may cover an identified list of per-bug plans; implement and verify each bug separately. User-provided directions alone are not approval; material plan changes require renewed confirmation. Show remaining bugs and present the next unapproved bug for confirmation.
- Verify fixes directly on local port 3000 with focused tests. Isolation for data destruction, migration, fault injection, or uncontrolled notifications requires prior explicit user confirmation under the local development rules above; do not start it autonomously. Accumulate fixes, then run the required full checks for the final release source, back up and publish the batch. In company test, verify the deployed version, health/login, each bug's critical path, and environment differences rather than repeating the full local suite.
- Do not mark a repaired bug resolved in Zentao until local 3000 verification, canonical GitHub push, company-test deployment and targeted verification, and evidence upload have all succeeded. Local-only fixes remain pending delivery. Publishing and Zentao writes still require authorization; maintaining this workflow starts neither.
- Enable fully automatic repair only when the user explicitly requests that mode for the current task. Reading or maintaining the skill does not start a repair task.
- Read connection settings from `.zentao.local.json`. The user has explicitly authorized versioning the supplied project settings in this file; this exception does not authorize committing other credentials. Use this file as the sole source for all six connection settings on Windows and macOS; do not override it with environment variables, `.mcp.json`, or credential fallback files. Never copy credentials into logs or documentation. An empty `zentaoAssignee` defaults to the current bug reporter, and the resolved build defaults to `trunk`.
- Follow the skill's Windows PowerShell or macOS zsh/bash instructions as appropriate. Handle authorized comments and status transitions on the user's behalf and verify the result in Zentao.

## 管理工作区设计

修改CRM、CMS或系统管理的导航、布局、详情、编辑、保存反馈或响应式时，必须使用 [uper-admin-workspace-design](.agents/skills/uper-admin-workspace-design/SKILL.md)。纯后端、数据库及HSK题库任务不自动触发。此要求不授予发布或业务规则变更权限。

## 管理界面颜色执行要求

CRM、CMS和系统管理的颜色变更必须执行[全局颜色与状态规范](docs/design/admin-color-system.md)，复用 `src/components/admin-colors.css` 的语义变量及现有共享业务组件；不得按页面新增近似状态色。营销站主题不能改变管理业务状态。颜色只呈现已存在的状态，不授权新增任务、评级或业务规则。修改时检查文字、背景和边框的浅深色配对、键盘焦点及文字含义，报告未验证状态。无能力权限或当前客户范围权限时隐藏“记录进展”；可执行认领前置步骤时禁用并解释；保存中保留禁用反馈，服务端校验不变。
