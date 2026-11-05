# COS 与 main 集成兼容测试

基线：功能分支 `4253655`，main `32a6149`。只改兼容衔接，不改变 main 推广业务；COS 使用 `cos_url`。本清单描述可执行断言，结果以实际命令回执为准。

## 离线迁移矩阵

文件 `tests/cmsPromotionMigration.test.mjs`，执行真实 `migrate` 函数，数据库为严格查询替身，不创建数据库或启动服务。

| 场景 | 断言 |
| --- | --- |
| COS-MERGE-01 | main已完成17/18而缺16：补COS，保留媒体/活动/索引/短码，重复运行不重复ALTER，仍执行main回填校验 |
| COS-MERGE-02 | 已有16：继续17/18，保持媒体与后续重复运行短码不变 |
| COS-MERGE-03 | 空库：执行完整1–18与42表集合，重复运行不重放DDL |
| COS-MERGE-04 | 16标记ready但COS列缺失：即使18ready也停止，不伪修复 |
| COS-MERGE-05 | 16 applying：阻断，不通过推广迁移伪造完成 |
| COS-MERGE-06 | main推广归属或短码异常仍拒绝 |
| COS-MERGE-16 | ready但BLOB类型、可空性或存储索引缺失/列顺序不符时拒绝 |

## 初始化数据与历史包

文件 `tests/cmsBootstrapContract.test.mjs`。

| 场景 | 断言 |
| --- | --- |
| COS-MERGE-07 | 共用预设构造与main原逻辑一致，返回值互不污染 |
| COS-MERGE-08 | 初始化只使用原账号输入、项目CMS及main系统预设；208媒体URL-only，预设索引完整，随机短码表为空 |
| COS-MERGE-09 | 缺16、applying、未知版本和同数量错误表集合均拒绝 |
| COS-MERGE-10 | 推广索引缺失/错归属、缺预设、混入运行记录或图片BLOB均拒绝 |
| COS-MERGE-11 | v18初始化行实际SQL序列化/解析往返；越界SQL拒绝；不连接数据库 |
| COS-MERGE-12 | 历史40表v16包只在显式legacy模式下接受，不伪标v18 |
| COS-MERGE-13 | 导出journal绑定版本，读取实际迁移记录，不按最高版本推造ready |

## 媒体读取

文件 `tests/cmsMediaCompatibility.test.mjs`，执行真实注册路由与响应替身，不监听端口。

| 场景 | 断言 |
| --- | --- |
| COS-MERGE-14 | 旧摘要URL和legacy_name仍输出原BLOB，有COS元数据也不覆盖BLOB |
| COS-MERGE-15 | 新URL-only仅重定向到可信永久COS URL，非法/缺失/带签名URL拒绝 |

## 既有验收与边界

- `tests/promotionMigration.mysql.test.ts` 保留main全部业务断言，只将重复插入16改成验证真实COS16夹具；默认跳过。本次不设置 `MYSQL_NATIVE_TEST_ENV`，不运行其中DROP/写库测试。
- 重跑既有COS上传、幂等、失败恢复、种子摘要及表单提示测试；推广归因、短链、页面组件、词典和完整回归按真实运行结果报告。
- 本次不重启3000、不执行真实MySQL迁移或新版SQL临时表验证、不触发通知。mock迁移和SQL解析不等于MySQL语法/持久数据升级实测；旧验收报告不能作为本次合并版本实库通过证据。
- 英文/印尼文实际页面、语言切换、移动端与生产未验证。三语固定内容保持main与当前分支已有能力。
