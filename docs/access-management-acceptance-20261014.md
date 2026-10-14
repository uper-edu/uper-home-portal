# Users & Access — local acceptance, 2026-10-14

## Delivery and boundary

Implemented a separate **System management → Users & access** workspace at `/system`, using the shared admin header, account menu, language controls and theme. Preview: `http://127.0.0.1:4418/system`.

This delivery remains in an independent MySQL database and independently built static directory. Local 3000 has not been restarted, migrated or switched. No GitHub push or public deployment was performed. No real customer dataset was imported into test fixtures. No live AI or Lark call was required or sent by this acceptance run.

## Capabilities

- Users: create accounts; preserve existing immutable IDs and login IDs; edit display names, roles and team memberships; enable/disable; inspect retained ownership and unfinished-task counts. New passwords use the existing password hash implementation. Old passwords are never returned.
- Roles: stable IDs, three translated names/descriptions, finite permission catalog, per-action own/team/all scopes where applicable, enable/disable, affected-staff preview before saving.
- Access preview: choose/search one employee and inspect effective permissions, each action's scope, and contributing roles. User editing also shows the proposed capability changes before saving.
- Sessions and credentials: separately authorized session revocation and password reset. Session-only operators can open user controls but cannot edit role assignments or profile fields without user-management authority.
- Audit: operator, reason, before/after role or user change, and affected IDs; password and session-token values are excluded. System audit requires separate authorization and is excluded from CRM notification audit.
- Documentation: EN/ID/ZH system guide plus a scoped entry in the CRM guide. Customer names, IDs, original conversations and staff notes are not translated.

## Authorization contract

MySQL migration 6 adds `access_roles`, `access_state` and `crm_users.access_revision`. The first initialization preserves existing user rows, hashes, role memberships and teams; it grants `access_admin` only to existing active Robert. This bootstrap is recorded once. Restart does not restore revoked roles or regrant Robert's CMS role.

Five built-in role definitions provide defaults: CRM Manager, Sales, CMS Operator, recruitment reader, Access Administrator. Recruitment reading remains a separate existing backend capability; this delivery does not add a recruitment management interface. Twenty finite permissions separate viewing, profile editing, follow-up, attendance, assignment, claiming, export, notification management, CMS and access administration.

Access Administrator is an access-management responsibility, not automatic business-data access. Robert retains his existing CRM/CMS roles independently. Role unions are computed per permission: an all-customer viewing role cannot silently widen an own-customer editing or export grant. Server requests, including direct API calls, enforce authorization.

`crm.own` retains the encoded value `own`. It is an owner-eligibility marker, **not permission to view, edit or export another customer's record**. Eligible owners also require follow-up capability. Claiming requires an eligible unassigned customer within the actor's claim scope and readable/processable ownership after assignment. Assignment to another person checks that person's active eligibility and applicable read/follow-up scope. Default Sales retain own-customer actions and same-team self-claiming; they cannot transfer a customer to another salesperson.

Customer notification routing uses effective capabilities and scopes. An owner unable to process the customer is invalid for owner routing. Fallback managers require the appropriate CRM viewing, assignment scope and manager-notification capability. Historical memberships and delivery records are not rewritten or replayed.

Role and user writes use a serialized policy lock, fresh actor authorization, a reason, and revision conflict checks. Partial delegated operators cannot manage or grant privileges beyond their authority. At least one active account must retain all access-administration capabilities. Authorization changes revoke affected sessions. Deactivation preserves customer ownership, task deadlines and historical attribution; reassignment is an explicit business operation.

## Acceptance evidence

| Check | Result |
|---|---|
| Complete root regression suite | **289 passed; 0 failed; 0 skipped** |
| Type check | `npm run lint` / `tsc --noEmit` passed |
| Production build | Vite passed into independent `frontend-dist`; live static resources not replaced |
| Native MySQL query catalog | 218 statements; catalog check passed |
| CRM dictionary consistency | 455 fields, 28 documented business tables; check passed |
| Diff whitespace | `git diff --check` passed |
| Existing accounts | Fixture IDs/password hashes preserved; only Robert bootstrapped as Access Administrator |
| Permissions | Sales, Manager, CMS Operator, system-only admin, scoped custom role and delegated operator tested; spoofed identities/direct API access denied |
| Action-scope isolation | Read/export/edit scopes, self-claim, owner qualification, manager fallback and CMS inquiry-receipt data isolation tested |
| Invalid configuration | Unknown permissions, invalid scope/dependencies, last-admin removal, duplicate login and stale revisions rejected |
| Lifecycle | Disabled accounts cannot authenticate; role/session changes invalidate access; reset values excluded from audit; revoked CMS role not restored on restart |
| Transaction/failure behavior | Conflicting writes preserve saved state; browser-injected precommit 503 retained the draft, loaded saved revision, then explicitly reconciled and successfully retried |
| Browser interface | All five tabs × three languages × three widths (390/768/1280) × two themes: **90 verified combinations, zero whole-page horizontal overflow** |
| Final preview refinement | Further **18 combinations**, zero overflow; employee search and keyboard selection verified |
| Keyboard/editor | Focus placement, dropdown Escape handling and editor close verified; pending changes protected by confirmation |

Browser evidence used simulated roles/accounts in the independent database. The browser role create/update and assignment exercises changed disposable fixture data only. Password reset was verified by isolated API tests rather than entering a new credential through browser automation.

Private evidence is under `.local-backups/access-management-20261014/` and is intentionally excluded from source synchronization: test/build/type logs, layout matrices, database fingerprints, source hashes, fixture environment and screenshot. Screenshot: `access-preview.png`.

## Preservation checks

Read-only before/after fingerprints of **all 28 local-3000 MySQL tables matched**, including row counts and canonical row SHA-256 values. Local 3000 has no `access_*` tables: the new schema has not been applied there.

The following five protected files match their pre-implementation SHA-256 values: `src/types/crmLead.ts`, `src/types/leadSystem.ts`, `server/portal/salesWorkflow.ts`, `server/portal/assessments.ts`, `src/data/hskAssessment.ts`. No customer-classification algorithm, HSK grading rule or historical task deadline was changed. The local-3000 environment/configuration was not edited.

## Remaining gates

1. Actual Robert/manager/sales usability review remains a human acceptance step; current evidence is automated testing and internal simulated-role walkthroughs.
2. Full assistive-technology and formal WCAG certification were not performed. Responsive layouts and principal keyboard interactions were checked; these do not constitute a full accessibility audit.
3. Company identity/SSO integration and server deployment are not included. MySQL-backed local accounts remain authoritative in this iteration.
4. A later, separately authorized 3000 switch must first back up the database/configuration, stop relevant writes, apply migration 6, verify preserved accounts/ownership/deadlines/configuration and Robert's access, then switch the independently verified build. Keep a compatible database backup and rollback build. Do not undo role changes by rerunning seed scripts or replay historical notifications.

No classification-priority decision is implied by this delivery; R1–R6 review remains separate.
