# UPER Home Portal maintenance

Canonical repository: `uper-edu/uper-home-portal` (private).

- Confirm the destination remote before any push. Do not push to the former personal repository unless explicitly requested.
- Never commit environment files containing credentials, runtime customer records in `data/`, logs, or local backups. `.env.example` contains placeholders only.
- Stage only reviewed source and documentation changes; do not blindly stage all files.
- Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check` before syncing.
- A request to sync code authorizes a push to the canonical repository, but does not authorize production deployment.
- Keep lesson content and grading rules unchanged during infrastructure fixes unless the user requests content changes.
