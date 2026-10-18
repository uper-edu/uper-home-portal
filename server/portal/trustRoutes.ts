import { permittedRecord } from "../../src/utils/accessControl.ts";
import { allowed } from "./identity.ts";
import {
  fact,
  operation,
  lockLead,
  taskCommand,
  invalid,
  stageFact,
} from "./trustWorkflow.ts";
export function mountTrustRoutes(
  app: any,
  { wrap, leadAccess, requestAllowed }: any,
) {
  app.get(
    "/api/crm/leads/:id/trust",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req);
      const { pool } = await import("./store.ts");
      const facts = (
        await pool.query(
          "SELECT * FROM crm_facts WHERE lead_id=:p1 ORDER BY created_at DESC,id DESC",
          [l.id],
        )
      ).rows;
      const tasks = (
        await pool.query(
          "SELECT * FROM followup_tasks WHERE lead_id=:p1 ORDER BY due_at,id",
          [l.id],
        )
      ).rows;
      const engagements = (
        await pool.query(
          "SELECT * FROM crm_engagements WHERE lead_id=:p1 ORDER BY created_at DESC",
          [l.id],
        )
      ).rows;
      const candidates = (
        await pool.query(
          "SELECT i.*,l.profile FROM identity_candidates i JOIN portal_leads l ON l.id=i.candidate_id WHERE i.lead_id=:p1",
          [l.id],
        )
      ).rows
        .filter((r: any) => requestAllowed(e, r.profile, req, "crm.read"))
        .map(({ profile, visitor_id, ...r }: any) => ({
          ...r,
          name: profile.fullName || profile.name,
          canConfirm: e.grants
            ? permittedRecord(e, profile, "crm.followup")
            : allowed(e, profile, "write"),
        }));
      res.json({ facts, tasks, engagements, candidates });
    }),
  );
  app.get(
    "/api/crm/leads/:id/operations/:requestId",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req);
      const { pool } = await import("./store.ts");
      const prior = (
        await pool.query(
          "SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2",
          [e.id, req.params.requestId],
        )
      ).rows[0];
      if (prior?.result.leadId === l.id) return res.json(prior.result);
      const log = (l.profile.followUpLogs || []).find(
        (v: any) => v.requestId === req.params.requestId && v.actor === e.id,
      );
      if (log) return res.json({ saved: true, leadId: l.id, ...log.result });
      invalid("Operation not found", 404);
    }),
  );
  app.post(
    "/api/crm/leads/:id/task-actions",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req, "crm.write");
      const { tx } = await import("./store.ts");
      const result = await tx((c: any) =>
        taskCommand(c, l.id, e.id, req.body, (p: any) =>
          requestAllowed(e, p, req),
        ),
      );
      res.json(result);
    }),
  );
  app.post(
    "/api/crm/leads/:id/stage",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req, "crm.write");
      const { tx } = await import("./store.ts");
      res.json(
        await tx(async (c: any) => {
          const current = await lockLead(c, l.id, (p: any) =>
            requestAllowed(e, p, req),
          );
          return operation(c, e.id, req.body, async () => {
            const b = req.body;
            if (
              ![
                "New",
                "Contacted",
                "Assessment Booked",
                "Assessment Done",
                "Trial Booked",
                "Trial Attended",
                "Enrolled",
                "Lost",
              ].includes(b.newStage)
            )
              invalid("Invalid sales stage");
            await stageFact(c, l.id, e.id, current, b, b.reason);
            const lead = {
              ...current,
              currentStage: b.newStage,
              stageRevision:
                b.newStage === current.currentStage
                  ? current.stageRevision || 0
                  : (current.stageRevision || 0) + 1,
              stageUpdatedAt:
                b.newStage === current.currentStage
                  ? current.stageUpdatedAt
                  : new Date().toISOString(),
            };
            await c.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1", [
              l.id,
              lead,
            ]);
            return { saved: true, leadId: l.id, lead };
          });
        }),
      );
    }),
  );
  app.post(
    "/api/crm/leads/:id/information",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req, "crm.write");
      const { tx } = await import("./store.ts");
      res.json(
        await tx(async (c: any) => {
          await lockLead(c, l.id, (p: any) => requestAllowed(e, p, req));
          return operation(c, e.id, req.body, async () => {
            if (
              typeof req.body.summary !== "string" ||
              !req.body.summary.trim() ||
              req.body.summary.length > 20000
            )
              invalid("Information text required");
            const id = crypto.randomUUID();
            await fact(c, l.id, "information.recorded", e.id, {
              id,
              summary: req.body.summary.trim(),
            });
            return { saved: true, leadId: l.id, informationId: id };
          });
        }),
      );
    }),
  );
  app.post(
    "/api/crm/leads/:id/engagement-actions",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req, "crm.write");
      const { tx } = await import("./store.ts");
      res.json(
        await tx(async (c: any) => {
          await lockLead(c, l.id, (p: any) => requestAllowed(e, p, req));
          return operation(c, e.id, req.body, async () => {
            const b = req.body;
            const selected = b.engagements || [
              { id: b.engagementId, version: b.version },
            ];
            if (
              !Array.isArray(selected) ||
              !selected.length ||
              selected.length > 1000 ||
              new Set(selected.map((v: any) => v.id)).size !== selected.length
            )
              invalid("Information changed; refresh and review", 409);
            if (!b.reason?.trim() || !["dismiss", "link"].includes(b.command))
              invalid("Action and reason required");
            if (
              b.command === "link" &&
              !(
                await c.query(
                  "SELECT id FROM followup_tasks WHERE id=:p1 AND lead_id=:p2 AND status IN ('open','overdue')",
                  [b.taskId, l.id],
                )
              ).rows.length
            )
              invalid("Task not found", 404);
            for (const selection of selected) {
              const row = (
                await c.query(
                  "SELECT * FROM crm_engagements WHERE id=:p1 AND lead_id=:p2 FOR UPDATE",
                  [selection.id, l.id],
                )
              ).rows[0];
              if (
                !row ||
                row.state !== "pending" ||
                row.version !== selection.version
              )
                invalid("Information changed; refresh and review", 409);
              await c.query(
                "UPDATE crm_engagements SET state=:p2,task_id=:p3,version=version+1 WHERE id=:p1",
                [
                  row.id,
                  b.command === "link" ? "linked" : "dismissed",
                  b.command === "link" ? b.taskId : null,
                ],
              );
              await fact(c, l.id, "engagement." + b.command, e.id, {
                engagementId: row.id,
                taskId: b.taskId,
                reason: b.reason,
              });
            }
            return { saved: true, leadId: l.id };
          });
        }),
      );
    }),
  );
  app.post(
    "/api/crm/leads/:id/identity-actions",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req, "crm.write");
      const { tx } = await import("./store.ts");
      res.json(
        await tx(async (c: any) => {
          await lockLead(c, l.id, (p: any) => requestAllowed(e, p, req));
          return operation(c, e.id, req.body, async () => {
            const b = req.body;
            await lockLead(c, b.candidateId, (p: any) =>
              requestAllowed(e, p, req),
            );
            if (
              !b.reason?.trim() ||
              !["same", "different"].includes(b.decision)
            )
              invalid("Identity decision and reason required");
            const found = (
              await c.query(
                "SELECT * FROM identity_candidates WHERE lead_id=:p1 AND candidate_id=:p2 AND decision='pending' FOR UPDATE",
                [l.id, b.candidateId],
              )
            ).rows;
            if (!found.length)
              invalid("Identity candidate changed; refresh and review", 409);
            await c.query(
              "UPDATE identity_candidates SET decision=:p3,decided_by=:p4,reason=:p5,decided_at=UTC_TIMESTAMP(6) WHERE lead_id=:p1 AND candidate_id=:p2",
              [l.id, b.candidateId, b.decision, e.id, b.reason],
            );
            await fact(c, l.id, "identity." + b.decision, e.id, {
              candidateId: b.candidateId,
              reason: b.reason,
              scope: "relationship_only_no_record_or_owner_transfer",
            });
            return { saved: true, leadId: l.id };
          });
        }),
      );
    }),
  );
}
