# Lark 渠道三分区验收 — 2026-10-12

## 交付

- 基本信息：渠道名称与运行方式；明确名称仅为 CRM 标签，Webhook 才决定实际群。
- 连接配置：模拟无需 Webhook 或团队字段；真实模式要求服务端 Webhook 引用，开启签名才要求签名引用。字段只接收变量名，不接收 URL 或实际密钥。
- 发送保护：群渠道统一上限，不重复配置策略限流。
- 移除无实际路由用途的团队输入、卡片团队信息和群选择器团队标签。历史数据库字段保留。
- 新渠道系统生成 ID；旧 ID 保留只读，改名和模式切换不修改策略关联。
- 隐藏连接信息不等于删除：切换模拟保留旧 Webhook/签名引用；关闭签名后旧签名引用保留但不参与校验或发送。
- 渠道卡片显示引用策略总数/启用数；连接配置就绪不表示接口接受、群内实收或员工已读。

## 隔离环境

5448 独立测试库 uper_calendar_acceptance_20261012、uper_calendar_policy_20261012、uper_calendar_preview_20261012；客户全部为 TEST 模拟数据。预览为 http://localhost:4361/crm，源码/构建/运行在 /private/tmp/uper-calendar-qa-20261012，无真实密钥或 Webhook。

真实 3000 不重启、不替换构建、不切换数据库。5449 真实库仅做只读指纹核对；17 张表与客户 JSON 验收前后一致。未部署公网、未推送 GitHub、未发送真实 Lark 消息。

## 验收

| 项目 | 结果 |
| --- | --- |
| 完整 npm test（显式隔离 DATABASE_URL） | 58/58 通过 |
| 日历/渠道 PostgreSQL 专项 | 9/9 通过 |
| 原通知 PostgreSQL 回归 | 22/22 通过 |
| npm run lint、独立副本 npm run build、git diff --check | 通过 |
| 浏览器新增无连接模拟渠道并保存 | 通过，仅名称/模式/上限即可保存 |
| 模拟→真实→签名开启→模拟的字段联动 | 通过，真实未填引用没有保存或真实发送 |
| 渠道列表引用数量、隐藏团队字段、系统只读 ID | 通过 |

新增集成场景验证：模拟无需连接/团队；真实无 Webhook 拒绝；签名开启无密钥引用拒绝；Webhook 不接收 URL；旧渠道改名/模式切换保留连接与团队历史值；关联策略配置完全一致；签名关闭时缺少旧签名密钥不再阻止配置就绪。真实 Lark 回执未在本次验证，状态检查不能代替实收。

截图与只读指纹保存于忽略目录 `.local-backups/lark-channel-20261012/`：simulation-three-sections.png、live-signing-fields.png、real-before.json、real-after.json。测试日志位于 `/private/tmp/lark-channel-{root,pg,policy,build}.log`。

## 剩余边界

真实环境的 Webhook 仍由管理员在服务端安全配置，本次没有新增密钥录入功能或自动查询实际 Lark 群名。真实身份平台联调等既有发布门槛继续保留。3000 尚未切换新版，4361 供本地审阅。
