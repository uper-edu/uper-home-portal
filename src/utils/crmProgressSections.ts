import {contactDraftIncomplete,incompleteAgreement,progressContactTime} from './crmProgressDraft';
import {crmValue} from './crmLanguage';
import {formatCrmSummaryTime} from './crmOperatingTime';
import {progressStageError} from './crmProgressStage';
import {hasContactDetails} from './crmProgressRecord';
export {hasContactDetails} from './crmProgressRecord';
export type ProgressSection='contact'|'agreement'|'stage'|'arrangement';
export function patchContactDetails(d:any,key:string,value:any){const next={...d,[key]:value};return {...next,recordKind:hasContactDetails(next)?'contact':'internal'};}
export function clearProgressSection(d:any,key:ProgressSection){
  if(key==='contact')return {...d,recordKind:'internal',channel:'',connectStatus:'',contactDirection:'',occurrenceMode:'',contactLocal:'',contactTimeConfirmed:false,occurredAt:undefined};
  if(key==='agreement')return {...d,agreementIntent:'',agreementTiming:'',commitmentChange:undefined,commitmentAction:'',commitmentLocal:'',commitmentDate:'',alsoNewAgreement:false};
  if(key==='stage')return {...d,stageUpdate:{enabled:false,stage:'',enrollmentConfirmed:false},stageError:''};
  return {...d,contactState:'',contactReason:''};
}
export function progressSectionState(d:any,lead:any,lang:string,timezone:string,canUpdateStage=true){
  const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const changed={contact:d.recordKind==='contact'&&hasContactDetails(d),agreement:!!d.agreementIntent,stage:!!d.stageUpdate?.enabled,arrangement:!!d.contactState};
  const stageBase=d.stageBase?.stage||d.expectedStage||lead.currentStage;
  const incomplete={contact:changed.contact&&contactDraftIncomplete(d,timezone),agreement:incompleteAgreement(d),stage:canUpdateStage&&!!progressStageError(d.stageUpdate,stageBase,timezone),arrangement:false};
  let contactTime='';
  if(changed.contact){
    if(d.occurrenceMode==='now')contactTime=t('Just now','Baru saja','刚刚发生');
    if(d.occurrenceMode==='unknown')contactTime=t('Time unknown','Waktu tidak diketahui','时间未确认');
    if(d.occurrenceMode==='specified'&&d.contactLocal)try{contactTime=formatCrmSummaryTime(progressContactTime(d.contactLocal,timezone),timezone);}catch{}
  }
  const current=lead.contactArrangement?.state;
  const arrangementLabel=(state:string|undefined)=>state==='stopped'?t('Proactive contact stopped','Kontak proaktif dihentikan','已停止主动联系'):!state||state==='active'?t('Normal contact','Kontak normal','正常联系'):t('Previous restriction retained','Pembatasan lama tetap berlaku','保留原联系限制');
  const outcome=d.commitmentChange?.status?({fulfilled:t('Fulfill','Penuhi','履行'),cancelled:t('Cancel','Batalkan','取消'),rescheduled:t('Reschedule','Jadwalkan ulang','改约')}as any)[d.commitmentChange.status]:'';
  const summary={
    contact:changed.contact?[d.channel?crmValue(d.channel,lang as any):'',d.connectStatus?crmValue(d.connectStatus,lang as any):'',contactTime].filter(Boolean).join(' · '):'',
    agreement:changed.agreement?[d.agreementIntent==='new'?t('New','Baru','拟新增'):t('Update','Ubah','拟调整'),outcome,d.commitmentAction||(lead.commitments||[]).find((c:any)=>c.id===d.commitmentChange?.id)?.action,d.agreementTiming==='date'?d.commitmentDate:d.agreementTiming==='exact'?d.commitmentLocal?.replace('T',' '):''].filter(Boolean).join(' · '):'',
    stage:changed.stage?`${crmValue(stageBase,lang as any)} → ${crmValue(d.stageUpdate.stage,lang as any)}`:crmValue(stageBase,lang as any),
    arrangement:changed.arrangement?`${arrangementLabel(current)} → ${d.contactState==='active'?t('Restore','Pulihkan','拟恢复'):t('Stop','Hentikan','拟停止')}`:arrangementLabel(current),
  };
  return {changed,incomplete,summary};
}
