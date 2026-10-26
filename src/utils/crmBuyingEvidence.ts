import {crmInstant} from './crmOperatingTime';
import {activeExtractionEvidence} from './crmExtractionEvidence';
import {effectiveSalesRecords} from './crmRecordAmendments';
import { historyBuyingLabel } from "./crmFollowupHistory";

export type BuyingEvidence = {
  id: string;
  kind: "questionnaire" | "sales" | "chat" | "legacy";
  value: string;
  at: string | null;
  actor?: string;
  original?: string;
  taskId?: string;
  taskOperation?: string;
  messageId?: string;
  conversationId?: string;
  sourceRecordId?: string;
  correctedBy?: string;
  aiDerived?: boolean;
};
const values = (items: unknown[]) => [
  ...new Set(
    items
      .filter(
        (v): v is string =>
          typeof v === "string" && !!v.trim() && v !== "None yet",
      )
      .map((v) => (v === "Ready to enrol" ? "Ready to enroll" : v)),
  ),
];
/** Derived read model only. Never writes classification inputs or guesses source from text. */
export function projectBuyingEvidence(
  facts: any[],
  profile: any,
): BuyingEvidence[] {
  const result: BuyingEvidence[] = [];
  const logs = new Set<string>();
  const withdrawn=new Set<string>();
  const excluded=new Set(effectiveSalesRecords(profile).filter(l=>l.contactExcluded).map(l=>l.id));
  for (const f of facts) {
    const d = f.data || {};
    if(Number(f.withdrawn)===1||excluded.has(d.result?.logId)){if(d.action==='booking')withdrawn.add('Booking requested');if(d.action==='enrollment')withdrawn.add('Ready to enroll');if(d.result?.logId)logs.add(d.result.logId);for(const v of values([...(d.buyingSignalsDetected||[]),d.buyingSignalDetected,...(d.answers?.buyingSignals||[]),d.answers?.buyingSignal]))withdrawn.add(v);continue;}
    if (f.kind === "questionnaire.submitted") {
      const a = d.answers || {};
      for (const value of values([...(a.buyingSignals || []), a.buyingSignal]))
        result.push({
          id: `${f.id}:${encodeURIComponent(value)}`,
          kind: "questionnaire",
          sourceRecordId:f.id,
          value,
          at: f.created_at || null,
          actor: "visitor",
          original: value,
        });
    } else if (f.kind === "followup.recorded") {
      if (d.result?.logId) logs.add(d.result.logId);
      for (const value of values([...(d.buyingSignalsDetected||[]),d.buyingSignalDetected]))
        result.push({
          id: `${f.id}:${encodeURIComponent(value)}`,
          kind: "sales",
          sourceRecordId:d.result?.logId,
          value,
          at: d.occurredAt || (profile.followUpLogs||[]).find((l:any)=>l.id===d.result?.logId)?.occurredAt || null,
          actor: f.actor,
          original: d.summary || "",
          taskId: d.processingTaskId,
          messageId: d.sourceMessageId,
          conversationId: d.sourceConversationId,
        });
    } else if (
      f.kind === "task.request_evidence" &&
      ["handoff", "booking", "enrollment"].includes(d.action) && (d.action!=="handoff" || Boolean(f.message_content || d.text))
    ) {
      result.push({
        id: `${f.id}:${d.action}`,
        kind: d.sourceType==='sales_record'?"sales":"chat",
        sourceRecordId:d.sourceRecordId||f.message_id||d.messageId,
        value: d.action === "handoff" ? "Advisor requested" : d.action === "booking" ? "Booking requested" : "Ready to enroll",
        at: d.occurredAt||f.message_at || null,
        actor: "visitor",
        original: d.text||f.message_content || "",
        messageId: f.message_id,
        conversationId: d.conversationId,
        taskId: d.taskId,
        taskOperation: d.taskOperation,
      });
    }
  }
  for (const log of effectiveSalesRecords(profile))
    if(log.contactExcluded){for(const v of values([...(log.buyingSignalsDetected||[]),log.buyingSignalDetected]))withdrawn.add(v);continue;}
    else if (!logs.has(log.id)) {
      for (const value of values([...(log.buyingSignalsDetected||[]),log.buyingSignalDetected]))
        result.push({
          id: `log-${log.id}:${encodeURIComponent(value)}`,
          kind: "sales",
          sourceRecordId:log.id,
          value,
          at: log.occurredAt || null,
          actor: log.staffName || log.actor,
          original: log.summary || "",
          taskId: log.processingTaskId,
          messageId: log.sourceMessageId,
          conversationId: log.sourceConversationId,
        });
    }
  const extractionRows=facts.filter(f=>f.kind==='information.extracted').map(f=>({id:f.id,created_at:f.created_at,status:'completed',source_id:f.data?.sourceId,source_type:f.data?.sourceType,input:{sourceRoot:f.data?.sourceRoot,amendment:f.data?.amendment},output:f.data}));
  const labels:Record<string,string>={price_inquiry:'Asked price',schedule_inquiry:'Asked schedule',advisor_request:'Advisor requested',assessment_interest:'Assessment interest',trial_interest:'Trial interest',enrollment_interest:'Enrollment interest'};
  for(const e of activeExtractionEvidence(extractionRows)){
   const o=e.observation;if(e.supersededBy||o.kind!=='signal'||o.subject!=='customer'||o.temporality!=='current'||e.root.countable===false)continue;
   const value=labels[o.field];if(!value)continue;
   if(result.some(v=>v.sourceRecordId===e.root.id&&v.value===value))continue;
   result.push({id:e.row.id+':'+o.field,kind:e.root.type==='customer_message'?'chat':'sales',sourceRecordId:e.root.id,value,at:e.root.occurredAt||null,original:o.quote,aiDerived:true});
  }
  const supported = new Set([...result.map((r) => r.value),...withdrawn]);
  for (const value of values([
    ...(profile.buyingSignals || []),
    profile.buyingSignal,
  ]))
    if (!supported.has(value))
      result.push({
        id: `legacy:${encodeURIComponent(value)}`,
        kind: "legacy",
        value,
        at: null,
      });
  const mapping:Record<string,string>={advisor_request:'Advisor requested',price_inquiry:'Asked price',schedule_inquiry:'Asked schedule',enrollment_interest:'Ready to enroll',trial_interest:'Booking requested'};
  for(const entry of result){const correction=(profile.extractionSignalCorrections||[]).find((c:any)=>c.sourceId===entry.sourceRecordId&&mapping[c.field]===entry.value);if(correction)entry.correctedBy=correction.correctionId;}
  for (const entry of result)
    if (entry.at && /^\d{4}-\d\d-\d\d /.test(entry.at))
      entry.at = entry.at.replace(" ", "T") + "Z";
  return result.sort(
    (a, b) =>
      (Date.parse(b.at || "") || 0) - (Date.parse(a.at || "") || 0) ||
      a.id.localeCompare(b.id),
  );
}
export function evidenceForLead(lead: any): BuyingEvidence[] {
  return lead.buyingEvidence ?? projectBuyingEvidence([], lead);
}
export function actualSignalValues(lead: any) {
  return values(
    evidenceForLead(lead)
      .filter((e) => !e.correctedBy&&(e.kind === "sales" || e.kind === "chat"))
      .map((e) => e.value),
  );
}
/** Current presentation only. Keep unsupported values in the ledger, not current intent. */
const intentValues = new Set(['Asked price','Asked schedule','Asked payment','Ready to enroll','Booking requested','Advisor requested','Assessment interest','Trial interest','Enrollment interest','Which level is right']);
export function visibleIntentEvidence(lead:any) {
  return evidenceForLead(lead).filter(e=>e.kind!=='legacy'&&intentValues.has(e.value));
}
export function signalCategory(e:Pick<BuyingEvidence,'kind'>,lang:string) {
  const words=e.kind==='questionnaire'?['Questionnaire interest','Minat kuesioner','问卷关注']:['Request / interest','Permintaan / minat','诉求／意向'];
  return words[lang==='zh'?2:lang==='id'?1:0];
}
/** One row per supported intent; latest known occurrence, not extraction/save time. */
export function worklistIntents(lead:any){
 const all=visibleIntentEvidence(lead).filter(e=>!e.correctedBy),actual=all.filter(e=>e.kind==='sales'||e.kind==='chat');
 const pool=actual.length?actual:all.filter(e=>e.kind==='questionnaire');
 const groups=new Map<string,BuyingEvidence[]>();
 for(const e of pool){const key=e.value==='Ready to enrol'?'Ready to enroll':e.value;groups.set(key,[...(groups.get(key)||[]),e]);}
 return [...groups.values()].map(records=>{const sorted=[...records].sort((a,b)=>(crmInstant(b.at||undefined)?.getTime()??-Infinity)-(crmInstant(a.at||undefined)?.getTime()??-Infinity)||a.id.localeCompare(b.id));return{evidence:sorted[0],unknownCount:records.filter(e=>!crmInstant(e.at||undefined)).length};}).sort((a,b)=>(crmInstant(b.evidence.at||undefined)?.getTime()??-Infinity)-(crmInstant(a.evidence.at||undefined)?.getTime()??-Infinity)||a.evidence.id.localeCompare(b.evidence.id));
}
export function worklistSignal(lead: any) {
  const all = visibleIntentEvidence(lead).filter(e=>!e.correctedBy);
  const actual = all.filter(e=>e.kind==='sales'||e.kind==='chat');
  const pool=actual.length?actual:all.filter(e=>e.kind==='questionnaire');
  return pool.length ? {evidence:pool[0],more:values(pool.map(e=>e.value)).length-1}:null;
}
export function buyingEvidenceLabel(
  e: Pick<BuyingEvidence, "kind" | "value">,
  lang: string,
) {
  const signalNames:Record<string,string[]>={"Advisor requested":["Advisor requested","Meminta konsultan","请求顾问联系"],"Assessment interest":["Assessment interest","Minat tes","测评意向"],"Trial interest":["Trial interest","Minat kelas percobaan","试听意向"],"Enrollment interest":["Enrollment interest","Minat mendaftar","报名意向"]};
  if(signalNames[e.value])return signalNames[e.value][lang==='zh'?2:lang==='id'?1:0];
  if (e.value === "Booking requested")
    return lang === "zh"
      ? "请求预约试听"
      : lang === "id"
        ? "Meminta jadwal kelas percobaan"
        : "Trial booking requested";
  if (e.kind === "chat" && e.value === "Ready to enroll")
    return lang === "zh"
      ? "明确请求报名"
      : lang === "id"
        ? "Meminta pendaftaran"
        : "Enrollment requested";
  return historyBuyingLabel(
    e.value,
    e.kind === "questionnaire" ? "questionnaire" : "sales",
    lang,
  );
}
export function evidenceHeading(kind: BuyingEvidence["kind"], lang: string) {
  const labels = {
    questionnaire: [
      "Questionnaire interests",
      "Minat dalam kuesioner",
      "问卷关注内容",
    ],
    sales: ["Customer requests and interests", "Permintaan dan minat pelanggan", "客户诉求与意向"],
    chat: ["Customer requests and interests", "Permintaan dan minat pelanggan", "客户诉求与意向"],
    legacy: [
      "Historical labels · evidence unavailable",
      "Label historis · bukti tidak tersedia",
      "历史标签 · 依据待核实",
    ],
  };
  return labels[kind][lang === "zh" ? 2 : lang === "id" ? 1 : 0];
}
