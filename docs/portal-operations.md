# MySQL portal operations

## Configuration and startup

Use Node.js 24+, MySQL 8 and the explicit dev/test/prod environment loader. Follow [environment configuration and the migration baseline](environment-configuration.md); use only the root placeholder templates. Actual credentials stay private. Reuse an existing environment file without overwriting its database connection or stable operation key.

Local3000 uses its existing MySQL database. Do not start another process, replace its build output or migrate/restore data as part of a documentation update. Company testing uses its own synthetic schema and the unified home domain. Production remains separately gated.

| Configuration | Where to maintain it | When it takes effect |
| --- | --- | --- |
| Deployment presets for the system Lark group, reserved campaigns and Finance role | [System defaults](../cloud/mysql/system-defaults.json), read by the [initializer](../cloud/mysql/system-defaults.mjs) | Initialization inserts missing records. Existing records retain their saved values. |
| Standard HSK course presets | [Course catalog](../src/data/crmCoursePrices.json) | Initialization adds missing courses. Manage saved courses in CRM. |
| SLA, work hours and automatic assignment | [CRM policy defaults](../src/types/crmPolicyConfig.ts) and CRM policy settings | Code supplies defaults where applicable. CRM saves environment-specific settings in MySQL. |
| Notification rules and delivery limits | [Rule defaults](../server/portal/policy.ts), [Lark defaults](../src/utils/larkNotificationDefaults.ts) and CRM notification settings | CRM uses saved rules and channels for delivery. |
| Lark group Webhook in local CRM and company test | Private environment file, `LARK_GROUP_CRM` | CRM shows the configuration status. Reload the service after changing the address. |
| Group Webhook, signing secrets and other credentials | [Server environment configuration](environment-configuration.md) | The service reads these at startup. |
| Initial CMS content and images | [CMS initialization bundle v2](../cloud/mysql/seeds/cms/v2/README.md) and [COS/bootstrap operations](operations/cms-cos-bootstrap.md). Edit imported content in CMS. | Explicitly publish and verify COS resources, then import URL metadata into an approved empty CMS; existing databases require a reviewed incremental migration. |

The built-in Lark group channel starts in simulation mode with the shared hourly limit and signing disabled. An existing CRM Bot channel keeps its ID and delivery settings when renamed to Lark 群通知. The group name is fixed. The group and personal system channels can be configured but cannot be deleted. For local CRM and company test, set `LARK_GROUP_CRM` in the environment's private server file and reload the service after replacing or removing the address. The CRM channel stores the variable name and displays connection status. Match signing to the Lark bot in CRM. Actual delivery also depends on the notification rules and worker configuration.

## Permissions and notifications

CRM, CMS and system management use persisted staff accounts and server-side permissions. Workspace access does not grant other business roles. Customer ownership and shared-pool claim rules apply at the API; filters cannot expand access. Current user/role configuration is authoritative, not a historical account list.

Sales Operations manages notification policies, channels and delivery audit. Owner routes fall back to CRM Manager when necessary. Each group channel sends to the group associated with its saved Webhook. The channel mode controls whether it sends or records a simulation. Personal notifications use their own channel mode, the Lark application and employee binding. Reading messages or opening contact tools does not complete business tasks. In local CRM and company test, the group Webhook comes from `LARK_GROUP_CRM`.

Use `PORTAL_WORKER_ENABLED=false` to keep the worker paused during maintenance and first-start checks. Real sending requires its own reviewed configuration and TEST receipt check. Distinguish pending, sending, accepted, simulated, unknown, failed and cancelled; accepted does not prove human receipt. Unknown external outcomes must be investigated before retrying. Historical holds and cancelled work remain protected after restart, recovery and channel fixes.

Before changing the Webhook storage method, back up the channel configuration and the private environment file. Verify that the new runtime resolves the original group address while the worker is paused. A rollback uses the saved channel configuration and its matching environment.

A policy can select Lark group and personal delivery independently. CRM schedules one delivery per selected group and up to one personal delivery for the eligible bound owner. Explicit personal delivery follows the personal channel mode and the policy’s per-owner limit. Untouched combined rules and queued snapshots retain their saved routing. The customer assignment policy routes privately.

Before deleting a group channel, remove it from all editable policies and clear or finish pending deliveries. Deletion clears the saved connection and preserves past delivery and audit records. The initializer leaves a deleted channel ID retired. Create a new channel to reconnect the group.

## Backup, restore and release

Use the current MySQL backup implementation in [cloud/mysql/backup.mjs](../cloud/mysql/backup.mjs) and the reviewed [administrator recovery and release procedure](company-trial-recovery-20261014.md). Maintenance requires explicit authorization and a private configuration; do not run examples against a live database without the applicable maintenance steps.

Backups and detailed reconciliation remain private. Restore only into an explicitly selected empty target, validate integrity and reconcile identities, ownership, raw text, scores, task deadlines and configuration. Restore/recovery revokes old sessions and installs a review gate; verify active accounts and two eligible administrators before release. Release does not replay historical notifications.

Ordinary code rollback retains the current MySQL database and accepted writes. Database restoration is a separate operation. Imported unknown message times remain unknown; placeholders must not enter real due/overdue calculations. Import and restore must not generate historical notification floods.

## Monitoring and acceptance

Track database readiness, pending-job age, failed/unknown deliveries, interrupted AI responses, task state and runtime identity. Health during recovery review can return 200 with businessReady=false; it is not business release. Follow [validation](portal-validation.md) for isolated checks and evidence boundaries.

Target-host configuration and limitations are recorded in [company deployment acceptance](company-host-deployment-20261015.md), [browser acceptance](company-browser-acceptance-20261015.md) and [live notification acceptance](company-lark-live-acceptance-20261015.md). Read each report with its date; a prior receipt or local test is not proof of current host or provider health.
