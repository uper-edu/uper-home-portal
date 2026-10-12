# UPER Home Portal

React/TypeScript website with an Express backend, CRM/CMS workbenches, HSK placement entry, and OpenAI chat with DeepSeek fallback.

## Local development

Requires Node.js 24 or newer and npm.

```sh
npm ci
cp .env.example .env
# Fill local credentials in .env; do not commit them.
npm run dev
```

The server listens on port 3000. Routes include `/`, `/chat`, `/crm`, and `/cms`.

## AI configuration

Set `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o`), and `DEFAULT_AI_PROVIDER=openai`. Set a valid `DEEPSEEK_API_KEY` to enable automatic fallback to `deepseek-chat`. The application retries with the backup if the primary fails, and resets partial streamed output before replacement. The model info endpoint confirms loaded configuration, not live provider health.

The server loads `.env` first, otherwise `.env.prod`. Keep both private. Gmail credentials support form notifications; without SMTP, existing form handlers may return simulated delivery.

## Checks and production run

```sh
npm test
npm run lint
npm run build
npm start
```

`lint` runs the existing TypeScript check. Unreferenced Lark modules are not included by that check and still require repair before use. Tests use temporary directories and mock provider credentials; they do not require production secrets.

## Data and migration boundary

This organizational repository starts from a clean source snapshot. It intentionally does not include the previous personal repository's Git history, real environment files, or runtime customer data. Public website content in `src/data/content/` and static learning assets are retained.

CRM runtime JSON records are created under `data/` and are excluded from Git. Existing local records can remain in place. New deployments start with an empty lead store and built-in default campaigns/policies. Provide persistent storage and backups separately. Do not use Git to synchronize customer records.

The current application has no authentication on administrative APIs. Keep development access restricted; authentication, durable storage, and credential rotation remain necessary before expanding production use. Do not treat repository creation as production deployment.

The repaired assessment entry resumes pending/skipped/completed status on reload; individual question progress is not persisted.
