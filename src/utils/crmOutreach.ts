import {contactRestriction} from './crmContact.ts';
import { permittedRecord, canClaimRecord } from './accessControl.ts';
export const isCrmManager = (employee: any) => employee?.active !== false && employee?.roles?.includes('crm_leader') && employee?.permissions?.includes('crm.followup');
export const canReviewIdentityRole=(employee:any,controls:{identityReviewManagerOnly?:boolean}={})=>isCrmManager(employee)||(controls.identityReviewManagerOnly===false&&employee?.active!==false&&employee?.roles?.includes("sales")&&employee?.permissions?.includes("crm.followup"));
export type ContactPurpose = 'sales_followup' | 'identity_verification' | 'customer_reply';
export function outreachPolicy(employee: any, lead: any, purpose: ContactPurpose = 'sales_followup', now = Date.now()) {
  const restriction = contactRestriction(lead, now);
  if (restriction === 'stopped') return 'CONTACT_STOPPED';
  if (lead.identityReview?.pending && (purpose !== 'identity_verification' || !isCrmManager(employee))) return 'IDENTITY_REVIEW_REQUIRED';
  if (purpose === 'identity_verification' && (!lead.identityReview?.pending || !isCrmManager(employee))) return 'IDENTITY_REVIEW_REQUIRED';
  if (!lead.owner && !isCrmManager(employee)) return 'CLAIM_BEFORE_CONTACT';
  if (!permittedRecord(employee, lead, 'crm.followup')) return 'CONTACT_PERMISSION_DENIED';
  if (restriction && purpose === 'sales_followup') return restriction === 'legacy' ? 'CONTACT_REVIEW_REQUIRED' : 'CONTACT_NOT_BEFORE';
  if (restriction === 'legacy' && purpose === 'customer_reply') return 'CONTACT_REVIEW_REQUIRED';
  return null;
}
export const canClaimForContact = (employee: any, lead: any) => (!lead.identityReview?.ownerAssignmentManagerOnly||isCrmManager(employee)) && !lead.identityReview?.pending && canClaimRecord(employee, lead);
const words: Record<string, [string,string,string]> = {
  CONTACT_STOPPED: ['Proactive contact stopped. Restore with a reason first.','Kontak proaktif dihentikan. Pulihkan dengan alasan terlebih dahulu.','已停止主动联系，请先说明原因并恢复。'],
  IDENTITY_REVIEW_REQUIRED: ['Identity review required · Review identity before claiming or contacting.','Identitas perlu diverifikasi · Verifikasi sebelum klaim atau kontak.','身份待核实 · 请先核实，再认领或联系。'],
  OWNER_MANAGER_REQUIRED: ["Only an authorized CRM Manager can claim or assign a Lead owner under the current policy.","Kebijakan saat ini hanya mengizinkan CRM Manager berwenang mengklaim atau menugaskan penanggung jawab Lead.","当前配置仅允许有权限的CRM Manager认领或分配Lead的Owner。"],
  SELF_CLAIM_DISABLED: ["Self-claim is disabled. Ask an authorized manager to assign the lead.","Klaim mandiri dinonaktifkan. Minta manajer berwenang menugaskan pelanggan.","自主认领已关闭，请由有权限的管理者分配客户。"],
  IDENTITY_REVIEW_PERMISSION_REQUIRED: ["Identity review requires permission for both records.","Verifikasi identitas memerlukan izin atas kedua catatan.","核实身份须同时具备双方记录的权限。"],
  CLAIM_BEFORE_CONTACT: ['Claim this lead before contacting.','Ambil pelanggan ini sebelum menghubungi.','请先认领此客户，再联系。'],
  CONTACT_PERMISSION_DENIED: ['You cannot contact this customer. Check the current owner and your permissions.','Anda tidak dapat menghubungi pelanggan ini. Periksa penanggung jawab dan izin Anda.','无权联系此客户，请核对当前负责人及权限。'],
  CONTACT_OWNER_CHANGED: ['Owner changed. Refresh and review before contacting.','Penanggung jawab berubah. Muat ulang dan tinjau sebelum menghubungi.','客户归属已变化，请刷新核对后再联系。'],
  CONTACT_REASON_REQUIRED: ['Enter the reason and scope of this exceptional contact.','Isi alasan dan cakupan kontak khusus ini.','请填写本次特殊联系的原因与范围。'],
  CONTACT_NOT_BEFORE: ['An agreed no-contact period is still in effect. Review the task before changing it.','Masa tidak menghubungi yang disepakati masih berlaku. Tinjau tugas sebelum mengubahnya.','尚在约定的不主动联系期限内，请先核对复查任务。'],
  CONTACT_REVIEW_REQUIRED: ['Review the previous contact arrangement before contacting. No date has been inferred.','Tinjau pengaturan kontak sebelumnya sebelum menghubungi. Tanggal tidak ditebak.','请先核对原联系安排，系统不会猜测日期或自动放行。'],
  CONTACT_EVIDENCE_REQUIRED: ['Select valid identity evidence or a new unanswered customer message.','Pilih bukti identitas yang valid atau pesan baru pelanggan yang belum dijawab.','请选择有效身份依据或客户新发且尚未答复的问题。'],
  CONTACT_CONTEXT_CHANGED: ['Contact conditions changed. Refresh before continuing.','Ketentuan kontak berubah. Muat ulang sebelum melanjutkan.','联系条件已变化，请刷新核对后继续。'],
  IDENTITY_MANAGER_REQUIRED: ['Only a CRM Manager can review identity.','Hanya CRM Manager yang dapat memverifikasi identitas.','仅CRM Manager可核实身份。'],
};
export function outreachText(code: string, lang: string) { return words[code]?.[lang==='zh'?2:lang==='id'?1:0] || code; }
