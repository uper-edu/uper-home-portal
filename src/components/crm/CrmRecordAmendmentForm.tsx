import {CrmFormSection} from './CrmFormLayout';
import {AdminFormActions} from '../AdminFormLayout';
import {agreementTime} from '../../utils/crmProgressDetails';
import {agreementCorrectionCandidates} from '../../utils/crmAgreementCorrection';
import {useCrmUiText,useCrmUiLanguage} from './CrmUiLanguage';
import {CrmOperationLayer} from './CrmOperationLayer';
import {AdminField,AdminRequiredNote} from '../AdminForm';
import {useEffect,useState} from 'react';
import {CrmSingleSelect}from'./CrmSingleSelect';
import {CrmDisclosure}from'./CrmDisclosure';
import {CrmSaveFeedback,CrmDiscardDialog}from'./CrmDetailWorkspace';
import {contactCorrectionOptions,linkedAmendments}from'../../utils/crmRecordAmendments';
export function CrmRecordAmendmentForm({target,lead,timezone,isLight,onSaved,onCancel,onDirty,onBusy,suspended}:any){
 const lang=useCrmUiLanguage(); const ui=useCrmUiText();

 const[kind,setKind]=useState(target.withdrawCommitmentId?'correction':'supplement'),[text,setText]=useState(''),[reason,setReason]=useState(''),[result,setResult]=useState(''),[revision,setRevision]=useState(()=>linkedAmendments(lead,target.eventId).length),[request,setRequest]=useState<any>(null),[unknown,setUnknown]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false),[latest,setLatest]=useState<any[]>([]);
 const [withdrawIds,setWithdrawIds]=useState<string[]>(target.withdrawCommitmentId?[target.withdrawCommitmentId]:[]);
 const sourceLog=(lead.followUpLogs||[]).find((v:any)=>v.id===target.payload?.result?.logId);
 const agreements=agreementCorrectionCandidates(lead,sourceLog).filter((v:any)=>v.status==='active');
 const dirty=withdrawIds.length>0||!!text||!!reason||!!result;
 useEffect(()=>{onDirty?.(dirty||unknown);},[dirty,unknown]);
 const change=(fn:()=>void)=>{fn();setRequest(null);setError('');};
 const contact=target.eventType==='followup.recorded'&&!['closure','internal'].includes(target.payload?.recordKind);
 async function save(query=false){if(busy||suspended)return;setBusy(true);onBusy?.(true);setError('');let body=request||{requestId:crypto.randomUUID(),targetFactId:target.eventId,expectedAmendmentRevision:revision,kind,text,reason,contactResult:result||undefined,withdrawCommitmentIds:withdrawIds,expectedCommitmentRevision:lead.simpleRevision||0};setRequest(body);
  try{const r=await fetch(`/api/crm/leads/${lead.id}/${query?'operations/'+body.requestId:'amendments'}`,query?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok){if(query&&r.status===404){setUnknown(false);setError('未查到本次结果；原输入和请求ID保留，可核对后明确重试。');}else if(!query&&r.status<500){setUnknown(false);setRequest(null);setError(d.error||'未保存，输入保留');}else{setUnknown(true);setError(d.error||'结果尚未确认，请查询保存结果');}return;}
   onDirty?.(false);onSaved?.(d);
  }catch{setUnknown(true);setError('保存结果尚未确认，输入保留。请先查询结果，不要重复提交。');}finally{setBusy(false);onBusy?.(false);}}
 const close=()=>unknown?setError('保存结果尚未确认，请先查询保存结果，输入已保留。'):dirty?setConfirm(true):(onDirty?.(false),onCancel());
 return <CrmOperationLayer compose title={ui("补充／修正")} context={lead.fullName} lang={lang} isLight={isLight} busy={busy||suspended} onClose={close}><div className="crm-editor-compose" aria-label={ui("追加补充／修正")}><div className="crm-editor-scroll" data-admin-stack=""><CrmFormSection name="original" lang={lang}><blockquote className="crm-editor-original">{target.original||target.payload?.summary||ui("请对照原始记录进行补充或修正")}</blockquote><p>{ui("直接编辑客户资料请到“客户资料”页签。")}</p><AdminRequiredNote lang={lang}/><p>{ui("原文不会修改或删除。客户后来改变想法，请正常添加进展；这里只补充原记录或纠正误记。")}</p>
 </CrmFormSection>
 <CrmFormSection name="amendment" lang={lang}><CrmSingleSelect label={ui("记录方式")} lang={lang} isLight={isLight} value={kind} disabled={busy||unknown||suspended} options={[{value:'supplement',label:ui('补充说明')},{value:'correction',label:ui('修正误记')}]} onChange={v=>change(()=>{setKind(v);if(v==='supplement'){setResult('');setWithdrawIds([]);}})}/>
 <AdminField>{ui("新增内容（必填）")}<textarea aria-label={ui("补充／修正内容")} value={text} maxLength={10000} disabled={busy||unknown||suspended} onChange={e=>change(()=>setText(e.target.value))}/></AdminField>
 {kind==='correction'&&<><AdminField>{ui("修正原因（必填）")}<input aria-label={ui("修正原因")} value={reason} maxLength={2000} disabled={busy||unknown||suspended} onChange={e=>change(()=>setReason(e.target.value))}/></AdminField>{contact&&<><CrmSingleSelect label={ui("联系结果如何修正")} lang={lang} isLight={isLight} value={result} disabled={busy||unknown||suspended} options={contactCorrectionOptions.map(([value,label])=>({value,label:ui(label)}))} onChange={v=>change(()=>setResult(v))}/><p>{ui("不增加联系次数。未回复仍满足首次尝试；未实际发生／重复登记不计数。若无其他有效依据，只恢复原首次要求和原期限，不新建任务、不重发旧通知。")}</p></>}</>}
 </CrmFormSection>
 {kind==='correction'&&agreements.length>0&&<CrmFormSection name="agreements" lang={lang}><p>{ui('仅选择从未实际达成的约定；客户后来取消或改约，请正常记录进展。')}</p>{agreements.map((v:any)=><AdminField key={v.id}><input type="checkbox" disabled={busy||unknown||suspended} checked={withdrawIds.includes(v.id)} onChange={e=>change(()=>setWithdrawIds(ids=>e.target.checked?[...ids,v.id]:ids.filter(id=>id!==v.id)))}/><span>{v.action}<br/>{agreementTime(v,timezone,lang)}</span></AdminField>)}</CrmFormSection>}
 {error&&<CrmSaveFeedback state={unknown?'unknown':'error'} lang={lang}>{ui(error)}</CrmSaveFeedback>}
 {error&&!unknown&&<button className="crm-work-link" disabled={busy||suspended} onClick={async()=>{try{const r=await fetch(`/api/crm/leads/${lead.id}`);const d=await r.json();if(!r.ok)throw Error();const p=d.lead||d;setLatest(linkedAmendments(p,target.eventId));setRevision(linkedAmendments(p,target.eventId).length);setRequest(null);setError('版本已更新，草稿保留。请查看原记录的新修正，再明确保存。');}catch{setError('最新记录暂不可用，输入保留。');}}}>{ui("核对最新版本，保留输入")}</button>}
 {latest.length>0&&<CrmDisclosure heading={ui("核对最新已保存的补充／修正")}>{latest.map((a:any)=><div key={a.id}><p>{a.recordedAt} · {a.staffName||a.actor}</p><p>{a.text}</p>{a.reason&&<p>{ui("原因：")}{a.reason}</p>}</div>)}</CrmDisclosure>}
 </div><AdminFormActions className="crm-trust-actions crm-editor-actions"><button className="crm-work-button crm-editor-primary" disabled={busy||suspended||(!unknown&&(!text.trim()||kind==='correction'&&!reason.trim()))} onClick={()=>void save(unknown)}>{busy ? ui("正在保存…") : unknown ? ui("查询保存结果") : ui("保存补充／修正")}</button><button className="crm-work-link" disabled={busy||unknown||suspended} onClick={()=>dirty?setConfirm(true):(onDirty?.(false),onCancel())}>{ui("取消")}</button></AdminFormActions>
 {confirm&&<CrmDiscardDialog isLight={isLight} title={ui("放弃未保存的补充／修正？")} description={ui("原记录和已保存内容不受影响。")} keepLabel={ui("继续编辑")} discardLabel={ui("放弃修改")} onKeep={()=>setConfirm(false)} onDiscard={()=>{onDirty?.(false);onCancel();}}/>}
 </div></CrmOperationLayer>;
}
