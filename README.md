# UPER Home Portal

React/TypeScript website with an Express backend, CRM/CMS workbenches, HSK placement entry, and OpenAI chat with DeepSeek fallback.

## Local development

Requires Node.js 24 or newer, npm, and a PostgreSQL database. Configure DATABASE_URL in .env before starting. For restricted localhost testing use PLATFORM_MODE=mock; real employee identity and permissions must come from the education management platform before remote CRM access.

```sh
npm ci --ignore-scripts
cp .env.example .env
# Fill local credentials in .env; do not commit them.
npm run dev
```

The locked `msedge-tts` package includes a pnpm-only installation guard. The npm workflow above skips dependency lifecycle scripts; the isolated snapshot was tested and built with this installation. On macOS arm64, run `node node_modules/@embedded-postgres/darwin-arm64/scripts/hydrate-symlinks.js` before initializing a fresh embedded cluster. A separately managed PostgreSQL service avoids the optional embedded setup.

The server listens on port 3000 (overridable with PORT). Mock employee mode binds to 127.0.0.1 and rejects proxied authentication. The local starter can restart an already initialized macOS arm64 PostgreSQL cluster in data/postgres-local; other environments use their separately managed database. Routes include `/`, `/chat`, `/crm`, and `/cms`.

## AI configuration

Set `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o`), and `DEFAULT_AI_PROVIDER=openai`. Set a valid `DEEPSEEK_API_KEY` to enable automatic fallback to `deepseek-chat`. The application retries with the backup if the primary fails, records failed attempts, and saves the final reply before confirming completion. The model info endpoint confirms loaded configuration, not live provider health.

The server loads `.env` first, otherwise `.env.prod`. Keep both private. Consultation chat is saved directly to CRM rather than deferred email submission. Unrelated contact/careers forms still use their existing SMTP handlers.

## Checks and production run

```sh
npm test
npm run lint
npm run build
npm start
```

`lint` includes all server modules. Tests use temporary directories and mock provider credentials. Set PORTAL_TEST_DATABASE_URL to a separate disposable PostgreSQL database to include CRM integration tests; production secrets and customer records are never required.

## Data and migration boundary

This organizational repository starts from a clean source snapshot. It intentionally does not include the previous personal repository's Git history, real environment files, or runtime customer data. Public website content in `src/data/content/` and static learning assets are retained.

Customer profiles, visitor sessions, conversations, messages, follow-up tasks and notification jobs now live in PostgreSQL. Legacy campaign JSON, local database clusters, reports and backups remain under ignored local paths. See docs/portal-operations.md for dry-run migration, integrity checks and backup/restore procedures. Do not use Git to synchronize customer records.

CRM routes enforce employee permissions and lead scope through the platform adapter. The bundled identity fixtures are localhost-only; real platform integration is pending. CMS and remaining legacy/public form boundaries require a separate deployment security review. Syncing this source does not authorize deployment.

The repaired assessment entry resumes pending/skipped/completed status on reload; individual question progress is not persisted.

Notification rules, channels and delivery audit appear under SLA & Policy. Daily reminders appear as activity badges and tasks in Leads. Reading a lead does not complete follow-up. Internal inbox and Lark adapters are implemented; Lark defaults to simulation until a designated group is configured. Email/SMS are disconnected. See docs/portal-validation.md for acceptance boundaries.
