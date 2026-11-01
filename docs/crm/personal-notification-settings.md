# Personal notification settings

Account menu → Notification settings is the shared employee entry in CRM, CMS and system management. The drawer combines Lark connection management and personal notification preferences. Language selection reuses CrmSingleSelect and shared styles. Disconnect uses the shared confirmation dialog with Cancel focused first and an explicit warning that personal CRM Lark notifications, including required reminders, will stop; group messages are unaffected. Fixed header, one scrolling body and one fixed footer; the footer places Cancel and Save on the right. The saved-result check is shown only when the result cannot be confirmed.

## Notification categories

|Category|Types|Personal control|
|---|---|---|
|System reminders|Advisor, booking and enrollment requests; customer agreement reminders; first-contact overdue; AI reply failures where existing routing applies|Read-only; cannot be disabled|
|Optional updates|New customer, customer updates, consultation reopened, assessment completed|Selectable only while available|
|Currently unavailable|Relevant types without an effective enabled Lark rule|Collapsed by default; disabled, with a reason|

Role relevance uses the existing recipient resolver with an own-customer preview; it does not invent a separate role list or broaden access. Employees without business-notification responsibilities do not see those choices. Global delivery faults are generated without a customer and currently go to the operational group; they are not offered as personal choices even for managers. Their group rules are unchanged. Daily summaries also remain group notifications.

A personal type is not a promise of delivery. Existing ownership, customer access, rule filters, source checks, schedules and duplicate prevention still apply. The personal settings cannot grant access or create a notification rule. No task, Tier, deadline, customer assignment or group/in-app behavior is changed.

## Editing prerequisites and enforcement

An employee must be bound to the configured Lark app, ordinary personal delivery must be enabled, and at least one relevant effective Lark rule must exist before preferences can be edited. Language and optional controls are read-only otherwise. Lark binding management remains independently available. An individual inactive type cannot be enabled by an employee.

Required and role-related work alerts cannot be opted out of in either planning or dispatch, including through previously stored opt-outs. No existing row is migrated on read, and no historical event is replayed. Optional choices retain their existing defaults. Preferences belonging to unavailable or hidden optional types are retained rather than cleared as a side effect of display.

The server accepts only the signed-in employee's settings, rejects required opt-outs, and checks binding, personal delivery, role relevance and effective rules within the existing policy-lock save transaction. Unchanged retries are no-ops. Changed values require the current revision. Same-value result recovery, audit rollback, own-user isolation and draft protection are retained. Permissions are not inferred from visible controls.

Language options are Organization default, English, Bahasa Indonesia and Chinese. The personal copy uses the selected language; group cards retain their rule language. Binding confirmation is not listed in the preference UI and still sends once automatically for a new or changed connection. It uses the personal language when explicitly chosen and otherwise the authorization language. The confirmation-card action is Notification settings / Pengaturan notifikasi / 通知设置.

## Storage and saving

Preferences remain in `access_state.notification_preferences`, keyed by employee ID; bindings remain separate. No schema migration is needed. Saving preferences does not immediately bind, unbind, send a message or create a task. Cancel and close protect unsaved changes. Failure feedback distinguishes a rejected save from an unconfirmed result; unconfirmed saves retain input and offer a read-only result check rather than automatic resubmission. Background binding refreshes do not overwrite preference drafts.

UI language uses employee-facing terms such as required, optional and not yet available. Technical user IDs, routing internals and provider acceptance details are not part of the ordinary preference form. The actual connection flow still verifies the authorized identity and maintains the original safeguards.

## Acceptance evidence

Current backup: `.local-backups/notification-settings-policy-20261031/` (private, never for Git). Earlier connection and preference acceptance evidence remains in the dated private backup directories.

- Isolated MySQL: 26 checks, all passed; mock-only providers and synthetic employees. Includes required opt-out rejection, historical opt-outs ignored for required new events, absent/wrong-app binding denial, global delivery disabled, inactive individual type, role hiding, concurrency, idempotency, audit rollback, private language, pending cancellation, owner changes and preserved group routing. Fixture resources are disposed.
- Focused unit/render checks: 25 checks, all passed. Covers required versus optional controls, disabled prerequisites, hidden types, footer order, conditional result action, and Chinese/English/Indonesian fixed labels. These are targeted checks, not a full repository run.
- Local Chinese desktop verification is performed after the build; real employee bindings and preferences are not modified for testing. English/Indonesian browser layouts, mobile layouts, real delivery and a real unbind are not claimed.
- Existing data, accounts, permissions, environment configuration and group channels are retained. The existing process-only ordinary notification worker pause remains in place. No real message, historical replay, GitHub push or deployment occurs.

## Account changes and confirmation behavior

Unbinding CRM does not sign the employee out of Lark. The Change account / Connect Lark flow opens the provider authorization page; choose its visible Use another account action to sign in as another Lark identity. Do not ask for phone/email in CRM or infer a binding from those values. No undocumented force-login parameter is added. A current connection is replaced only after the employee confirms the verified identity, so disconnecting first is unnecessary. The help is collapsed by default, and a returned identity is displayed in a compact confirmation card.

Nested disconnect confirmation uses the shared danger variant and initially focuses Cancel. Escape cancels only that confirmation, not the underlying settings drawer. A cancelled dialog must preserve both the binding and any preference draft.

## Final UI acceptance (2026-10-31, Vancouver)

Chinese desktop at local 3000: required groups are read-only, optional choices and the shared language trigger are disabled while personal delivery is unavailable, inactive customer-update and agreement types are disabled in the collapsed unavailable group, and Cancel / Save stay fixed at the bottom right. The disconnect modal states that personal CRM Lark messages, including required reminders, will stop; Cancel is initially focused. Escape cancels only that modal and returns focus to Disconnect, leaving settings and the real binding intact. Change account and its collapsed Use another account guidance are visible.

The authorized temporary in-memory UI fixture used the real components with synthetic data and intercepted all account actions. It verified shared dropdown opening, keyboard selection, Escape and focus return, retention of a language draft after cancelling disconnect, and disabled choices after a simulated confirmed disconnect. The temporary interface and its tab were closed. No real account change was performed by this automated acceptance.

Separate from automated acceptance, read-only audit inspection observed a manual real disconnect/reconnect during this work (binding revision 3). The new binding confirmation was accepted by Lark. It was not retried or replayed; client receipt was not independently verified. This must not be described as a mock notification or as an additional automated test send.

The project design skill now explicitly requires shared selection controls/styles, shared service-interruption confirmation, the right-aligned Cancel / Save footer, prerequisite/role enforcement and actual interaction checks. Its original front matter and referenced paths were checked. The bundled skill validator could not run because PyYAML is not installed; no package was installed merely for that check.

## Visual variant and standards comparison

The personal drawer uses an explicit `admin-notification-drawer` variant of the shared operation layer, 640px maximum width. Width is a scoped design choice, not a new global standard. The shared fixed header, one scrolling body and fixed right-hand Cancel / Save footer remain unchanged. Desktop scroll-body padding is 24px; field/group/action gaps use the shared form tokens.

Account management and preferences are sibling surfaces, without nested cards for each notification class. Form sections, footer actions and save feedback now use AdminFormSection, AdminFormActions and AdminFormFeedback. Section titles follow the shared 14px/600 definition. Required reminders are listed once under an Always on label rather than repeating that status on every item. Optional choices are aligned in single-column rows. Inactive choices remain disabled in a collapsed group. An unavailable personal service is informational (the shared info pair), not a warning or delivery failure.

The source styles are scoped in personal-notification-settings.css instead of accumulating page overrides in admin-header.css. The account-menu label/status alignment and the shared language selector/disconnect dialog are retained. This visual revision changes no save, role, preference, binding, task, notification or delivery rule.

### Measured Chinese desktop visual acceptance

At a 1280×720 browser viewport, the local 3000 drawer measured 640px wide, scroll-body padding 24px, group gap 16px and section titles 14px/600. Footer stayed at y=647–720 while body scroll changed from 0 to 292px; the last expanded scope explanation remained above the footer. Actions measured 40px high and stayed right-aligned. These measurements validate the scoped variant, not all admin pages.

Light/dark screens were both inspected. Sample contrast ratios (light / dark): required labels 14.29 / 12.35, information banner 7.48 / 7.72, saved binding badge 4.79 / 9.49. This is a sample check of these foreground/background pairs, not a whole-site accessibility claim. The original light theme was restored. Closing the drawer returned focus to the account menu. The ordinary personal-delivery setting remained off, so controls stayed read-only; no live binding or preference change was used to manufacture an editable state.

Nine focused preference/card render checks passed, with TypeScript checking, development build and whitespace checking passing. Existing backend/isolated acceptance is the earlier baseline; no new backend behavior was introduced. English/Indonesian and mobile layouts were not exercised in this visual round.

Final typography check after the visual review: required business labels, optional labels, language control and section headings all measure 14px; section titles retain 600 weight. The final light preview was captured from local 3000 after this correction.

The former Account and work alerts section is removed. AI reply failures share the System reminders group with the existing non-optional business notices. Connection confirmation is absent from the settings list and its explanatory scope text; the automatic confirmation sender remains unchanged.

### 可选动态的开放状态
未开放的可选通知与已开放通知放在同一列表，右侧显示灰色“暂未开放”，不展示可操作开关。规则开放后原位显示开关，不新增分组或改变发送规则。系统提醒保持不可关闭。
