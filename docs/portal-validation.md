# Portal validation

The CRM/chat source snapshot has a dedicated PostgreSQL integration suite. Run with an isolated disposable database, never customer data:

```sh
PORTAL_TEST_DATABASE_URL=postgresql://... npm test
npm run lint
npm run build
```

Tests cover visitor association across both chat sources, request idempotency, repeated messages, OpenAI/DeepSeek fallback including partial streams, storage failure acknowledgement, abandoned generation, transactional outbox/inbox processing, Lark business-error/unknown-result states, read cutoffs, lead scope and assignment permission, and 20 concurrent conversations with 100 synthetic messages. Without PORTAL_TEST_DATABASE_URL, only the non-database tests run; that does not constitute complete CRM acceptance.

Local browser/service acceptance also exercised conversation display, list activity badges, search persistence, follow-up logs, scheduled tasks, completion actions and restart persistence. The local fixture platform adapter is not a production identity provider.

Real education-platform authentication, approved Lark group receipt and target-host backups remain deployment gates. Provider test fixtures do not prove live external delivery. Runtime records, local reconciliation reports, environment files, backups and customer-derived checksums are excluded from the repository.

Sync-snapshot verification completed with `npm ci --ignore-scripts`, 24 passing tests (including a fresh isolated PostgreSQL database), `npm run lint`, `npm run build` and staged diff checks. Parallel HSK content revisions and their additional tests are outside this change.
