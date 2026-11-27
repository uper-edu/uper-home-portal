# 2026-11-26｜release 回合 main 至最新版本：完整汇总

**终点**：公司仓库 `origin/main` = `9f56b49fcb96d34a537d6da4c5a84f34b04b2a30`。远端 `release` = `fda9d65`。本文比较已提交快照；不含工作区未提交的规范或其他文件，不等同于现网数据库盘点。

## 一、先定位「开始回合」

以下为本地 Git reflog 时间（UTC+8），不是各提交原始创作时间：

- **17:00:57**：从旧 `release@44db683` 合入当时的 `main@f70782d`，产生 `fda9d65`。第一父提交是旧 release，第二父提交是回合前 main。
- **17:24:33**：本地 `main` 从 `f70782d` 快进至 `fda9d65`（`merge release: Fast-forward`）。这才是今天 **release → main** 的动作，没有另造合并提交。
- **17:57:14**：本地 `main` 快进至远端的 `9f56b49`。因此以 `fda9d65` 为起点只会看到第二段，漏掉回合动作带给 main 的改动。

| 想回答的问题 | 起点 → 最新 main | 可达提交数 | 文件净差异 | 新增 MySQL 表 |
|---|---|---:|---|---:|
| 回合前的 main | `f70782d → 9f56b49` | 15 | 56 files changed, 2618 insertions(+), 123 deletions(-) | 0 |
| 今日发版合并前的 release | `44db683 → 9f56b49` | 393 | 895 files changed, 76588 insertions(+), 18266 deletions(-) | 28 |
| 更早的 release 历史节点 | `cb640ee → 9f56b49` | 397 | 897 files changed, 76642 insertions(+), 18266 deletions(-) | 28 |

三行是对同一终点的不同基线比较，不能相加。`cb640ee` 是 **11 月 7 日** 将当时 `origin/main` 合入 COS 修复线的历史节点，不是今天的回合。**回答“今天 main 得到了什么”看第一行；准备“旧 release 升到今天最新 main”的交付清单看第二行。**

## 二、今天 main 得到了什么（f70782d → 9f56b49）

**阶段 A：回合当刻，16 个文件。** 官网首页、关于我们、CSCA、活动、招聘、HSK、新闻、留学和研学页面保留 release 的 COS 图片地址，移除不再需要的 Unsplash 预连接；飞书群机器人允许国内官方域名，并保留对伪装域名的拒绝；临时密码门禁仅限制员工工作区，不再连带拦截公开访客 API。补入两项对应的回归覆盖、生产只从 `release` 发布的分支规范，并忽略本地 `hedocs/`。这部分没有结构 SQL。

**阶段 B：其后 main 新增 40 个文件差异。** 以下是第二段的业务变化；两段合计 56 个文件（14 新增、42 修改）。


| 领域 | 以前 → 现在 | 边界与影响 |
|---|---|---|
| 教师档案 | 新增 CRM 教师资料维护、启停、本地／外籍分类、中英印尼三语独立内容，以及照片、简历附件。 | 教师选项、档案、薪酬的可见范围不同；跟进人员能选教师，不等于能访问薪酬。附件经类型与内容校验，保存在现有设置表，经权限接口读取，不是公开图片地址。 |
| 薪酬与合同 | 支持保留合同薪酬原文，另存按生效日期／合同阶段划分的费率，区分按课和按月、IDR 和 CNY，保留变更前后内容。 | 档案运营权限与费率财务权限分开。费率版本和服务期共同决定报价，避免拿当前费率无条件重算旧结算。 |
| 班次、一对一预约 | 新建班次发布与一对一确认从自由填写教师姓名，改为选择可用教师；保存教师 ID 与当时姓名。班次排课预览沿用所选教师。 | 新指派校验启用状态及教师类别。已发布、已有结构化教师且首课已开始的班次限制改派；保留旧记录的姓名，不做批量教师身份回填。学员端的一对一确认不暴露内部教师 ID。 |
| 课程成本与教师结算 | CRM 经营看板新增按月维护的教师结算单；可关联标准班、小班或已确认的一对一预约，记录课次、服务期、费率及修订。 | 同一目标的重叠服务期跨单号、跨月份也拒绝；无日期的历史明细按整个目标防重。更正需理由和正确版本。按课人民币费用保留 IDR 折算与依据；月薪不自动摊成每节课成本。结算记录用于成本核算，不是发工资或对学生收款。 |
| GA4 报名事件 | 新增 `enrollment_class_view`、`enrollment_application_start`、`enrollment_seat_reserved`、`enrollment_proof_saved`。 | 详情和申请以实际展示为准；获席和保存凭证以成功回执／恢复确认为准，并在当前标签页按订单去重。订单号用于本地去重，不上传到 GA4。**保存凭证不代表财务已核款。** |
| 看板与电视墙 | 新增报名落地会话漏斗，按来源、媒介和活动汇总；详情浏览单列，允许直达申请。电视墙的申请启动率使用同一批报名落地会话作为分母。 | 只统计首次落在报名页的会话，按 WIB 的会话开始日归属，观察同一会话前 24 小时的有序步骤。区分无覆盖、真实零、缺会话标识的浏览；不把 GA4 会话数等同于学员或订单数。 |


### 本区间在已有表中写什么

| 存储位置 | 本次实际变化 |
|---|---|
| `portal_settings`（原表） | `faculty:profile:`、`faculty:photo:`、`faculty:cv:`、`faculty:rate:` 和 `faculty:rate-history:` 保存教师资料、私有附件、费率及历史。`dashboard_teacher_settlement_*` 键按环境保存结算单、月份索引、锁和修订历史；跨月更正会移除旧月份索引。`ga_enrollment_funnel_v1:<环境>:<日期>` 存按日汇总，较新抓取结果可更新旧汇总。上面都是记录键，不是表名或数据库索引。 |
| `enrollment_classes.data`（原 JSON 列） | 班次教师指派新增 `teacherId`，保留姓名快照 `teacher`；没有新增物理列。 |
| `enrollment_demands.criteria`（原 JSON 列） | 一对一确认在 `appointment.confirmation` 内保存 `teacherId` 与姓名、首课时间、排期。旧版只提交姓名的确认请求不符合新接口要求。 |
| `portal_audit`（原表） | 教师档案、费率和结算单保存时写入审计记录；结算更正另有版本历史。 |
| MySQL 查询目录 | `cloud/mysql/query-catalog.json` 更新运行时 SQL 目录。`cloud/mysql/schema*.sql`、`cloud/mysql/migrate.mjs` 和 `sql/` 均无本区间改动。没有随本区间代码新增的结构 SQL，也没有用于历史教师批量回填的迁移。 |
| GA4 / BigQuery | 唯一新增的 `.sql` 是 `scripts/analytics/enrollment-funnel.bigquery.sql`：查询 GA4 导出日表并产出汇总，**不是 MySQL 建表脚本**。新导入工具默认预览；显式写入才会更新目标环境的日汇总。此次未执行查询或导入。 |


## 三、若按今天合并前的旧 release 做升级对比（44db683 → 9f56b49）

**整体功能清单 = 本节的跨版本变化 + 上节阶段 B 的教师、结算、漏斗变化。** 上节阶段 A 的 COS、飞书和访客修复已经在旧 release 中，因此不是从旧 release 升级后的新功能。


| 模块 | 主要变化 | 升级时关注什么 |
|---|---|---|
| 学员报名 | 新增公开班次与报名页、邮箱验证、报名查单、付款说明、上传和补交凭证；支持候补、选课意向、余位匹配、转班、取消、退款与一对一排期。 | 公开入口能打开不代表可报名；班次、服务开关、收款资料和邮件投递须分别核对。 |
| CRM 与财务 | 客户和报名商机关联、按班次处理、销售协助报名；按转账核款、实际收款账户、逾期款项冲抵、分笔退款、售后权限及重复提交恢复。 | 对照订单应收、凭证、逐笔实收、冲抵和退款；凭证不是实收，GA4 记录也不是财务流水。 |
| 招生邮件与飞书 | 管理发信账号、发信池、收件人绑定、发送配额及尝试记录。飞书群与个人渠道分开管理真实／模拟投递；增加回执、重试和个人偏好处理。 | 首次渠道模式迁移及历史待发队列会影响是否真实发送；不能把 HTTP 成功等同于业务通知已送达。 |
| AI、课程与 HSK | Chat 使用结构化课程、班次和报名上下文；调整主备供应商、模型管理、失败重试及流式回复。更新 HSK 课程介绍、学习建议和测评历史兼容处理。 | 模型凭证、主备请求、咨询与报名的权限边界要分开验证。 |
| 运营报表与 GA4 | 新增 CRM 运营看板／电视墙、月 KPI 目标；结合流量、广告、教学等来源，细分公开班次落地与推广归因，记录收款和退款分析事件。 | 核对报表数据覆盖期及来源；不要把缺少来源数据解读成零业绩。 |
| CMS、后台与访问管理 | CRM、CMS 和系统管理复用详情、导航、搜索、下拉、时间选择与保存反馈；移除退役文件式 CMS 模块，调整管理员恢复、角色影响预览与登录恢复。 | 核对各角色的可见范围、拒绝路径、保存恢复，以及旧内容和图片。官网图片的 COS 修复在旧 release 已有，不把它算作本次新增。 |
| 配置与凭证 | 引入分环境托管集成凭证、密钥环、轮换及撤销；调整公开来源变量、新旧配置兼容、worker 启用条件、集成凭证配置方式和发布手册。 | `ACCESS_PUBLIC_ORIGIN` 和新运行时的 `PORTAL_PUBLIC_ORIGIN` 并非仅换展示名称；旧 `PORTAL_WORKER_ENABLED=false` 不再保证生产 worker 暂停。 |


### 全部 28 张新增表及用途（旧 release 基线）

| 表 | 用途 | 建表 SQL |
|---|---|---|
| `enrollment_classes` | 班次定义、发布状态与版本 | `schema-enrollment-20261114172847.sql` |
| `enrollment_email_challenges` | 报名邮箱验证码挑战 | `schema-enrollment-20261114174435.sql` |
| `enrollment_email_sessions` | 邮箱验证后的会话 | `schema-enrollment-20261114174435.sql` |
| `enrollment_orders` | 学员报名订单、状态与金额快照 | `schema-enrollment-20261114174435.sql` |
| `enrollment_proofs` | 学员提交的付款凭证 | `schema-enrollment-20261114174435.sql` |
| `enrollment_receipts` | 财务确认的实收记录，区别于学员上传凭证 | `schema-enrollment-20261114174435.sql` |
| `enrollment_class_openings` | 班次开班决定记录 | `schema-enrollment-20261114174435.sql` |
| `enrollment_waitlist` | 候补记录 | `schema-enrollment-20261114175859.sql` |
| `enrollment_demands` | 尚无合适班次的选课需求 | `schema-enrollment-20261114175859.sql` |
| `enrollment_vacancy_cycles` | 余位释放与匹配轮次 | `schema-enrollment-20261114175859.sql` |
| `enrollment_interest_events` | 候补和选课需求的业务事件 | `schema-enrollment-20261114175859.sql` |
| `enrollment_transfer_invitations` | 转班邀请与应答期限 | `schema-enrollment-20261114181313.sql` |
| `enrollment_transfers` | 已发生的转班记录 | `schema-enrollment-20261114181313.sql` |
| `enrollment_refund_cases` | 退款申请及处理状态 | `schema-enrollment-20261114181313.sql` |
| `enrollment_refund_payments` | 分笔退款流水 | `schema-enrollment-20261114181313.sql` |
| `enrollment_refund_returns` | 已退资金的退回流水 | `schema-enrollment-20261114213702.sql` |
| `enrollment_payment_credits` | 把已核实款项冲抵至另一报名订单的记录 | `schema-enrollment-20261115014556.sql` |
| `enrollment_opportunities` | 与 CRM 客户关联的报名商机 | `schema-enrollment-20261114182623.sql` |
| `enrollment_opportunity_progress` | 商机阶段、跟进人和备注历史 | `schema-enrollment-20261114182623.sql` |
| `enrollment_customer_records` | 报名相关记录与客户、商机的关联 | `schema-enrollment-20261114182623.sql` |
| `enrollment_record_attribution` | 报名记录的推广归因快照 | `schema-enrollment-20261114183459.sql` |
| `enrollment_notification_receipts` | 按事件键保存的报名通知回执 | `schema-enrollment-20261114183459.sql` |
| `enrollment_assisted_applications` | 销售协助报名的确认请求、有效期与结果订单 | `schema-enrollment-20261115183339.sql` |
| `enrollment_mail_configuration` | 各环境招生邮件配置及修订号 | `schema-enrollment-20261116191537.sql` |
| `enrollment_mail_attempts` | 邮件投递尝试、状态及限额统计依据 | `schema-enrollment-20261116191537.sql` |
| `enrollment_mail_bindings` | 收件人与发件账号的绑定 | `schema-enrollment-20261116191537.sql` |
| `crm_payment_analytics` | CRM 实收／退款分析事件与 GA4 投递状态，不是财务原始账本 | `schema-v19.sql` |
| `integration_credentials` | 按环境、集成类型与资源隔离的托管凭证状态 | `schema-credentials-20261119162447.sql` |


### 追加的列和索引

| 表 | 区间内建表之后的增量 |
|---|---|
| `enrollment_waitlist` | `learner_name VARCHAR(120)`、`activity_at DATETIME(6)`，均允许 NULL。 |
| `enrollment_orders` | 可空的 `activity_at DATETIME(6)`，区分业务活动时间与建单时间。 |
| `enrollment_proofs` | 可空的 `transfer_details JSON`，保存申报金额、流水号等转账信息。 |
| `enrollment_receipts` | 可空的 `receiving_account VARCHAR(160)`，记录实际收款账户。 |
| `enrollment_refund_cases` | 可空的 `timing JSON`，记录申请时间、预计退款期限等。 |
| `enrollment_mail_attempts` | 可空的 `pool_id VARCHAR(40)`，索引 `mail_pool_daily(environment, day_key, pool_id)`。 |
| `crm_payment_analytics` | v20 增加可空 `dispatch_state`、`attempted_at` 和索引 `payment_analytics_dispatch(environment, dispatch_state, created_at)`；另在 `migrate.mjs` 内联添加可空 `occurred_at DATETIME(6)`。 |

这 7 张表都属于本区间新增的 28 张表。对比两端，新增的 19 份运行时 schema SQL 中未见删除旧表或旧列；这不等于不存在运行时 DML。`sql/` 目录只修改了 `README.md`，没有交付对应的新手工升级 SQL 包。代码中的 v19/v20 是支付分析版本标记；报名、凭证等另行建表，不能仅凭 `trial_schema_versions` 最大值判断升级完成。


## 四、验收与使用边界

- **关心实际升级时，先核对数据库，而不是只看代码提交号。** 28 张是代码比较得出的新表，不代表测试库或生产一定缺 28 张。教师和漏斗复用已有表，不需要再创建一套教师或 GA 表。
- 旧 release → 最新 main 的区间仍包含自动迁移和初始化写库路径。仓库的手动 SQL 要求不能靠启动、重启或滚动发布替代。此报告不执行、也不授权执行任何 SQL。
- 本次重新核对了远端引用、本地 reflog、合并父提交、Git 树差异及新增建表声明。没有启动服务、连接数据库、修改业务代码或重跑全量测试。此前第二阶段 32 个定向测试通过，并不代表整个旧 release 升级已经验收。
