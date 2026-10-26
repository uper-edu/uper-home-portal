import {sameProfileValue,compatibleProfileValue} from './crmFieldValues';
import {effectiveContactRecords} from './crmRecordAmendments';
import {interactionInstant} from './crmInteractionTimeline';
export const profileFields:Record<string,string>={goal:'主要学习目标',goals:'其他学习目标',targetHskLevel:'目标HSK等级',hskExamPlan:'考试计划',preferredStart:'希望开始时间',city:'城市',mode:'授课方式',availability:'可上课时段',budgetMin:'预算下限',budgetMax:'预算上限',budgetCurrency:'预算币种',budgetPeriod:'预算周期',concerns:'主要顾虑',communicationLanguage:'首选沟通语言',preferredChannel:'首选联系渠道'};
export const profileSourceLabels:Record<string,string>={questionnaire:'客户问卷',sales_contact:'销售联系记录',sales_edit:'销售直接编辑',legacy:'既有资料',ai_customer_text:'客户原文（AI提取）',ai_sales_text:'销售原文（AI提取）'};
const equal=(a:any,b:any)=>JSON.stringify(Array.isArray(a)?[...a].sort():a??null)===JSON.stringify(Array.isArray(b)?[...b].sort():b??null);
const bad=(s:string,status=400):never=>{throw Object.assign(Error(s),{status});};
export function validateProfileUpdates(updates:any){
 if(!updates||typeof updates!=='object'||Array.isArray(updates)||Object.keys(updates).length>Object.keys(profileFields).length)bad('画像字段格式不正确');
 const result:any={};for(const[k,v]of Object.entries(updates)){
  if(!Object.hasOwn(profileFields,k))bad('不允许修改该画像字段：'+k);
  if(v===null){result[k]=null;continue;}
  if(['goals','concerns'].includes(k)){if(!Array.isArray(v)||v.length>(k==='goals'?8:12)||v.some(x=>typeof x!=='string'||!x.trim()||x.length>300))bad('画像列表格式不正确');result[k]=[...new Set((v as string[]).map(x=>x.trim()))];}
  else if(['budgetMin','budgetMax'].includes(k)){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e12)bad('预算必须是有效非负数');result[k]=v;}
  else {if(typeof v!=='string'||!v.trim()||v.length>500)bad('画像文字为空或过长');result[k]=(v as string).trim();}
  if(k==='communicationLanguage'&&!['en','id','zh','unknown',null].includes(result[k]))bad('沟通语言不正确');
  if(k==='mode'&&!['Online','Offline','Not sure',null].includes(result[k]))bad('授课方式不正确');
  if(k==='budgetPeriod'&&!['month','course','hour','unspecified',null].includes(result[k]))bad('预算周期不正确');
  if(k==='budgetCurrency'&&result[k]!==null&&!/^[A-Z]{3}$/.test(result[k]))bad('预算币种使用三位大写代码，例如IDR');
 }
 return result;
}
export function applyProfileFields(current:any,raw:any,versions:any,context:{sourceType:string;sourceFactId:string;actor:string;occurredAt?:string|null;recordedAt:string;correction?:boolean}){
 const updates=validateProfileUpdates(raw),p={...current,profileFieldMeta:{...(current.profileFieldMeta||{})}},changes:any[]=[];
 for(const[k,value]of Object.entries(updates)){
  if(context.sourceType==='questionnaire'&&(value===null||value===''||(Array.isArray(value)&&!value.length)))continue;
  const old=current.profileFieldMeta?.[k]||{revision:0,sourceType:'legacy',valueState:'legacy_unknown'};
  if(versions&&versions[k]!==old.revision)bad(profileFields[k]+'已被更新，请保留输入并核对最新资料',409);
  const occurred=interactionInstant(context.occurredAt),previous=interactionInstant(old.effectiveAt);
  const differs=!sameProfileValue(k,current[k],value),unresolved=old.pendingDifferences?.length>0;
  if(!differs&&!unresolved&&!context.correction&&old.valueState!=='withdrawn')continue;
  const late=differs&&current[k]!=null&&previous&&(!occurred||Date.parse(occurred)<=Date.parse(previous))&&!context.correction;
  const observation={value,sourceFactId:context.sourceFactId,sourceType:context.sourceType,effectiveAt:occurred||null,recordedAt:context.recordedAt,actor:context.actor};
  if(late){
    const pending=[...(old.pendingDifferences||[])];if(!pending.some((d:any)=>d.sourceFactId===context.sourceFactId&&equal(d.value,value)))pending.push(observation);
    p.profileFieldMeta[k]={...old,revision:old.revision+1,pendingDifferences:pending};changes.push({field:k,before:current[k]??null,observation:value,applied:false,reason:occurred?'较早或同时的信息，未覆盖当前值':'发生时间不明，未覆盖当前值',...observation});
  }else{
    p[k]=value;p.profileFieldMeta[k]={revision:old.revision+1,sourceType:context.sourceType,sourceFactIds:[context.sourceFactId],effectiveAt:occurred||null,recordedAt:context.recordedAt,updatedBy:context.actor,valueState:'sourced',valueChanged:differs,pendingDifferences:[]};changes.push({field:k,before:current[k]??null,after:value,applied:true,...observation});
  }
 }
 if(p.budgetMin!=null&&p.budgetMax!=null&&p.budgetMin>p.budgetMax)bad('预算下限不能高于上限');
 return{profile:p,changes};
}
/** Facts only: no personal state, completion state, deadline or hint assignment. */
export function dynamicProfileHints(p:any,now=Date.now()){
 const hints:any[]=[];
 for(const[k,m]of Object.entries(p.profileFieldMeta||{}) as any){if(!profileFields[k])continue;if(m.valueState==='correction_pending')hints.push({id:'corrected-basis:'+k,kind:'difference',text:profileFields[k]+'的原依据已有修正，新值尚未明确采用；当前值暂留，请对照原文。',evidenceIds:[m.correctionSourceId].filter(Boolean)});if(m.valueState==='withdrawn')hints.push({id:'source:'+k,kind:'source',text:profileFields[k]+'的依据已撤回；当前资料保留，请结合原记录判断。',evidenceIds:m.sourceFactIds||[]});if(m.pendingDifferences?.some((d:any)=>d.effective!==false&&!d.supersededBy&&!compatibleProfileValue(k,p[k],d.value)))hints.push({id:'difference:'+k,kind:'difference',text:profileFields[k]+'存在不同记录：'+m.pendingDifferences.filter((d:any)=>d.effective!==false&&!d.supersededBy&&!compatibleProfileValue(k,p[k],d.value)).map((d:any)=>Array.isArray(d.value)?d.value.join('、'):String(d.value??'明确清空')).join('；')+'。来源与发生时间可在客户资料查看。',evidenceIds:m.pendingDifferences.filter((d:any)=>d.effective!==false&&!d.supersededBy&&!compatibleProfileValue(k,p[k],d.value)).map((d:any)=>d.sourceFactId)});}
 const recent=Object.entries(p.profileFieldMeta||{}).filter(([k,m]:any)=>{const at=interactionInstant(m.effectiveAt);return !!profileFields[k]&&m.sourceType!=='legacy'&&m.valueState!=='withdrawn'&&m.valueChanged!==false&&(!at||Date.parse(at)>=now-7*86400000&&Date.parse(at)<=now);}).sort((a:any,b:any)=>(Date.parse(b[1].effectiveAt)||-Infinity)-(Date.parse(a[1].effectiveAt)||-Infinity));
 for(const[k,m]of recent as any)if(!m.pendingDifferences?.some((d:any)=>d.effective!==false&&!d.supersededBy&&!compatibleProfileValue(k,p[k],d.value)))hints.push({id:'change:'+k,kind:'change',text:profileFields[k]+'最近有更新，来源：'+(profileSourceLabels[m.sourceType]||m.sourceType)+'。',at:interactionInstant(m.effectiveAt)||undefined,recordedAt:m.recordedAt,evidenceIds:m.sourceFactIds||[]});
 if((p.budgetMin!=null||p.budgetMax!=null)&&(!p.budgetCurrency||!p.budgetPeriod||p.budgetPeriod==='unspecified'))hints.push({id:'budget-unit',kind:'difference',text:'预算缺少明确币种或计价周期，不能直接与报价比较。',evidenceIds:[]});
 const last=effectiveContactRecords(p).filter((l:any)=>l.recordKind==='contact').sort((a:any,b:any)=>(Date.parse(b.occurredAt||'')||0)-(Date.parse(a.occurredAt||'')||0))[0];
 if(last?.connectStatus==='Wrong Number')hints.push({id:'invalid-contact:'+last.id,kind:'contact',text:'最近联系记录为联系方式异常；请结合当前联系方式判断，不代表必须再次拨打。',evidenceIds:[last.id]});
 for(const a of p.commitments||[]){if(a.status!=='active')continue;let due=false;if(a.at)due=Date.parse(a.at)<now;else if(a.date){try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:a.timezone||'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));const day=['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-');due=a.date<=day;}catch{}}if(due)hints.push({id:'agreement:'+a.id,kind:'agreement',text:'客户约定日期／时间已到：'+a.action+'。按实际记录履行、取消或改约，不创建任务。',evidenceIds:[a.sourceId]});}

 return hints;
}
