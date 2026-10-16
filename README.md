# UPER Home Portal

React/TypeScript website with an Express backend, MySQL persistence, CRM/CMS and system-management workspaces, HSK placement entry, and OpenAI chat with DeepSeek fallback.

## Local development

Requires Node.js 24 or newer, npm and MySQL 8. Environment names are `dev`, `test` and `prod`; each uses its own private configuration and data source.

```sh
npm ci --ignore-scripts
cp -n .env.dev.example .env.dev
chmod 600 .env.dev
# Fill the private local database connection and other required values before starting.
npm run dev
```

The locked `msedge-tts` package includes a pnpm-only installation guard, so the npm workflow skips dependency lifecycle scripts.

Development normally listens on localhost:3000. Do not start another process or overwrite the database connection when an existing local3000 service is running. Routes include `/`, `/chat`, `/crm`, `/cms` and `/system`; staff permissions and customer ownership apply to the management APIs. Mock employee fixtures are for isolated localhost tests only.

## Environment configuration and builds

Only placeholder templates belong in Git: `.env.dev.example`, `.env.test.example` and `.env.prod.example`. Actual `.env.dev`, `.env.test` and `.env.prod` files stay private and are not included in release packages. The old `.env` is not automatically merged by the new environment loader.

```sh
npm run build:dev
npm run build:test
# Start a prepared environment only after its private configuration is ready:
npm run start:dev
```

`npm run build` is the development build. Outputs are `build/<environment>/web` and `build/<environment>/runtime`. Frontend builds consume only public `VITE_` variables; server credentials are injected at runtime. Production configuration is reserved and startup remains blocked until explicitly provisioned. See [environment configuration](docs/environment-configuration.md) for file creation, secret custody and environment isolation.

## AI and notification configuration

Configure `OPENAI_API_KEY` and `OPENAI_MODEL` (default `gpt-4o`) privately. A valid `DEEPSEEK_API_KEY` enables fallback to `deepseek-chat`. Provider attempts and the final consultation response are persisted; a configuration endpoint does not prove live provider health. Unrelated contact/careers forms retain their SMTP handlers.

Sales Operations manages notification rules, channels and delivery audit. Opening a customer or reading messages does not complete follow-up tasks. Lark starts in simulation for a new environment and requires explicit approval and a configured server-side Webhook before live sending. Email/SMS delivery is not connected. Environment templates deliberately do not embed the current server's secrets or activate live delivery.

## Checks

```sh
npm test
npm run lint
npm run build
```

Database integration tests use disposable synthetic databases. The native test harness requires its explicitly designated independent MySQL socket and MySQL CLI directory; never point it at local3000 or a company business schema. See `tests/helpers/mysql.mjs` and the company acceptance reports for the exact harness and evidence boundaries.

## Company test deployment

The approved unified origin is `https://home.prototype.uperedu.com`, with frontend and API served together. The company test environment has its own synthetic MySQL schema and private `.env.test`; it does not use local3000 customer data or credentials. Staff APIs retain login, role and customer-scope checks. Server builds are prepared locally and released through the project adapter for the `uper-server-deploy` skill. A GitHub sync does not authorize deployment.

- [Company deployment acceptance](docs/company-host-deployment-20261015.md)
- [Browser acceptance and remaining limitations](docs/company-browser-acceptance-20261015.md)
- [Live automatic Lark acceptance and historical queue isolation](docs/company-lark-live-acceptance-20261015.md)

System management's test directory is available only to fully authorized system administrators in the explicitly enabled synthetic company environment. It lists preset test accounts, current roles and only a verified still-valid initial password; later-created users and changed passwords are excluded. No actual initial password is stored in source.

The permanent read-only `organic` campaign groups new registrations from `/chat`, `/chat?c=home` and `/chat?c=organic`. Other campaign IDs remain independent, and existing first-touch attribution is preserved. This is an entry-based source bucket, not verified search-engine traffic. The shareable test directory calls the campaign entry “Campaign attribution”.

## Running identity and safe maintenance

The shared account menu, `/api/version`, health and response headers identify the environment and build. Packages embed the full commit, source digest, dirty state and build time; mixed front/backend packages fail startup. Source mode is explicitly labeled. Health uses the actual dataset. See [runtime identity and cutover checklist](docs/runtime-version-and-policy-cutover-20261015.md). The retired name-password exception is removed; existing account passwords are not reset. The targeted legacy-test policy retirement tool requires preview, confirmation and stopped services, holds unsent historical work and never replays notifications.

## Data boundary

Customer profiles, employee accounts, visitor sessions, conversations, messages, assessments, follow-up tasks and notification delivery records persist in MySQL. Static question banks, public content and translations may remain JSON assets. Data migrations, backups, restores and environment cutovers require their own reviewed procedure; changing code does not normally require restoring the entire database. See the [MySQL migration and acceptance baseline](docs/environment-configuration.md#mysql-迁移与验收基线) for data-preservation results, notification isolation and evidence limits; [operations](docs/portal-operations.md) and [validation](docs/portal-validation.md) provide current entry points.

Do not commit private environment files, keys, runtime customer records, logs, local databases or backups. Stage only reviewed source, placeholder templates and documentation. This repository's canonical remote is `uper-edu/uper-home-portal`.
