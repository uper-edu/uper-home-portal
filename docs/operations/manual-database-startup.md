# 手工升级数据库；启动只做核验

适用范围：从生产基线 `95eea57` 对应的、已完整初始化的 MySQL 8 v18 库，升级至本批结构。不能根据镜像标签推断实库状态。这不是空库安装包、回退脚本或执行授权。下列步骤都不应放入应用、worker、initContainer、Jenkins 或 TKE 部署钩子。

## 运维顺序

1. 核实目标实例和库名、版本 1–18 的 `ready` 记录、真实表结构、账号权限及可恢复备份。记录金额、订单、客户归属、通知和邮件队列基线。盘点旧配置是否依赖 `ACCESS_PUBLIC_ORIGIN`、`PORTAL_WORKER_ENABLED=false`；新版需要已批准的公开域名配置且生产 worker 不依赖旧暂停开关。没有可控的停写、停消费和回退窗口就停止。
2. 初次应在**经单独授权的隔离库**演练（已完成，见「演练记录」；具体命令见「执行手册」）；手动执行[结构 SQL](../../sql/v20261126182423_portal_v18_to_v20.sql)。使用新的 mysql 8 批处理客户端进程（理解 `DELIMITER`，遇错即停，不用 `--force`，不要依赖 GUI 的“继续执行”）。通过客户端选中目标库，同时在同一会话显式设置 `@uper_expected_database` 为从变更单独立核对的库名，不要用 `DATABASE()` 自动填入。SQL 需读取元数据、创建表和临时使用具名存储过程，并仅为缺失的 v19/v20 写版本记录。已存在但结构不符的目标表、脏版本、恢复屏障均拒绝，不擅自清理或修复。
3. 单独准备[首次投递配置 SQL](../../sql/v20261126182717_reviewed_delivery_state.sql)。会话输入不是 `.env` 新增项：`@uper_expected_database`、`@uper_environment`（`dev`/`test`/`prod`）。在缺少初始化记录时还须提供人工审核的 `@uper_group_mode`、`@uper_personal_mode`、`@uper_mail_mode`。群／个人只接受 `live` 或 `simulation`；旧群总开关未配置真实发送时二者应为 `simulation`；旧群已配置真实发送但个人未获准时，个人仍为 `simulation`。群 `live` 只保留已有真实渠道，不把模拟渠道提为真实。招生邮件按原设置选择，正式环境无获批 SMTP 时使用 `disabled`。**不得仅为通过门禁而选择真实投递。** DML 在事务中执行，保留已有有效设置；不会消费或重放历史队列。重复执行不应新增审计或覆盖已保存的代际标识。
4. 手动执行[系统预设 SQL](../../sql/v20261126192807_system_default_seeds.sql)，同样设置 `@uper_expected_database`。它只补旧版启动会写入、而 `95eea57` 的库里还没有的三类预设：`lead.assigned` 通知策略（库中没有该 ID 时新增并启用，通过站内和飞书个人渠道通知负责人；个人渠道是否真实发送取决于上一步核定的模式），`social-bio` 缺失的常驻推广预设和索引（含 4 个报名入口），以及系统飞书群标记（库中没有系统群时，把唯一沿用旧系统名称的群改名为「Lark 群通知」并标记为系统群，使其不能被删除或改名；模式和 Webhook 引用不变）。已有策略、自定义链接和短链不改写；保留标识冲突时拒绝并交人工复核。缺少任何一类时，应用启动检查会报错停止。
5. 检查账号策略、teamless 标记、自然来源 Campaign、SLA、CMS 集合、其余通知策略（含已停用和已删除标记）、课程/角色和邮件池。已有业务数据、账号、密码、策略版本、推广关系和历史回执不由这三份 SQL 重写。若旧环境缺少预期业务初始值，或日报仍待收件路由复核，须列出具体差异，由负责人确认后**另写定向 SQL**；不能复制新环境种子或通过重启启用日报。空库、离线副本、部分旧版本升级也必须另做方案。本次未提供全新环境开户/初始密码 SQL：空库只建结构后，账号、SLA、teamless、默认通知策略和邮件投递状态均无初始化入口，应用启动检查会拒绝；新环境在该方案交付前只能由已初始化的库恢复得到。
6. 对照初始化之前的基线、各表和索引，重复运行手工 SQL 验证目标数据零变更。在隔离环境验证应用/worker 的只读启动、阻断状态和回退兼容性。失败时先停止；DDL 的隐式提交不能用业务事务回滚。失败可能留下脚本自己的存储过程，先审查其名称、定义与归属再人工处理，绝不覆盖同名现有过程。
7. 经批准后才在正式窗口逐项执行；确认生产流水线使用获批的 `release` 完整提交。应用只读核验通过后方可监听；邮件和任务 worker 的正常运行仍可能处理到期业务。只读启动不等于允许带真实队列做演练。制品回退前必须核对旧应用与新库及切换后写入的兼容性。

## 执行手册

以下流程已于 2026-11-26 在生产库的本地副本上逐步演练，结果见后文「演练记录」。在公司 test 或 prod 执行仍须各自单独授权；本手册不是执行授权。

### 1. 执行前核对（只读）

在目标库执行，结果与预期不符就停止：

```sql
SELECT GROUP_CONCAT(CONCAT(version,':',state) ORDER BY version SEPARATOR ' ') FROM trial_schema_versions;
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE();
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name LIKE 'access\_restore\_guard\_%';
SELECT routine_name FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name LIKE 'uper\_%';
SELECT id, config->>'$.mode', config->>'$.groupName' FROM notification_channels;
SELECT channel, IF(recipient LIKE 'personal:%','personal','group') kind, state, COUNT(*) FROM notification_jobs GROUP BY 1,2,3;
```

预期：版本 1–18 全部 `ready` 且没有 19、20；42 张表；恢复屏障 0；没有 `uper_` 开头的存储过程。后两条用于核定投递方式，见第 3 步。

### 2. 备份与停写

完成可恢复备份并记录恢复点。停止应用写入和通知、邮件队列消费后再执行 SQL。执行前另行保存 `notification_channels`、`notification_rules`、`trial_campaigns` 中 `social-bio` 行、`campaign_promotion_index` 和 `portal_settings` 的当前内容，供回退使用。

### 3. 依次执行三份 SQL

每份 SQL 用一个新的 mysql 8 命令行客户端进程执行，文件经标准输入传入，不加 `--force`。密码通过交互提示或登录配置提供，不写在命令行里。会话变量用 `--init-command` 在同一会话内设置。`<库名>` 填变更单上独立核对过的库名。

```sh
# ① 结构
mysql --host=<主机> --port=<端口> --user=<账号> -p --default-character-set=utf8mb4 \
  --init-command="SET @uper_expected_database='<库名>'" <库名> < sql/v20261126182423_portal_v18_to_v20.sql

# ② 投递方式
mysql --host=<主机> --port=<端口> --user=<账号> -p --default-character-set=utf8mb4 \
  --init-command="SET @uper_expected_database='<库名>', @uper_environment='<dev|test|prod>', @uper_group_mode='<live|simulation>', @uper_personal_mode='<live|simulation>', @uper_mail_mode='<disabled|smtp|simulation>'" \
  <库名> < sql/v20261126182717_reviewed_delivery_state.sql

# ③ 系统预设
mysql --host=<主机> --port=<端口> --user=<账号> -p --default-character-set=utf8mb4 \
  --init-command="SET @uper_expected_database='<库名>'" <库名> < sql/v20261126192807_system_default_seeds.sql
```

第 ② 步的三个模式必须由负责人按旧部署的实际配置核定，不能照抄演练值：

- 旧配置 `PORTAL_NOTIFICATION_MODE=configured` 时群为 `live`，否则为 `simulation`。
- 群为 `live` 且旧配置 `LARK_PERSONAL_DELIVERY_ENABLED=true` 时个人为 `live`，否则为 `simulation`。
- 招生邮件按旧传输配置选择；`prod` 不接受 `simulation`，没有获批 SMTP 时用 `disabled`。
- 第 1 步的任务统计可作旁证：`accepted` 的群任务或个人任务说明对应渠道此前在真实发送。旁证不能代替对部署配置的核对。

每步成功的标志是客户端退出码为 0 且没有输出。执行后核对：

| 步骤 | 核对查询 | 生产副本上的实测结果 |
|---|---|---|
| ① | 表数；`trial_schema_versions` | 70 张表；版本 1–20 全部 `ready`。旧 42 张表中只有 `trial_schema_versions` 变化，28 张新表为空 |
| ② | `portal_settings` 的 `lark_personal_channel`；`notification_channels` 的 `mode`；`enrollment_mail_configuration` | 个人渠道为 `{"mode": <核定值>, "revision": 1}`；群选 `simulation` 时原 `live` 的群改为 `simulation`，选 `live` 时群不变；邮件配置新增一行，`revision` 为 0 |
| ③ | `notification_rules` 的 `lead.assigned`；`notification_channels`；`social-bio` 的链接数和索引数 | 规则版本 1、已启用；`CRM_Leads_Update` 改名为「Lark 群通知」并标记 `systemManaged`，模式和 Webhook 引用不变；`social-bio` 链接和索引都由 10 增至 14 |

三份 SQL 写入的审计记录 `actor` 均为 `manual-sql`，可据此核对执行次数和数量。

### 4. 重跑与失败处理

- 三份 SQL 都可重复执行。演练中每份重跑后，全库逐表 `CHECKSUM TABLE` 均无变化；第 ② 份即使换一组模式重跑，也保留首次保存的决定。
- 门禁拒绝或中途报错时，客户端以非 0 退出并停在第一条错误。第 ②、③ 份的全部写入在同一事务内，演练中注入冲突后整体回滚，逐表校验无变化。第 ① 份的建表会隐式提交，按设计已建好的表保留，修复原因后重跑会核对并跳过它们；建表中途失败这一情形没有单独演练。
- 失败会留下脚本自己的存储过程：`uper_release_20261126182423`、`uper_delivery_20261126182717`、`uper_seed_20261126192807`，回滚 SQL 则是 `uper_rollback_20261127101113`。直接重跑会在创建过程时报「已存在」并停止，不会调用旧过程。核对该过程确为本次脚本所建后手工 `DROP PROCEDURE`，再重跑。成功执行后脚本会自行删除过程。

### 5. 启动核验

三份 SQL 全部完成并核对后才能启动新版应用。启动检查只读；演练中共执行 14 条只读语句并通过。缺任何一步都会报 `Database not ready: …` 并停止：演练中未升级的库报缺少 `crm_payment_analytics` 表，只做完 ① 或 ①、② 时报缺少 `lead.assigned` 通知策略。启动检查按 `PORTAL_ENV` 查找邮件配置，第 ② 步的 `@uper_environment` 必须与部署环境一致。

### 6. 回退

按新版应用是否已经使用新表，分两种情况：

**新表尚无数据**（升级中途失败，或升级完成但新版未启动、启动后未产生报名、收款分析和托管凭证记录）：执行回滚 SQL，库回到 v18。先停止应用和队列消费并备份。

```sh
mysql --host=<主机> --port=<端口> --user=<账号> -p --default-character-set=utf8mb4 \
  --init-command="SET @uper_expected_database='<库名>', @uper_rollback_confirm='v20-to-v18'" \
  <库名> < sql/v20261127101113_rollback_v20_to_v18.sql
```

- 执行账号除升级所需权限外，还需要 `DROP` 和 `DELETE`。
- 它撤销的内容以 ②、③ 写入的审计记录为准：`lead.assigned` 策略（其待发任务取消，不补发）、系统飞书群标记（名称恢复为「CRM Lark Bot」）、4 个 `enroll-*` 推广预设及其索引和短链、个人飞书投递决定；然后删除 28 张新表和 v19、v20 版本记录。
- 成功后核对：版本 1–18、42 张表、没有 `uper_` 存储过程；审计中新增一条 `release.rollback`。之后可以启动 `95eea57` 制品，也可以重新执行升级。
- 不恢复 `social-bio` 的 `updatedAt`。第 ② 份曾把群改为模拟时会拒绝，须先按执行前记录恢复群模式。

**新表已有数据**：回滚 SQL 整体拒绝且不做修改，因为删表会丢失业务记录。可选的处理：

- 保留数据库，切回 `95eea57` 制品。演练中只运行了旧版的启动迁移程序，没有启动旧版应用：它在已升级的库上正常完成，只额外为 4 个 `enroll-*` 预设各生成一条短链。此后再升级到新版，启动检查仍通过；但仓库内的历史迁移程序（恢复工具会调用它）会报 `Invalid promotion short-link mapping`，使用前须先删除这 4 条短链。
- 从执行前备份恢复，并补录其后的业务。

未演练：旧版应用在已升级库上的页面和队列行为；从备份恢复所需时间；受限账号执行回滚所需权限。

### 7. 生产部署配置

新版以生产方式启动时会先校验部署配置，任何一项不符都会在监听前退出。切换制品前逐项核对正式环境已注入的键（只核对键名和非敏感取值，不导出密钥）：`PORTAL_ENV=prod`、`PORTAL_DEPLOYMENT=production`、`PORTAL_PRODUCTION_READY=true`、`NODE_ENV=production`、`APP_ENV=production`、`PLATFORM_MODE=local`、`TRIAL_DATASET=synthetic`、`APP_URL` 和 `PORTAL_PUBLIC_ORIGIN` 均为 `https://uperedu.com`、`ACCESS_ALLOWED_ORIGINS` 只含获批域名、`MYSQL_TLS_MODE=disabled`、`ACCESS_TRUSTED_PROXIES` 为确切的内网代理地址。旧版使用的 `ACCESS_PUBLIC_ORIGIN` 和 `PORTAL_WORKER_ENABLED` 新版不再读取；生产方式下 worker 随应用启动。缺少的键属于新增环境变量，须按 `AGENTS.md` 逐项取得批准后才能加入。

## 演练记录

| 项目 | 内容 |
|---|---|
| 日期与环境 | 2026-11-26；本地 MySQL 8.0.46（Docker，Linux 容器内官方 mysql 客户端），生产库副本及其克隆。库默认排序规则为 `utf8mb4_unicode_ci`，表均为 `utf8mb4_0900_bin` |
| 起始状态 | 版本 1–18 `ready`，42 张表，无恢复屏障；没有 `lark_personal_channel`，没有 `lead.assigned`；`social-bio` 有 10 个链接 |
| 门禁 | 未声明库名、库名不符、结构未升级、未提供模式、「群模拟＋个人真实」组合：全部拒绝，且不改数据 |
| 分支 | 「群 `live`／个人 `simulation`」「群和个人均 `live`」「全部 `simulation`」三种组合各完整执行一遍，邮件均为 `disabled`；`smtp` 分支未执行 |
| 与旧启动路径对比 | 在另一份克隆上运行旧迁移程序和原挂载步骤作参照。两者的表、列及顺序、默认值、排序规则、索引、约束完全一致；数据差异只有时间戳、审计记录和邮件配置行（参照路径未运行邮件初始化） |
| 对旧数据的影响 | 旧 42 张表中 35 张逐表校验无变化；变化的 7 张为版本表、`portal_settings`、`portal_audit`、`notification_rules`、`notification_channels`、`trial_campaigns`、`campaign_promotion_index` |
| 字符集 | 第 ③ 份用 `latin1` 客户端执行，写入的「·」与 `utf8mb4` 客户端逐字节相同 |
| 应用启动 | 用提交 `e344651` 的开发构建，以隔离数据集方式（无通知 worker，飞书固定模拟，不提供任何外部凭证）在升级后的克隆上启动：2 秒就绪，`/api/health`、`/api/version` 正常，`/api/promotion-links/enroll-ig` 返回 `verified`。启动加 8 个只读请求后全库逐表校验无变化 |
| 耗时 | 每份约 1 秒（库约 7 MB） |
| 回滚（2026-11-27） | 在与生产同名的本地库（由生产库副本克隆，演练后已删除）上，用生产执行包的原文件依次执行预检、三份升级、核验，再执行回滚。回滚后 42 张表与升级前逐表校验一致，仅 `portal_audit`（保留 4 条审计）和 `trial_campaigns`（`social-bio` 的 `updatedAt`）不同。另验证：回滚重跑零变更；只做完结构步骤后回滚；回滚后再次升级并通过启动检查；新表有一行数据时拒绝且零变更；库名不符时拒绝；待发的 `lead.assigned` 任务被取消、`enroll-*` 短链被删除 |
| 未覆盖 | 使用 root 账号执行，受限账号所需权限未验证；真实生产实例的锁等待、复制延迟和恢复时间未验证；没有以生产部署方式启动应用，没有运行 worker，没有消费队列或发送通知；生产配置（公开域名、代理、发布门禁、密钥环）与新版启动要求是否一致未核对 |

## 启动路径的变化

| 原触发点 | 现在的行为 |
|---|---|
| API 或独立 worker → `store.initialize` → 自动建表、ALTER、种子写入 | 共用 `cloud/mysql/startup-database.mjs`：只读检查数据库、恢复屏障、版本，检查基线表及 28 张目标表的列/索引等；不调用旧迁移。 |
| API 挂载 → 本地员工、角色、teamless、通知规则、SLA、投递方式初始化 | 只核对必要状态；不创建员工、不替换角色、不启用通知、不重置邮件代际。默认通知策略逐项核对是否存在（含停用、删除标记），缺失时报错。 |
| API 入口 → 默认 organic Campaign；CMS 路由挂载 → 补空集合 | 从启动移除，改在预检中读取确认；缺失时报错。 |
| 迁移收尾 → 系统 Campaign、`social-bio` 常驻推广预设、推广索引和短链回填、系统飞书群标记 | 从启动移除；预检核对每个常驻预设在推广索引中归属 `social-bio`，并核对存在未删除的系统飞书群，缺失时报错。 |
| 挂载报名路由即创建后台定时器 | 正常 HTTP 监听成功后登记，按既有业务条件定时消费，启动不立即执行周报。 |

验证边界：自动化测试用模拟查询，只证明启动检查不发写语句；真实 SQL 的语法、门禁、重跑和回滚以上文演练记录为准。受限账号权限、生产实例的锁等待和恢复时间仍未验证。仓库内的历史初始化/恢复工具不属于启动路径，禁止把它们接作部署步骤。
