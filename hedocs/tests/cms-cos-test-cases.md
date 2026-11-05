# CMS COS 测试用例

关联计划：`hedocs/plans/cms-cos-production-bootstrap.md`。自动化采用Node原生test；故障用mock，不在业务库制造故障。适用范围：中文电脑端、本地3000及获准dev数据库。场景状态以本次执行回执为准。

## COS-01 — 永久URL不追加Sanity参数
<!-- he-test-case:COS-01 -->
- 文件：`tests/cmsCos.test.ts`。输入COS及Sanity图片，调用尺寸/质量链式方法；COS URL原样保留，Sanity保留原行为。

## COS-02 — 开发直连精确边界
<!-- he-test-case:COS-02 -->
- 文件：`tests/cmsCos.test.ts`。仅显式dev授权和指定主机/端口/库名通过；prod、其他目标、缺授权或socket混用拒绝。

## COS-03 — 资源URL信任边界
<!-- he-test-case:COS-03 -->
- 文件：`tests/cmsCosStorage.test.mjs`。合法永久地址和旧路径通过；伪造域名、HTTP、签名参数、路径穿越及片段拒绝。

## COS-04 — 新对象安全上传
<!-- he-test-case:COS-04 -->
- 文件：`tests/cmsCosStorage.test.mjs`。模拟404后上传；核对禁止覆盖头、摘要元数据、WebP类型以及公开校验调用。

## COS-05 — 已有对象不覆盖
<!-- he-test-case:COS-05 -->
- 文件：`tests/cmsCosStorage.test.mjs`。相同对象直接复用；内容不符拒绝，不能写入替换。

## COS-06 — 失败不返回成功或泄露秘密
<!-- he-test-case:COS-06 -->
- 文件：`tests/cmsCosStorage.test.mjs`。模拟带秘密内容的SDK错误；返回脱敏失败，不返回成功。

## COS-07 — 并发创建
<!-- he-test-case:COS-07 -->
- 文件：`tests/cmsCosStorage.test.mjs`。上传冲突后读取并验证胜出的对象，摘要正确才返回。

## COS-08 — 匿名资源完整性
<!-- he-test-case:COS-08 -->
- 文件：`tests/cmsCosStorage.test.mjs`。字节摘要正确通过；错误内容或403失败。

## COS-09 — 引用转换保持业务内容
<!-- he-test-case:COS-09 -->
- 文件：`tests/cmsCosStorage.test.mjs`。递归转换媒体引用，保留标题和编辑元数据；未列入清单的图片拒绝。

## COS-10 — SQL解析与无外键导出
<!-- he-test-case:COS-10 -->
- 文件：`tests/cmsCosStorage.test.mjs`。跨行INSERT、分号和转义引号正确解析；SQL表达式和未闭合字面量拒绝；移除外键且保留索引。

## COS-11 — 上传先于短事务
<!-- he-test-case:COS-11 -->
- 文件：`tests/cmsCosUpload.test.mjs`。COS调用不持有数据库锁；事务写URL元数据和审计，提交后才返回。

## COS-12 — 请求幂等与冲突
<!-- he-test-case:COS-12 -->
- 文件：`tests/cmsCosUpload.test.mjs`。完成请求不重复上传；相同requestId不同指纹返回409。

## COS-13 — 事务内重复核对
<!-- he-test-case:COS-13 -->
- 文件：`tests/cmsCosUpload.test.mjs`。上传期间另一请求先完成，取得锁后复用原结果，不重复写媒体或审计。

## COS-14 — 数据库提交失败
<!-- he-test-case:COS-14 -->
- 文件：`tests/cmsCosUpload.test.mjs`。失败回滚并释放连接，不返回成功，不删除共享COS对象。

## COS-15 — 上游失败阻止持久化
<!-- he-test-case:COS-15 -->
- 文件：`tests/cmsCosUpload.test.mjs`。上传失败或返回错误摘要URL时，禁止开始数据库写入。

## COS-16 — 初始化包完整性
<!-- he-test-case:COS-16 -->
- 文件：`tests/cmsCosSeed.test.mjs`。真实读取208张源图核验摘要；统计106条内容和图集3/2/2/2；离线preview成功，无旧媒体引用。

## COS-17 — 校验清单
<!-- he-test-case:COS-17 -->
- 文件：`tests/cmsCosSeed.test.mjs`。212个包文件逐个验证SHA-256。

## COS-18 — 增量schema及打包
<!-- he-test-case:COS-18 -->
- 文件：`tests/cmsCosSeed.test.mjs`。v16允许NULL BLOB并新增COS列，禁止新增外键和破坏性删除，构建清单包含新schema。

## COS-19 — 执行阶段独立校验账号来源
<!-- he-test-case:COS-19 -->
- 文件：`tests/cmsCosRecovery.test.mjs`。原SQL与备份身份状态一致才通过；密码哈希差异必须被发现，不因当前库等于快照而放行。

## COS-20 — 提交后恢复不重复递增版本
<!-- he-test-case:COS-20 -->
- 文件：`tests/cmsCosRecovery.test.mjs`。区分精确的待执行、已提交和并发冲突，含超过JS安全整数的revision。

## COS-21 — 导出文件原子且可重入
<!-- he-test-case:COS-21 -->
- 文件：`tests/cmsCosRecovery.test.mjs`。相同内容可重复生成，不同内容拒绝覆盖；未留下临时文件。

## COS-22 — 发布文件落盘中断与尾行截断恢复
<!-- he-test-case:COS-22 -->
- 文件：`tests/cmsCosRecovery.test.mjs`。上传完成但包校验清单失败后可恢复、不重复上传已确认资源；不完整末尾进度视为未确认并重新验证，完整坏记录拒绝。

## COS-23 — 上传说明与实际存储一致
<!-- he-test-case:COS-23 -->
- 文件：`tests/cmsCos.test.ts`。核对 CMS 上传说明为 COS 和数据库仅存资源地址，ZH/EN/ID 字典一致且不再声称图片存入 MySQL。三语字典断言不等于三语页面验收。

## COS-24 — 验收退出失败不可误报通过
<!-- he-test-case:COS-24 -->
- 文件：`tests/cmsCosAcceptance.test.mjs`。4 条离线断言覆盖退出200、非200、网络异常和登录前失败；退出失败先保存失败收据再抛错，既有业务失败原因不丢失。不调用真实服务或制造远端故障。

## 实际环境证据（不替代自动化场景）

- 208 个 COS 资源公开下载及摘要核验：私有发布回执 `cos-published.json`。
- 原 9 账号、6 角色、10 条权限状态与原备份一致；schema v16 ready。
- 最终 DDL＋DML 在连接级临时表执行：40 表、9 账号、8 类 CMS、208 媒体，持久表写入 0。
- 用户独立批准的 CMS-only 临时账号真实登录；生成图片经文件输入的真实处理器上传，未 mock 后端或 COS。保存、刷新回读、再次编辑、二次确认删除均完成。
- 中文首页 HSK 图集 3→4 张，翻至新增 COS 图片并完成 1000×600 解码；删除后恢复 3 张。
- 八类 CMS 实际浏览，最终共 106 条内容、9 条图集，与项目种子业务内容一致。
- `scripts/cms-acceptance.mjs` 实际 37 项检查通过：健康、登录、身份、八类读取、权限拒绝、真实上传、永久 URL、幂等、结果查询、冲突/跨域/匿名/非法/超限拒绝、不可信图集 URL、旧版本拒绝、原内容保留、单审计、URL-only 存储及退出。
- 该在线脚本依赖清理前特定临时图集与授权临时账号，只是本次 fixture 阶段的验收工具，不是清理后可直接重跑的通用 smoke。不得对生产执行。
- `cleanup-verified.json`：临时账号及其会话、私有临时密码文件已清理；原身份零差异。开发库 212 条 URL-only 媒体（208 种子＋4 验收），0 BLOB；媒体和审计保留，没有删除 COS 对象。生产 SQL 摘要未变且无测试数据。
- 最终 `final-checks-v5/`：35/35 定向测试、lint、build、diff-check 和在线脚本语法检查通过；全量 1586 项中 1543 通过、8 既有失败、35 跳过，不能标记全量绿灯。
- 最终中文电脑端上传提示已核实。原生 OS 文件选择器、英文/印尼文页面、三语切换、移动端及生产未验证。
