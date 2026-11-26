# GA4 同笔交易两次部分退款验收

2026 年 11 月 7 日复查通过。UPER Test 原探索报表在同一交易下显示 1 次购买和 2 次退款，退款累计 **Rp 150,000**。

## 核对范围

- GA 账户为 DataPower，属性为 UPER Test（`561827503`），币种为 IDR。
- 报表按 2026 年 11 月 7 日、专用 Web 数据流 `UPER Refund QA Web`（`16291733074`）及模拟交易 `GA-QA-1be47205-5b71-4fd1-9636-b3b475a45e97` 筛选。
- 原发送记录包含 1 条 `purchase`（Rp 1,000,000）及 2 条 `refund`（Rp 100,000 和 Rp 50,000）。三条事件使用同一交易 ID，Google 收集端返回 HTTP 204。
- 刷新原探索报表后，`refund` 行的事件数为 2，退款金额为 Rp 150,000。报表合计 3 次事件。这确认了两次退款在同一交易下累计。两笔单独的退款金额来自原发送记录，报表展示的是汇总金额。 [UPER Test 原探索报表](https://analytics.google.com/analytics/web/#/analysis/a399457165p561827503/edit/3rT7qH3oQBaxiLtIJmmz4w)

## UPER Production 观察报表

| 项目 | 已保存的设置 |
| --- | --- |
| 探索报表 | [CRM 购买与退款](https://analytics.google.com/analytics/web/#/analysis/a399457165p543450253/edit/BEhrMSQhSySYZpj9v1ejsQ) |
| 属性与数据流 | DataPower → UPER Production（`543450253`）。数据流名称精确匹配 `UPER Web`（流 ID `15159406809`） |
| 日期 | 滚动最近 28 天。无固定验收日期或测试交易 ID 筛选 |
| 事件 | 事件名称匹配 `^(purchase\|refund)$` |
| 表格 | 行为交易 ID、事件名称。指标为事件次数、退款金额 |
| 金额口径 | 页签注明「购买＝首笔到账核实时合同额｜退款＝实际退款额」。合同额是购买事件的上报口径，财务实收与终止结算以 CRM 台账为准 |

生产报表配置已在 GA 后台刷新确认，当时无匹配数据。UPER Test 原探索及验收数据保留。生产报表配置与生产外发分别验收。

## 正式开启 GA 外发前的门槛

入队和取消已提交到本地 `main`。默认关闭的发送器及 v20 状态增量已单独提交（`ae1ad5f`）。运行入口需要可信的 GA 客户标识与同意来源，目前应用还未接入该来源。历史两笔退款的 GA4 结果来自单独发送的模拟事件。 [入队实现](../../../server/portal/paymentAnalytics.ts) · [发送器](../../../server/portal/paymentAnalyticsDispatch.ts) · [v20 增量](../../../cloud/mysql/schema-v20.sql)

| 顺序 | 待完成 | 通过标准 |
| --- | --- | --- |
| 1 | 默认关闭的独立发送器与环境校验，模拟已验收 | 财务保存后异步处理。要求独立开关 `PORTAL_GA_DISPATCH_ENABLED=true`、与环境匹配的 `PORTAL_GA_MEASUREMENT_ID`、私有 `PORTAL_GA_API_SECRET` 和 UTC 起算时间 `PORTAL_GA_START_AT`。关闭、缺配置或错配时外部请求为零。 |
| 2 | 确定同意、标识和报表来源口径 | 明确客户的 GA `client_id` 如何取得及使用，缺少同意或有效标识时留待处理。用同一稳定的非个人交易标识关联购买与多笔退款，参数使用白名单。确认正式流是否已有同名事件，必要时加 CRM 专用来源标记及报表筛选。 [Google 发送指南](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events) · [Google 个人信息规范](https://support.google.com/analytics/answer/6366371) |
| 3 | 发送顺序、防重及结果未知，隔离 MySQL 和模拟接口已验收 | 购买获收集端接收后，再按顺序发送该笔交易的退款。领取发送的状态先入库，响应丢失和中断遗留的记录归为结果未知，后续不自动重发。仍需验收 CRM 实发到 GA 报表的闭环，以及已发送后更正的处理流程。 [Google Measurement Protocol 参考](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference) |
| 4 | 确定启用范围和停发方式 | 约定启用时间及处理范围。建议从启用后的合格事件开始，历史 `held` 记录不自动放行。明确历史购买没有 GA 记录时，后续退款如何处置。明确超时事件的处置，不将旧事件重标为当天。演练停发、恢复和从队列到 GA 报表的对账，记录数量、金额差异和待处理项。 [Google 时间戳说明](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events#validation_behavior_for_past_events_and_user_properties) |

### 环境与验收顺序

| 环境 | GA 属性 | 对应 Web 数据流 |
| --- | --- | --- |
| 本地 3000 | UPER Test | `UPER Local` |
| 公司测试站 | UPER Test | `UPER Staging` |
| 正式站 | UPER Production | `UPER Web` |

`UPER Refund QA Web` 是 UPER Test 内用于本次退款验收的独立流。本地和公司测试站的常规数据流见上表。 [三环境配置](../../analytics/ga4-environments.md)

1. **本地和公司测试环境**只在 UPER Test 范围内验收。先拦截发送，验证保存、开关、并发、响应丢失、作废、权限和回滚。将来若单独授权隔离实发，使用 UPER Test 的退款验收专用流，完成 CRM 核实 → 入队 → 发送 → 报表闭环。同一笔模拟交易应为 1 次购买、2 次退款，累计 Rp 150,000。
2. **正式启用前**单独核对生产配置和发布回滚方案。确认目标为 UPER Production 的 UPER Web、首批范围清晰、可立即停发，并完成相应授权。
3. **正式启用后**从生产环境只读核对首批符合条件的真实交易。按交易 ID 对照 CRM 与 GA 的购买次数、退款次数和退款金额，记录差异。出现错流、重复或金额不符时先停发并核查。生产验收不使用本地或测试环境的事件。

### 客户 GA 标识与分析同意接入方案

1. 客户侧先提供可撤回的分析选项，默认关闭。记录同意范围、版本、时间和撤回状态。客户提交问卷、要求顾问或付款时照常办理。分析同意与广告同意分别管理。 [Google 网站同意模式](https://developers.google.com/tag-platform/security/guides/consent)
2. 客户主动同意后，由客户浏览器向当前环境的 Google 标签读取 `client_id`。通过现有访客会话及已保存的登记回执绑定到 CRM 客户。服务端校验会话、登记归属及环境，限制记录的访问和保留期限。员工浏览器、客户联系方式和系统生成的替代 ID 均不得填补缺失标识。 [Google 标识获取说明](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#client_id)
3. 首次合格购买固定所用标识与不含个人信息的交易 ID。后续退款沿用该交易绑定。发送前逐条核对绑定和最新同意，缺失、撤回或归属冲突时拦截，财务台账照常保存。验收覆盖同意、拒绝、撤回、跨访客、跨环境、多设备和身份合并。

## 收尾状态

- 原有入队和 v19 增量已在本地 `main`（`c3e862a`）。临时 MySQL 8.4.11 验证 v19 数据保留、v20 重跑两次、中断恢复、并发防重及响应丢失。模拟接口收到同一交易的 1 笔购买与 2 笔退款，合计 Rp 150,000。测试库已清理，v20 尚未应用到日常环境，外发保持关闭。
- 复查为只读，未重发事件。原定 2026 年 11 月 8 日 09:30（温哥华时间）的一次性复查已取消。
