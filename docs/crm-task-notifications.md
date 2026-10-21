# CRM task notification activation

The three independent events are `task.created`, `task.rescheduled` and `task.appointment_due`. Their default template targets the existing `CRM_Leads_Update` (CRM Bot) channel. A new installation keeps these policies inactive until an operator explicitly confirms activation; restarting never overwrites stored policy settings.

For an authorized local activation, inspect first:

```sh
PORTAL_ENV=dev node --import tsx scripts/crm-task-notices.ts
```

After checking the plan and retaining a private configuration backup:

```sh
PORTAL_ENV=dev node --import tsx scripts/crm-task-notices.ts --apply
```

The script reads the selected environment using the application's normal environment loader. It never prints secrets. Run against only the intended database. The transaction requires all three rules and the existing CRM Bot channel, rejects unresolved or retired routing, changes only `enabled` and the channel reference, and preserves all conditions, calendars, templates, limits and retry settings. Each actual change creates a rule version, activation time and audit entry. Repeating an already-applied activation makes no new versions.

Customer notifications continue to follow eligible Owner, then eligible CRM Managers. This operation grants no user permissions and creates no replacement group. Channel mode and server-side Webhook configuration remain unchanged.

Only events at or after activation use the new version. An appointment already missed before activation cannot bypass this boundary through a freshly generated due event. Future appointments can still notify when they fall due. Existing job snapshots, failed or unknown receipts are neither rewritten nor replayed. Historical failures remain visible. Rescheduling and task completion retain their existing revision and queued-notice cancellation checks.

Verify event creation, correct recipients, task deadline preservation, idempotent activation and absence of historical replay with a simulated channel before running live sends. A simulated receipt does not prove real group delivery. Do not switch a live shared channel to simulation just to test it; use the isolated test database. For local UI checks, pause the process worker temporarily and retire only explicitly identified test events before resuming, leaving stored channel configuration and historical queues intact.
