# UPER Home Portal maintenance

Canonical repository: `uper-edu/uper-home-portal` (private).

- Confirm the destination remote before any push. Do not push to the former personal repository unless explicitly requested.
- Never commit environment files containing credentials, runtime customer records in `data/`, logs, or local backups. `.env.example` contains placeholders only.
- Stage only reviewed source and documentation changes; do not blindly stage all files.
- Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check` before syncing.
- A request to sync code authorizes a push to the canonical repository, but does not authorize production deployment.
- Keep lesson content and grading rules unchanged during infrastructure fixes unless the user requests content changes.

## Zentao bug fixes

- Use [fix-zentao-bugs](.agents/skills/fix-zentao-bugs/SKILL.md) for Zentao bug investigation, repair, and disposition.
- Default to manual confirmation: analyze each bug and its validity, present the final repair plan and obtain explicit human approval for that exact bug and plan before changing repair code, then implement and verify it. User-provided directions alone are not approval; material plan changes require renewed confirmation. Show remaining bugs and automatically present the next bug for confirmation.
- Enable fully automatic repair only when the user explicitly requests that mode for the current task. Reading or maintaining the skill does not start a repair task.
- Read connection settings from `.zentao.local.json`. The user has explicitly authorized versioning the supplied project settings in this file; this exception does not authorize committing other credentials. Use this file as the sole source for all six connection settings on Windows and macOS; do not override it with environment variables, `.mcp.json`, or credential fallback files. Never copy credentials into logs or documentation. An empty `zentaoAssignee` defaults to the current bug reporter, and the resolved build defaults to `trunk`.
- Follow the skill's Windows PowerShell or macOS zsh/bash instructions as appropriate. Handle authorized comments and status transitions on the user's behalf and verify the result in Zentao.
