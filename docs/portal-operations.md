# Portal persistence and notifications

## Run locally

Requires Node >=24 and PostgreSQL. Install with `npm ci`. Set server-only `DATABASE_URL`; the application initializes the additive schema in `server/portal/schema.sql`. For local QA set `PLATFORM_MODE=mock`, `MOCK_EMPLOYEE_ID=test-admin`, `PORT=4341`. Start with `npm run dev`. Do not expose this mock environment through a public proxy. Proxy headers and non-local Host values reject mock authentication. Production has no mock identity fallback: implement `PlatformAdapter` against the education management platform before opening CRM access.

The macOS arm64 optional PostgreSQL binary is for isolated developer tests, not a production database service. Use a separate database for integration tests:

```
PORTAL_TEST_DATABASE_URL=postgresql://... npm run test:portal
npm test
npm run lint
npm run build
```

Without `DATABASE_URL`, CRM and new consultation APIs fail closed with 503. The legacy model-only route is accessible solely via the explicit `LEGACY_CHAT_TEST=true` regression switch; never set it in deployed environments. Existing public preview is a separate checkout and has not been upgraded.

## Configure notifications

Daily work stays in CRM → Leads: activity badges, unread/my-pending/unassigned/overdue filters, deadlines, and follow-up actions in the customer timeline. Notification policy/channel/delivery administration is under SLA & Policy → 通知设置与发送审计. Inbox and follow-up are separate: reading does not complete a task. Edit policies with validated JSON fields; saving a draft disables that rule, enabling applies to future events. Pending jobs keep their rule snapshot and version. The simulator does not send. Send logs distinguish `pending`, `sending`, `accepted`, `simulated`, `unknown`, `failed`, `cancelled`. Unknown external results require investigation; automatic retries could duplicate a delivered message.

Channel IDs represent Lark groups, e.g. `sales`. Channel config: `{"team":"sales","secretRef":"LARK_WEBHOOK_URL","mode":"simulation"}`. `secretRef` references a server environment variable; it does not hold the secret. The old `LARK_WEBHOOK_URL` variable can be reused. Local/test live sends additionally require `LARK_TEST_GROUP=sales`. Only official HTTPS Lark webhook URLs are permitted. No usable webhook was found in current environment files.

Credentials never travel to the browser. Email/SMS remain disconnected. No production group is contacted automatically. To enable actual delivery, configure an explicitly designated test group, verify a synthetic event and CRM link, then review live-mode configuration. There is no provider receipt proving human reading.

## Migration and rollback

Back up JSON and PostgreSQL first. Dry run:

```
npm run migrate:portal -- data/leads_db.json
```

Review counts, SHA-256, missing/duplicate IDs, invalid dates. During a maintenance window stop consultation writes. Apply against the selected database:

```
npm run migrate:portal -- data/leads_db.json --apply
```

Imports preserve customer IDs and original profile/follow-up JSON. Historical messages use `legacy_unknown`; original message IDs and timestamps are preserved in metadata. Missing dates use an import placeholder, never a claim of a known conversation time. Imported follow-up tasks enter `migration_hold` until staff explicitly review and activate them, preserving deadlines without sending historical overdue alerts. The importer creates no outbox events and repeated imports do not duplicate rows. Candidate duplicates require review; imports do not auto-merge them. Do not leave JSON and PostgreSQL dual writes active.

Back up with `pg_dump` and restore into a separate PostgreSQL database with `pg_restore`/`psql`; reconcile counts before switching. After new writes begin, rollback must use a database-compatible application version or a complete export including new records. Returning to stale JSON loses accepted writes.

## Monitoring and boundaries

Monitor oldest pending outbox/job age, failed and unknown deliveries, overdue tasks, database errors and interrupted AI replies. Worker leases expire after one minute; external sends become unknown, internal jobs can retry. Advisory locks serialize generation per conversation and external sends per group. Health and job monitoring must be linked to the eventual deployment's operations system.

Remaining integration/release work: real platform authentication and employee lookup; approved Lark test group receipt; backup/restore drill in the target hosting environment; complete UI acceptance across both chat surfaces and all rule branches. The notification editor now uses grouped forms and delivery tables; see docs/notification-settings-guide.md. No public release is authorized by this local implementation.

A tested application-level snapshot utility is available: `DATABASE_URL=... node --import tsx scripts/portal-backup.ts backup /absolute/backup.json` and `restore /absolute/backup.json`. Restore requires empty destination tables, verifies SHA-256 and restores foreign keys in dependency order; it never overwrites existing records. It covers this portal schema only, not full PostgreSQL roles/extensions. Keep production pg_dump backups as well.

## Employee data scope

The platform adapter supplies stable employee ID, permissions and data scope. Sales use `own` (only assigned customers); sales managers use `all`. The server applies scope to leads, details, conversations, tasks, export and statistics; changing filters cannot expand access. Assignment requires `crm.assign`, independently of ordinary follow-up editing. Reassignment immediately changes the next authorized response. Per-employee read watermarks clear only activity already observed; later events remain unread. Viewing never completes follow-up. Real education-platform integration remains pending.

## Local 3000 startup

The configured local instance uses persistent data/postgres-local on 127.0.0.1:5449. `npm run dev` invokes scripts/local-start.mjs to ensure that local PostgreSQL is running before starting the application. Keep migration reconciliation reports private and outside Git. New consultation writes go to PostgreSQL; keep source JSON in protected local backups.

## Backup and migration acceptance update (2026-10-12)

Application snapshots now use v2, cover 17 portal tables including HSK attempts, preserve timestamp microseconds and sequence state, and reject unknown source tables. Snapshot creation is read-only and does not initialize the schema. Restore checks integrity before initialization, refuses occupied destinations, and rolls back partial imports. v1 imports explicitly report their missing independent HSK coverage. See docs/portal-backup-migration-acceptance-20261012.md for evidence and limits.

Migration dry-run reports contact-match candidates and anomalies. Unknown message dates use an explicitly marked epoch placeholder; original source text and metadata remain available. Apply stores per-lead source fingerprints; re-importing the same source retains newer database writes. Changed sources, existing ID conflicts, and early imports without fingerprints require manual review. Historical tasks remain migration_hold and retain deadlines; imports create no events. Run restores into isolated databases with outbound delivery disabled, reconcile all tables, inspect interrupted/unknown jobs, then authorize worker activation. Native full-database backup, offsite retention and target-host recovery remain deployment gates.
