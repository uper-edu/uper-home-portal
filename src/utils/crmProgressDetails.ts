import {profileFields} from './crmDynamicProfile';
import {formatCrmOperatingTime,viewerTimeZone} from './crmOperatingTime';
import type {CrmLanguage} from './crmLanguage';
import {crmValue} from './crmLanguage';
const text=(lang:string,en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
export function agreementTime(agreement:any,timezone:string,lang:string,compact=false){
 if(!agreement)return text(lang,'Not recorded','Tidak tercatat','未记录');
 if(agreement.at)return formatCrmOperatingTime(agreement.at,agreement.timezone||timezone)+' · '+(agreement.timezone||timezone);
 if(agreement.date)return agreement.date+(compact?'':' · '+text(lang,'Date only','Hanya tanggal','仅日期'));
 return text(lang,'No date or time agreed','Tanggal dan jam belum disepakati','尚未约定日期或时刻');
}
export function progressDetails(log:any,lead:any,requests:any[],lang:CrmLanguage,timezone:string){
 const t=(en:string,id:string,zh:string)=>text(lang,en,id,zh);const rows:{label:string,value:string}[]=[];
 const add=(label:string,value:any)=>{if(value!==undefined&&value!==null&&value!=='')rows.push({label,value:String(value)});};
 const internal=log.recordKind==='internal'||log.recordKind==='closure';
 add(t('Record type','Jenis catatan','记录类型'),internal?t('Internal progress','Perkembangan internal','内部进展'):t('Customer contact','Kontak pelanggan','客户联系'));
 add(t('Actual occurrence','Waktu kejadian sebenarnya','实际发生时间'),log.occurredAt?formatCrmOperatingTime(log.occurredAt,viewerTimeZone())+' · '+viewerTimeZone():t('Not recorded; recording time is separate','Tidak tercatat; waktu pencatatan terpisah','未注明；记录时间另行保留'));
 if(!internal){add(t('Initiated by','Dimulai oleh','联系发起方'),log.contactDirection==='sales'?t('Sales','Sales','销售'):log.contactDirection==='customer'?t('Customer','Pelanggan','客户'):t('Not specified','Tidak disebutkan','未注明'));add(t('Contact channel','Saluran kontak','联系渠道'),crmValue(log.channel,lang));add(t('Actual result','Hasil nyata','实际联系结果'),crmValue(log.connectStatus,lang));}
 add(t('Stage facts recorded','Fakta tahap yang dicatat','本次记录的阶段事实'),log.stageObservations?.length?log.stageObservations.map((v:string)=>crmValue(v,lang)).join(' · '):null);
 add(t('Sales stage change','Perubahan tahap','销售阶段变更'),log.newStage?(log.expectedStage?crmValue(log.expectedStage,lang)+' → ':'')+crmValue(log.newStage,lang):null);
 add(t('New buying signals','Sinyal niat baru','新增购买信号'),log.buyingSignalsDetected?.length?log.buyingSignalsDetected.map((v:string)=>crmValue(v,lang)).join(' · '):null);
 if(log.contactState){add(t('Contact arrangement','Pengaturan kontak','主动联系安排'),log.contactState==='stopped'?t('Proactive contact stopped','Kontak proaktif dihentikan','已停止主动联系'):t('Proactive contact restored','Kontak proaktif dipulihkan','已恢复主动联系'));add(t('Arrangement reason','Alasan pengaturan','安排变更原因'),log.contactReason);}
 if(log.commitment){add(t('New agreement','Kesepakatan baru','新增约定'),log.commitment.action);add(t('Agreed time','Waktu kesepakatan','约定时间'),agreementTime(log.commitment,timezone,lang));}
 if(log.commitmentChange){const prior=(lead.commitments||[]).find((v:any)=>v.id===log.commitmentChange.id);add(t('Original agreement','Kesepakatan semula','原约定'),prior?.action||log.commitmentChange.id);if(prior)add(t('Original agreed time','Waktu semula','原约定时间'),agreementTime(prior,timezone,lang));add(t('Agreement outcome','Hasil kesepakatan','约定处理结果'),({fulfilled:t('Fulfilled','Dipenuhi','已履行'),cancelled:t('Cancelled','Dibatalkan','已取消'),rescheduled:t('Rescheduled','Dijadwalkan ulang','已改约')}as any)[log.commitmentChange.status]||log.commitmentChange.status);add(t('Update reason','Alasan perubahan','约定更新原因'),log.commitmentChange.reason);}
 if(log.profileUpdates&&!log.result?.profileFieldResults?.length)for(const[k,v]of Object.entries(log.profileUpdates))add('资料更新 · '+(profileFields[k]||k),v===null?'明确清空':Array.isArray(v)?v.map(x=>crmValue(x,lang)).join('、'):typeof v==='string'?crmValue(v,lang):v);
 const handled=log.result?.handledRequestIds||log.answeredRequests||[];
 if(handled.length)add(t('Requests actually answered','Permintaan yang dijawab','实际回应的请求'),handled.map((id:string)=>requests.find((r:any)=>r.id===id)?.data?.text||t('Original request unavailable','Permintaan asli tidak tersedia','原请求暂不可用')).join('\n'));
 if(log.result?.completedTaskIds?.length)add(t('First-follow-up result','Hasil tindak lanjut pertama','首次跟进处理结果'),({attempted:t('Actual attempt; no reply','Percobaan nyata; belum dibalas','真实尝试，尚未回复'),connected:t('Connected / replied','Tersambung / dibalas','已接通／已回复'),invalid_contact:t('Invalid contact','Kontak tidak valid','联系方式无效'),exception:t('Exception recorded','Pengecualian dicatat','已记录例外')}as any)[log.result.firstOutcome]||t('Processed','Diproses','已处理'));
 add(t('Exception reason','Alasan pengecualian','例外原因'),log.exceptionReason);
 return rows;
}
