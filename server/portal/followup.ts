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
) {
  const { event } = await import("./store.ts");
  if (!conversation.lead_id)
    return {
      taskId: null,
      taskOperation: undefined,
      status: "contact_required",
      reply: followupReply(lang, "contact_required", action),
    };
  const profile = (
    await db.query("SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE", [
      conversation.lead_id,
    ])
  ).rows[0].profile;
  let task = (
    await db.query(
      "SELECT * FROM followup_tasks WHERE lead_id=:p1 AND (request_key=:p2 OR kind=:p3) AND status IN ('open','overdue') ORDER BY created_at LIMIT 1 FOR UPDATE",
      [
        conversation.lead_id,
        conversation.id + ":" + action + ":" + messageId,
        action,
      ],
    )
  ).rows[0];
  const taskOperation = task ? "supplemented" : "created";
  if (!task) {
    const settings = (
      await db.query("SELECT value FROM portal_settings WHERE id='sla'")
    ).rows[0].value;
    const at = (await db.query("SELECT UTC_TIMESTAMP(6) AS at")).rows[0].at;
    const { due, snapshot } = taskDeadline(profile, action, settings, at);
    task = (
      await db.query(
        "INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,original_due_at,request_key,details) VALUES(:p1,:p2,:p3,:p4,:p5,:p5,:p6,:p7)",
        [
          id(),
          conversation.lead_id,
          action,
          profile.owner || null,
          due,
          conversation.id + ":" + action + ":" + messageId,
          { sourceConversationId: conversation.id, sourceMessageId: messageId },
        ],
      )
    ).rows[0];
    await event(
      db,
      action === "handoff"
        ? "handoff.requested"
        : action === "booking"
          ? "booking.requested"
          : "enrollment.requested",
      conversation.lead_id,
      {
        taskId: task.id,
        source: conversation.source,
        conversationId: conversation.id,
        messageId,
        sla: snapshot,
      },
    );
  }
  await fact(db, conversation.lead_id, "task.request_evidence", "visitor", {
    taskId: task.id,
    conversationId: conversation.id,
    messageId,
    action,
    taskOperation,
  });
  return {
    taskOperation,
    taskId: task.id,
    status: "awaiting_advisor",
    reply: followupReply(lang, "awaiting_advisor", action),
  };
}
