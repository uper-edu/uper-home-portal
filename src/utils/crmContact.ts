import {effectiveContactRecords} from './crmRecordAmendments';
export type ContactState = "active" | "waiting" | "nurture" | "stopped";
export function contactStatistics(lead: any) {
  const logs = effectiveContactRecords(lead)
    .filter(
      (l: any) =>
        l.recordKind !== "closure" &&
        l.timestampKnown !== false &&
        ["Connected", "No Response", "Wrong Number"].includes(
          l.connectStatus,
        ) &&
        Number.isFinite(Date.parse(l.timestamp || l.at)) &&
        Date.parse(l.timestamp || l.at) > 0,
    )
    .sort(
      (a: any, b: any) =>
        Date.parse(b.timestamp || b.at) - Date.parse(a.timestamp || a.at),
    );
  const connected = logs.filter((l: any) => l.connectStatus === "Connected");
  return {
    attemptCount: logs.length,
    connectedCount: connected.length,
    lastAttempt: logs[0] || null,
    lastConnected: connected[0] || null,
  };
}
/** Legacy waits remain restricted until explicitly reviewed. New agreements expire by clock. */
export function contactRestriction(lead: any, now = Date.now()): 'stopped' | 'legacy' | 'until' | null {
  const state = lead.contactArrangement?.state;
  if (state === 'stopped') return 'stopped';
  if (state && !['active','waiting','nurture'].includes(state)) return 'legacy';
  if (['waiting','nurture'].includes(state)) return 'legacy';
  const review = lead.contactReview;
  if (review?.blockBefore === true && (!Number.isFinite(Date.parse(review.reviewAt)) || Date.parse(review.reviewAt) > now)) return 'until';
  return null;
}
export function contactPaused(lead: any, now = Date.now()) {
  return contactRestriction(lead, now) !== null;
}
/** Missing task data is an error, not evidence that planning is absent. */
export function needsTaskPlanning(_lead:any,_now=Date.now()){return false;}

export function needsHandling(lead:any,now:number,day:(n:number)=>string){
 if(!lead.attention||lead.attention.error||lead.identityReview?.pending)return true;
 if((lead.attention.tasks||[]).some((t:any)=>t.kind==='consultation'&&['open','overdue'].includes(t.status)))return true;
 return (lead.commitments||[]).some((v:any)=>v.status==='active'&&((v.at&&Date.parse(v.at)<=now)||(v.date&&v.date<=day(now))));
}

export function greeting(language: string, name: string, advisor: string) {
  if (language === "zh")
    return `您好，${name}！我是 UPER Education 的 ${advisor}。感谢您的咨询，可以先确认您的学习需求和方便联系的时间吗？`;
  if (language === "id")
    return `Halo ${name}! Saya ${advisor} dari UPER Education. Terima kasih telah menghubungi kami. Boleh saya mengonfirmasi kebutuhan belajar dan waktu yang sesuai untuk Anda?`;
  if (language === "en")
    return `Hello ${name}! I'm ${advisor} from UPER Education. Thank you for your inquiry. May I confirm your learning needs and a convenient time to contact you?`;
  return "";
}
