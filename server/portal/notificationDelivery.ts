import {LARK_DEFAULT_MAX_PER_HOUR} from '../../src/utils/larkNotificationDefaults.ts';
import {larkNotificationColor} from '../../src/utils/larkNotificationColors.ts';
import {notificationDestination,type NotificationTargetKind} from '../../src/utils/crmNotificationTarget.ts';
import crypto from "node:crypto";
import {dailyDigestPreview,type DailyDigestInput} from '../../src/utils/larkDailyDigest.ts';
import {larkNotificationPreview,type LarkCardInput} from '../../src/utils/larkNotificationPresentation.ts';
import { permittedRecord } from "../../src/utils/accessControl.ts";
import { allowed, type Employee } from "./identity.ts";
import type { Rule } from "./policy.ts";
export const CRM_LEADER_ROLE = "crm_leader";
export function resolveRecipients(
  rule: Rule,
  lead: any,
  employees: Employee[],
  leadId?: string,
) {
  if (!leadId || rule.event === "notification.failed")
    return {
      ids: employees
        .filter(
          (e) =>
            e.active &&
            (e.grants
              ? e.permissions.includes("crm.leader")
              : e.roles?.includes(CRM_LEADER_ROLE)) &&
            e.permissions.includes(
              e.grants ? "notifications.read" : "notifications.manage",
            ) &&
            (rule.event !== "daily.digest" ||
              (e.grants
                ? e.grants["crm.read"]?.includes("all")
                : e.scope === "all")),
        )
        .map((e) => e.id),
      reason: "operations_to_crm_leaders",
    };
  const profile = { ...lead, team: lead?.team || "sales" };
  const visible = employees.filter(
    (e) =>
      e.active === true &&
      e.permissions.includes("crm.read") &&
      !(rule.event === "daily.digest" && e.scope === "own") &&
      (!leadId || allowed(e, profile)),
  );
  if (leadId) {
    const owner = visible.find(
      (e) =>
        e.id === profile.owner &&
        (!e.grants ||
          ((e.permissions.includes("crm.own") ||
            e.permissions.includes("crm.leader")) &&
            permittedRecord(e, profile, "crm.followup"))),
    );
    if (owner) return { ids: [owner.id], reason: "valid_owner" };
    const leaders = visible.filter(
      (e) =>
        (e.grants
          ? e.permissions.includes("crm.leader")
          : e.roles?.includes(CRM_LEADER_ROLE)) &&
        e.permissions.includes("crm.assign") &&
        (!e.grants || permittedRecord(e, profile, "crm.assign")),
    );
    return {
      ids: leaders.map((e) => e.id),
      reason: leaders.length
        ? profile.owner
          ? "invalid_owner_to_crm_leader"
          : "unassigned_to_crm_leader"
        : "no_authorized_crm_leader",
    };
  }
  return { ids: [], reason: "no_authorized_crm_manager" };
}
export function recipients(
  rule: Rule,
  lead: any,
  employees: Employee[],
  leadId?: string,
) {
  return resolveRecipients(rule, lead, employees, leadId).ids;
}
export function priority(event: string, payload: any, lead: any) {
  return (
    payload.priority ||
    ([
      "handoff.requested",
      "booking.requested",
      "enrollment.requested",
      "task.overdue",
      "ai.failed",
      "notification.failed",
    ].includes(event) || lead.tier === "Hot"
      ? "urgent"
      : "normal")
  );
}
export function retryAfter(value: string | null, now: Date) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, (time - now.getTime()) / 1000) : 0;
}
export function validWebhook(value: string | undefined) {
  try {
    const u = new URL(value || "");
    return (
      u.protocol === "https:" &&
      u.hostname === "open.larksuite.com" &&
      !u.username &&
      !u.password &&
      !u.port &&
      /^\/open-apis\/bot\/v2\/hook\/[a-zA-Z0-9_-]+$/.test(u.pathname) &&
      !u.search &&
      !u.hash
    );
  } catch {
    return false;
  }
}
export function larkCard(
  text: string,
  leadId: string | undefined,
  secret: string | undefined,
  now: Date,
  target?:{kind:NotificationTargetKind;id:string},
  event='',
) {
  const url = new URL("/crm", process.env.APP_URL || "http://localhost:3000");
  if (leadId) url.searchParams.set("lead", leadId);
  if(target&&leadId)url.href=notificationDestination(url.origin,leadId,target).href;
  const body: any = {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: larkNotificationColor(event).template,
        title: {
          tag: "plain_text",
          content:
            "UPER · " +
            (process.env.PORTAL_DEPLOYMENT === 'company-trial' || process.env.PLATFORM_MODE === "mock" ||
            ["test","dev","local"].includes(process.env.APP_ENV || "")
              ? "TEST"
              : process.env.NODE_ENV || "DEV"),
        },
      },
      elements: [
        { tag: "div", text: { tag: "lark_md", content: text } },
        {
          tag: "action",
          actions: [
            {
              tag: "button",
              text: { tag: "plain_text", content: "CRM" },
              url: url.toString(),
              type: "primary",
            },
          ],
        },
      ],
    },
  };
  if (secret) {
    body.timestamp = String(Math.floor(now.getTime() / 1000));
    body.sign = crypto
      .createHmac("sha256", body.timestamp + "\n" + secret)
      .update("")
      .digest("base64");
  }
  return body;
}

/** Shared by the worker and explicitly authorized live template acceptance. */
export function standardLarkCard(input:LarkCardInput,leadId:string|undefined,secret:string|undefined,now:Date){
  const preview=larkNotificationPreview({...input,asOf:now.toISOString()});
  const body=larkCard('',leadId,secret,now,input.target,input.kind);
  body.card.header.template=larkNotificationColor(input.kind,input.failure).template;
  if(leadId&&!input.target){const fallback=new URL(body.card.elements[1].actions[0].url);fallback.searchParams.set('tab','leads');fallback.searchParams.set('leadView',input.kind==='assessment.completed'?'assessment':input.kind==='lead.created'?'profile':['ai.failed','conversation.reactivated'].includes(input.kind)?'chat':'activities');body.card.elements[1].actions[0].url=fallback.toString();}
  body.card.header.title.content+=' · '+preview.title;
  body.card.elements[0]={tag:'div',text:{tag:'plain_text',content:[...preview.rows.map(row=>row.label+(input.language==='zh'?'：':': ')+row.value),...(preview.note?[preview.note]:[])].join('\n')}};
  const buttonLabels:Record<string,[string,string,string]>={
    'commitment.due':['查看客户约定','View agreement','Lihat kesepakatan'],
    'lead.created':input.target?['查看登记依据','View registration source','Lihat sumber pendaftaran']:['查看客户资料','View customer profile','Lihat profil pelanggan'],
    'assessment.completed':input.target?['查看本次测评','View this assessment','Lihat asesmen ini']:['查看测评页','View assessments','Lihat asesmen'],
    'handoff.requested':input.target?['查看请求依据','View request evidence','Lihat bukti permintaan']:['查看客户','View customer','Lihat pelanggan'],
    'booking.requested':input.target?['查看请求依据','View request evidence','Lihat bukti permintaan']:['查看客户','View customer','Lihat pelanggan'],
    'enrollment.requested':input.target?['查看请求依据','View request evidence','Lihat bukti permintaan']:['查看客户','View customer','Lihat pelanggan'],
    'conversation.reactivated':input.target?['查看本次会话','View this conversation','Lihat percakapan ini']:['查看客户对话','View conversations','Lihat percakapan'],
    'task.overdue':input.target?['查看联系要求','View contact requirement','Lihat kewajiban kontak']:['查看客户','View customer','Lihat pelanggan']};
  const labels=buttonLabels[input.kind];body.card.elements[1].actions[0].text.content=labels?labels[input.language==='zh'?0:input.language==='id'?2:1]:input.language==='zh'?'查看客户':input.language==='id'?'Lihat pelanggan':'View customer';
  if(input.kind==='notification.failed'||input.kind==='ai.failed'){
    const url=new URL('/crm',process.env.APP_URL||'http://localhost:3000');
    if(input.kind==='ai.failed'&&leadId){url.href=notificationDestination(url.origin,leadId,input.target).href;url.searchParams.set('tab','leads');url.searchParams.set('lead',leadId);url.searchParams.set('leadView','chat');}
    else {url.searchParams.set('tab','policy');url.searchParams.set('policyTopic','notification-jobs');if(input.jobId)url.searchParams.set('job',input.jobId);}
    body.card.elements[1].actions[0].url=url.toString();
    body.card.elements[1].actions[0].text.content=input.kind==='ai.failed'&&leadId?(input.target?(input.language==='zh'?'查看失败回复':input.language==='id'?'Lihat balasan gagal':'View failed reply'):(input.language==='zh'?'查看客户对话':input.language==='id'?'Lihat percakapan':'View conversation')):(input.language==='zh'?'查看发送记录':input.language==='id'?'Lihat catatan pengiriman':'View delivery record');
  }
  return body;
}

export function dailyDigestCard(input:DailyDigestInput,secret:string|undefined,now:Date){
  const preview=dailyDigestPreview(input),body=larkCard('',undefined,secret,now,undefined,'daily.digest');
  body.card.header.title.content+=' · '+preview.title;
  body.card.elements[0]={tag:'div',text:{tag:'plain_text',content:[...preview.rows.map(r=>r.label+(input.language==='zh'?'：':': ')+r.value),preview.note].join('\n')}};
  body.card.elements[1].actions[0].text.content=input.language==='zh'?'查看客户列表':input.language==='id'?'Lihat daftar pelanggan':'View customer list';
  if(input.jobId){const url=new URL(body.card.elements[1].actions[0].url);url.searchParams.set('tab','leads');url.searchParams.set('digestJob',input.jobId);body.card.elements[1].actions[0].url=url.toString();}
  return body;
}

export function channelConnection(id: string, config: any) {
  const webhookConfigured = validWebhook(process.env[config.secretRef]);
  const signingSecretConfigured =
    !(config.signingEnabled ?? !!config.signingSecretRef) ||
    !!process.env[config.signingSecretRef];
  const testMode =
    process.env.PORTAL_DEPLOYMENT === 'company-trial' ||
    process.env.PLATFORM_MODE === "mock" ||
    process.env.APP_ENV === "test" ||
    process.env.NODE_ENV !== "production";
  const designatedTestGroup = process.env.LARK_TEST_GROUP === id;
  const status =
    config.mode !== "live"
      ? "simulation"
      : !webhookConfigured
        ? "missing_webhook"
        : !signingSecretConfigured
          ? "missing_signing_secret"
          : testMode && !designatedTestGroup
            ? "test_group_blocked"
            : "configured";
  return {
    status,
    webhookConfigured,
    signingSecretConfigured,
    designatedTestGroup,
    realReceiptVerified: false,
  };
}

// Legacy policies may disagree. Until the channel is explicitly configured,
// use the strictest historical policy/snapshot limit for this group.
export async function groupRateLimit(
  db: { query: Function },
  group: string,
  config: any,
) {
  if (
    Number.isInteger(config?.maxPerHour) &&
    config.maxPerHour >= 0 &&
    config.maxPerHour <= 10080
  )
    return { maxPerHour: config.maxPerHour, source: "channel" };
  const rows = (
    await db.query(
      "SELECT JSON_EXTRACT(config,'$.maxPerHour') AS value FROM notification_rules WHERE NULLIF(JSON_UNQUOTE(JSON_EXTRACT(config,'$.group')),'null')=:p1 AND JSON_CONTAINS(JSON_EXTRACT(config,'$.channels'),JSON_QUOTE('lark')) UNION ALL SELECT JSON_EXTRACT(snapshot,'$.rule.maxPerHour') AS value FROM notification_jobs WHERE channel='lark' AND recipient=:p1",
      [group],
    )
  ).rows;
  const limits = rows
    .map((r: any) => r.value)
    .filter((v: any) => Number.isInteger(v) && v >= 0 && v <= 10080);
  return {
    maxPerHour: limits.length ? Math.min(...limits) : LARK_DEFAULT_MAX_PER_HOUR,
    source: limits.length ? "legacy_strictest" : "default",
  };
}
