import {validateLocalInstant} from './crmOperatingTime';
import {calendarSample} from './workCalendar';
export function wantsNewAgreement(draft:any){return draft.agreementIntent==='new'||(draft.agreementIntent==='update'&&(draft.commitmentChange?.status==='rescheduled'||draft.alsoNewAgreement));}
export function incompleteAgreement(draft:any){return Boolean((draft.agreementIntent==='update'&&(!draft.commitmentChange?.id||!draft.commitmentChange?.status))||(wantsNewAgreement(draft)&&(!draft.commitmentAction?.trim()||(draft.agreementTiming==='date'&&!draft.commitmentDate)||(draft.agreementTiming==='exact'&&!draft.commitmentLocal))));}
export function prepareProgressDraft(draft:any,timezone:string){
 const {stageUpdate,savedProgress,stagePending,stageState,stageError,stageBase,stageLatest,stageRequestId,stageObservations,buyingSignalsDetected,newStage,profileUpdates,profileVersions,profileCorrection,answeredRequests,agreementIntent,agreementTiming,alsoNewAgreement,commitmentAction,commitmentDate,commitmentLocal,contactLocal,internalLocal,contactTimeConfirmed,exceptionReason,expectedContactArrangementVersion,reviewedContactArrangementState,...fields}=draft;
 return {...fields,occurredAt:draft.recordKind==='contact'&&draft.occurrenceMode==='specified'?progressContactTime(draft.contactLocal,timezone):draft.recordKind==='contact'&&draft.occurrenceMode==='unknown'?null:undefined,occurrenceMode:draft.recordKind==='contact'?draft.occurrenceMode:undefined,contactDirection:draft.recordKind==='contact'?draft.contactDirection:undefined,channel:draft.recordKind==='contact'?draft.channel:undefined,connectStatus:draft.recordKind==='contact'?draft.connectStatus:undefined,contactState:draft.contactState||undefined,expectedContactArrangementVersion:draft.contactState?expectedContactArrangementVersion:undefined,contactReason:draft.contactState?draft.summary?.trim():undefined,commitmentChange:agreementIntent==='update'&&draft.commitmentChange?{...draft.commitmentChange,reason:draft.summary?.trim()}:undefined,commitment:wantsNewAgreement(draft)?{action:commitmentAction,date:agreementTiming==='date'?commitmentDate:undefined,at:agreementTiming==='exact'?progressContactTime(commitmentLocal,timezone):undefined,timezone}:undefined};
}

/** Minute-complete wall-clock input; no truncation, missing time or date normalization. */
export function progressContactTime(local:any,timezone:string){
 if(typeof local!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw Error('请填写完整日期、小时和分钟');
 const [date,time]=local.split('T'),[year,month,day]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number);
 if(year<1970||month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||hour>23||minute>59)throw Error('实际日期或时间不正确');
 const instant=calendarSample(date,time,timezone);
 try{validateLocalInstant(local,instant,timezone);}catch{throw Error('此日期或时刻无效或不唯一，请选择其他时间');}
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant),get=(k:string)=>parts.find(p=>p.type===k)?.value;
 if(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`!==local)throw Error('所选时区不存在此时刻，请核对日期与时间');
 return instant.toISOString();
}
export function contactDraftIncomplete(draft:any,timezone:string){
 if(draft.recordKind!=='contact')return false;
 if(!draft.channel||!draft.connectStatus||!['sales','customer'].includes(draft.contactDirection)||!['now','specified','unknown'].includes(draft.occurrenceMode))return true;
 if(draft.contactDirection==='customer'&&draft.connectStatus!=='Connected')return true;
 if(draft.occurrenceMode==='specified'){try{return Date.parse(progressContactTime(draft.contactLocal,timezone))>Date.now();}catch{return true;}}
 return false;
}
