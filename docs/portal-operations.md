# MySQL portal operations

## Configuration and startup

Use Node.js 24+, MySQL 8 and the explicit dev/test/prod environment loader. Follow [environment configuration and the migration baseline](environment-configuration.md); use only the root placeholder templates. Actual credentials stay private. Reuse an existing environment file without overwriting its database connection or stable operation key.

Local3000 uses its existing MySQL database. Do not start another process, replace its build output or migrate/restore data as part of a documentation update. Company testing uses its own synthetic schema and the unified home domain. Production remains separately gated.

## Permissions and notifications

CRM, CMS and system management use persisted staff accounts and server-side permissions. Workspace access does not grant other business roles. Customer ownership and shared-pool claim rules apply at the API; filters cannot expand access. Current user/role configuration is authoritative, not a historical account list.

Sales Operations manages notification policies, channels and delivery audit. Owner routes fall back to CRM Manager when necessary. CRM Bot uses channel `CRM_Leads_Update` and server variable `LARK_GROUP_CRM`; browser responses must never contain the Webhook. Reading messages or opening contact tools does not complete business tasks.

New environments start with workers paused or explicitly simulated. Real sending requires its own reviewed configuration and TEST receipt check. Distinguish pending, sending, accepted, simulated, unknown, failed and cancelled; accepted does not prove human receipt. Unknown external outcomes must be investigated before retrying. Historical holds and cancelled work remain protected after restart, recovery and channel fixes.

## Backup, restore and release

Use the current MySQL backup implementation in [cloud/mysql/backup.mjs](../cloud/mysql/backup.mjs) and the reviewed [administrator recovery and release procedure](company-trial-recovery-20261014.md). Maintenance requires explicit authorization and a private configuration; do not run examples against a live database without the applicable maintenance steps.

Backups and detailed reconciliation remain private. Restore only into an explicitly selected empty target, validate integrity and reconcile identities, ownership, raw text, scores, task deadlines and configuration. Restore/recovery revokes old sessions and installs a review gate; verify active accounts and two eligible administrators before release. Release does not replay historical notifications.

Ordinary code rollback retains the current MySQL database and accepted writes. Database restoration is a separate operation. Imported unknown message times remain unknown; placeholders must not enter real due/overdue calculations. Import and restore must not generate historical notification floods.

## Monitoring and acceptance

Track database readiness, pending-job age, failed/unknown deliveries, interrupted AI responses, task state and runtime identity. Health during recovery review can return 200 with businessReady=false; it is not business release. Follow [validation](portal-validation.md) for isolated checks and evidence boundaries.

Target-host configuration and limitations are recorded in [company deployment acceptance](company-host-deployment-20261015.md), [browser acceptance](company-browser-acceptance-20261015.md) and [live notification acceptance](company-lark-live-acceptance-20261015.md). Read each report with its date; a prior receipt or local test is not proof of current host or provider health.
