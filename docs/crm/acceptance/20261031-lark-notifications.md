# Lark cards and channel scheduling — local acceptance

Status: release preparation. The authoritative current results and residual gates are in [release readiness](20261031-lark-release-readiness.md). Earlier dated entries below are historical evidence, not current limitations. Local worker remains paused.

## Initial implementation snapshot (historical)

- Newly created native outbox events and contact-form events carry notificationPolicyVersion=2. No historical outbox/jobs are rewritten or replayed. Version is copied into job snapshots; send-time checks use the same version boundary.
- V2 Lark immediate/delay/digest scheduling ignores business days and working hours. Explicit quiet intervals remain separate. Existing SLA, task deadline and in-app scheduling functions are unchanged.
- Daily digest generation permits Lark on nonworking days; its event records whether the in-app channel is eligible. Existing digest IDs remain unchanged, preserving same-day deduplication.
- New customer, advisor-request and assessment cards use shared ZH/EN/ID presentation. The notification-rule preview uses that same function with synthetic data.
- Questionnaire sources use exact questionnaire fact ID plus customer ID and kind. Advisor sources use exact engagement ID plus customer ID and kind. Assessment scores come from the exact stored assessment plus customer ID. Missing references are not replaced with latest profile information.
- Free-form advisor request text is excluded from the card. This is a conservative deviation from the earlier excerpt proposal, not a claim of completed automatic redaction. Complete original evidence stays in CRM.

## Verification

- Five non-database tests pass: old/new version boundaries; channel separation; weekends; delay; exact digest boundary; quiet periods; unchanged task SLA; all nine language/event previews; exact source query; cross-customer source rejection; missing reference; no raw private request text returned by source loader.
- TypeScript no-emit check passes. Local dev package builds successfully.
- Local runtime restarted using the previously authorized process-only worker-disabled launcher. Environment files and channel configuration unchanged. No notifications sent or replayed.

## Still required

- Actual authenticated ZH/EN/ID preview interaction and layout verification.
- Database-backed worker planning/delivery simulation, rate limiting and retry interaction; not claimed by pure-function tests. No independent environment is authorized this round.
- Full source content/labels and advisor excerpt/privacy contract review. The current card intentionally exposes minimal fields; questionnaire learning goals and contact-form details are not yet rendered.
- Actual Lark rendering/receipt not tested or authorized.

## Authenticated browser review

Existing Robert Hui session on local 3000 was used. New-customer preview was switched through Chinese, English and Indonesian; all three rendered the expected localized title, customer label and explicit unknown occurrence time. Preview language drafts were discarded through the unsaved-change confirmation; no policy was saved.

The browser review found stale business-hours controls and text, plus the timing-preview endpoint still using legacy scheduling. Source corrections were applied and passed TypeScript checking; a new package build was requested. These corrections still require post-restart browser confirmation. Advisor and assessment preview matrices remain unverified in the browser. This report does not claim complete acceptance.

## Completed browser acceptance (follow-up)

- Advisor request: Chinese 顾问联系请求 / English Advisor contact requested / Indonesian Permintaan konsultan. Each rendered Maya Putri, a localized unknown occurrence time, and a localized link instruction to view the complete request in CRM. No original free text appeared.
- Assessment: Chinese 测评完成 / English Assessment completed / Indonesian Asesmen selesai. Each rendered the same synthetic score 12 / 20 and localized unknown occurrence time.
- Language changes were preview-only. Both policy drafts were discarded through the existing unsaved-change confirmation. No save/enable controls were used.
- The updated screen no longer offered the business-hours delivery checkbox; it displayed that new Lark events ignore workdays/hours and explicit quiet hours remain separate.
- Browser timing preview, Sunday 2026-11-01: when the event rendered as 14:00 Jakarta, in-app stayed at 14:00 and assessment Lark scheduled at 18:00 that Sunday. When the event rendered as 20:00 Jakarta, in-app stayed at 20:00 and assessment Lark scheduled Monday 2026-11-02 18:00. Advisor request at Sunday 20:00 Jakarta returned the identical Sunday 20:00 for both channels. These previews did not create notification jobs.

## Final disposition

The requested synthetic three-language card previews (including earlier new-customer checks) and the corrected assessment/advisor timing preview paths have passed local desktop browser checks. This is not full notification delivery acceptance.

Historical findings (superseded by the final fixes below):
1. Full database-backed worker planning, source snapshots, retry/rate-limit/deduplication integration remains untested. Pure function tests do not prove queue behavior.
2. Standard card content remains minimal versus the original proposal: owner, learning goal, contact-form details, recorded-time details and safe request excerpt are incomplete. Source codes may still render as internal English identifiers. The questionnaire reference is validated but does not yet render the original answer.
3. The editable legacy summary template remains visible for the three standard cards even though V2 cards use the shared renderer; helper text still says Lark uses the summary template. This is a misleading configuration affordance.
4. The scheduling summary still says global SLA calendar while V2 inherits only timezone for Lark. Custom business-hours controls may still appear for historical settings. Fixed UI Indonesian help text is not fully verified.
5. Daily-digest preview and generation need a combined weekend-channel test; current browser checks covered assessment digest timing, not the daily aggregate event.
6. Lark actual rendering, receipt and signing/retry failure paths have not been exercised or authorized. Notification worker remains paused by the approved process-only override.

No new implementation changes were made during this follow-up browser acceptance. No notifications sent/replayed, no policy saved, no GitHub push or server deployment.

## Final fixes and verification

- Standard cards hide the legacy editable summary template. Other events retain it. Help text explains this boundary. Notification language replaces the misleading date-only language label.
- Delivery settings inherit the operating timezone. Workday/start/end controls no longer appear as V2 Lark restrictions. Configuration values and historical snapshots remain stored unchanged.
- Cards include current owner display name, exact source type localized in ZH/EN/ID, separate recorded time, and learning goals only from the original questionnaire's recognized structured options. Unrecognized/free-form goals are excluded. Contact-form submissions are resolved by exact submission ID and customer. No raw request text is returned by the source loader.
- Consolidated source records are readable only through their stored identityMergedInto relationship. Missing assessment/request evidence cancels the outbound job; no unverified completion is sent. Stopped-contact/identity-review conditions receive an internal-review instruction.
- Actual V2 card construction was intercepted by a fetch test double in the isolated database; no real Lark endpoint was contacted. V2 retry/rate-rejection/unknown-result tests and legacy retry tests passed.
- Final automated results: 6 standalone tests plus 29 native integration tests, all passed, no skips. Native cases include legacy/new queue timing, actual card construction, missing-source cancellation, weekend daily aggregate channel separation and idempotent scans, deduplication, rate limit, Retry-After/1-5-15 backoff, retry exhaustion, unknown result non-replay, and parallel workers.
- Two obsolete legacy fixtures were updated: owner transfer now supplies the required concurrency/reason/request identity and a simulated sales follow-up permission; legacy night-time recheck uses a fixed future test clock with an explicitly due job. No production permission changes.
- TypeScript check, local build and diff whitespace check passed. Final build loaded on 3000 with workerEnabled:false.
- Browser checked the final standard-card layout: no summary template input, operating-timezone labels, and ZH/EN/ID new-customer cards including owner, localized questionnaire source, recorded time and recognized learning goal. Language drafts were discarded without saving. Prior advisor/assessment three-language and Sunday timing checks remain applicable through the shared renderer/scheduler; no claim of new Lark receipt.
- Final read-only local check: HTTP 200; 500 accepted and 6 cancelled notification jobs, unchanged from recovery baseline; no remaining lark_v2 temporary schemas. The temporary test HTTP server/pools were closed by teardown. Existing shared isolated MySQL service was left as found.

## Remaining deliberate boundary

Actual Lark provider rendering/receipt and resuming the local notification worker require explicit authorization and were not performed. A redacted free-text request excerpt is not implemented: the supported policy is to keep original request text in CRM and send structured context plus a customer link. No unsafe regex-based privacy claim is made. No GitHub push or server deployment occurred.

## Authorized live template acceptance — 2026-10-31

User explicitly authorized new TEST messages and retained the scheduled assessment cadence. This run uses synthetic template-acceptance messages with existing sample-customer detail links; it does not create/replay historical business events or claim a new questionnaire/request/assessment was submitted. The production worker and live acceptance now share standardLarkCard, so localized content, plain-text rendering and customer button construction are identical. The acceptance-only footer labels all fields synthetic.

| Kind | Languages | Result |
|---|---|---|
| New customer | ZH / EN / ID | 3 accepted (HTTP 200, code 0); all 3 observed in the CRM Bot Lark desktop conversation |
| Advisor request | ZH / EN / ID | 3 accepted (HTTP 200, code 0); all 3 observed in CRM Bot; English/Indonesian visual card layout reviewed |
| Assessment | ZH / EN / ID | 3 prepared, not yet sent; due 2026-11-01 18:00 Asia/Jakarta (2026-11-01 03:00 America/Vancouver; 11:00 UTC) |

Live cards retained TEST titles, localized source/owner/recording-time labels and localized customer buttons. Original free text and contact details were not sent. The live run uses a private manifest with unique TEST IDs, safe payload hashes and per-message terminal receipts. Unknown or interrupted sends are never retried automatically.

Customer button checks: actual Lark buttons opened the expected localhost customer addresses for Dewi/Maya. Chrome's login had expired, so it displayed the login page at the correct address. The same exact addresses in the already-authenticated local in-app browser opened Dewi Lestari and Maya Putri details. Arif Hidayat's prepared assessment destination was also verified in that authenticated session. This is desktop-local acceptance; localhost links are not usable on a separate phone/computer and were not tested there.

A one-time local thread automation (ID: test) was created only after the user explicitly approved it. It is scheduled for the assessment due time and restricted to the 3 existing pending manifest entries, with no ordinary worker invocation. If the computer is asleep/offline, actual timing may be delayed and must be reported. It must not reschedule accepted, rejected, sending or unknown entries. Assessment receipt/visual acceptance remains pending until that future run.

No business data/configuration/permission changes or notification replay. Ordinary 3000 worker remains paused. These template tests bypass business-event creation deliberately, so their receipts live in the private acceptance manifest, not the ordinary notification_jobs table. They establish real channel/template delivery, not a new end-to-end business registration test. No GitHub push/deployment.

## Follow-up: omit unknown occurrence fields

User confirmed receipt of the live TEST messages and requested omission of unknown occurrence. Shared renderer now omits blank/unknown occurrence fields; known occurrence and recording time remain separate. Eight focused tests, TypeScript and local build passed. Loaded on local 3000 with the notification worker still paused; no additional live messages were sent. Already delivered messages were not edited/replayed. The three pending assessment TEST messages use this shared renderer when due, so their unknown occurrence line will also be omitted. Richer type-specific content beyond existing score/structured goals requires a separate content design, especially source-faithful customer excerpts and group privacy boundaries.

## Substantive content follow-up

User authorized richer notification bodies and no additional sends. Shared presentation now puts customer needs/excerpts/results before metadata; exact empty/unknown placeholders disappear, including unassigned owner, unsupported source and unknown questionnaire choices. New-customer context uses recognized original questionnaire goals, self-reported level, mode and city. Website inquiries may provide a protected original excerpt.

Advisor excerpts are retrieved from the exact linked user message and conversation within the customer's identity group, never assistant content or cached request text. Sales-record evidence is labeled separately. Quotes remain in their original language and are capped at 160 Unicode code points with a visible ellipsis. A conservative whole-input privacy gate excludes text containing detected contact details, links, long digit sequences, credential/identity/account/address/medical risk markers before truncation; no replacement or paraphrase is fabricated. This is a conservative filter, not a claim of exhaustive semantic DLP. Restricted full originals remain in CRM.

Assessment cards read only stored attempt mode, score/maxScore, reached threshold flags, screening placement and per-section counts. They do not infer levels from total score, translate an unstructured saved summary, recompute grading or claim official HSK certification. Zero-size sections and unknown values are omitted. Positive skipped/unanswered counts and stored screening-review guidance remain visible.

11 targeted tests passed, including empty/unknown filtering, original-language quotes, privacy beyond the truncation boundary, exact message-role/source/customer scoping, stored assessment results and no arbitrary summary rendering. TypeScript passed. Preview fixtures show known needs, an Indonesian request excerpt and structured assessment results in all three locales. No live TEST messages were added, no historical messages were edited/replayed. Existing scheduled assessment acceptance remains unchanged.

Color discussion is a proposal only: blue new customer, orange advisor request, cyan assessment; headers only. Red remains failure/overdue/restriction, purple remains AI, completion is not a green pass signal. No color implementation or extra live color tests were authorized/performed.

Substantive-content browser acceptance completed on 3000: all 9 event/language combinations were inspected. New customer showed goal, self-reported beginner level, online preference and Jakarta before metadata. Advisor request retained the same Indonesian original under localized excerpt labels in all locales. Assessment showed synthetic 72/100, full mode, stored provisional HSK 1 threshold, listening 20/25, reading 16/25 and 2 skipped. Unknown occurrence did not appear. Preview language drafts were discarded without saving. No messages sent this round, no pending TEST entries added or modified. The previously scheduled 3 assessment template TEST entries remain synthetic fixtures and do not acquire real assessment provenance from this renderer update. Color codes remain a proposed design, not implemented.

## Live substantive-body test

User explicitly requested another send test after the substantive-content update. Two new Chinese synthetic TEST template messages were prepared and sent through the existing designated CRM Bot channel: one new-customer card and one advisor-request card. Both returned HTTP 200/code 0; both were observed in the Lark desktop CRM Bot conversation.

The new-customer card displayed learning goal, self-reported beginner level, online preference and Jakarta before metadata. The advisor-request card displayed the synthetic Chinese original asking about beginner Chinese and Saturday class arrangements. Neither card displayed unknown occurrence time or blank fields. Both retained the customer button, true source-type label and explicit synthetic-TEST footer. No old message was resent. Existing 3 scheduled assessment TEST entries and their due times were not altered. The private receipt manifest is under .local-backups/lark-live-content-20261031/ and is excluded from Git.

## All-type live template inventory and acceptance

User requested testing every Lark message type. Read-only inventory found 15 configured event rules:

| Category | Types | Live acceptance |
|---|---|---|
| Enabled Lark (9) | lead.created, handoff.requested, assessment.completed, booking.requested, enrollment.requested, conversation.reactivated, task.overdue, ai.failed, notification.failed | New-customer/advisor tests already received; 6 additional types below received; assessment remains scheduled |
| In-app only (2) | commitment.due, conversation.updated | No Lark delivery attempted; existing channel settings preserved |
| Disabled (1) | daily.digest | Not enabled or sent |
| Retired (3) | task.created, task.rescheduled, task.appointment_due | Not executed or sent |

Six NEW Chinese TEST template messages were generated for booking.requested, enrollment.requested, conversation.reactivated, task.overdue, ai.failed and notification.failed using the exact active rule template, actual worker timingEventLabel formatting and larkCard transport renderer. All 6 returned HTTP 200/provider code 0 and were observed in the CRM Bot desktop conversation. Each footer explicitly identifies a synthetic scenario, not a real booking/enrollment/overdue task/system fault. No customer state, task, business event, rule or channel was modified. No prior event was replayed. Test receipts are in the private .local-backups/lark-all-types-20261031/manifest.json. Per-hour checks include previous manual acceptance manifests plus ordinary accepted jobs. Actual business-event triggers, role routing and failure generation were not exercised by these template tests.

Findings (content acceptance NOT passed for these six legacy types):
- Booking/enrollment/reactivation still display internal English event identifiers and lack the triggering customer request/message; request is not confirmed booking/enrollment.
- Legacy text repeats Unassigned and blank trailing separators, contrary to the new empty-field principle.
- AI failure is incorrectly grouped under the Sales prefix; both AI and notification failures show Anonymous/Unassigned rather than a useful operation/failure summary and relevant diagnostics link.
- First-contact overdue provides the deadline but no useful ownership/context beyond the generic template; any future enrichment must preserve the original deadline and sales autonomy.
- These six headers remain generic UPER TEST and buttons remain generic CRM; their titles/actions/content have not received the three-standard-card redesign. No color-code changes were made.

At this checkpoint, 8 of the 9 enabled Lark types have a real TEST receipt (including earlier new-customer/advisor tests); assessment is not yet sent and remains due at the previously agreed time. Thus all types have been inventoried, but full real receipt acceptance is pending the scheduled assessment, and the six legacy types need a separately approved content repair. Disabled/in-app-only/retired types were intentionally not force-enabled.

## 每日汇总支持与真实 TEST（2026-10-31 18:22Z）

- 已在修改前备份本次文件至私有 `.local-backups/lark-daily-20261031/`。
- 核对 `dailyStageCounts`：统计配置时区所对应日期内新建的客户，按汇总时的销售阶段分组，同时保留规则的来源、Tier和阶段筛选。不是全部客户概况，不是当天销售阶段迁移量，也不推算转化率。
- 新版每日 Lark 卡片复用同一渲染器用于实际工作进程及模板验收：日期／运营时区、新增数量、非零阶段分布、口径说明、客户列表入口。无客户为已知的0；未知旧阶段不做歧义映射，汇入“阶段未明确”；无效计数显示核对提示，不冒充0。旧已排队事件保留旧版本。
- 中文模拟汇总 TEST `TEST-LARK-42295007-86af-4522-a4e9-55a3741cbcf9`：HTTP200、Lark code0，已在原CRM Bot群的桌面Lark中读取到完整卡片。模拟数量为12（8／3／1），不代表真实业务统计。客户列表按钮没有误带客户ID。
- 规则发送前后SHA256一致，`daily.digest`仍停用；没有开启历史团队范围待复核的策略，没有创建业务事件、任务或通知队列记录，没有重放。
- 本地3000中文页面已核对新每日摘要预览，使用模拟日期2030-01-06；未保存任何策略。三语渲染、零数量、旧阶段和异常数据定向测试与原三类卡片测试共13项通过、0跳过；类型检查及本地构建通过。
- 本轮仅实发每日汇总中文模板，英文／印尼文实发未做；每日自动排期与实际数据库聚合到发送的完整链路尚未通过启用策略验收（策略保持停用），不能把模板实收当作全链路通过。既有周末渠道隔离测试与去重测试证据保留在上文。
- 其余6类已实收的旧模板仍有事件代码、Anonymous／Unassigned及内容不足问题，内容质量未通过；不因接口接受而标为全部完成。测评三语3条TEST保持原既定排期，未提前发送。

## 剩余六类卡片收口与隔离验收（2026-10-31，本轮继续）

### 本轮交付

- 修改前文件备份：私有 `.local-backups/lark-remaining-20261031/`；保留既有并行源码，不推送、不部署。
- 新增 `notificationContentVersion:3`：6类新增正文只作用于新事件；原已排队事件的正文版本不重写，通知策略／渠道配置不改。
- 预约／报名申请显示准确的待确认状态和触发原文摘录，沿用整段隐私筛查；校验原始证据客户归属和申请类型；不把申请当作预约、报名或付款成立。
- “客户重新咨询”实际上在重新打开会话时产生，本轮将卡片描述为“客户重新打开咨询”，并记录对应会话ID；不更改触发规则、不伪造新消息。
- 首次联系逾期显示既有要求的原期限；内部核实限制不变；没有新增或修改3000任务。
- AI失败事件补充准确会话和失败回复ID。通知失败按确切原作业显示受影响类型、渠道、尝试次数；区分失败与结果未知，未知状态要求先核对。两类均不向群内暴露原始错误、接口、凭证或部分AI答案。
- 9种标准事件卡片和每日汇总复用实际渲染函数；模拟值集中于独立样例工厂，不能作为实际客户字段的默认值。配置页隐藏这些标准Lark卡片无效的自定义正文编辑；每日站内模板仍保留。
- 操作入口按实际情况指向客户、客户对话或通知设置；未新增业务颜色。卡片颜色分型仍属于待确认设计项，不假称已落地。

### 已验证

1. ZH／EN／ID卡片、空字段、隐私、准确源查询及未知结果等16项定向测试通过、0跳过。
2. 用户本轮明确允许的临时独立MySQL验收：33项通过、0跳过，包括实际工作进程构建6类卡片（发送被拦截并模拟回执）、每日数据聚合→范围过滤→排期→发送→重复扫描去重、周末只生成Lark、旧通知保留旧排期、跨客户依据拒绝、原测评结果读取、限流、重试和结果未知不重放。临时库和临时用户在退出时清理，不复制3000客户或员工。
3. 全量默认回归：1403项，1382通过、0失败、21跳过；类型检查、本地构建及diff检查通过。首轮遇到本机测试监听权限限制和查询清单未同步；已同步清单并在允许监听的测试执行中重跑通过，不将首轮失败隐藏为已通过。
4. 本地3000中文电脑端逐项切换6类事件及三种通知语言，18组合预览检查；未点击保存或发送。预览检查发现运营故障样例错带“客户对话”来源，已修正并重跑测试及构建。退出前将事件和语言恢复原值，无未保存修改。
5. 页面验收前后12类表的计数及哈希相同：客户、员工、角色、配置、通知策略／渠道、任务、测评、事实、互动、AI提取和通知队列。普通通知进程仍按此前许可仅在运行进程中暂停，配置文件未改；本轮未追加实发。

### 21项默认跳过测试的影响

默认全量命令未设置独立库，因此显示21个数据库验收入口跳过。其中 `Lark V2 integration`、`notification MySQL cancellation` 已在上述获准的隔离命令中单独运行通过，不能再列为本轮通知的未验收项。其余19项属于历史备份恢复、Campaign预算／删除／保存／默认数据、推广存储／复核、AI来源复核／供应商故障切换、工作区HTTP、747／657隔离场景、互动时间线、操作范围并发、联系工作流、策略恢复／分主题保存、身份回滚、问卷提交回执。本轮没有更改这些模块的事务或规则，未扩大重测；这不等于这些场景已通过，也不构成本轮卡片与每日排期验收的缺口。

### 必须如实保留的未完成项

- 新版6类卡片本轮仅页面／模拟发送验收；此前6条旧模板实收不能算新版卡片实收。实际Lark客户端对新版卡片的显示与按钮行为仍需新TEST验收。
- 三语测评原有3条TEST仍为pending，均排在 `2026-11-01T11:00:00Z`（雅加达18:00／温哥华03:00）。未到时间，不提前发、不增加副本；本轮只读核对清单，尚未取得这3条实收结果。
- 每日规则仍停用，历史范围待复核未移除；隔离验收已覆盖全链路，但3000每日自动推送未启用。真实群此前仅收到中文模拟每日模板，EN／ID未实发。
- 每日统计暂保持“当日新增客户及汇总时阶段”；新增全量经营指标、颜色分型、恢复普通工作进程、启用每日策略、GitHub及测试站发布均未自行执行。

## 新版卡片群内实收验收（2026-10-31继续）

本轮使用原CRM Bot群，6种现有已启用规则的新模拟TEST，不创建实际预约、报名、任务或故障。所有卡片均明确TEST，使用实际工作进程同一 `standardLarkCard` 渲染器；来源字段与业务请求本轮均为模拟，不把链接客户的旧记录当作新请求。

| 类型 | 新TEST标识 | 实收结果 |
| --- | --- | --- |
| 预约申请 | TEST-LARK-8669057e-d1fd-49a7-b1c4-40cfd67a5abc | HTTP200/code0；群内已读到原文摘录及“尚未确认具体安排” |
| 报名申请 | TEST-LARK-0509d0c8-baa5-4183-a12c-ac9816c8a552 | HTTP200/code0；群内已读到原文摘录及“不代表报名或付款已确认” |
| 首次联系逾期 | TEST-LARK-c9b9b6af-544b-4d10-abaa-695e6df7451a | HTTP200/code0；群内期限与正文一致 |
| AI咨询失败 | TEST-LARK-2595486a-da8b-4476-be39-64dc4ddf826a | HTTP200/code0；群内可读到处理提示，无原始错误 |
| 通知异常 | TEST-LARK-c4a4a621-8ccc-495b-9ed9-2f89b96e018f | HTTP200/code0；群内可读到受影响类型、渠道及次数，无凭证或端点 |
| 客户重新打开咨询 | TEST-LARK-dbbc5137-c933-4b78-a715-0f6dc8b32542 | 暂待限流窗口，最早2026-10-31T19:02:52.764Z；未提前发 |

5条实收均通过桌面Lark读取对应确切ID和正文；没有未知发生时间、空负责人、Anonymous／Unassigned或原始事件代码。中文实收只代表当前策略选择的中文；英文／印尼文仍是上轮页面及自动化验收，不冒充三语群内实收。

按钮验证：预约卡片实际点击后Chrome进入Maya Putri的跟进页；报名和逾期卡片也已分别实际点击，均进入同一客户的跟进页。AI卡片实际点击后进入Maya的对话页；运营卡片进入销售运营设置。运营链接目前落到默认日历主题，不直接定位发送记录；作为剩余导航精度问题记录，不能称为“精确定位发送日志”通过。localhost链接仅在本机电脑验证，不声称其他设备可访问。

本轮发送和页面访问前后12类受保护表计数／哈希完全相同，未修改数据、账号、权限、配置或通知作业。私有验收清单保留每次尝试状态、回执、无签名卡片快照及哈希；结果未知不自动重试。已有测评3条原TEST仍未到雅加达11月1日18:00排期，未提前发送。

## 群额度调整为100（用户明确授权，2026-10-31）

- 修改前私有备份 `.local-backups/lark-limit100-20261031/channel-before.json`。
- 通过3000中文电脑端“通知渠道→CRM Bot→每小时发送上限”保存100，刷新后仍显示“每小时上限100 · 群内所有策略共用”。后端读回 `{maxPerHour:100,source:channel}`；相比备份，仅 `maxPerHour` 字段变化。
- 原有效20来自旧策略兼容取最严格值，不是Lark平台限制。显式渠道100优先于旧规则／作业快照的20；不需要重写历史记录。其他新建渠道默认值未全局改写，本次只调整现有CRM Bot渠道。
- 前后12类受保护表仅 `notification_channels` 按授权发生变化；客户、账号、角色、设置、通知规则、任务、测评、事实、互动、AI结果及通知队列哈希一致。既有channel.save审计由原保存机制记录。
- 没有修改产品源代码或额度判定算法；去重、并发保护、Lark HTTP429／业务限流回退、Retry-After、重试次数和unknown不自动重试保持原实现。已有16项卡片／排期定向测试通过，无追加实发、无历史重放、无推送部署。
- 这不是取消CRM保护：超过100仍会顺延；本轮没有发送100条消息做压力测试。原已批准的一次性TEST及测评排期不因额度修改而重建或补发。

## 到期时间与剩余时长（2026-10-31）

- 修改前备份本轮文件至私有 `.local-backups/lark-deadline-20261031/`。
- Lark标准卡片与通用到期通知保留准确期限，并增加“期限状态（发送时）”：还剩／已逾期／已到期，使用CRM现有时长格式。客户约定只有日期时不补午夜、不计算小时分钟；未知／无效时刻不伪造倒计时。
- 原始期限与发送参考时间分开传入，实际卡片由发送处理时钟覆盖预览时间；每次延后发送／重试重新计算，不能用入队时的倒计时。显示自然时长，不变更工作日历、原期限或发送策略。消息发出后时长固定，不冒充实时更新。
- 18项定向测试通过：未到期、逾期、精确零点、不足1分钟、UTC偏移、MySQL UTC值、仅日期／空值／无效时间，以及三语与重试后时长变化。全量默认回归1405项：1384通过、0失败、21跳过（原数据库入口，未新启隔离环境）；类型检查、本地构建和diff检查通过。
- 本轮不新增通知、不启用只在站内的客户约定Lark渠道，不重放历史；群额度100保留，数据／权限／配置及期限保持不变。不推送、不部署。

## 最后一条新版TEST一次性验收完成（2026-10-31 12:07，温哥华）

- 按本条独立授权仅发送 TEST-LARK-dbbc5137-c933-4b78-a715-0f6dc8b32542，conversation.reactivated。其余5项已accepted，未重发。HTTP200、Lark code0；6类清单现全部accepted，无pending、unknown或sending。
- 原CRM Bot群内已读到确切TEST ID、标题“客户重新打开咨询”及正文“客户重新打开咨询会话，尚不代表已发送新消息”。无空负责人或未知发生时间。模拟记录时间仍是准备时刻01:42，实际发送12:07温哥华（02:07雅加达）；未将准备时间误称实际发送时间。
- 实际点击该卡片“查看客户”，Chrome打开Maya Putri（lead=7a1a710b-bc36-4fab-aacb-884c92ab470e）的跟进页，非其他客户。
- protected.ts after仅notification_channels相对本批最初备份变化；这是用户后续明确授权的群额度20→100，check.ts读回source=channel且差异字段仅maxPerHour。其余11类保护表（数据、账号、权限、通知队列等）计数哈希一致。未修改配置、恢复worker、推送或部署；未碰另一个三语测评排期。
- 本条一次性自动化完成后删除，避免再次触发；三语测评仍由原独立安排处理。本条只证明中文消息实收，不冒充三语测评实收或最新期限时长通知实发。

## Lark按钮精准定位审查（2026-10-31，用户追加检查）

实际点击已确认客户、AI对话和运营入口能打开，但这仅是页面层验收；下列定位层尚不合格。另逐类通过当前实际卡片构造函数检查9类标准事件与每日汇总的URL，未发送新消息、未修改产品代码。

| 类型 | 当前链接能力 | 建议目标 |
| --- | --- | --- |
| 新客户 | 仅lead，通常落到跟进页 | 客户资料／对应登记问卷依据，明确按钮语义 |
| 顾问／预约／报名请求 | 仅lead，没有requestEvidenceId/messageId | 同一客户的准确请求依据；自动展开对应原文并高亮 |
| 测评完成 | 仅lead，未指定assessment页签或attemptId | 测评页签＋对应单次测评记录；自动展开、滚动及高亮 |
| 重新打开咨询 | 仅lead，无conversationId | 对话页签＋对应会话，不能伪造新客户消息定位 |
| 首次联系逾期 | 仅lead，无taskId | 跟进页＋对应首次联系要求／期限区 |
| AI回复失败 | leadView=chat，但无conversationId/messageId | 对应会话＋确切失败回复，提供必要上下文 |
| 通知发送异常 | tab=policy，实际落到默认日历主题 | 发送记录主题＋原失败／未知通知jobId，而非告警自身jobId |
| 每日汇总 | 无筛选上下文，普通CRM入口 | 对应统计日期／运营时区／规则范围的新增客户列表；下钻不扩大权限 |

根因是卡片构造接口大多只有leadId，缺少事件定位上下文；前端当前的历史依据、对话定位等能力主要存在内存状态，没有统一的外部URL定位入口。不能只改按钮文字、添加无消费逻辑的query/hash，或凭“最新记录”替代精确源。

建议先修复测评误落跟进、申请／失败消息无定位、通知异常落日历，再统一新客户／首次要求／每日汇总。采用统一的来源定位协议，只携带必要的不透明记录ID，不把原文、手机号或凭证放入URL。目标记录加载后再展开、滚动和聚焦；刷新及登录恢复同一目标；无权／已删除／关联不匹配明确提示，不能默默定位别的记录。验收必须在同客户多次测评、多会话、多条申请／失败作业的样本下实际点击，不能只检查URL参数。历史已发送消息缺少的定位信息不会因新模板更新自动补齐；本轮不修改旧消息、不重放。

## 精准链接修复验收（本地3000）

- 已备份：`.local-backups/lark-targets-20261031/`。本地构建 `4c207d8c967b-56ec09480b3424c6`，普通通知进程继续按已授权状态暂停，不改配置。
- 中文电脑端实际验证：Arif单次测评自动展开、滚动、聚焦，刷新保持同一记录；Dewi顾问请求定位确切客户原文并高亮；Maya首次联系要求显示原期限与当前完成状态并聚焦；Maya登记问卷定位并展开对应历史依据；通知异常入口打开发送记录主题并聚焦指定作业。跨客户测评引用返回不可用。
- 获本轮授权的临时隔离验收：仅模拟数据与账号，外发全部拦截。销售本人／其他销售／CMS真实角色、未登录、非法类型、缺失记录、跨客户记录、同客户旧测评、已合并客户来源、请求编号到原消息关联及原文删除后的拒绝均通过。验收结束删除独立库与临时数据库用户。
- 定向17项测试全过；类型检查、构建及diff空白检查通过。最终默认回归1410项：1388通过、0失败、22跳过；其中新增隔离套件默认跳过，但已通过本轮显式隔离运行。其余21项跳过不是本轮新增定位功能的通过证据。首次受限执行的6项本机监听EPERM，获隔离授权后重跑已全部通过。
- 保护检查：客户、账号、角色权限、配置、通知规则／渠道、任务、测评、事实、请求、提取结果及通知队列计数哈希无差异。
- 未验证：Lark客户端内新卡片的实际点击（本轮不追加发送）；退出后登录恢复；AI失败消息、客户约定历史、网站咨询来源及每日汇总的实际页面定位；多次测评的页面自动展开仅单记录实测，多记录精确选择已由隔离API验收。三语固定文案保留，页面本轮仅中文电脑端。
- 标题区颜色仍统一blue，未完成按消息类型的color code；本次没有声称已实现。旧消息缺少源编号时不猜测、不重放。
- 未推送GitHub、未部署服务器，未新增业务任务、未改变Tier。

## 后续：标题颜色执行完成（本地3000）

本节取代上节“标题区颜色未完成”的当前状态说明。备份位于`.local-backups/lark-header-20261031/`，本地构建`4c207d8c967b-cffa4d02383d5659`。

- 实际标准卡片、每日汇总与通用发送分支均使用共享事件配色；中文页面预览使用相同映射及现有浅深色语义变量，保留文字类型。蓝色=普通信息，橙色=请求／约定提醒，青色=测评结果，红色=逾期／异常，灰色=每日汇总。
- 中文电脑端实际打开五类预览，确认类型、标题和颜色分别对应；确认蓝色深色主题配对并恢复原主题，关闭编辑未保存。其余颜色深色页面未逐项验收。
- 18项定向测试通过；覆盖全部9种标准事件的中英印尼卡片生成、每日汇总三语、通用约定提醒及未知事件回退；类型检查、构建、diff检查通过。三语页面本轮未切换，仅卡片生成测试覆盖三语。
- 数据、账号、权限、配置、任务、测评、事实、请求、提取与通知队列计数哈希全部不变。没有发送或重放通知，没有修改排期、启停渠道、恢复普通worker、推送或部署。
- Lark客户端实际标题由平台原生模板渲染，本轮未实发验证；管理页预览仅表示颜色类别，非客户端像素复刻。旧消息保留原颜色，不补发。精准链接上一节列出的未验证场景仍保留，不因标题色通过而视为完成。

## 新标题与精准链接受控实发验收

2026-10-31温哥华12:30，在用户“请继续”受控实发授权范围内，仅向原CRM Bot群发送2条全新TEST，不执行或重试历史作业。私有清单与回执：`.local-backups/lark-header-live-20261031/manifest.json`。

|类型|唯一TEST ID|接口／客户端／实际点击|
|---|---|---|
|新客户（蓝）|TEST-LARK-COLOR-0834d17b-57c9-4de5-982b-2bf27581090a|code0接受；Lark桌面实收且蓝色标题可见；点击“查看登记依据”在Chrome打开Maya，自动展开并聚焦问卷4965c224-fe17-4414-8a37-da1495d68979|
|顾问请求（橙）|TEST-LARK-COLOR-dfb0301c-3086-480a-a75f-9d6e17b1f85d|code0接受；Lark桌面实收且橙色标题可见；点击“查看请求原文”打开Dewi，对应消息aafdd768-0e5a-49a2-8141-a3fe974dd024聚焦／高亮且在可视范围|

本轮消息明确说明仅引用既有模拟样本，不代表再次发生真实业务。新客户用最小字段验证颜色与按钮，不能代替真实流程完整字段内容的重新验收。

剩余边界：红色实发未做（没有现有失败／未知作业，未制造业务故障）；灰色实发未做（每日规则保持停用，未绕过启用条件）；青色测评仍按已授权既定排期，不提前发送或另建自动化。先前已排期的测评TEST是否携带本次精准来源编号仍需到期时核对，不能据旧脚本推定精准链接通过。退出再登录恢复及其他未验证路径仍保留，不为本轮测试登出既有会话。

保护表计数哈希：全部一致。普通worker继续暂停，配置与每日规则启停不变，不新增任务、不改变Tier、不重放通知，未推送GitHub或部署。本轮没有新增自动化或未来发送承诺。

## 最终颜色语义与请求全景定位（本地3000）

本节取代前述请求橙色／逾期红色的配色口径，保留历史验收证据。备份`.local-backups/lark-final-semantics-20261031/`；构建`4c207d8c967b-551b0b0df257a20f`。

- 当前统一：逾期／发送结果待核实=橙色；AI明确失败／通知明确失败=红色；新客户／重新咨询／普通请求与临近提醒=蓝色；测评=青色；每日汇总=灰色。通知结果未知的标题明确为“通知发送结果待核实”，中英印尼同步，不误报明确失败。
- 请求按钮统一“查看请求依据”，解析同客户的确切原始消息，然后打开全景内的`message:<原消息ID>`事件box；销售记录来源请求仍定位对应销售记录。原文及关联整理／采用／补充不复制。缺失／无权来源仍返回不可用，不猜最新消息。测评、失败回复、发送异常和约定仍使用各自已实现的精确业务落点。
- 中文电脑端：Dewi两个不同request分别定位到aafdd768-0e5a-49a2-8141-a3fe974dd024和a595707e-3a2d-4b24-846f-2044972a2547，自动展开、聚焦、可视；第二条保留已有补充信息；第一条刷新后恢复。逾期橙色、AI失败红色、普通请求蓝色预览实测通过。
- 20项定向测试通过，含三语卡片生成、未知／失败区分、请求原始事件关联、路由及期限展示；类型检查、构建、diff检查通过。未启动新隔离环境；本次未重跑隔离数据库套件，既有隔离结果不冒充新结果。三语页面及新版Lark客户端实发未验证。
- 无新增发送，无重放；普通worker保持暂停；保护表计数哈希全部一致，无数据／权限／配置／队列变更。未推送或部署。此前实发的橙色请求卡片保留原颜色，不重发；其请求定位URL由当前3000解析为全景事件。
