import {createContext,useContext,useEffect,useState} from 'react';
import {AdminField,AdminRequiredNote} from '../AdminForm';
import {AdminFormActions} from '../AdminFormLayout';
import {CrmOperationLayer} from './CrmOperationLayer';
import {CrmSaveFeedback,CrmDiscardDialog} from './CrmDetailWorkspace';
import {CrmSingleSelect} from './CrmSingleSelect';
import {useCrmUiText} from './CrmUiLanguage';
import {salesProgressStages,isEnrolledStage} from '../../utils/crmSalesProgress';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';

export const CrmEnrollmentCorrectionAccess=createContext<{open?:(id:string)=>void}>({});
export function CrmEnrollmentCorrectionAction({factId,voided}:any){
 const {open}=useContext(CrmEnrollmentCorrectionAccess),ui=useCrmUiText();
 return !voided&&open&&factId?<button type="button" className="crm-work-link" onClick={()=>open(factId)}>{ui('作废报名误记')}</button>:null;
}
export function CrmEnrollmentVoidStatus({value}:any){
 const ui=useCrmUiText();
 return value?<div className="crm-work-muted" role="note"><strong>{ui('已作废 · 报名误记')}</strong><p>{value.reason}</p><small>{value.actor} · {formatCrmOperatingTime(value.recordedAt,viewerTimeZone())}</small></div>:null;
}
export function CrmEnrollmentCorrectionForm({lead,factId,lang,isLight,suspended,onDirty,onBusy,onCancel,onSaved}:any){
 const ui=useCrmUiText(lang);
 const [context,setContext]=useState<any>(null),[loadError,setLoadError]=useState(false),[retry,setRetry]=useState(0);
 const [reason,setReason]=useState(''),[stage,setStage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[request,setRequest]=useState<any>(null),[discard,setDiscard]=useState(false);
 useEffect(()=>{let live=true;setLoadError(false);fetch(`/api/crm/leads/${lead.id}/stage-context`,{signal:AbortSignal.timeout(10000)}).then(async r=>{const d=await r.json();if(!r.ok||d.leadId!==lead.id)throw Error();if(live)setContext(d);}).catch(()=>{if(live)setLoadError(true)});return()=>{live=false};},[lead.id,retry]);
 useEffect(()=>{onDirty?.(!!reason||!!stage||unknown)},[reason,stage,unknown]);
 const target=context?.enrollmentConfirmations?.find((v:any)=>v.id===factId),needsStage=isEnrolledStage(context?.current.stage)&&context?.enrollmentConfirmations.filter((v:any)=>!v.voided).length===1;
 const change=(fn:()=>void)=>{fn();setRequest(null);setError('')};
 const close=()=>{if(busy||suspended)return;if(unknown){setError('保存结果尚未确认，请先查询保存结果，输入已保留。');return;}if(reason||stage)setDiscard(true);else onCancel();};
 async function save(){if(busy||suspended)return;const body=request||{requestId:crypto.randomUUID(),targetFactId:factId,reason,expectedStage:context.current.stage,expectedStageRevision:context.current.version,expectedEnrollmentRevision:context.current.enrollmentVersion,...(needsStage?{newStage:stage}:{})};setRequest(body);setBusy(true);onBusy?.(true);setError('');
  try{const r=await fetch(`/api/crm/leads/${lead.id}/${unknown?'operations/'+body.requestId:'enrollment-void'}`,unknown?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const d=await r.json();
   if(!r.ok){if(unknown&&r.status===404){setUnknown(false);setError('未查到本次结果；原输入和请求ID保留，可核对后明确重试。');}else if(!unknown&&r.status<500){setRequest(null);setError(d.error||'未保存，输入保留');}else{setUnknown(true);setError(d.error||'保存结果尚未确认，输入保留。请先查询结果，不要重复提交。');}return;}
   onDirty?.(false);onSaved(d);
  }catch{setUnknown(true);setError('保存结果尚未确认，输入保留。请先查询结果，不要重复提交。');}finally{setBusy(false);onBusy?.(false)}
 }
 return <CrmOperationLayer compose title={ui('作废报名误记')} context={lead.fullName} {...{lang,isLight}} busy={busy||suspended} onClose={close}><div className="crm-editor-compose"><div className="crm-editor-scroll" data-admin-stack=""><AdminRequiredNote lang={lang}/>
 {loadError?<CrmSaveFeedback state="error" lang={lang}>{ui('原报名确认暂不可用，请重试。')}<button className="crm-work-link" onClick={()=>setRetry(n=>n+1)}>{ui('重试')}</button></CrmSaveFeedback>:!context?<p role="status">{ui('正在加载原报名确认…')}</p>:!target||target.voided?<p role="alert">{ui('该报名确认已作废或不可用，请核对最新记录。')}</p>:<>
 <section><h4>{ui('原报名确认')}</h4><small>{target.actor} · {ui('录入：')}{formatCrmOperatingTime(target.recordedAt,viewerTimeZone())}</small><blockquote className="crm-editor-original">{target.text}</blockquote></section>
 <p>{ui('仅用于当初没有报名或选错客户；客户后来退课、退款不在此处理。原记录永久保留。')}</p>
 <AdminField required>{ui('纠错说明')}<textarea aria-label={ui('纠错说明')} required maxLength={2000} value={reason} disabled={busy||unknown||suspended} onChange={e=>change(()=>setReason(e.target.value))}/></AdminField>
 {needsStage&&<AdminField required>{ui('纠错后的销售阶段')}<CrmSingleSelect label={ui('纠错后的销售阶段')} required value={stage} lang={lang} isLight={isLight} disabled={busy||unknown||suspended} options={[{value:'',label:ui('请选择')},...salesProgressStages.filter(s=>s[0]!=='progress:enrolled').map(s=>({value:s[0],label:s[lang==='zh'?1:lang==='id'?3:2]}))]} onChange={v=>change(()=>setStage(v))}/></AdminField>}
 </>}
 {error&&<CrmSaveFeedback state={unknown?'unknown':'error'} lang={lang}>{ui(error)}{!unknown&&<button className="crm-work-link" onClick={()=>{setContext(null);setRequest(null);setRetry(n=>n+1)}}>{ui('核对最新版本，保留输入')}</button>}</CrmSaveFeedback>}
 </div><AdminFormActions className="crm-editor-actions"><button className="crm-work-button crm-editor-primary" disabled={busy||suspended||!unknown&&(!target||target.voided||!reason.trim()||needsStage&&!stage)} onClick={()=>void save()}>{ui(busy?'正在保存…':unknown?'查询保存结果':'确认作废误记')}</button><button className="crm-work-button" disabled={busy||unknown||suspended} onClick={close}>{ui('取消')}</button></AdminFormActions>
 {discard&&<CrmDiscardDialog {...{isLight}} title={ui('放弃未保存的纠错？')} description={ui('原记录和已保存内容不受影响。')} keepLabel={ui('继续编辑')} discardLabel={ui('放弃修改')} onKeep={()=>setDiscard(false)} onDiscard={()=>{onDirty?.(false);onCancel()}}/>}
 </div></CrmOperationLayer>;
}
