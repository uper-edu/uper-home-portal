import {assertIdentitySalesAllowed} from './identityConsolidation.ts';
import {
  attendanceInput,
  linkedParticipationCampaign,
  supportsParticipationRecord,
} from "../../src/utils/crmParticipation.ts";
import { invalid } from "./trustWorkflow.ts";

/** Keep the existing row lock and audit-based idempotency; no tasks or notifications. */
export async function saveAttendance(
  c: any,
  leadId: string,
  actor: string,
  body: any,
  campaigns: any[],
  canWrite: (profile: any) => boolean,
  clock = new Date(),
) {
  const input = attendanceInput(body);
  const current = (
    await c.query("SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE", [
      leadId,
    ])
  ).rows[0]?.profile;
  if (!current || !canWrite(current)) invalid("Lead not found", 404);
  await assertIdentitySalesAllowed(c,leadId);
  const previous = (
    await c.query(
      "SELECT data FROM portal_audit WHERE action='attendance.record' AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data,'$.id')),'null')=:p1 AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId')),'null')=:p2",
      [leadId, body.requestId],
    )
  ).rows[0]?.data;
  if (previous) {
    if (
      !Object.keys(input).every(
        (key) => previous.input[key] === (input as any)[key],
      )
    )
      invalid("Attendance request conflict", 409);
    return current;
  }
  const campaign = linkedParticipationCampaign(current, campaigns);
  if (!campaign || campaign.id !== input.campaignId)
    invalid(
      "Source campaign changed. Reopen the customer before recording participation.",
      409,
    );
  const priorRecord = current.attendanceRecords?.find(
    (record: any) => record.campaignId === campaign.id,
  );
  if (input.confirmed && !supportsParticipationRecord(campaign))
    invalid("The source campaign does not support participation records");
  if (!input.confirmed && !priorRecord?.confirmed)
    invalid("No participation confirmation to withdraw");
  const record = {
    ...input,
    recordedAt: clock.toISOString(),
    actor,
  };
  const next = {
    ...current,
    attendanceRecords: [
      ...(current.attendanceRecords || []).filter(
        (record: any) => record.campaignId !== input.campaignId,
      ),
      record,
    ],
  };
  await c.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1", [
    leadId,
    next,
  ]);
  await c.query(
    "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'attendance.record',:p2)",
    [actor, { id: leadId, requestId: body.requestId, input }],
  );
  return next;
}
