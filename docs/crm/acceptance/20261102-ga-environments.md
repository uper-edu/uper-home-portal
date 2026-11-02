# GA三环境配置验收 · 2026-11-02

## 结论与范围

完成两个属性、三个Web数据流的配置及本地3000接入。域名不变。测试站和生产站仅完成GA后台及本地构建配置，未发布远端，不能作为远端已生效或已实收的证明。

- UPER Test（561827503）：UPER Local（16251883595，G-RTB5CWXVWV）、UPER Staging（16252453328，G-YTELN0GKTF）。
- UPER Production（543450253）：UPER Web（15159406809，G-SZCY9WLK8X）。保留原正式属性、衡量ID和历史数据，只规范显示名称。
- 三个流均关闭增强型衡量。正式属性补齐与测试一致的13个事件维度、2个毫秒指标和5个业务关键事件；五项默认货币值逐项重新打开回读，均为不设置。未新增按URL生成的事件规则、永久排除过滤器或历史删除请求。
- 生产客户、生产员工业务使用和显式QA分开；员工正常CRM使用不会被当作测试全部排除。规则见[GA三环境数据去向](../../analytics/ga4-environments.md)。

## 备份和变更

私有备份位于 `.local-backups/ga-env-20261102/`，包含原环境文件、相关源码和完整MySQL备份。数据库备份3182401字节，SHA-256：`76f47399c113f956d0ea2fde58dbcbe066c3b668d6e4c614cc97c5f65cc85e7f`。凭证、备份和原始客户数据不进入Git。

私有环境文件按键比对：dev和prod值不变；test仅补充VITE_UPER_MEASUREMENT_ID。服务器环境文件及运行配置未改。原3000运行包保留为previous-local-package，可回退；重启沿用原暂停通知的启动方式，没有恢复普通工作进程。

本轮实现：公开环境映射、构建ID错配拒绝、运行主机／HTTPS核对、显式测试标签和员工使用分类。相关文件为 `src/data/analyticsEnvironments.json`、`server/analyticsEnvironment.mjs`、`src/utils/analyticsEnvironment.ts`、`src/utils/analytics.ts`、`src/utils/analyticsPolicy.ts`、`vite.config.ts`、三份.env示例注释及定向测试。保留此前并行改动，没有Git暂存、提交或推送。

## 自动验证

| 检查 | 结果与边界 |
|---|---|
| 全量项目测试 | 1493项：1464通过、0失败、29跳过 |
| 最终统计及环境定向测试 | 20通过、0失败、0跳过 |
| TypeScript检查 | 通过 |
| dev完整运行包构建 | 通过；现运行版本4c207d8c967b-4c5ea7497156cfda |
| test、prod前端构建 | 均通过，仅构建未运行或部署 |
| 构建产物ID | dev仅G-RTB5CWXVWV，test仅G-YTELN0GKTF，prod仅G-SZCY9WLK8X |
| 缺失／错误ID | 构建拒绝；不会静默使用其他环境ID |
| 错误主机／协议／目标 | 单元正反矩阵通过：本机、测试、生产交叉错配以及伪装域名均拒绝统计 |
| 显式QA与隐私 | 同标签保持、解除和Storage异常通过；URL标记及个人信息不进入页面URL参数 |
| git diff --check | 通过 |

29项跳过均为需显式独立MySQL夹具的组：恢复、历史补分、自动分案、Campaign预算／删除／推广／保存／来源复核／空库／推广复核、工作区HTTP、持久化AI故障切换、747场景、互动时间线、操作范围并发／撤权、联系执行、运营配置恢复／主题保存、约定提醒、P0身份及回滚、站内通知、Lark绑定／授权／V2／取消／目标、657身份、顾问请求和登记回执事务。没有因本轮GA配置新增失败；未在本轮重新验收这些业务数据库事务。此次未修改这些事务实现，因此不阻断三环境映射与本地统计配置验收；后续若改动其业务流程，仍须相应隔离验收，不能把跳过算通过。

## 中文电脑端及GA实收

本地3000版本接口确认前后端一致。中文 `/link`、`/chat`、CRM列表正常，实际页面仅加载本地衡量ID。

通过无活动参数的/link入口点击进入/chat，另在127.0.0.1入口验证空姓名校验及填写模拟资料后切换到目标步骤。没有提交问卷、发起顾问请求、保存测评、修改客户或发送对话；现有CRM筛选未保存或更改。

UPER Test DebugView实际收到本轮questionnaire_view、questionnaire_step_view、questionnaire_step_next、questionnaire_start和questionnaire_validation_error。展开参数核对：

- app_version：4c207d8c967b-4c5ea7497156cfda；
- environment：development；
- traffic_category：internal_test；
- page_location：http://127.0.0.1:3000/chat，无模拟姓名、电话或邮箱。

证据保存在私有目录local-ga-received.json、prod/test-default-value-readback.json、artifact-ga-ids.json及控制台页面快照。实时列表中的旧转化属于先前已授权验收，不作为本轮新转化；本轮没有通过补发事件制造转化。

## 数据保护结果

36张表对比，33张完全一致，包括客户、员工账号、角色权限、CMS、业务事实、任务期限、运营配置及通知队列。仅三张出现页面访问带来的正常变化，并用安全脚本核对具体字段：

- conversations：65→67；既有65条全量哈希一致；新增两条均无消息。
- visitor_sessions：44→45；既有44条全量哈希一致。
- trial_campaigns：7→7；两条仅stats.impressions变化，没有修改Campaign配置或归因业务规则。

没有清理、复制或还原业务数据，没有新客户、真实通知或历史通知重放。安全差异报告仅记录字段路径、数量及哈希，不输出客户内容、账号或密钥。

## 尚未验证及后续发布要求

1. 未发布测试站、生产站；远端页面的实际加载ID和实收需在后续明确授权发布后分别验收。本次test/prod构建通过不等于远端运行通过。
2. 标准报表和新增自定义维度的24–48小时处理未等待完成；流列表“过去48小时未收数据”的状态存在更新延迟，实收以上述DebugView的确切新版本事件为准。
3. 本轮未提交客户或发送通知，未重跑最终提交、测评保存、销售保存的真实业务闭环；保留前轮授权隔离验收结果，不冒充本轮重新执行。
4. 仅验中文电脑端；英语、印尼语和窄屏未重测。统计配置不更改三语或页面布局。
5. 原正式属性的旧混合数据没有被清理；切换后报表需结合日期、hostname、environment及traffic_category分析。已打开旧页面仍可能沿用旧脚本，应刷新后再验收。
6. 浏览器拦截、关闭页面、跨设备及未主动标记的生产测试仍可能漏计或混入；GA不能替代业务数据库对账。
