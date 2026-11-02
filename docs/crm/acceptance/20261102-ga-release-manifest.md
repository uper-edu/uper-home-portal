# GA三环境与在线文档第五章发布清单

基线：3169b748992498bab6383d3c84ddffd75144ab73。用户已明确授权纳入此前GA流程埋点、推送canonical main并发布测试站。生产环境不发布。

本批包含三环境GA目标与主机防错、问卷／测评／咨询／CRM保存回执埋点、匿名顾问请求回执、登录切换必填说明修复，以及在线文档第五章。39项源文件及文档由明确清单提取。

排除其他并行改动。instagramBioCampaign.ts仅提取LinkHub所需URL及语言处理函数，未带入未使用的Campaign预置记录生成器、初始化／自动种子或其他Campaign业务变更。原工作区并行修改保留。环境凭证、日志、客户数据和备份不入Git。

## 验证

- 完整回归：1488项，1459通过、0失败、29个需要显式独立MySQL夹具的组跳过。未在本次发布阶段另建数据库或重跑业务写入链。
- TypeScript和git diff --check通过；本shell无npm命令，执行package.json对应的Node入口。发布前须完成干净提交的dev／test构建。
- Bio URL提取函数的默认／明确来源及三个语言变体正反核对通过。
- 测试站可恢复备份：/opt/project/home/private-backups/ga-release-20261102，包含数据库、持久化数据、运行配置和旧发布位置。通知进程已暂停，发布前通知队列为空。
- 发布后另记录实际版本、保护指纹和UPER Staging实收。旧本地验收报告保留原时间边界，不充当本次远端验收。

## 文件清单

- `server/analyticsEnvironment.mjs`
- `server/portal/runtime.ts`
- `src/data/analyticsEnvironments.json`
- `src/utils/analytics.ts`
- `src/utils/analyticsPolicy.ts`
- `src/utils/analyticsEnvironment.ts`
- `src/utils/analyticsReceipts.ts`
- `vite.config.ts`
- `src/components/GFormOnboardingModal.tsx`
- `src/components/HSKPlacementAssessment.tsx`
- `src/services/portalChat.ts`
- `src/pages/StandAloneChat.tsx`
- `src/pages/CrmWorkbench.tsx`
- `src/components/crm/CrmOwnerEditor.tsx`
- `src/components/crm/CrmProfileFields.tsx`
- `src/components/crm/CrmSimpleWorkflow.tsx`
- `src/components/crm/CrmTrustPanel.tsx`
- `src/pages/LinkHub.tsx`
- `src/components/AdminForm.tsx`
- `src/components/CrmAccess.tsx`
- `tests/adminForm.test.ts`
- `src/components/crm/CrmUserGuide.tsx`
- `src/components/crm/CrmAnalyticsGuide.tsx`
- `src/components/crm/analyticsGuide.json`
- `tests/crmAnalyticsGuide.test.ts`
- `tests/analyticsEnvironment.test.ts`
- `tests/analyticsPolicy.test.ts`
- `tests/analyticsService.test.ts`
- `tests/registrationAdvisorAnalytics.test.ts`
- `tests/registrationAdvisor.mysql.test.ts`
- `docs/analytics/ga4-environments.md`
- `docs/analytics/ga4-event-contract.md`
- `docs/crm/acceptance/20261102-ga-environments.md`
- `docs/crm/acceptance/20261102-ga-p1-closeout.md`
- `docs/crm/acceptance/20261102-ga-online-document.md`
- `.env.dev.example`
- `.env.test.example`
- `.env.prod.example`
- `src/utils/instagramBioCampaign.ts`

## 同批文档补充

用户在发布过程中要求补充事件上报说明。第五章5.6区分自动采集、增强型衡量和业务埋点，明确自定义事件无需GA预创建、维度／指标与关键事件仍需配置，以及去重和保存回执要求。交付状态同步为测试站已发布、生产未部署；原始本地验收证据保留。
