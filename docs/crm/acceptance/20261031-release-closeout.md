# 发布前收口结果

状态：当前约定提醒连续验收缺口已关闭；整批发布仍需冻结最终文件范围并按覆盖说明处理范围外改动。未推送、未部署。

备份：私有 `.local-backups/release-closeout-20261031/source.tar.gz`，135份源文件及文档。候选文件见同目录 release-manifest 文档；清单不是最终提交授权。

## 最终常规回归

1461项：1434通过，0失败，27跳过。已修正自动分案新增后运营主题数量的过期断言（12→13并明确检查assignment），重新生成SQL清单和文档词典。类型检查和dev构建执行；构建日志保留。未改变业务规则。

## 隔离补验

第一组18项通过，0跳过，覆盖约定恢复、未来排期及重复tick不重放、旧pending取消而accepted不变、并发与事务回滚，以及Lark V2流程。
第二组48项：47通过，1失败，0跳过，覆盖通知渠道、限流回执、重试上限、取消和排期等。失败为crmTrustNotifications旧用例调用已退役taskCommand创建接口，返回410；不是当前约定发送失败，但不能标作通过。

以上为上一轮结果，失败项已由下述最终补验替代，不再作为未修复故障。

隔离仅使用新模拟库／员工／客户，外发拦截或模拟，夹具退出清理；未复制现有数据和账号。3000保护表前后计数及哈希无差异（diffs=[]），未实际分配客户、发送或重放通知。

## 默认跳过项原文

以下为默认套件的跳过记录，不能改写为通过；部分已由上述定向隔离套件覆盖，尚需发布前逐项关联证据。

- ﹣ legacy backup restore requires explicitly authorized isolated MySQL (1.000958ms) # MYSQL_NATIVE_TEST_ENV not supplied; no database verification performed
- ﹣ backfill requires approved isolated database (0.585333ms) # SKIP
- ﹣ automatic assignment requires approved isolation (0.586542ms) # SKIP
- ﹣ campaign budget API acceptance requires independent MySQL (0.044417ms) # Set MYSQL_NATIVE_TEST_ENV
- ﹣ campaign deletion protection requires isolated MySQL (0.280667ms) # Set MYSQL_NATIVE_TEST_ENV
- ﹣ promotion MySQL acceptance requires independent socket (0.044916ms) # Set MYSQL_NATIVE_TEST_ENV
- ﹣ campaign save MySQL acceptance requires explicit native socket (0.094625ms) # Set MYSQL_NATIVE_TEST_ENV
- ﹣ MySQL source review scenarios require independent native fixture (0.195625ms) # SKIP
- ﹣ workspace HTTP acceptance requires explicit independent MySQL (0.042417ms) # Set MYSQL_NATIVE_TEST_ENV
- ﹣ persisted provider failover needs explicit isolated MySQL fixture (0.561958ms) # SKIP
- ﹣ 747 native acceptance requires isolated MySQL (0.826708ms) # Independent synthetic database required
- ﹣ native campaign storage remains empty without seeding legacy examples (0.683583ms) # SKIP
- ﹣ interaction timeline native acceptance (0.302417ms) # Independent native MySQL required
- ﹣ operation scope native concurrency and revoked access require explicit independent MySQL (0.038625ms) # MYSQL_NATIVE_TEST_ENV not configured; no implicit acceptance
- ﹣ outreach transactions require isolated MySQL (0.303958ms) # Set MYSQL_NATIVE_TEST_ENV
- ﹣ policy restore requires isolated MySQL (0.8055ms) # Set MYSQL_NATIVE_TEST_ENV
- ﹣ topic saves require isolated MySQL (0.62225ms) # Set MYSQL_NATIVE_TEST_ENV
- ﹣ P0 native identity and rollback require explicit independent MySQL (0.043042ms) # MYSQL_NATIVE_TEST_ENV not configured; destructive trigger scenario not run on3000
- ﹣ inbox isolation requires approved temporary database (0.32525ms) # SKIP
- ﹣ Lark binding requires approved isolation (0.388834ms) # SKIP
- ﹣ Lark self service requires approved isolation (0.615333ms) # SKIP
- ﹣ Lark V2 integration requires approved isolated database (0.634917ms) # SKIP
- ﹣ notification MySQL cancellation requires explicitly authorized isolated MySQL (0.126042ms) # MYSQL_NATIVE_TEST_ENV not supplied; no database verification performed
- ﹣ notification targets require approved isolated database (0.340625ms) # SKIP
- ﹣ 657 live MySQL isolation requires independent native test database (0.376958ms) # SKIP
- ﹣ promotion review transactions require independent native MySQL fixture (0.133417ms) # SKIP
- ﹣ registration receipt transactions require explicit isolated MySQL (0.626958ms) # No live database fallback

## 最终补验（本轮）

- 先备份旧测试至私有 `.local-backups/agreement-closeout-20261031/`。仅修改测试与验收文档，未修改业务实现。
- crmTrustNotifications已迁移至saveSimpleSalesWorkflow当前约定写入／取消流程，不再调用退役taskCommand。
- 同一约定：保存原文与确切时间→到期前无任务／无外发→到期产生单一任务→模拟11232限流→持久化重试排期→退避前不重试→同任务重试成功→重复tick不发送→取消后不回放已接受历史。
- 同客户其他约定：到期前取消不创建发送任务；已进入退避的约定取消后任务转cancelled，模拟调用次数不增加。所有记录仅隔离库模拟数据，没有新增followup_tasks。
- 连续链、747恢复及通知MySQL套件合计32项通过，0失败、0跳过；隔离库与临时用户在清理钩子删除，fetch恢复。模拟webhook所有请求被进程内拦截，没有真实消息。
- 最终默认全量1461项：1433通过、0失败、28跳过。原27项逐项说明见 `20261031-skipped-test-coverage.md`；新增第28项是当前链显式声明隔离前置条件，过去该旧文件无隔离环境时静默不注册。本轮该项已隔离通过，不能写成新增未验收功能。
- 类型检查与diff检查通过。产品源码未改，沿用前轮已通过的相同产品构建；未重启3000。保护表前后计数哈希diffs=[]。

本轮约定提醒验收阻断已消除；不等于所有并行功能均完成最终版本隔离回归。发布清单中涉及聊天身份、绑定、活动或其他范围的改动，仍须依逐项覆盖说明排除或补证，不能盲目提交工作区。
