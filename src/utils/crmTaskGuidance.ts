import type {CrmLanguage} from './crmLanguage';
import type {TaskPresentationInput} from './crmTaskPresentation';
const pick=(lang:CrmLanguage,en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
/** Guidance is advisory. It does not infer contact, sales results or task completion. */
export function taskCompletionGuidance(task:Pick<TaskPresentationInput,'kind'>,lang:CrmLanguage){
 switch(task.kind){
 case 'consultation':return pick(lang,'Record the actual contact outcome, the needs clarified. An unanswered attempt alone does not resolve the enquiry.','Catat hasil kontak nyata, kebutuhan yang dipahami. Upaya tanpa balasan saja belum menyelesaikan pertanyaan.','记录真实联系结果、已了解的需求；一次未回复尝试本身不代表咨询已处理完。');
 case 'handoff':return pick(lang,'Check the original advisor request and record how it was handled. An AI reply, opening WhatsApp or an unanswered attempt does not resolve the request.','Periksa permintaan konsultan asli dan catat penanganannya. Balasan AI, membuka WhatsApp, atau upaya tanpa balasan belum menyelesaikan permintaan.','核对客户原始顾问请求并记录处理结果；AI回复、打开WhatsApp或一次未回复不代表诉求已解决。');
 case 'booking':return pick(lang,'Record the outcome of this booking request and any confirmed arrangement. A request is not a confirmed booking or attendance; if the work is no longer needed, cancel or replace it with a reason.','Catat hasil permintaan janji ini dan pengaturan yang telah dikonfirmasi. Permintaan bukan janji terkonfirmasi atau kehadiran; jika pekerjaan tidak diperlukan lagi, batalkan atau ganti dengan alasan.','记录本次预约请求的处理结果及已确认安排；请求不等于预约已确认或已到场。原工作不再需要时，说明原因后取消或替代。');
 case 'enrollment':return pick(lang,'Record how the requested enrollment support was handled and the next step. Contacting the customer does not prove enrollment, payment or a sale.','Catat penanganan bantuan pendaftaran yang diminta dan langkah berikutnya. Menghubungi pelanggan tidak membuktikan pendaftaran, pembayaran, atau penjualan.','记录本次报名支持事项的处理结果及下一步；联系成功不代表报名、付款或成交。');
 case 'contact_review':return pick(lang,'Review the current facts and explicitly decide the next arrangement. Reaching the review time does not complete the task, send a message or restore stopped contact.','Tinjau fakta terkini dan tentukan rencana berikutnya secara tegas. Tibanya waktu tinjauan tidak menyelesaikan tugas, mengirim pesan, atau mengaktifkan kembali kontak yang dihentikan.','核对当前事实并明确下一步安排；到达复查时间不会自动完成任务、发送消息或恢复已停止的联系。');
 default:return pick(lang,'Confirm the specific action written in this task was carried out and record its result. If it remains unfinished, keep it open; cancel or replace obsolete work with a reason.','Pastikan tindakan spesifik dalam tugas ini telah dilakukan dan catat hasilnya. Jika belum selesai, biarkan terbuka; batalkan atau ganti pekerjaan yang tidak diperlukan dengan alasan.','确认任务中写明的具体动作已实际执行，并记录结果；未完成则保持待处理，原工作不再需要时说明原因后取消或替代。');
 }
}
export type TaskOverlap={left:TaskPresentationInput;right:TaskPresentationInput;basis:'same_matter'|'same_source'|'contact_scope'|'same_type'};
const text=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():null;
/** Exact provenance and broad work scope only: never match free text or infer duplicate work. */
export function taskOverlapCandidates(tasks:TaskPresentationInput[],focusId?:string):TaskOverlap[]{
 const active=tasks.filter((t,i)=>['open','overdue'].includes(t.status)&&tasks.findIndex(v=>v.id===t.id)===i),result:TaskOverlap[]=[];
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const left=active[i],right=active[j];if(focusId&&left.id!==focusId&&right.id!==focusId)continue;
  const a=left.details,b=right.details;let basis:TaskOverlap['basis']|undefined;
  if(text(a?.matterId)&&text(a?.matterId)===text(b?.matterId))basis='same_matter';
  else if(text(a?.sourceMessageId)&&text(a?.sourceConversationId)&&text(a?.sourceMessageId)===text(b?.sourceMessageId)&&text(a?.sourceConversationId)===text(b?.sourceConversationId))basis='same_source';
  else if(['consultation','handoff'].includes(left.kind)&&['consultation','handoff','booking','enrollment'].includes(right.kind)&&left.kind!==right.kind||['consultation','handoff'].includes(right.kind)&&['booking','enrollment'].includes(left.kind))basis='contact_scope';
  else if(left.kind===right.kind&&['handoff','booking','enrollment'].includes(left.kind))basis='same_type';
  if(basis)result.push({left,right,basis});
 }return result;
}
export function taskOverlapBasis(basis:TaskOverlap['basis'],lang:CrmLanguage){
 const values={
 same_matter:['Linked to the same matter; actions may still differ.','Terkait urusan yang sama; tindakan tetap bisa berbeda.','关联同一事项，但具体工作仍可能不同。'],
 same_source:['Share a source message; one message can contain different requests.','Berasal dari pesan yang sama; satu pesan bisa berisi permintaan berbeda.','来自同一条消息，一条消息仍可能包含不同请求。'],
 contact_scope:['Initial contact or advisor work may overlap with handling this explicit request.','Kontak awal atau tugas konsultan mungkin beririsan dengan penanganan permintaan ini.','初次联系或顾问工作，可能与处理这项明确请求的范围重叠。'],
 same_type:['Same request type does not mean the same matter. Check the original requests.','Jenis permintaan yang sama bukan berarti urusan yang sama. Periksa permintaan asli.','同类请求不等于同一件事，请核对各自原文。']
 };const v=values[basis];return pick(lang,v[0],v[1],v[2]);
}
