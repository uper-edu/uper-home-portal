# MySQL portal validation

Use disposable synthetic MySQL databases and separate local services. Never point tests at local3000 or the company business schema. The [migration and acceptance baseline](environment-configuration.md#mysql-迁移与验收基线) records retained migration conclusions; dated feature reports are not current MySQL acceptance claims.

## Automated checks

Run `npm test`, `npm run lint` and `npm run build` in a temporary source checkout with the required dependencies. Build only with a placeholder/public frontend environment; never copy live credentials. The default build writes build/dev, so it must not run in a checkout whose build/dev is serving local3000.

Full native database integration requires `MYSQL_NATIVE_TEST_ENV` and `MYSQL_BIN_DIRECTORY`. The [test helper](../tests/helpers/mysql.mjs) requires the dedicated independent socket `/private/tmp/uper-mysql-native-cleanup.sock`, creates random synthetic schemas/accounts, and removes inherited live AI/Lark credentials. Prepare a separate MySQL test instance for that socket; do not redirect the live database to satisfy the fixture. The company package integration also creates its own local TLS database and HTTPS proxy.

Record pass/fail/skip counts and actual integration execution. Missing database prerequisites or skipped tests are not a full acceptance pass. Do not use an old test count as the expected result for a newer commit. A connection/setup failure must be reported separately and rerun after correcting the isolated fixture.

## Required workflow checks

Cover Campaign attribution, registration, assessment persistence, stored AI attempts and final replies, permission boundaries, shared-pool claims, selected-task completion, explicit next arrangements, idempotent retries, transaction rollback, task/notification association, worker restart and historical holds. CMS checks cover CRUD, optimistic conflicts, audit rollback, media and separate recruitment authorization. Preserve customer raw text and current grading rules.

For browser acceptance, record role, language, viewport, task and outcome. Check the four customer tabs, retained drafts on failure, read-versus-task state and contact previews from Profile/Assessment. Existing three-language and narrow-screen evidence applies only to its tested version, not full accessibility conformance or proven sales productivity.

## External services and recovery

Model/notification stubs verify application behavior but do not prove real AI or group receipt. Live calls require approved credentials and synthetic content; record provider acceptance separately from user-confirmed Lark receipt. Never resend historical notifications to create evidence.

Backup/restore validation requires a separate empty target, integrity and row/content reconciliation, administrator recovery, result queries, fresh-session review and explicit release. Confirm historical work remains held while new events follow current policy. Local tests do not establish a target-host disaster-recovery drill, independent secret custody or real dual-person approval; see [recovery limits](company-trial-recovery-20261014.md).

Private environment files, customer records, backups, raw screenshots and detailed reconciliation stay outside Git and release packages. Read-only checks of live services must not be described as a new migration or deployment.
