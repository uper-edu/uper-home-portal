# Users, roles and email login — acceptance and local cutover

Date: 2026-10-14. This supersedes the team-scope behavior described in the earlier independent access-management report. It includes the later authorization to switch local 3000 and synchronize reviewed source to the canonical private repository. No public/server deployment or external invitations are included.

## Business model

- Users identify people; roles grant individual actions; Owner identifies the responsible employee. Teams no longer decide authorization, claiming, recipient routing or summary selection. Historical team values remain inert evidence in existing records; there is no team editor or organization-management capability.
- Actions retain independent own/all scopes. Viewing all customers does not grant editing or exporting them. Eligible Sales use a shared unassigned pool and can claim only for themselves. Assignment eligibility and the assignee's ability to read/process the resulting customer are checked separately. Existing ownership is never rewritten by this migration.
- Default customer notifications use valid Owner → CRM Manager with access and assignment authority for the customer. Team membership is irrelevant. Operational incidents go to authorized Managers. Full-customer summaries require full customer-read scope. Lark channel IDs and Webhook references remain configured destinations, not organization teams.
- Custom historical team grants are **removed**, never silently promoted to all-customer access. Dependent customer actions without viewing/follow-up capability are also removed. Original definitions and before/after changes remain in access audit. The authorized default Sales claiming change is specifically limited to the shared unassigned pool.
- Legacy policies are versioned when routing changes; channel, conditions unrelated to teams, calendars, templates, frequency limits and enable/disable intent are preserved. Policies with team filters or team-specific daily summaries remain inactive with a review marker. An authorized operator must explicitly confirm removal of the old restriction before enabling; saving a draft cannot clear this marker implicitly. Old policy snapshots remain in version history.
- Pending old jobs carrying retired filters are cancelled when processed; accepted delivery history is never rewritten as withdrawn. Historical failures are not replayed.

## Staff email login

MySQL schema migration **7** adds nullable `crm_users.email` and a unique normalized `email_key`. Existing accounts receive no invented email addresses. An administrator can maintain an optional email in Edit user; Login ID remains immutable and continues to work with the same password. This is a second login identifier for the same account, not a second account or a password-recovery service.

Addresses are trimmed, case-normalized, format-validated and unique across accounts, including disabled accounts. Changing/removing email revokes sessions and does not change account ID, password, roles, ownership or task deadlines. Login ID and email resolve to the same account-level failure-limit key, so switching identifiers does not bypass throttling. Disabled accounts cannot authenticate with either identifier. Passwords are not returned or recorded in audit.

Robert is the first Access Administrator, independently retaining existing CRM/CMS roles. Bootstrap is once-only and revokes pre-grant Robert sessions. At least one active full access administrator must remain. Unknown permissions, stale revisions, cross-origin changes and delegated privilege escalation are rejected server-side.

Robert was present in the earlier Users list; the card was below other users. The signed-in account is now pinned first and labeled in all three languages. Staff names are preserved as entered.

## Independent verification

- **293 root tests passed; zero failed/skipped**, using independent MySQL fixtures and simulated accounts/customers. Coverage includes migration idempotency/preservation, shared claim races, foreign-customer mutation/export denial, manager fallback without teams, explicit policy review, pending/accepted historical jobs, unique email aliases, mixed-case login, shared ID/email throttling, email changes/session revocation, disabled aliases, delegated access and last-admin protection.
- Required `npm run lint`, `npm run build`, native SQL catalog check and `git diff --check` passed. Catalog: 229 repository statements. CRM business dictionary: 456 fields/28 business tables. Static HSK content and grading source were not changed; existing HSK/AI/task regressions passed.
- Browser: five system modules × EN/ID/ZH × three viewport overrides × light/dark = **90 combinations**, no whole-page horizontal overflow. User editor additionally checked in nine language/width combinations: email input present, Team IDs absent, no overflow. Requested viewport overrides were 390/768/1280; browser zoom yielded approximately 354/698/1163 CSS pixels during the editor checks, recorded rather than presented as exact CSS sizes.
- A synthetic email account signed into the independent Sales workspace through the actual browser. It could not access System management. No real staff email was assigned during this exercise. No live AI, Lark, email or SMS notification was sent by this run.
- Online system guidance, CRM documentation entry, labels and error messages updated in English, Indonesian and Chinese. Names and human/customer original text remain unchanged.

Private fixture credentials, logs, dumps, screenshots, hashes and environment files are stored only under ignored `.local-backups/` paths and are excluded from Git.

## Local 3000 cutover

Before switching: backed up the existing MySQL database, complete environment bytes and previous static assets. Applied additive migrations, held existing unprocessed events/pending-or-uncertain jobs and existing unfinished tasks from automatic historical notification processing, then switched the verified build. Original task status/deadline data were not rewritten by those holds. No customer/activity data were restored from old versions.

Preservation checks:

- **21 business tables** matched pre-cutover row counts and canonical SHA-256 values; no unexpected business-table changes. These include customer profiles/ownership, conversations, messages, assessments, follow-up tasks, content/settings, channels and delivery records.
- Original employee-column fingerprints matched after projecting away additive columns and Robert's explicitly approved `access_admin` addition. Names, IDs, password hashes, original role memberships and inert historical team values were retained. Exactly **9 existing accounts**; no synthetic test account was imported into 3000.
- Environment file is byte-identical. Webhook/AI configuration is retained server-side, never included in source or reports.
- `daily.digest` is the one local policy marked inactive for explicit historical scope review; its original snapshot remains available. Other existing policy conditions are retained. Do not enable it blindly as if the previous team-only summary were an all-customer summary.
- Existing worker configuration was resumed after validation. HTTP and browser checks confirm Robert's system access, CRM customer-list access, CMS access and mailbox field; Sales system access/configuration editing are denied. Sales can still read the business calendar used in their workflow.

The local services were launched with private logs in the background so their process lifetime does not depend on the interactive tool session. Local-only URLs: `http://localhost:3000/system`, `/crm`, `/cms`. Browser verification also used `127.0.0.1:3000` to avoid replacing the user's separate localhost session.

## Git synchronization and remaining items

The canonical remote was verified as `uper-edu/uper-home-portal`. The source sync includes previously accepted, required MySQL/CMS/shared-admin dependencies absent from the remote baseline, plus this access module. Customer data, keys, actual environment files, local backups and built static artifacts are excluded. Assessment endpoint SQL adaptation is infrastructure only; no lesson content or grading-rule change is included.

Remaining: administrators must enter real staff emails; review the paused daily summary before enabling; real staff usability testing and company identity/server deployment remain separate. No verification email delivery, public signup, organization tree or external deployment is claimed.

Rollback: preserve the new authorization checks. Prefer restoring previous static assets with a compatible current server; do not revert to startup seed logic that restores revoked privileges. Restore a database backup only after explicitly accounting for writes since cutover; never overwrite newer customer activity with the old dump.
