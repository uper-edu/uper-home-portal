# 默认27项跳过测试覆盖说明

原27项来自上一轮默认全量报告。跳过表示未提供隔离数据库，不表示通过。以下明确区分本轮实跑、已有报告证据及未重跑；不得将不同轮次计数相加。

|序号|场景／文件|覆盖及发布影响|
|---|---|---|
|1|历史备份恢复 · `accessLegacyRestore.test.ts`|本轮未重跑；备份恢复路径未改，非约定提醒阻断；若发布清单包含恢复逻辑改动则必须补验。|
|2|历史补分 · `assignmentBackfill.mysql.test.ts`|已有20261031-assignment-backfill报告：13项隔离通过；本轮未重跑，不等同最终版本重验。|
|3|自动分案 · `autoAssignment.mysql.test.ts`|已有20261031-auto-assignment报告：7项隔离通过；本轮未重跑，不实际分配3000客户。|
|4|活动预算API · `campaignBudget.test.ts`|未重跑；不属于约定提醒，若发布涉及活动预算则补验。|
|5|活动删除保护 · `campaignDeleteProtection.test.ts`|未重跑；活动删除逻辑不属本轮，涉及相关代码发布时补验。|
|6|推广链接 · `campaignPromotion.test.ts`|未重跑；推广流程范围外。|
|7|活动保存 · `campaignSave.test.ts`|未重跑；活动保存范围外。|
|8|获客来源复核 · `campaignSourceReviews.test.ts`|未重跑；来源复核范围外。|
|9|活动工作区HTTP · `campaignWorkspace.test.ts`|未重跑；活动工作区范围外。|
|10|AI故障切换持久化 · `chatFailover.test.mjs`|本轮未重跑；不以普通单元测试替代持久化验收，聊天代码若纳入最终发布需补验或核对已有证据。|
|11|747约定恢复 · `crmAgreementRestore747.mysql.test.ts`|本轮隔离重跑通过：未来排期、历史不重放、并发及回滚。|
|12|活动空库 · `crmCampaignEmpty.test.ts`|未重跑；活动初始化范围外。|
|13|互动时间线 · `crmInteractionTimeline.mysql.test.ts`|本轮未重跑；应按最终发布改动核对历史证据，不能标通过。|
|14|保存操作隔离 · `crmOperationScope.test.ts`|本轮未重跑；操作结果隔离范围外，若发布涉及该机制需补验。|
|15|准备联系工作流 · `crmOutreachPortal.test.ts`|本轮未重跑；准备联系范围外。|
|16|策略恢复默认 · `crmPolicyResetPortal.test.ts`|本轮未重跑；未修改恢复机制。|
|17|主题独立保存 · `crmPolicyTopics.mysql.test.ts`|本轮未重跑；未修改主题保存事务，相关单元测试在全量中执行。|
|18|身份事务与回滚 · `crmTrustP0.test.ts`|本轮未重跑；身份流程若纳入整批发布，应另补验或核对已有证据。|
|19|站内收件箱隔离 · `inappInbox.mysql.test.ts`|已有20261031-inapp-inbox报告：6项隔离通过；本轮未重跑。|
|20|管理员Lark绑定 · `larkBinding.mysql.test.ts`|本轮未重跑；绑定机制与约定提醒不同，不以通知测试代替绑定验收。|
|21|自助Lark绑定 · `larkSelfService.mysql.test.ts`|本轮未重跑；授权绑定需独立证据，不进行真实绑定。|
|22|Lark V2流程 · `larkV2Integration.test.ts`|上一轮隔离18项组合中已覆盖；本轮连续测试覆盖当前约定发送，不替代所有V2事件。|
|23|通知MySQL取消 · `notificationPolicy.test.ts`|本轮隔离notification MySQL套件通过，覆盖渠道、重试上限、取消及去重。|
|24|精准通知目标 · `notificationTargets.mysql.test.ts`|既有20261031-inapp-inbox及lark-release-readiness报告覆盖权限／定位；本轮未重跑。|
|25|访客身份隔离 · `portalVisitorIsolation.test.ts`|本轮未重跑；不属于约定提醒，涉及聊天身份改动发布时补验。|
|26|推广复核事务 · `promotionReviews.test.ts`|未重跑；营销复核范围外。|
|27|登记结果查询 · `registrationSave.mysql.test.ts`|本轮未重跑；登记保存范围外，涉及相关源代码发布时补验。|

迁移后的crmTrustNotifications现在显式声明隔离前置条件，因此默认全量新增第28个跳过项（原测试无隔离环境时静默不注册）。该新增项本轮已在隔离环境实际运行通过，不是新增未验收业务。

整批发布仍需冻结清单：范围外的并行代码不能仅因与约定提醒无关就默认放行。上述“涉及则补验”项目要么排除其改动及依赖，要么取得相应验证证据。
