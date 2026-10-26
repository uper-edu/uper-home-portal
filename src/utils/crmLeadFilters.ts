import {matchesLeadMetric,metricSelections} from './crmLeadAnalytics';
import {hasConfirmedEnrollment} from './crmEnrollment';
import {salesProgressStages,isClosedSalesStage,isSalesProgressStage} from './crmSalesProgress';
import {projectInteractionTimeline} from './crmInteractionTimeline';
import {contactOverview} from './crmContactOverview';
import { worklistIntents } from "./crmBuyingEvidence.ts";
import {needsHandling,contactPaused,needsTaskPlanning,contactStatistics} from "./crmContact.ts";
import {
  DEFAULT_CRM_POLICY_CONFIG,
  type CrmPolicyConfig,
} from "../types/crmPolicyConfig.ts";
export type FilterOption = readonly [string, string, string];
export const filterDimensions = {
  tier: {
    en: "Customer group",
    zh: "客户分组",
    options: [
      ["Hot", "High intent", "高意向"],
      ["Warm-Offline", "Medium intent · offline", "中意向 · 线下"],
      ["Warm-Online", "Medium intent · online", "中意向 · 线上"],
      ["School", "School partnership", "院校合作"],
      ["Cold-Nurture", "Nurture", "培育池"],
      ["__unknown", "Not assessed", "未评估"],
    ],
  },
  stage: {
    en: "Sales stage",
    zh: "销售阶段",
    options: [
      ...salesProgressStages.map(([value,zh,en])=>[value,en,zh] as const),
      ["__unknown", "Not recorded", "未填写"],
    ],
  },
  connect: {
    en: "Latest sales contact result",
    zh: "最近销售联系结果",
    options: [
      ["Connected", "Connected / replied", "已接通／已回复"],
      ["No Response", "Unanswered / no reply", "未接通／未回复"],
      ["Wrong Number", "Invalid number", "号码异常"],
      ["__unknown", "Not recorded", "暂无销售联系记录"],
    ],
  },
  situation: {
    en: "Follow-up situation",
    zh: "跟进情形",
    options: [
      ["first_contact", "No sales contact recorded", "尚无销售联系"],
      ["stale", "Long time without a contact attempt", "长期未尝试联系"],
      ["retry", "Latest unanswered contact, no later conversation", "销售联系未回复且之后无有效沟通"],
    ],
  },
  mode: {
    en: "Learning format",
    zh: "授课方式",
    options: [
      ["Offline", "Offline", "线下"],
      ["Online", "Online", "线上"],
      ["Not sure", "Undecided", "尚未确定"],
      ["__unknown", "Not recorded", "未填写"],
    ],
  },
  signal: {
    en: "Customer request / interest",
    zh: "客户诉求／意向",
    options: [
      ["Asked price", "Asked about tuition", "咨询学费"],
      ["Asked schedule", "Asked about schedule", "咨询课程时间"],
      ["Asked payment", "Asked about payment", "咨询付款方式"],
      ["Ready to enroll", "Ready to enroll", "准备报名"],
      ["Booking requested", "Trial booking requested", "请求预约试听"],
      ["Advisor requested", "Advisor requested", "请求顾问联系"],
      ["Assessment interest", "Assessment interest", "测评意向"],
      ["Trial interest", "Trial interest", "试听意向"],
      ["Enrollment interest", "Enrollment interest", "报名意向"],
      ["Which level is right", "Asked about suitable level", "咨询适合级别"],
      ["__unknown", "Not recorded", "暂无有依据的诉求／意向"],
    ],
  },
} satisfies Record<string, { en: string; zh: string; options: FilterOption[] }>;
export type Dimension = keyof typeof filterDimensions;
export const dimensions = Object.keys(filterDimensions) as Dimension[];
export const taskOptions: FilterOption[] = [
  ["all", "Any", "不限"],
  ["pending", "First contact requirement pending", "首次联系未完成"],
  ["today", "Due today", "今天到期"],
  ["overdue", "Overdue", "已逾期"],
  ["none", "First contact completed or not required", "已完成或无首次联系要求"],
];
export interface LeadFilters {
  overview?:string[];
  workScope?: "action" | "all";
  ownership: "all" | "mine" | "unassigned" | "person";
  owner: string;
  task: string;
  search: string;
  sort: string;
  tier: string[];
  stage: string[];
  connect: string[];
  situation: string[];
  mode: string[];
  signal: string[];
}
export function defaultLeadFilters(scope: string): LeadFilters {
  return {
    workScope: "all",
    ownership: scope === "own" ? "mine" : "all",
    owner: "",
    task: "all",
    search: "",
    sort: "priority",
    tier: [],
    stage: [],
    connect: [],
    situation: [],
    mode: [],
    signal: [],
  };
}
export function filterQuery(f: LeadFilters) {
  const p = new URLSearchParams();
  p.set("workScope",f.workScope||"all");
  for(const value of f.overview||[])p.append("overview",value);
  p.set("ownership", f.ownership);
  if (f.owner) p.set("owner", f.owner);
  p.set("task", f.task);
  if (f.search.trim()) p.set("search", f.search.trim());
  p.set("sort", f.sort);
  for (const k of dimensions) for (const v of f[k]) p.append(k, v);
  return p.toString();
}
export function parseLeadFilters(q: Record<string, unknown>): LeadFilters {
  const f = defaultLeadFilters("all");
  const scalar = (k: string) =>
    typeof q[k] === "string" ? (q[k] as string) : "";
  f.ownership = (scalar("ownership") ||
    (Object.hasOwn(q, "owner")
      ? scalar("owner")
        ? "person"
        : "unassigned"
      : "all")) as LeadFilters["ownership"];
  f.workScope = (scalar("workScope") || "all") as "action" | "all";
  if(!["action","all"].includes(f.workScope))throw Error("Invalid lead filters");
  const overview=q.overview===undefined?[]:Array.isArray(q.overview)?q.overview:[q.overview];
  if(overview.length>Object.keys(metricSelections).length||overview.some(v=>typeof v!=='string'||!Object.hasOwn(metricSelections,v)))throw Error("Invalid lead filters");
  if(overview.length)f.overview=[...new Set(overview)] as string[];
  f.owner = scalar("owner");
  f.task = scalar("task") || "all";
  f.search = scalar("search").trim();
  f.sort = scalar("sort") || "newest";
  if (
    !["all", "mine", "unassigned", "person"].includes(f.ownership) ||
    !taskOptions.some((o) => o[0] === f.task) ||
    !["newest", "activity", "deadline", "priority"].includes(f.sort) ||
    f.search.length > 200
  )
    throw Error("Invalid lead filters");
  for (const k of dimensions) {
    const raw = q[k] === undefined ? [] : Array.isArray(q[k]) ? q[k] : [q[k]];
    if (
      raw.length > 20 ||
      raw.some(
        (v) =>
          typeof v !== "string" ||
          !filterDimensions[k].options.some((o) => o[0] === v),
      )
    )
      throw Error("Invalid lead filters");
    f[k] = [...new Set(raw)] as string[];
  }
  return f;
}
export function activeTasks(lead: any) {
  return (lead.attention?.tasks || []).filter((t: any) =>
    ["open", "overdue"].includes(t.status),
  );
}
export function isOverdueTask(t: any, now: number) {
  return (
    ["open", "overdue"].includes(t.status) &&
    Number.isFinite(Date.parse(t.dueAt)) &&
    Date.parse(t.dueAt) < now
  );
}
export function calendarDay(date: number, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function leadMatches(
  lead: any,
  f: LeadFilters,
  employeeId: string,
  timezone: string,
  now: number,
  config: CrmPolicyConfig = DEFAULT_CRM_POLICY_CONFIG,
) {
  if(f.overview?.some(key=>!matchesLeadMetric(lead,key,now)))return false;
  if (f.ownership === "mine" && lead.owner !== employeeId) return false;
  if (f.ownership === "unassigned" && lead.owner) return false;
  if (f.ownership === "person" && lead.owner !== f.owner) return false;
  if (
    f.search &&
    ![
      "fullName",
      "whatsapp",
      "phone",
      "email",
      "leadNumber",
      "businessNumber",
      "id",
    ].some((k) =>
      String(lead[k] || "")
        .toLocaleLowerCase()
        .includes(f.search.toLocaleLowerCase()),
    )
  )
    return false;
  const tasks = activeTasks(lead);
  const historical = (lead.attention?.tasks || []).some(
    (t: any) => t.status === "migration_hold",
  );
  if (f.task === "unplanned" && !needsTaskPlanning(lead,now)) return false;
  if (f.task === "pending" && !tasks.length) return false;
  if (f.task === "none" && (tasks.length || historical)) return false;
  if (f.task === "overdue" && !tasks.some((t: any) => isOverdueTask(t, now)))
    return false;
  if (
    f.task === "today" &&
    !tasks.some(
      (t: any) =>
        Number.isFinite(Date.parse(t.dueAt)) &&
        calendarDay(Date.parse(t.dueAt), timezone) ===
          calendarDay(now, timezone),
    )
  )
    return false;
  const values: Record<string, any> = {
    tier: lead.tier === "Unqualified" ? null : lead.tier,
    stage: isSalesProgressStage(lead.currentStage)?lead.currentStage:null,
    connect: (lead.interactionTimeline||projectInteractionTimeline(lead)).sales?.result,
    mode: lead.mode,
    signal: worklistIntents(lead).map(row=>row.evidence.value),
  };
  for (const k of dimensions.filter((k) => k !== "situation")) {
    const v = Array.isArray(values[k])
      ? values[k]
      : values[k]
        ? [values[k]]
        : [];
    if (
      f[k].length &&
      !f[k].some((x) => (x === "__unknown" || (k === "signal" && x === "None yet") ? !v.length : v.includes(x)))
    )
      return false;
  }
  if (f.situation.length) {
    const closed = isClosedSalesStage(lead.currentStage);
    const overview=contactOverview(lead,config,now);
    const situations = {
      first_contact: !overview.hasSales,
      stale:
        overview.stale,
      retry:
        !closed &&
        overview.unanswered &&
        !contactPaused(lead),
      historical,
    };
    if (!f.situation.some((x) => situations[x as keyof typeof situations]))
      return false;
  }
  return true;
}
export function filterAndSummarize(
  leads: any[],
  f: LeadFilters,
  employeeId: string,
  timezone: string,
  now: number,
  config?: CrmPolicyConfig,
) {
  const rows = leads.filter((l) =>
    (f.workScope!=="action"||needsHandling(l,now,n=>calendarDay(n,timezone))) &&
    leadMatches(l, f, employeeId, timezone, now, config),
  );
  const time = (v: any) => (Number.isFinite(Date.parse(v)) ? Date.parse(v) : 0);
  rows.sort((a, b) => {
    const reviewRank=Number(Boolean(b.identityReview?.pending))-Number(Boolean(a.identityReview?.pending));
    if(reviewRank)return reviewRank;
    if(f.sort==="priority"){
      const rank=(l:any)=>{const tasks=activeTasks(l).filter((t:any)=>t.status!=="migration_hold"&&time(t.dueAt)>0);
        if(tasks.some((t:any)=>Math.min(time(t.dueAt)||Infinity,time(t.requestDueAt)||Infinity)<now)||(l.attention?.customerRequests||[]).some((r:any)=>time(r.dueAt)>0&&time(r.dueAt)<now))return 0;
        if(tasks.some((t:any)=>calendarDay(Math.min(time(t.dueAt)||Infinity,time(t.requestDueAt)||Infinity),timezone)===calendarDay(now,timezone))||(l.attention?.customerRequests||[]).some((r:any)=>time(r.dueAt)>0&&calendarDay(time(r.dueAt),timezone)===calendarDay(now,timezone)))return 1;
        if((l.attention?.customerRequests||[]).length||tasks.some((t:any)=>["handoff","booking","enrollment"].includes(t.kind)))return 2;
        if(tasks.length)return 3;
        return isClosedSalesStage(l.currentStage)||l.followUpDisposition?.kind==="none"?5:4;};
      const delta=rank(a)-rank(b);if(delta)return delta;
      const due=(l:any)=>Math.min(...activeTasks(l).filter((t:any)=>t.status!=='migration_hold'&&time(t.dueAt)>0).map((t:any)=>Math.min(time(t.dueAt)||Infinity,time(t.requestDueAt)||Infinity)),...(l.attention?.customerRequests||[]).map((r:any)=>time(r.dueAt)||Infinity));
      if(due(a)!==due(b))return due(a)<due(b)?-1:1;
      return time(b.attention?.latest?.at)-time(a.attention?.latest?.at)||String(a.id).localeCompare(String(b.id));
    }
    if (f.sort === "deadline") {
      const due = (l: any) =>
        Math.min(...activeTasks(l).map((t: any) => time(t.dueAt) || Infinity));
      const ad = due(a),
        bd = due(b);
      if (ad !== bd) return ad < bd ? -1 : 1;
    }
    if (f.sort === "activity") {
      const delta =
        time(b.attention?.latest?.at) - time(a.attention?.latest?.at);
      if (delta) return delta;
    }
    return (
      time(b.submittedAt) - time(a.submittedAt) ||
      String(a.id).localeCompare(String(b.id))
    );
  });
  const enrolled = rows.filter(hasConfirmedEnrollment).length;
  return {
    leads: rows,
    total: rows.length,
    stats: {
      total: rows.length,
      hot: rows.filter((p) => p.tier === "Hot").length,
      warmOffline: rows.filter((p) => p.tier === "Warm-Offline").length,
      warmOnline: rows.filter((p) => p.tier === "Warm-Online").length,
      school: rows.filter((p) => p.tier === "School").length,
      coldNurture: rows.filter((p) => p.tier === "Cold-Nurture").length,
      overdueSla: rows.filter((p) =>
        activeTasks(p).some((t: any) => isOverdueTask(t, now)),
      ).length,
      enrolled,
      conversionRate:
        (rows.length ? (enrolled * 100) / rows.length : 0).toFixed(1) + "%",
    },
  };
}

export function restoreLeadFilters(saved:any,scope:string):LeadFilters {
 const defaults=defaultLeadFilters(scope);
 if(!saved||typeof saved!=='object'||Array.isArray(saved))return defaults;
 const next={...defaults,...saved,workScope:'all'};
 if(typeof next.overview==='string')next.overview=[next.overview];
 delete next.unread;
 if(!taskOptions.some(o=>o[0]===next.task))next.task='all';
 for(const k of dimensions)next[k]=Array.isArray(saved[k])?saved[k].filter((v:unknown)=>filterDimensions[k].options.some(o=>o[0]===v)):[];
 try{return parseLeadFilters(Object.fromEntries([...new URLSearchParams(filterQuery(next)).keys()].map(k=>[k,(k==='overview'||dimensions.includes(k as Dimension))?new URLSearchParams(filterQuery(next)).getAll(k):new URLSearchParams(filterQuery(next)).get(k)])))}catch{return defaults}
}
