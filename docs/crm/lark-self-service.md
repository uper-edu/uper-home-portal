# Personal Lark connection

Status: implemented locally. Local OAuth configuration activation was explicitly approved and completed on 2026-10-31. The employee completed real Lark consent, the corrected callback and explicit confirmation; same-identity save and no-duplicate behavior are verified. A new-binding formal confirmation receipt remains unverified. No real binding or real message has been changed/sent by this task.

## Employee flow

Account menu / Personal Lark notifications is available to authenticated active employees without access-management permissions. It reads only the current employee's status; unconnected users are told that personal notifications cannot yet be delivered. Contact details and Lark identifiers are not shown in the menu.

Connect opens Lark's documented browser authorization. The server stores a five-minute hashed state tied to the exact CRM employee and session, app ID, pinned tenant key, binding revision and validated same-origin return location. Callback tokens/codes are never persisted. The callback verifies identity and tenant and stages a candidate; it does not bind or send. Employee confirmation commits the binding, audit entry and one confirmation record atomically. Same identity or repeated callback/confirmation does not create another message. Concurrent administrator changes and identities bound elsewhere are rejected. Self-disconnect checks the binding revision and only changes the signed-in employee; future personal jobs cancel under existing delivery checks. Group channels remain unchanged.

The confirmation is a green app-bot card, with localized title/body and a same-origin Manage notification settings button. It does not contain phone/email, customer information or technical IDs. Provider acceptance is displayed separately from binding success; response loss remains unknown and is never blindly resent. Pending confirmations can be processed by the existing notification worker; sending/unknown/failed/accepted records are not automatically resent. The existing process-only worker pause is retained locally.

## Required approval before activation

The implementation reads existing LARK_APP_ID and LARK_APP_SECRET plus:

- LARK_OAUTH_REDIRECT_URI: exact callback URL. Local candidate: http://localhost:3000/api/crm/lark/callback. The same URL must be registered in the Lark app's redirect/security configuration. HTTP is accepted only for local loopback; deployed environments require HTTPS.
- LARK_TENANT_KEY: independently verified identifier of PT UPER EDUCATION TECHNOLOGY. Do not use its tenant domain or guess this value. Reading it via the official tenant information API requires tenant:tenant:readonly; current app does not have that scope. Adding permissions/publishing requires user approval. An administrator may instead supply the verified key from another trusted source.
- LARK_BINDING_CONFIRMATIONS_ENABLED=true: explicit permission to send one formal confirmation to each new/changed employee-authorized connection. This does not enable the ordinary personal notification queue or replay old messages. Ordinary personal delivery remains controlled separately by LARK_PERSONAL_DELIVERY_ENABLED.

Before approval, no real environment file was modified. After explicit approval, only .env.dev received the three activation values above; its original contents are backed up privately. Missing configuration leaves Connect disabled with an explanation. Existing users can still manage/disconnect their own binding, with confirmation. No developer should click those actions for a real user during verification.

## Validation

Approved isolated MySQL tests intercept every Lark endpoint and use synthetic employees only. Covered login/origin/configuration checks, return-URL restrictions, cross-employee/session/tenant denial, state expiration/replay, stage-before-confirm semantics, duplicate identity, unchanged-binding no duplicate notice, unbind concurrency, ambiguous-send no retry, token/code non-persistence and audit-failure rollback before sending. Temporary schemas and actors are cleaned up by the fixture. Actual browser authorization completion and formal confirmation receipt remain unverified until the employee completes the flow.

### Local acceptance evidence (2026-10-31)

- 23 isolated integration checks passed (8 self-service, 5 administrator save/binding, 10 queue/group integration); zero failed or skipped. All provider calls were intercepted. No real customer or employee was copied.
- 17 focused access, employee-card and Lark client checks passed; zero failed or skipped. The three-language guide assertion was updated to include the new authorization instructions.
- TypeScript checking, the development build and diff whitespace checking passed. These are targeted checks; the full repository suite was not run for this task.
- Chinese desktop at local 3000: existing employee account menu shows saved bound status, without phone/email/open ID. Personal settings opens correctly; missing setup is explained and authorization is disabled. Escape closes the modal and restores focus to the account menu. No real authorization, disconnection or message was triggered.
- Not verified live: Lark redirect configuration, actual browser OAuth consent, trusted-tenant matching against the real provider, and receipt of the formal confirmation. Unbound-user browser rendering, English/Indonesian browser layouts and mobile layouts are not claimed as passed. Isolated tests cover unbound API access and localized guide content.
- Following explicit activation approval, the local callback was registered in CRM-Rot. tenant:tenant:readonly was added as an immediately effective no-approval scope. The official tenant query returned the expected company, PT UPER EDUCATION TECHNOLOGY. Only the three local .env.dev values listed above changed; ordinary delivery flags and all other environment values stayed unchanged.
- Local 3000 was restarted with the existing process-only ordinary-worker pause. The real OAuth consent page displays CRM-Rot, the expected enterprise and Robert Hui, requesting only the user identifier. Consent is handed to the employee. Existing Robert identity is already bound; same-identity confirmation will not send another message. Do not unbind an employee simply to manufacture a delivery test.
- Existing group channels and persisted business configuration remain unchanged; no GitHub push or deployment occurred.

Official reference: https://open.larksuite.com/document/ukTMukTMukTM/uETOwYjLxkDM24SM5AjN

### Strict-cookie live return correction

The first employee attempt reached the Lark consent page but returned `Login required`: the existing CRM session cookie uses SameSite=Strict and is intentionally excluded on the provider's cross-site callback. This is an application handoff defect, not proof that the employee failed to authorize. The callback now commits a minimal same-origin continuation document (no-store, no-referrer, nonce CSP) before re-entering the callback. Cookie settings remain Strict; the original employee/session, tenant, state expiry and one-use checks still apply. A single resume marker prevents loops if the session is truly absent. No authentication is inferred from state alone.

The new isolated check covers missing-cookie bridge, no token exchange or send before session restoration, rejection when the resumed request remains unauthenticated, and success when the original session returns. All 23 isolated integration checks passed; with the existing 17 focused checks this is 40 distinct targeted checks. The corrected live callback and explicit confirmation passed on employee retry. New-binding confirmation receipt remains unverified.

### Final real authorization verification

At 2026-10-31 16:34 Vancouver time, after the employee confirmed completion, read-only verification found the own OAuth flow in `saved` state, its authorized identity matching the existing employee binding, its saved revision matching binding revision 1, and the configured application matching. No confirmation record was created (count 0), as expected for an unchanged binding. The browser returned to `/system`, and the employee card reports connected. Evidence contains only state, matching booleans, counts and a binding hash in the private backup directory.

Real consent, Strict-cookie callback recovery, explicit save and unchanged-identity deduplication are accepted. Real self-unbind and a new/changed binding confirmation receipt have not been exercised against the real employee; isolated checks cover those flows. No existing binding was removed merely for testing, and no actual notification was sent by this self-service acceptance.

## Unified notification entry

The account entry and confirmation-card action now use Notification settings / Pengaturan notifikasi / 通知设置. It combines connection management and personal type/language preferences. See [Personal notification settings](personal-notification-settings.md) for effective-rule display, delivery boundaries and current acceptance. Earlier dated validation above describes the self-service implementation baseline.
