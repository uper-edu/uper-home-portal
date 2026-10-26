import {requestEvidenceId} from './taskManagement.ts';
import {customerReplied} from "./noResponse.ts";
import { fact } from "./trustWorkflow.ts";
import { sla, type Rule } from "./policy.ts";
import {
  calculateLeadTier,
  determineLevelState,
} from "../../src/types/leadSystem.ts";
import { randomUUID as id } from "node:crypto";
export type FollowupAction = "handoff" | "booking" | "enrollment";
export function leadTier(profile: any) {
  if (profile.tier && profile.tier !== "Unqualified") return profile.tier;
  if (!profile.goal || !profile.reportedLevel) return "Unqualified";
  return calculateLeadTier({
    buyingSignal: profile.buyingSignal || "None yet",
    currentStatus: profile.currentStatus || "Other",
    goal: profile.goal,
    levelState: determineLevelState(profile.reportedLevel),
    city: profile.city || "Other",
    mode: profile.mode || "Not sure",
  }).tier;
}
export function taskDeadline(
  profile: any,
  kind: string,
  settings: Rule & { hotHours: number; warmHours: number; coldHours: number },
  at = new Date(),
) {
  const tier = leadTier(profile);
  const hours =
    ["handoff", "booking", "enrollment"].includes(kind) || tier === "Hot"
      ? settings.hotHours
      : ["Cold-Nurture", "School"].includes(tier)
        ? settings.coldHours
        : settings.warmHours;
  if (!Number.isFinite(hours) || hours <= 0)
    throw Error("Invalid response deadline configuration");
  return {
    due: sla(at, hours, settings),
    snapshot: {
      kind,
      tier,
      hours,
      counting: "natural",
      timezone: settings.timezone,
      start: settings.start,
      end: settings.end,
      days: settings.days,
    },
  };
}
export function followupReply(
  lang: string,
  status: string,
  action: FollowupAction = "handoff",
) {
  const zh = lang.startsWith("zh"),
    en = lang.startsWith("en");
  if (status === "contact_required") {
    return zh
      ? "消息已保存。请登记联系信息后提交顾问跟进；当前没有在线人工坐席接入。"
      : en
        ? "Message saved. Register contact details to request advisor follow-up. No live agent has joined."
        : "Pesan tersimpan. Isi kontak untuk tindak lanjut konsultan. Belum ada admin manusia yang bergabung.";
  }
  if (status === "completed") {
    return zh
      ? "消息已保存，该跟进事项已完成。可提交新的跟进申请。"
      : en
        ? "Message saved. This follow-up task is completed. You can submit a new request."
        : "Pesan tersimpan. Tindak lanjut ini telah selesai. Anda dapat mengirim permintaan baru.";
  }
  if (action === "booking") {
    return zh
      ? "预约请求已记录，等待顾问确认安排；当前尚未确认具体预约。"
      : en
        ? "Booking request recorded. Awaiting advisor follow-up; no appointment has been confirmed yet."
        : "Permintaan janji temu tercatat. Menunggu tindak lanjut konsultan; jadwal belum dikonfirmasi.";
  }
  if (action === "enrollment") {
    return zh
      ? "报名意向已记录，等待顾问跟进；当前尚未完成报名或付款。"
      : en
        ? "Enrollment interest recorded. Awaiting advisor follow-up; enrollment and payment are not completed."
        : "Minat pendaftaran tercatat. Menunggu tindak lanjut konsultan; pendaftaran dan pembayaran belum selesai.";
  }
  return zh
    ? "消息和顾问跟进请求已保存，等待顾问联系。当前不是实时人工聊天，可继续向 AI 咨询。"
    : en
      ? "Message and advisor follow-up request saved. Awaiting contact; this is not live agent chat. You can continue consulting AI."
      : "Pesan dan permintaan tindak lanjut tersimpan. Menunggu konsultan; ini bukan obrolan langsung dengan admin. Anda dapat melanjutkan konsultasi dengan AI.";
}

export async function ensureFollowup(
  db: any,
  conversation: any,
  action: FollowupAction,
  messageId: string,
  lang: string,
  evidenceOnly = false,
) {
  const { event } = await import("./store.ts");
  if (!conversation.lead_id)
    return {
      taskId: null,
      taskOperation: undefined,
      status: "contact_required",
      reply: followupReply(lang, "contact_required", action),
    };
  // Serialize all incoming requests for this customer before checking retries.
  const profile=(await db.query("SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE",[conversation.lead_id])).rows[0].profile;
  const key=requestEvidenceId(conversation.lead_id,conversation.id,messageId,action);
  const prior=(await db.query("SELECT * FROM crm_engagements WHERE id=:p1 AND lead_id=:p2",[key,conversation.lead_id])).rows[0];
  const old=(await db.query("SELECT data FROM crm_facts WHERE lead_id=:p1 AND kind='task.request_evidence' AND data->>'$.messageId'=:p2 AND data->>'$.conversationId'=:p3 AND data->>'$.action'=:p4 LIMIT 1",[conversation.lead_id,messageId,conversation.id,action])).rows[0];
  if(prior||old)return {taskId:prior?(Object.hasOwn(prior.data,'receiptTaskId')?prior.data.receiptTaskId:prior.task_id):old?.data?.taskId||null,taskOperation:prior?.data.receiptOperation||'recorded',status:'awaiting_advisor',reply:followupReply(lang,'awaiting_advisor',action)};
  const original=(await db.query("SELECT created_at,content FROM messages WHERE conversation_id=:p1 AND (id=:p2 OR request_id=:p2) AND role='user' ORDER BY created_at LIMIT 1",[conversation.id,messageId])).rows[0];
  if(!evidenceOnly)await customerReplied(db,conversation.lead_id,key,original?.created_at);
  const taskId=null, taskOperation='recorded';
  await db.query("INSERT INTO crm_engagements(id,lead_id,kind,source_id,data,state,task_id) VALUES(:p1,:p2,'task_request',:p3,:p4,:p5,:p6)",[key,conversation.lead_id,messageId,{action,receiptTaskId:taskId,receiptOperation:taskOperation,conversationId:conversation.id,messageId,text:original?.content||'',source:conversation.source},taskId?'linked':'pending',taskId]);
  await event(db,action==='handoff'?'handoff.requested':action==='booking'?'booking.requested':'enrollment.requested',conversation.lead_id,{...(taskId?{taskId}:{}),requestEvidenceId:key,source:conversation.source,conversationId:conversation.id,messageId});
  await fact(db,conversation.lead_id,'task.request_evidence','visitor',{taskId,requestEvidenceId:key,conversationId:conversation.id,messageId,action,taskOperation});
  return {taskId,taskOperation,status:'awaiting_advisor',reply:followupReply(lang,'awaiting_advisor',action)};
}

/** A staff-recorded customer request has its own original evidence, never a fabricated chat. */
export async function recordSalesAdvisorRequest(db:any,job:any,observation:any){
 const {event}=await import('./store.ts');
 const key=requestEvidenceId(job.lead_id,'sales_record',job.source_id,'handoff');
 const prior=(await db.query('SELECT id FROM crm_engagements WHERE id=:p1 AND lead_id=:p2',[key,job.lead_id])).rows[0];
 if(prior)return;
 const data={action:'handoff',receiptTaskId:null,receiptOperation:'recorded',sourceType:'sales_record',sourceRecordId:job.source_id,text:observation.quote,occurredAt:job.input.occurredAt,source:'sales_record'};
 await db.query("INSERT INTO crm_engagements(id,lead_id,kind,source_id,data,state,task_id) VALUES(:p1,:p2,'task_request',:p3,:p4,'pending',NULL)",[key,job.lead_id,job.source_id,data]);
 await fact(db,job.lead_id,'task.request_evidence',job.input.actor,{...data,taskId:null,requestEvidenceId:key,taskOperation:'recorded'});
 await event(db,'handoff.requested',job.lead_id,{requestEvidenceId:key,source:'sales_record',sourceRecordId:job.source_id});
}
