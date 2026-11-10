# Lark standard notifications

The nine active Lark event types and the daily digest now have standard localized cards. The rule's selected language determines Chinese, English or Indonesian output. The synthetic policy preview shares the same presentation function as delivery. New booking/enrollment requests, reopened consultations, first-contact overdue, AI failures and notification failures opt in via notificationContentVersion=3. Already queued versions preserve their original snapshots and templates; in-app delivery is unchanged.

## Fields and privacy

Customer name and current owner come from the authorized customer and active employee directory. Questionnaire goals must be recognized original questionnaire options from the event's exact questionnaire fact, never a current AI profile summary. Website inquiries resolve the event's exact submission. Advisor requests resolve the exact task_request evidence, and assessment scores resolve the exact attempt and customer. Consolidated source access follows only the stored identity relationship. Missing mandatory request/assessment evidence cancels sending.

Occurrence and recording time are distinct. Unknown occurrence stays unknown. Recording time never substitutes for occurrence. Source types are localized; AI is not a source category. Full transcripts, detected contact/identity/account/address details and arbitrary free-form goals are excluded. A short original-language excerpt may appear only after the conservative whole-input privacy gate. Full evidence remains in CRM. Contact/identity holds show internal-review guidance.

## Scheduling

New outbox events carry notificationPolicyVersion=2; job snapshots retain it. V2 Lark scheduling ignores workdays and work start/end times. Explicit quiet windows, delay, scheduled send time, deduplication, group rate limit and retry controls remain effective. Assessment events retain the rule's individual scheduled-send cadence; the usual configured time is 18:00 Jakarta. They are not a merged daily assessment digest.

In-app notifications retain their existing behavior. Daily aggregate events can produce Lark on nonworking days while excluding in-app generation on those days. Existing per-rule/date event IDs prevent repeated scans from duplicating the aggregate. No migration rewrites historical jobs, changes task deadlines, creates tasks, changes Tier or replays notifications.

## Operations

Deleting a policy removes it from the active list and stops it from being used for future events. Queued notifications retain their original schedule and snapshot. Delivery and change history remain available. A deleted default policy is not recreated on restart.

Policies can select Lark group notifications and Lark personal notifications independently. Personal notifications use the enterprise app and the policy's per-owner limit, without a group channel or Webhook. Live app delivery requires the personal channel to be in live mode, the app credentials and a matching, authorized owner binding. The same channel mode applies to account binding confirmations. Simulated confirmations do not contact Lark. Personal preferences continue to apply. Customer assignment supports the eligible new owner's private message. Daily summaries and notification delivery failures support group delivery. The editor displays the equivalent options for existing combined Lark rules. Untouched legacy rules and already queued snapshots retain their original recipient and group restrictions. The personal channel can further restrict those private deliveries to simulation. Saving the split options makes future events follow the explicit selection.

Local 3000 and company test use `PORTAL_WORKER_ENABLED=false` during maintenance. The pause applies again when the service restarts with that setting. Re-enable workers or send real acceptance messages only with explicit authorization. Simulated acceptance does not establish actual group receipt or Lark-client visual rendering.

On first upgrade, keep the two retired variables in the running environment until the migration has recorded the modes. Existing live groups stay live only if legacy configuration allowed live sending. The personal channel inherits live mode only if both legacy settings permitted business delivery. Missing settings migrate to simulation. If binding confirmations used to bypass a business delivery restriction, the new shared personal channel also applies simulation to those confirmations. Check the saved modes before removing the variables. The process switch remains in force. Local CRM and company test read the built-in group destination from `LARK_GROUP_CRM` in the private server environment. The test button follows its saved channel mode.

## Content update

Empty and unknown fields are hidden, including unknown occurrence time and unassigned owner. Substance precedes metadata: original questionnaire needs for registration; exact triggering customer-message excerpt (sales text labeled separately) for advisor requests; stored assessment outcomes and section counts for assessments. Short excerpts retain their original language; the whole source is checked for recognized privacy risks before truncation. Protected excerpts are omitted entirely, not replaced by an AI paraphrase. This filter is conservative and does not guarantee detection of every sensitive fact. Full original text remains in CRM. Assessment display does not change the scoring rules or infer an official level from total score.

### 每日汇总正文

新版 `daily.digest` Lark 正文使用每日新增客户卡片，页面预览和发送共用渲染器。统计源为 `dailyStageCounts`：指定运营日期新建的客户、按汇总时当前销售阶段分组，保留既有规则筛选；不表示全量客户分布或阶段推进次数。只展示非零阶段；已知零新增显示0，异常数据提示核对，旧阶段不推断映射。站内模板仍独立保留，Lark使用标准卡片。系统预置的每日汇总默认启用，使用「Lark 群通知」和站内消息。曾因旧团队范围待复核而停用的预置策略会恢复启用，保留已有渠道、筛选和排期。管理员后来主动停用时，重启不会重新开启。

## Other six active event types

| Event | Business content and exact source |
| --- | --- |
| booking.requested | Pending booking request; exact task_request evidence and corresponding customer message, never a confirmed appointment. |
| enrollment.requested | Pending enrollment request; exact task_request evidence and customer message, never confirmation of enrollment or payment. |
| conversation.reactivated | Reopening the consultation session, not proof of a new customer message. The new event includes its conversation ID; no arbitrary latest message is attached. |
| task.overdue | Existing consultation first-contact requirement and its original response deadline. No new task, deadline or Tier action. Contact/identity restrictions retain internal-review guidance. |
| ai.failed | Existing failed AI reply and its conversation association. No raw error, partial generated answer, endpoint or credential is transmitted. |
| notification.failed | Exact failed/unknown job: affected notification type, channel and attempts. Unknown delivery explicitly requires checking before retry; no raw errors or replay. |

New request cards verify customer ownership and action type. Missing mandatory request evidence cancels delivery. Operational cards use notification settings/logs or the customer's conversation as the button destination. Policy previews use a separate synthetic sample factory, never a fallback for real customer data. Shared cards use the event header categories documented below.

### Remaining activation and acceptance boundaries

The daily rule reports daily new customers, rather than all-customer health or conversions. Simulation verifies aggregation-to-delivery without establishing real group receipt. See the dated acceptance records for assessment test deliveries.

## Deadline context in Lark notifications

A concrete task/request/commitment deadline is accompanied by a localized remaining/overdue duration, explicitly marked as the status at send time. The exact deadline remains visible. Standard cards and the generic scheduled-notice path use the same countdown helper as CRM. The worker computes against each delivery attempt's processing clock; the card builder overrides any stale preview reference with its send clock. Retries and deferred delivery therefore do not preserve an outdated remaining-time string. The duration is natural elapsed time, not working hours. Date-only commitments keep their date and never acquire an invented midnight or hourly countdown. This is message presentation only: no change to due dates, schedules, business states, channel enablement, deduplication or retries. Existing Lark messages are immutable and are not resent to refresh their countdown.

## Exact button destinations (local implementation, 2026-10-31)

New cards carry only opaque source IDs in their links. The CRM authorizes the customer before resolving any source. Assessment cards open the exact attempt; customer requests open the original interaction box in the customer panorama (sales-record requests open their source history); reactivation opens the specific conversation; AI failure opens the exact failed message. First-contact and agreement notices open their respective existing records. Delivery alarms open the original delivery job in notification settings. New-customer cards use the linked questionnaire fact or website submission when available, otherwise explicitly open the profile. A missing target produces an unavailable/no-access message, never a latest-record fallback.

Daily links retain the saved operating date, timezone and rule filters, intersected with current customer visibility. New digest snapshots persist that scope. Older snapshots use their original saved rule/calendar when sufficient; incomplete scope is rejected. Header templates now use the shared event color mapping documented below. Existing sent cards are not updated or replayed.

## Header colors

One shared mapping controls both outgoing card headers and synthetic policy previews: blue for new customers/reactivation, ordinary requests and agreement/appointment reminders, orange for overdue contact requirements or unconfirmed delivery, turquoise for completed assessments, red for definite AI/delivery failures, and grey for daily summaries. The existing textual event and failure/unknown distinction remains visible. These categories do not imply payment, successful enrollment, assessment quality or new task urgency. Preview colors use existing admin semantic pairs; actual Lark colors are platform-rendered templates. No old card is resent to apply color.

## New-configuration defaults (2026-10-31)

New notification policies default to English (`en`). New Lark channels and the no-configuration hourly fallback default to100 messages per group per hour. Frontend forms and backend use `larkNotificationDefaults`. Explicit saved language/channel limits remain unchanged, including zero and nondefault limits. Historical rule/job limits still use the existing strictest-legacy fallback when no explicit channel limit is saved; changing a default does not rewrite historical snapshots or existing settings. New policies still require an explicit Lark channel selection and save; nothing is enabled automatically.

## Customer agreement reminders

`commitment.due` defaults to in-app, Lark group and Lark personal delivery. The policy uses the existing system group and sends the personal copy to an eligible, bound customer owner. It is an always-on system reminder, not an optional update. New defaults do not silently overwrite existing rules; local activation is explicit, versioned and audited. Existing custom filters, language and limits remain unchanged.

The blue card shows the customer, privacy-screened agreement text, exact agreed time (or original date only), deadline status at send time when an instant exists, and owner. Empty values stay hidden. “View agreement” opens the specific agreement in Follow-up. Paused contact or unresolved identity retains the internal-review warning. No new task, automatic contact or Tier change is created.

New events use the shared localized card. Cancelled/changed-away agreements are not delivered. Activation does not replay processed events or create Lark reminders for agreement instants before activation; date-only agreements compare dates in the agreement timezone without inventing a time. The notification worker remains paused during local acceptance; no real sends are part of this verification.
