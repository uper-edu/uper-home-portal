---
artifact_contract: he-unified-plan
artifact_readiness: implementation-ready
execution_type: code
product_contract_source: he-plan-bootstrap
---

## Context

用户于本会话批准本计划：在 cn60.monite.cn:3306/uper_trial_home 新建表，保留备份账号及权限，以项目提交的 CMS v2 内容初始化 COS URL，在本地3000验证。生产由用户手工同步；本次不提交、推送或部署。原始备份只读，秘密与账号导出不进入Git。

## Goal Capsule

输入：D:\uper_trial_home_20261104193118.sql（账号权限）；Git d6b05b842a2f5921483ba22400915f6d56634a38 的 cloud/mysql/seeds/cms/v2（8类106条内容208张图片）。目标COS桶 uper-portal-public-20261104191752-1433456541，地域 ap-jakarta，前缀 cms/，对象URL https://uper-portal-public-20261104191752-1433456541.cos.ap-jakarta.myqcloud.com/cms/<SHA256>.webp。

## Product Contract

- **R1** — 全部所需表采用当前schema及COS改造，在指定库新建；同名表存在则停止，不覆盖。
- **R2** — 保留备份全部账号、密码哈希、状态和角色权限；不重置密码、不复制旧登录会话。
- **R3** — CMS仅来自项目初始化包；资源和后续上传使用COS；数据库保存cos_url及元数据，新媒体无BLOB。
- **R4** — 除账号权限和必要系统种子外，不复制旧会话、审计、对话、待执行任务或通知凭据。
- **R5** — 本地3000连接指定库验证，交付完整DDL+DML，用户自行同步生产。
- **A1** — 账号及权限与源数据一致，报告不泄密。
- **A2** — 208资源匿名GET摘要一致；CMS上传保存刷新和首页展示通过。
- **A3** — 完整SQL与初始库一致，符合版本迁移，无新增外键；测试数据不进入最终初始化包。
- **A4** — 自动测试和中文桌面实际验收有证据；失败及未验证如实记录。

批准边界：允许使用所给凭据连接指定数据库、发布指定CMS公开资源并创建缺失表。凭据仅服务端私有配置，不进入命令参数、日志、计划、前端或SQL。禁止覆盖现存表、清库、关闭TLS证书校验、改变桶ACL、删除云对象、重置账号、触发通知、直接操作生产。遇到同名表/TLS不满足/对象冲突/匿名读取失败/缺安全登录信息则停止相应步骤。必要时可在WSL安装开发依赖，但不另建数据库。

## 执行中已确认的调整

- 用户明确批准仅 `dev + remote-dev + cn60.monite.cn:3306/uper_trial_home` 允许无TLS直连，生产及其他远端TLS门禁不变；最终代码不提交。
- 只读预检发现40张现存表、v15、9账号、8类106条CMS、0媒体。用户选择保留现有表并增量改造：先备份并比对账号/CMS，一致后升级COS结构、补媒体及改精确URL；差异停止，不静默覆盖。U1/U5由“空库新建”改为该增量路径，最终交付SQL仍为独立空库初始化包。

## Implementation Units

### U1 — 固定输入并核对初始化条件
- Requirements: R1, R2, R3, R4
- Files: 源SQL（只读）、cloud/mysql/schema*.sql、cloud/mysql/migrate.mjs、账号权限引导、CMS v2包
- Approach: 使用he-work；固定输入摘要，可靠解析SQL多行INSERT和转义，核对账号依赖；远端只读预检版本/TLS/同名表。不得整包执行原SQL。
- Dependencies: none
- Test strategy: coverage
- Test scenarios: 同名表、坏SQL、缺失关联、版本和TLS不满足
- Verification: 输入清单、结构及账户依赖统计、实际连接回执
- Execution note: 不打印账户秘密，遇同名表停止。

### U2 — COS适配层与schema
- Requirements: R1, R3, A2, A3
- Files: cloud/mysql/cms-media-storage.mjs、cloud/mysql/migrate.mjs、新schema、scripts/package-portal.mjs、package.json及配置示例
- Approach: SDK统一上传/URL/重试脱敏，PORTAL_COS_*沿用环境隔离；媒体新增cos_url/对象键/存储类型/字节数，content允许NULL；保留旧BLOB升级兼容。无外键，必要索引保留；启动迁移不联网。
- Dependencies: U1
- Test strategy: tdd
- Test scenarios: 配置隔离、URL白名单、摘要冲突、重试、旧结构升级
- Verification: 定向测试、DDL检查、构建清单
- Execution note: 不修改桶策略，不删除对象。

### U3 — CMS上传与展示
- Requirements: R3, A2, A4
- Files: cloud/mysql/site.mjs、服务端入口、src/cmsClient.ts、相关测试
- Approach: 保留权限/同源/2MB及像素限制/Sharp/SHA256/幂等。网络上传在事务外，提交前重新核对幂等并写URL及审计；失败不回退BLOB、不删除共享对象。图集接受可信COS与合法旧URL；旧路由兼容，COS不加Sanity参数。前端复用既有重试草稿；确需交互变更时调用uper-admin-workspace-design。
- Dependencies: U2
- Test strategy: tdd
- Test scenarios: 成功、权限拒绝、超限、重复冲突、并发、部分失败、旧图
- Verification: 接口单测及3000上传保存刷新
- Execution note: 无布局和业务范围扩展。

### U4 — 初始化资源发布及URL数据
- Requirements: R3, A2
- Files: cloud/mysql/seeds/cms/v2/{bundle.json,import.mjs,preview.json,SHA256SUMS,README.md}、发布工具及测试
- Approach: 分离离线preview/显式上传/匿名核验/导入。208资源按内容摘要上传并核验；仅替换媒体引用，其他内容不变，重建校验清单。导入URL元数据，不写BLOB，保留空库/相同重入/拒绝覆盖保护。保留本地原图。
- Dependencies: U2
- Test strategy: tdd
- Test scenarios: 缺图、坏摘要、URL非法、续传、空库重入与非空拒绝
- Verification: 208个匿名GET及内容摘要、非媒体内容一致性
- Execution note: 不使用备份旧CMS、不上传其他业务附件。

### U5 — 完整SQL与指定库初始化
- Requirements: R1, R2, R4, A1, A3
- Files: 可复现生成工具及测试、文档、Git忽略的敏感交付目录
- Approach: 当前完整schema+COS列、原账号权限、项目CMS与必要种子生成完整SQL；版本记录须与结构对应。无写死库名/建库/DROP/TRUNCATE/明文凭据；按依赖导入。先检查全部输入，再建表导入。最终SQL保留初始状态，不含验收临时数据。
- Dependencies: U1, U2, U3, U4
- Test strategy: coverage
- Test scenarios: DDL完整、账户关联、版本一致、初始化中断及秘密隔离
- Verification: 表结构/计数/账号哈希与权限一致性/健康检查
- Execution note: DDL不承诺事务回滚，中断保留状态并停止，不自动删表。

### U6 — 远端dev与3000验收
- Requirements: R5, A4
- Files: cloud/mysql/database.mjs、环境启动校验、示例、测试报告
- Approach: 明确受控dev远端模式，限定目标且保留生产隔离及TLS验证；不能冒充本地socket模式。优先本机，必要WSL依赖，不另建DB。3000验收不启动通知worker；既有配置不改发送模式。保留账号登录，缺登录信息不重置。he-test-browser用于真实页面验收。
- Dependencies: U2, U3, U5
- Test strategy: tdd + coverage
- Test scenarios: 目标白名单/跨环境隔离/TLS、登录/CMS8类/图集/首页/权限
- Verification: npm test；npm run lint；npm run build；git diff --check；3000中文桌面及DB只读核验
- Execution note: 不跑旧4412/实库故障注入，不测试未授权语言设备。

## Verification Contract

先建立基线，故障测试用mock。208张资源逐一实际核验。SQL和数据库初始状态、账号权限摘要一致。3000实际完成上传保存刷新和首页展示。最终交付包不包含测试数据。he-test-generate建立用例证据；最终he-simplify-code、he-test-full、只报告he-code-review。秘密扫描覆盖变更与构建产物。未通过项不可标为通过。

## Definition of Done

指定库建表初始化且账号保留；CMS种子与后续上传使用COS，DB存URL；自动测试和3000验收完成；完整DDL+DML/校验和/配置与操作说明/证据可交付。生产由用户同步，不提交推送部署。
