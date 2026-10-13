# 通知条件下拉与全局路由验收 — 2026-10-12

## 交付与隔离

完整实现保存在独立源码副本 `/private/tmp/uper-routing-qa-20261012`，预览为 http://localhost:4363/crm。正式运行中的 3000 使用 Vite 热更新，因此本次未覆盖真实目录的 src/server 文件；避免 UI 提前更新、API 尚未切换的混用。可应用源码补丁、候选文件副本和 SHA-256 清单保存在忽略目录 `.local-backups/notification-routing-20261012/`，`git apply --check` 通过。没有部署公网、没有 GitHub 推送。

5448 为新独立 PostgreSQL 集群 `/private/tmp/uper-routing-postgres`，只监听回环。数据库分别为 uper_calendar_routing_test_20261012、uper_calendar_routing_policy_20261012、uper_calendar_routing_preview_20261012。预览只有 TEST 模拟客户、模拟角色，没有 API Key 或 Webhook。真实数据库 5449 的 17 张表与客户 JSON 在 UI 验证窗口前后的指纹一致。

## 可搜索选择

- 业务事件保持每策略单选，但支持搜索，避免改动原事件契约。
- 客户来源、等级、阶段和客户所属团队支持搜索、多选、选中标签、移除、清除筛选；空数组表示全部。
- 同一字段 OR，不同字段 AND。等级使用 CRM 实际枚举（含 Unqualified、Warm-Offline、Warm-Online 等），不使用模糊的 Warm/Cold 替代。
- 选项结合既有枚举、可信平台团队、历史策略值、历史事件/会话来源和客户实际等级/阶段/团队。未知或历史值明确标记；选中但未出现在目录的旧值仍显示并保留，不自动替换。
- 原 rule.team 保留：明确指定团队和每日统计继续使用；Owner 策略不再显示或使用每条策略的 Fallback team。

## 全局站内通知路由

针对原 recipient=owner 的客户通知：

1. Owner 必须存在于可信员工目录、明确 active=true、具备 crm.read，且有权查看该客户；满足时发送给 Owner。
2. 未分配、历史无效 Owner、离职/未确认在职或无权限时，改发具备显式 crm_leader 角色、active=true、crm.read+crm.assign、客户团队成员资格与数据范围权限的 Leader。
3. 普通管理员身份不自动成为 Leader。模拟目录中 test-admin 被明确授予该角色；独立测试另设 Owner、销售 Leader、运营 Leader 和无 Leader 角色的管理员。
4. 排队任务发送前重新解析收件人，原目标无效时取消原通知并创建授权接收人的任务。
5. 无授权接收人时保存 notification.routing_unresolved 审计与 notification.failed 运营事件，不制造成功；运营异常事件不递归制造同类异常。

客户 Owner、资料、策略配置与版本不自动改写。不增加自动分配功能。明确团队/主管策略、运营异常和每日汇总保留原目标；每日汇总显示统计团队说明。Lark 机器人仍发送至策略配置的群，不宣称可向 Owner/Leader 直接私聊。

全局规则集中在共享服务端解析器，页面展示真实目录状态；浏览器不能提交自己的 Leader 角色。后续平台适配必须提供可信 roles、active、teams、permissions、scope。

## 验收结果

| 项目 | 结果 |
| --- | --- |
| 新路由单元与 PostgreSQL 验收 | 6/6 通过 |
| 原通知 PostgreSQL 回归 | 22/22 通过 |
| 完整自动化测试 | 59/59 通过 |
| 全部类型检查与独立副本构建 | 通过 |
| 可应用补丁检查 | git apply --check 通过 |
| 浏览器搜索与多选 | 搜索 warm，同时选择线上/线下；同时选择两入口 |
| 保存与重新打开 | 模拟停用草稿 routing-dropdown-qa 保留全部选中值，未启用发送 |
| 页面兜底字段 | 默认全局路由，不再要求填写 Fallback team |
| 真实 CRM 隔离 | 17 表与客户 JSON 指纹一致；3000 未切换 |

自动化覆盖有效/无效/未分配 Owner、明确在职与权限、跨团队隔离、无 Leader 的管理员不接收、排队改派、缺少接收人审计、运营异常不递归、历史筛选保留与越权/伪造来源拒绝。

截图和指纹：忽略目录中的 searchable-filters.png、real-before.json、real-after.json。日志为 /private/tmp/notification-routing-{pg,policy,root,build}.log。

## 后续边界

真实身份平台权限与角色联调尚未完成；模拟验收不代表真实 CRM Leader 目录已接通。待审阅后可将补丁应用到原项目并重新切换 3000，沿用原数据库；本次保留其原运行版本。旧自定义团队/主管策略不会被静默改成 Owner 路由。
