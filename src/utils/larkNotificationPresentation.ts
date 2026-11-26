import {LEAD_ASSIGNED_EVENT} from './leadAssignmentNotification.ts';
import type {NotificationTargetKind} from './crmNotificationTarget.ts';
import {crmValue} from './crmLanguage.ts';
import {assessmentNotificationDetails,notificationValue,safeNotificationExcerpt,notificationDeadlineStatus} from './larkNotificationContent.ts';
type Language='zh'|'en'|'id';
export const standardLarkKinds=['commitment.due','lead.created',LEAD_ASSIGNED_EVENT,'handoff.requested','assessment.completed','booking.requested','enrollment.requested','conversation.reactivated','task.overdue','ai.failed','notification.failed'] as const;
export type LarkKind=typeof standardLarkKinds[number];
export type LarkCardInput={target?:{kind:NotificationTargetKind;id:string};jobId?:string;kind:LarkKind;language:Language;name:string;agreementAction?:string;time?:string;owner?:string;source?:string;score?:number;maxScore?:number;goals?:string[];recordedAt?:string;internalReview?:boolean;excerpt?:string;excerptRestricted?:boolean;assessmentResult?:any;city?:string;mode?:string;reportedLevel?:string;due?:string;dueAt?:string;asOf?:string;attempts?:number;failedEvent?:LarkKind;failedChannel?:string;failure?:'ai_unavailable'|'delivery_failed'|'delivery_unknown';};
export function larkKindTitle(kind:LarkKind,language:Language){
 const labels:Record<LarkKind,[string,string,string]>={
 'commitment.due':['客户约定到期','Customer agreement due','Kesepakatan pelanggan jatuh tempo'],
 'lead.created':['新客户','New lead','Pelanggan baru'],
 [LEAD_ASSIGNED_EVENT]:['客户已分配','Customer assigned','Pelanggan ditugaskan'],
 'handoff.requested':['顾问联系请求','Advisor contact requested','Permintaan konsultan'],
 'assessment.completed':['测评完成','Assessment completed','Asesmen selesai'],
 'booking.requested':['预约申请待确认','Booking request to confirm','Permintaan janji perlu dikonfirmasi'],
 'enrollment.requested':['报名申请待确认','Enrollment request to confirm','Permintaan pendaftaran perlu dikonfirmasi'],
 'conversation.reactivated':['客户重新打开咨询','Customer reopened consultation','Pelanggan membuka konsultasi kembali'],
 'task.overdue':['首次联系尝试已逾期','First contact attempt overdue','Upaya kontak pertama terlambat'],
 'ai.failed':['AI咨询回复失败','AI consultation reply failed','Balasan konsultasi AI gagal'],
 'notification.failed':['通知发送异常','Notification delivery issue','Masalah pengiriman notifikasi']};
 return labels[kind][language==='zh'?0:language==='id'?2:1];
}
export function larkNotificationPreview(input:LarkCardInput){
 const t=(zh:string,en:string,id:string)=>({zh,en,id})[input.language];
 const rows:{label:string;value:string}[]=[];
 const put=(label:string,value:unknown)=>{if(notificationValue(value))rows.push({label,value:value.trim()});};
 const title=input.kind==='notification.failed'&&input.failure==='delivery_unknown'?t('通知发送结果待核实','Delivery result needs verification','Hasil pengiriman perlu diverifikasi'):input.kind==='task.overdue'&&input.internalReview?t('首次联系要求逾期 · 先内部核实','First contact overdue · internal review','Kontak pertama terlambat · tinjau internal'):larkKindTitle(input.kind,input.language);
 put(t('客户','Customer','Pelanggan'),input.name);
 if(input.kind==='lead.created'){
  const goals=[...new Set((input.goals||[]).filter(notificationValue))];
  if(goals.length)put(t('学习目标','Learning goal','Tujuan belajar'),goals.map(goal=>crmValue(goal,input.language)).join(' · '));
  put(t('自报水平','Self-reported level','Tingkat yang dilaporkan'),notificationValue(input.reportedLevel)?crmValue(input.reportedLevel,input.language):undefined);
  put(t('授课偏好','Class preference','Preferensi kelas'),notificationValue(input.mode)?crmValue(input.mode,input.language):undefined);
  put(t('城市','City','Kota'),input.city);
 }
 if(input.kind==='commitment.due')put(t('约定事项','Agreement','Kesepakatan'),safeNotificationExcerpt(input.agreementAction));
 const excerpt=safeNotificationExcerpt(input.excerpt);
 if(excerpt && input.kind!=='assessment.completed')put(input.source==='sales_record'?t('销售记录摘录','Sales record excerpt','Kutipan catatan penjualan'):t('客户原文摘录','Customer excerpt','Kutipan pelanggan'),excerpt+(Array.from(input.excerpt!.trim()).length>Array.from(excerpt).length?'…':''));
 if(input.kind==='assessment.completed'){
  const score=input.assessmentResult?.score??input.score,maxScore=input.assessmentResult?.maxScore??input.maxScore;
  if(Number.isFinite(score)&&Number.isFinite(maxScore)&&maxScore>0&&score>=0&&score<=maxScore)put(t('测评得分','Score','Skor'),`${score} / ${maxScore}`);
  rows.push(...assessmentNotificationDetails(input.assessmentResult,input.language));
 }
 if(input.kind==='booking.requested'||input.kind==='enrollment.requested')put(t('当前状态','Status','Status'),input.kind==='booking.requested'?t('收到预约申请，尚未确认具体安排','Booking requested; arrangements are not confirmed','Permintaan janji diterima; jadwal belum dikonfirmasi'):t('收到报名申请，不代表报名或付款已确认','Enrollment requested; enrollment and payment are not confirmed','Permintaan pendaftaran diterima; pendaftaran dan pembayaran belum dikonfirmasi'));
 if(input.kind==='conversation.reactivated')put(t('当前动态','Activity','Aktivitas'),t('客户重新打开咨询会话，尚不代表已发送新消息','The customer reopened a conversation; this does not establish a new message','Pelanggan membuka kembali percakapan; belum berarti ada pesan baru'));
 put(input.kind==='commitment.due'?t('约定时间','Agreed time','Waktu kesepakatan'):input.kind==='task.overdue'?t('首次联系期限','First contact deadline','Batas kontak pertama'):t('到期时间','Due','Jatuh tempo'),input.due);
 if(notificationValue(input.due))put(t('期限状态（发送时）','Deadline status (at send)','Status tenggat (saat dikirim)'),notificationDeadlineStatus(input.dueAt,input.asOf,input.language));
 if(input.kind==='ai.failed')put(t('处理提示','Handling','Penanganan'),t('AI未能生成完整回复；请在CRM核对会话和服务状态','AI could not generate a complete reply; review the conversation and service status in CRM','AI tidak dapat membuat balasan lengkap; periksa percakapan dan status layanan di CRM'));
 if(input.kind==='notification.failed'){
  put(t('受影响通知','Affected notification','Notifikasi terdampak'),input.failedEvent&&standardLarkKinds.includes(input.failedEvent)?larkKindTitle(input.failedEvent,input.language):undefined);
  put(t('渠道','Channel','Saluran'),input.failedChannel==='lark'?'Lark':input.failedChannel==='inapp'?t('站内提醒','In-app','Dalam aplikasi'):undefined);
  if(Number.isSafeInteger(input.attempts)&&input.attempts!>0)put(t('发送尝试次数','Delivery attempts','Jumlah upaya kirim'),String(input.attempts));
  put(t('处理提示','Handling','Penanganan'),input.failure==='delivery_unknown'?t('发送结果未确认；先核对发送记录和群内消息，避免重复发送','Delivery is unconfirmed; check logs and the group before retrying to avoid duplicates','Pengiriman belum terkonfirmasi; periksa log dan grup sebelum mencoba lagi agar tidak duplikat'):t('发送未成功；请核对渠道配置和发送记录，不自动重放','Delivery failed; check channel settings and logs; no automatic replay','Pengiriman gagal; periksa pengaturan saluran dan log; tidak dikirim ulang otomatis'));
 }
 if(input.internalReview)put(t('处理提示','Handling','Penanganan'),t('先内部核实，暂不直接联系','Review internally before contacting the customer','Tinjau secara internal sebelum menghubungi pelanggan'));
 put(input.kind===LEAD_ASSIGNED_EVENT?t('新负责人','New owner','Penanggung jawab baru'):t('负责人','Owner','Penanggung jawab'),input.owner);
 const source=({questionnaire:t('客户问卷','Questionnaire','Kuesioner'),customer_message:t('客户对话','Customer conversation','Percakapan pelanggan'),sales_record:t('销售记录','Sales record','Catatan penjualan'),assessment:t('测评记录','Assessment record','Catatan asesmen'),contact_form:t('官网咨询表单','Website inquiry','Formulir situs'),standalone_chat:t('在线咨询','Online consultation','Konsultasi daring'),homepage_widget:t('首页咨询','Homepage consultation','Konsultasi beranda')} as Record<string,string>)[input.source||''];
 put(t('来源','Source','Sumber'),source);
 put(input.kind===LEAD_ASSIGNED_EVENT?t('分配时间','Assigned at','Waktu penugasan'):t('发生时间','Occurred','Waktu kejadian'),input.time);
 if(input.kind!==LEAD_ASSIGNED_EVENT)put(t('记录时间','Recorded','Waktu pencatatan'),input.recordedAt);
 return {title,rows,note:input.excerptRestricted?t('原文仅在CRM内查看','Original text is available in CRM','Teks asli tersedia di CRM'):undefined};
}
