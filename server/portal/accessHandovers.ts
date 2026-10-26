import {pendingIdentity} from './identityReview.ts';
import {loadCrmAccessControls} from './crmAccessControls.ts';
import {isCrmManager} from '../../src/utils/crmOutreach.ts';
import crypto from "node:crypto";
import { pool, tx, event } from "./store.ts";
import { platform } from "./identity.ts";
import {
  eligibleOwner,
  permittedRecord,
  projectEmployee,
} from "../../src/utils/accessControl.ts";

export async function accessDirectory(c: any) {
  const roles = (await c.query("SELECT * FROM access_roles ORDER BY id")).rows;
  return (
    await c.query("SELECT * FROM crm_users ORDER BY display_name")
  ).rows.map((u: any) => projectEmployee(u, roles));
}
export async function handoverItems(c: any, userId: string) {
  const employee = (await accessDirectory(c)).find((u: any) => u.id === userId);
  const leads = (await c.query("SELECT * FROM portal_leads")).rows;
  const usable = (profile: any) =>
    employee &&
    employee.active &&
    eligibleOwner(employee) &&
    permittedRecord(employee, profile, "crm.read") &&
    permittedRecord(employee, profile, "crm.followup");
  return {
    leads: leads.filter(
      (l: any) => l.profile.owner === userId && !usable(l.profile),
    ),
    tasks: (
      await c.query(
        "SELECT * FROM followup_tasks WHERE owner_id=:p1 AND status IN ('open','overdue','migration_hold')",
        [userId],
      )
    ).rows.filter((task: any) => {
      const lead = leads.find((l: any) => l.id === task.lead_id);
      return !lead || !usable(lead.profile);
    }),
  };
}
export async function reconcileHandovers(c: any, before: any[], cause: any) {
  for (const next of await accessDirectory(c)) {
    const prior = before.find((u) => u.id === next.id);
    const abilities = (u: any) => JSON.stringify([u.active, u.grants]);
    if (!prior || abilities(prior) === abilities(next)) continue;
    const items = await handoverItems(c, next.id);
    if (!items.leads.length && !items.tasks.length) continue;
    const existing = (
      await c.query(
        "SELECT * FROM access_handovers WHERE user_id=:p1 AND state='pending' FOR UPDATE",
        [next.id],
      )
    ).rows[0];
    if (existing)
      await c.query(
        "UPDATE access_handovers SET causes=:p2,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=:p1",
        [existing.id, JSON.stringify([...existing.causes, cause])],
      );
    else
      await c.query(
        "INSERT INTO access_handovers(id,user_id,causes) VALUES(:p1,:p2,:p3)",
        [crypto.randomUUID(), next.id, JSON.stringify([cause])],
      );
    await c.query(
      "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'access.handover.required',:p2)",
      [
        cause.actor,
        JSON.stringify({
          userId: next.id,
          customerCount: items.leads.length,
          taskCount: items.tasks.length,
          operationId: cause.operationId,
        }),
      ],
    );
  }
}
const deny = (status: number, message: string): never => {
  throw Object.assign(Error(message), { status });
};
export function mountAccessHandovers(app: any) {
  const wrap = (fn: any) => (q: any, r: any) =>
    Promise.resolve(fn(q, r)).catch((e: any) =>
      r
        .status(e.status || 503)
        .json({ error: e.status ? e.message : "access_unavailable" }),
    );
  app.get(
    ["/api/admin/access/handovers", "/api/crm/access-handovers"],
    wrap(async (q: any, r: any) => {
      const actor = await platform.authenticate(q);
      if (!actor) deny(401, "Login required");
      if (
        !actor.permissions.includes(
          q.path.startsWith("/api/admin") ? "access.read" : "crm.assign",
        )
      )
        deny(403, "Permission denied");
      const cases = (
        await pool.query(
          "SELECT * FROM access_handovers ORDER BY created_at DESC",
        )
      ).rows;
      const result = [];
      const timezone =
        (await pool.query("SELECT value FROM portal_settings WHERE id='sla'"))
          .rows[0]?.value.timezone || "Asia/Jakarta";
      for (const item of cases) {
        const affected = await handoverItems(pool, item.user_id);
        const details =
          actor.permissions.includes("crm.assign") &&
          actor.permissions.includes("crm.read");
        const leads = details
          ? affected.leads.filter(
              (l: any) =>
                permittedRecord(actor, l.profile, "crm.assign") &&
                permittedRecord(actor, l.profile, "crm.read"),
            )
          : [];
        const allLeads = (await pool.query("SELECT * FROM portal_leads")).rows;
        const tasks = details
          ? affected.tasks.filter((t: any) => {
              const l = allLeads.find((l: any) => l.id === t.lead_id);
              return (
                l &&
                permittedRecord(actor, l.profile, "crm.assign") &&
                permittedRecord(actor, l.profile, "crm.read")
              );
            })
          : [];
        if (
          q.path.startsWith("/api/crm") &&
          !leads.length &&
          !tasks.length &&
          affected.leads.length + affected.tasks.length
        )
          continue;
        result.push({
          timezone,
          id: item.id,
          userId: item.user_id,
          revision: Number(item.revision),
          state:
            affected.leads.length + affected.tasks.length
              ? "pending"
              : item.state,
          customerCount: details ? leads.length : affected.leads.length,
          taskCount: details ? tasks.length : affected.tasks.length,
          remainingTotal:
            actor.permissions.includes("access.read") || actor.scope === "all"
              ? affected.leads.length + affected.tasks.length
              : undefined,
          causes: item.causes,
          leads: leads.map((l: any) => ({
            id: l.id,
            name:
              l.profile.fullName ||
              l.profile.name ||
              l.profile.studentName ||
              l.id,
            owner: l.profile.owner,
            fingerprint: crypto
              .createHash("sha256")
              .update(JSON.stringify(l.profile))
              .digest("hex"),
          })),
          tasks: tasks.map((t: any) => ({
            id: t.id,
            leadId: t.lead_id,
            kind: t.kind,
            status: t.status,
            dueAt: t.due_at,
            owner: t.owner_id,
          })),
        });
      }
      r.setHeader("Cache-Control", "no-store");
      r.json(result);
    }),
  );
  app.post(
    "/api/crm/access-handovers/:id",
    wrap(async (q: any, r: any) => {
      const result = await tx(async (c: any) => {
        const actor = await platform.authenticate(q);
        if (!actor) deny(401, "Login required");
        if (!actor.permissions.includes("crm.assign"))
          deny(403, "Permission denied");
        const b = q.body;
        if(Array.isArray(b.leads)&&b.leads.length&&(await loadCrmAccessControls(c)).ownerAssignmentManagerOnly&&!isCrmManager(actor))deny(403,"OWNER_MANAGER_REQUIRED");
        if (
          typeof b.reason !== "string" ||
          !b.reason.trim() ||
          b.reason.length > 500
        )
          deny(400, "access_reason_required");
        const h = (
          await c.query(
            "SELECT * FROM access_handovers WHERE id=:p1 FOR UPDATE",
            [q.params.id],
          )
        ).rows[0];
        if (!h) deny(404, "access_handover_missing");
        if (Number(h.revision) !== b.revision) deny(409, "access_conflict");
        const items = await handoverItems(c, h.user_id);
        if (b.complete === true) {
          if (items.leads.length || items.tasks.length)
            deny(409, "access_handover_remaining");
        } else {
          if (
            !Array.isArray(b.leads) ||
            !Array.isArray(b.taskIds) ||
            b.leads.length + b.taskIds.length === 0 ||
            b.leads.length + b.taskIds.length > 100
          )
            deny(400, "access_handover_selection");
          const releaseToPool=b.targetId==='__shared_pool';
          if(releaseToPool&&(!isCrmManager(actor)||b.taskIds.length))deny(403,'CONTACT_PERMISSION_DENIED');
          const target = (await accessDirectory(c)).find(
            (u: any) => u.id === b.targetId,
          );
          if (!releaseToPool && (!target || !eligibleOwner(target)))
            deny(400, "access_handover_target");
          for (const selected of b.leads) {
            const l = (
              await c.query(
                "SELECT * FROM portal_leads WHERE id=:p1 FOR UPDATE",
                [selected.id],
              )
            ).rows[0];
            if (
              !l ||
              l.profile.owner !== h.user_id ||
              crypto
                .createHash("sha256")
                .update(JSON.stringify(l.profile))
                .digest("hex") !== selected.fingerprint ||
              !items.leads.some((x: any) => x.id === l.id)
            )
              deny(409, "access_conflict");
            if (
              !permittedRecord(actor, l.profile, "crm.assign") ||
              !permittedRecord(actor, l.profile, "crm.read")
            )
              deny(403, "Permission denied");
            if(!releaseToPool&&(await pendingIdentity(c,l.id,true)).length)deny(409,'IDENTITY_REVIEW_REQUIRED');
            const profile = {
              ...l.profile,
              owner: releaseToPool?null:target.id,
              ownerChangedAt: new Date().toISOString(),
            };
            if (
              !releaseToPool && (!permittedRecord(target, profile, "crm.read") ||
              !permittedRecord(target, profile, "crm.followup"))
            )
              deny(400, "access_handover_target");
            await c.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1", [
              l.id,
              profile,
            ]);
            if(releaseToPool)await c.query("UPDATE followup_tasks SET owner_id=:p2 WHERE lead_id=:p1 AND status IN ('open','overdue','migration_hold')",[l.id,null]);
            await event(c, "conversation.updated", l.id, {
              source: "crm_assignment",
              assignmentChanged: true,
            });
          }
          for (const taskId of new Set(b.taskIds)) {
            const t = (
              await c.query(
                "SELECT * FROM followup_tasks WHERE id=:p1 FOR UPDATE",
                [taskId],
              )
            ).rows[0];
            const l =
              t &&
              (
                await c.query(
                  "SELECT * FROM portal_leads WHERE id=:p1 FOR UPDATE",
                  [t.lead_id],
                )
              ).rows[0];
            if (
              !t ||
              !l ||
              !items.tasks.some((x: any) => x.id === t.id) ||
              t.owner_id !== h.user_id ||
              !["open", "overdue", "migration_hold"].includes(t.status)
            )
              deny(409, "access_conflict");
            if (
              !permittedRecord(actor, l.profile, "crm.assign") ||
              !permittedRecord(actor, l.profile, "crm.read")
            )
              deny(403, "Permission denied");
            if (
              !permittedRecord(target, l.profile, "crm.read") ||
              !permittedRecord(target, l.profile, "crm.followup")
            )
              deny(400, "access_handover_target");
            await c.query(
              "UPDATE followup_tasks SET owner_id=:p2 WHERE id=:p1",
              [t.id, target.id],
            );
          }
        }
        const remaining = await handoverItems(c, h.user_id);
        await c.query(
          "UPDATE access_handovers SET state=:p2,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=:p1",
          [h.id, b.complete ? "completed" : "pending"],
        );
        await c.query(
          "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'access.handover.update',:p2)",
          [
            actor.id,
            JSON.stringify({
              id: h.id,
              reason: b.reason,
              targetId: b.targetId,
              leads: b.leads?.map((x: any) => x.id),
              taskIds: b.taskIds,
              complete: !!b.complete,
            }),
          ],
        );
        return {
          remainingCustomers: remaining.leads.length,
          remainingTasks: remaining.tasks.length,
          revision: Number(h.revision) + 1,
          completed: !!b.complete,
        };
      });
      r.json(result);
    }),
  );
}
