# 系统初始化预置

本页说明初始化入口、默认值的维护位置，以及已有配置的保护规则。修改这些源码不会直接改写当前环境；需要后续获准发布并重新启动，才会执行初始化。

## 统一入口与执行顺序

应用启动由 `server/portal/runtime.ts` 的 `initializePortalDefaults()` 统一编排：

1. 执行 MySQL 结构升级和系统记录初始化。
2. 处理现有 Lark 群／个人渠道的发送模式兼容迁移。
3. 经原有密码与恢复保护流程初始化员工和角色。
4. 补齐缺失通知策略、存量权限兼容与每日汇总策略。
5. 补齐兼容 SLA 设置；销售运营默认值由同一份销售数据提供。

数据库结构与事务入口仍为 `cloud/mysql/migrate.mjs`。预置活动、财务角色、群渠道和课程在结构锁内由 `initializeSystemDefaults()` 初始化；新库的个人渠道状态在初始化基础结构时写入。数据库结构迁移、业务预置和账号初始化保留各自原有的事务边界，并非所有步骤共用一个事务。仅执行 `schema.sql` 不等于完成应用初始化。

## 默认值维护位置

统一数据入口为 [`src/data/system-defaults/index.ts`](../../src/data/system-defaults/index.ts)。各分类文件有英文注释，说明用途、单位、生效与保留规则。消费端读取这些定义，不再分别复制相同默认值。

| 分类 | 文件 | 内容与当前默认值 |
| --- | --- | --- |
| 推广 | [`campaigns.ts`](../../src/data/system-defaults/campaigns.ts) | 自然流量 `organic` 和日常自然推广 `social-bio`；不再预置 Instagram Bio 活动。 |
| 账号权限 | [`access.ts`](../../src/data/system-defaults/access.ts) | 六种内置角色模板与九个初始账号的角色组合；不存密码。 |
| 通知 | [`notifications.ts`](../../src/data/system-defaults/notifications.ts) | 新群与个人渠道真实发送；默认英文、每小时100条；通知策略、个人偏好及不可关闭类型。 |
| 销售运营 | [`sales.ts`](../../src/data/system-defaults/sales.ts) | 雅加达工作日历、首次联系与后续跟进时限、自动分案默认关闭及轮询策略。 |
| 课程 | [`courses.ts`](../../src/data/system-defaults/courses.ts) | 课程默认发布、折扣权限为0；价格和课时仍读取已确认的价目表。 |
| AI | [`ai.ts`](../../src/data/system-defaults/ai.ts) | 默认主模型 `gpt-6.1-sol`、备用 `deepseek-chat`；主模型仍允许 `OPENAI_MODEL` 提供默认值，已保存 CRM 选择优先。 |

已有独立业务资源继续作为唯一来源，不把大数据包重复塞进初始化注册表：

- [`evergreenPromotionLinks.json`](../../src/data/evergreenPromotionLinks.json)：日常自然推广的10条链接，包含两条 Threads 链接。稳定推广ID、归因参数和短链兼容逻辑不变。
- [`crmCoursePrices.json`](../../src/data/crmCoursePrices.json)：8门HSK标准课程的价格和课时，金额单位IDR；报名仍保存当时报价快照。
- CMS初始化内容、图片与题库仍由各自已有导入工具和资源包维护；数据库结构升级仍由迁移链维护。
- Webhook、应用凭证、租户标识、回调及数据库连接留在各环境的私有配置中；群地址仍由 `LARK_GROUP_CRM` 提供。

销售工作日历约束业务期限，不能据此限制 Lark 在周末或工作时间之外发送。真实发送默认值也不会绕过策略收件范围、负责人权限、员工绑定、凭证和渠道模式校验。

## 已有配置与重复执行

- 新系统读取分类默认值；已有渠道的模拟／真实模式、签名和限流保持原样。旧个人渠道继续走既有兼容迁移；新库直接写入当前个人渠道版本，避免被旧模式变量改变新系统默认值。
- 重复执行只补缺失预置，不清零活动统计，不覆盖调价、上下架、优惠、自定义角色或已保存通知策略及个人偏好。
- 标准课程采用稳定ID；旧版同名人工课程保留原ID、原报价及历史引用。遇到多个同名旧课程或预留活动身份冲突时中止并回滚，不猜测合并。
- 初始账号仍为 Suki、Robert、Fadhil、Zainul、Wigar、Tester、Fenny、Ethan、Monite。首次安装从各环境的私有 `ACCESS_INITIAL_PASSWORD` 读取统一密码，亦支持使用受限的 `ACCESS_INITIAL_PASSWORDS_FILE`。新建账号首次登录必须设置新密码，之后才能访问工作区。Robert的初始管理员授权仍由原有引导流程完成。
- 已有账号的密码、停用状态及角色保持原样；重启不会把管理员已撤销的财务权限或其他权限加回。恢复审查屏障继续阻止账号初始化写入。
- 离线迁移副本与恢复安全屏障保留原有保护。自动化夹具可显式使用 `initializeSystemDefaults=false` 构造空业务场景。

## 本轮验证范围

使用内存模拟数据库与模拟消息传输验证新系统预置、重复执行、已有课程／角色／渠道配置保留、活动身份冲突回滚，以及账号密码与权限不被覆盖。核对重构前后实际默认值一致，并采用已确认的新 Lark 群与个人渠道默认真实发送；后续核对将 AI 默认主模型修正为已确认的 `gpt-6.1-sol`，与三份环境配置一致。

未执行真实 MySQL 初始化、3000重启、页面验收或真实通知发送；未更改当前数据、账号、权限、配置或测试站。发布前如需验证实际数据库与启动行为，应在获准范围内另行验收。
