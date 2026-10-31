import {screeningGuidance} from '../data/hskScreeningPlacement.ts';
import {firstContactCountdown} from './crmCountdown.ts';
import {crmInstant} from './crmOperatingTime.ts';
import type {HskScreeningPlacement} from '../data/hskScreeningPlacement.ts';
type Lang='zh'|'en'|'id';
/** Relative to send/preview time; date-only values never acquire an invented midnight. */
export function notificationDeadlineStatus(value:string|undefined,reference:string|undefined,lang:Lang){
 if(!value||/^\d{4}-\d{2}-\d{2}$/.test(value.trim()))return;
 const due=crmInstant(value),now=reference?crmInstant(reference):null;
 if(!due||!now||due.getTime()<=0)return;
 return firstContactCountdown(due.toISOString(),now.getTime(),lang);
}
export function notificationValue(value:unknown):value is string {
 return typeof value==='string' && !!value.trim() && !['unknown','not specified','not sure','unassigned','anonymous','未注明','未知','未分配','负责人待核对','owner needs review','periksa penanggung jawab','belum ditugaskan','tidak disebutkan','—','-','other','其他'].includes(value.trim().toLowerCase());
}
/** Conservative privacy gate, not intent detection. Risky text stays in CRM; no paraphrase or replacement. */
export function safeNotificationExcerpt(value:unknown):string|undefined {
 if(typeof value!=='string'||!value.trim())return;
 const text=value.trim();
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)||/[@]|https?:|www\.|(?:\d[\s()+.-]*){7,}/iu.test(text))return;
 if(/(?:身份证|护照|银行卡|银行账户|地址|住址|诊断|病历|密码|验证码|passport|\bktp\b|rekening|alamat|password|verification code|bank account|medical|diagnos|\baddress\b)/iu.test(text))return;
 const excerpt=Array.from(text).slice(0,160).join('');
 return notificationValue(excerpt)?excerpt:undefined;
}
export function assessmentNotificationDetails(result:any,lang:Lang){
 const t=(zh:string,en:string,id:string)=>({zh,en,id})[lang];
 const rows:{label:string;value:string}[]=[];
 if(!result||typeof result!=='object')return rows;
 const mode=result.attempt?.mode;
 if(mode==='express'||mode==='full')rows.push({label:t('测评类型','Assessment','Jenis asesmen'),value:mode==='express'?t('快速筛查','Quick screening','Skrining singkat'):t('完整测评','Full assessment','Asesmen lengkap')});
 const p=result.screeningPlacement;
 if(mode==='express' && p?.policyVersion==='screening-15-startpoint-v1' && [0,1,2,3].includes(p.stage) && [1,2,3].includes(p.suggestedStartLevel) && typeof p.needsReview==='boolean' && ['clear','boundary','inconsistent','incomplete','audio_error'].includes(p.reason)){
  const guidance=screeningGuidance(p as HskScreeningPlacement,lang);
  rows.push({label:t('结果','Result','Hasil'),value:guidance.stage});
  if(notificationValue(guidance.review))rows.push({label:t('复核提示','Review','Peninjauan'),value:guidance.review});
 }else if(mode==='full' && Array.isArray(result.thresholds)){
  const valid=result.thresholds.filter((v:any)=>['HSK 1','HSK 2','HSK 3'].includes(v.level)&&typeof v.reached==='boolean');
  const reached=['HSK 3','HSK 2','HSK 1'].find(level=>valid.some((v:any)=>v.level===level&&v.reached));
  if(reached)rows.push({label:t('本卷结果','Paper result','Hasil tes ini'),value:t(`${reached}门槛达成（暂定）`,`${reached} threshold reached (provisional)`,`Ambang ${reached} tercapai (sementara)`)});
  else if(valid.some((v:any)=>v.level==='HSK 1'&&!v.reached))rows.push({label:t('本卷结果','Paper result','Hasil tes ini'),value:t('未达到本卷HSK 1门槛','Paper HSK 1 threshold not reached','Ambang HSK 1 pada tes ini belum tercapai')});
 }
 for(const [key,label] of [['listening',t('听力','Listening','Menyimak')],['reading',t('阅读','Reading','Membaca')],['writing',t('书写','Writing','Menulis')]]){
  const v=result.sections?.[key];
  if(v&&Number.isInteger(v.total)&&v.total>0&&Number.isInteger(v.correct)&&v.correct>=0&&v.correct<=v.total)rows.push({label,value:t(`答对 ${v.correct}/${v.total}`,`${v.correct}/${v.total} correct`,`${v.correct}/${v.total} benar`)});
 }
 if(Number.isInteger(result.skippedCount)&&result.skippedCount>0)rows.push({label:t('跳过题数','Skipped','Dilewati'),value:String(result.skippedCount)});
 if(Number.isInteger(result.unansweredCount)&&result.unansweredCount>0)rows.push({label:t('未作答题数','Unanswered','Belum dijawab'),value:String(result.unansweredCount)});
 return rows;
}
