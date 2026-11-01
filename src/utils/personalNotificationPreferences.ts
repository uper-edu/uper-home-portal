export const personalNotificationTypes = [
 ['lead.created','新客户','New customer','Pelanggan baru'],
 ['handoff.requested','顾问请求','Advisor request','Permintaan konsultan'],
 ['booking.requested','预约请求','Booking request','Permintaan jadwal'],
 ['enrollment.requested','报名请求','Enrollment request','Permintaan pendaftaran'],
 ['conversation.updated','客户动态更新','Customer updates','Pembaruan pelanggan'],
 ['conversation.reactivated','重新打开咨询','Consultation reopened','Konsultasi dibuka kembali'],
 ['assessment.completed','测评完成','Assessment completed','Asesmen selesai'],
 ['commitment.due','客户约定提醒','Customer agreement reminder','Pengingat kesepakatan'],
 ['task.overdue','首次联系逾期','First contact overdue','Kontak pertama terlambat'],
 ['ai.failed','AI回复失败','AI reply failed','Balasan AI gagal'],
 ['notification.failed','通知发送异常','Notification delivery issue','Gangguan pengiriman notifikasi'],
] as const;
export const requiredPersonalTypes=['handoff.requested','booking.requested','enrollment.requested','commitment.due','task.overdue'] as const;
export const operationsPersonalTypes=['ai.failed','notification.failed'] as const;
export function personalNotificationCategory(type:string):'required'|'optional'|'operations'{return (requiredPersonalTypes as readonly string[]).includes(type)?'required':(operationsPersonalTypes as readonly string[]).includes(type)?'operations':'optional';}
export function personalNotificationRequired(type:string){return personalNotificationCategory(type)!=='optional';}
export type PersonalNotificationLanguage='rule'|'en'|'id'|'zh';
export type PersonalNotificationPreferences={revision:number;language:PersonalNotificationLanguage;disabledTypes:string[]};
export const defaultPersonalPreferences=():PersonalNotificationPreferences=>({revision:0,language:'rule',disabledTypes:[]});
export function normalizePersonalPreferences(value:any):PersonalNotificationPreferences {
 return {revision:Number.isInteger(value?.revision)&&value.revision>=0?value.revision:0,language:['rule','en','id','zh'].includes(value?.language)?value.language:'rule',disabledTypes:personalNotificationTypes.map(t=>t[0]).filter(key=>!personalNotificationRequired(key)&&Array.isArray(value?.disabledTypes)&&value.disabledTypes.includes(key))};
}
export function personalNotificationAllowed(value:PersonalNotificationPreferences,event:string){return personalNotificationRequired(event)||!value.disabledTypes.includes(event);}
export function personalNotificationLanguage(value:PersonalNotificationPreferences,ruleLanguage:string){return value.language==='rule'?ruleLanguage:value.language;}
