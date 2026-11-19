import {AdminRefreshAction} from './admin/AdminRefreshAction';
import {AdminFormSection,AdminFormActions,AdminFormFeedback} from './AdminFormLayout';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {aiModelSlots,defaultReasoningEffort,effortField,reasoningEfforts,sameAiSelection,selectedReasoningEffort,supportsReasoningEffort,type AiSelection} from '../utils/aiModelSelection';
import {testAndSaveAi} from '../utils/aiServiceSubmit';
import type {CrmLanguage} from '../utils/crmLanguage';
import {aiServiceText} from '../utils/aiServiceLanguage';
import {AdminField,AdminRequiredNote} from './AdminForm';
import {FlaskConical, Settings2, CheckCircle2, XCircle, LoaderCircle} from 'lucide-react';
import {CrmSingleSelect} from './crm/CrmSingleSelect';
import {CrmDisclosure} from './crm/CrmDisclosure';
import {formatCrmEventTime} from '../utils/crmOperatingTime';
export function AiServicePanel({lang,isLight,renderHeading}:{lang:CrmLanguage;isLight:boolean;renderHeading:(refresh:ReactNode)=>ReactNode}){
 const [data,setData]=useState<any>(null),[selection,setSelection]=useState<AiSelection>({primary:'',fallback:''}),[check,setCheck]=useState<any>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[unresolved,setUnresolved]=useState(typeof sessionStorage!=='undefined'&&!!sessionStorage.getItem('uper-ai-pending'));
 const submitting=useRef(false);
 const [querying,setQuerying]=useState(false);
 const call=async(path='',body?:any)=>{const r=await fetch('/api/admin/ai-service'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(body?155000:15000)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
 const load=async(initial=false)=>{try{const d=await call();setData(d);const recent=d.checks?.find((c:any)=>c.ok&&c.revision===d.revision&&c.expiresAt>Date.now()&&sameAiSelection(c.selection,selection));if(recent)setCheck(recent);if(initial){let draft;try{draft=JSON.parse(sessionStorage.getItem('uper-ai-draft')||'null')}catch{}setSelection(draft||d.current);}const pending=sessionStorage.getItem('uper-ai-pending');if(pending&&d.history?.some((v:any)=>v.requestId===pending)){setNotice('saved');setUnresolved(false);sessionStorage.removeItem('uper-ai-pending');sessionStorage.removeItem('uper-ai-draft');setSelection(d.current);setCheck(null);}
  else if(pending)setNotice('unknown');
 }catch{
  setNotice(sessionStorage.getItem('uper-ai-pending')?'queryPendingFailed':'error');
 }};
 useEffect(()=>{void load(true);},[]);
 const choose=(s:typeof selection)=>{setSelection(s);setCheck(null);sessionStorage.setItem('uper-ai-draft',JSON.stringify(s));};
 const submit=async()=>{
  if(!data||submitting.current||unresolved)return;
  if(selection.primary===selection.fallback){setNotice('required');return;}
  submitting.current=true;setBusy(true);setNotice('');setCheck(null);
  let activating=false;const requestId=crypto.randomUUID();
  try{
   const result=await testAndSaveAi({call,current:data.current,selection:{...selection},revision:data.revision,requestId,onChecked:setCheck,beforeActivate:()=>{activating=true;sessionStorage.setItem('uper-ai-pending',requestId);}});
   if(result.unchanged)setNotice('verified');
   if(result.saved){setNotice('saved');sessionStorage.removeItem('uper-ai-pending');sessionStorage.removeItem('uper-ai-draft');setUnresolved(false);await load();}
  }catch(e){const message=(e as Error).message;setNotice(message==='conflict'?'conflict':activating?'unknown':'error');if(activating&&message!=='conflict'&&message!=='test_required')setUnresolved(true);else{sessionStorage.removeItem('uper-ai-pending');setUnresolved(false);}}
  finally{submitting.current=false;setBusy(false);}
 };

 const query=async()=>{
  setQuerying(true);
  try{await load();}finally{setQuerying(false);}
 };
 return <>{renderHeading(<AdminRefreshAction label={aiServiceText.refresh[lang==='zh'?2:lang==='id'?1:0]}
  loading={querying} disabled={busy} onClick={()=>void query()}/>)}
  <AiServiceContent {...{lang,isLight,data,selection,check,busy,notice,unresolved}} onSelect={choose} onSubmit={submit}/>
 </>;
}
type ContentProps={lang:CrmLanguage;isLight:boolean;data:any;selection:AiSelection;check:any;busy:boolean;notice:string;unresolved:boolean;onSelect:(s:AiSelection)=>void;onSubmit:()=>void};
export function AiServiceContent({lang,isLight,data,selection,check,busy,notice,unresolved,onSelect,onSubmit}:ContentProps){
 const col=lang==='zh'?2:lang==='id'?1:0,t=(k:keyof typeof aiServiceText)=>aiServiceText[k][col];
 const status=(ok:boolean)=> <span className="ai-check" data-ok={ok}>{ok?<CheckCircle2 size={15} aria-hidden="true"/>:<XCircle size={15} aria-hidden="true"/>}{t(ok?'ready':'failed')}</span>;
 const describe=(value:AiSelection,role:typeof aiModelSlots[number])=>{
  const effort=selectedReasoningEffort(value,role);
  return effort?`${value[role]} · ${t(effort)}`:value[role];
 };
 const fields=(value:AiSelection)=> <dl className="ai-config-values">{aiModelSlots.map(k=><div key={k}><dt>{t(k)}</dt><dd>{describe(value,k)}</dd></div>)}</dl>;
 return <section data-admin-form="" className="ai-service-panel" aria-busy={busy}>
  <p className="ai-service-guide">{t('shortGuide')}</p>
  {notice&&<AdminFormFeedback className="ai-service-feedback" state={notice==='saved'||notice==='verified'?'saved':notice==='error'?'error':'unknown'} role="status">{t(notice as keyof typeof aiServiceText)}</AdminFormFeedback>}
  {!data?<p role="status">{t(notice?'error':'busy')}</p>:<>
   <div className="access-grid ai-service-grid">
    <AdminFormSection variant="card" className="access-card ai-service-card" titleId="ai-model-heading" title={<><Settings2 size={19} aria-hidden="true"/>{t('models')}</>} actions={<AdminRequiredNote lang={lang}/>}>
     <div className="ai-config-active"><span>{t('active')}</span>{fields(data.current)}</div>
     <div data-admin-grid="" className="ai-service-fields">
      {aiModelSlots.map(role=>{
       const effort=selectedReasoningEffort(selection,role);
       const modelId=`ai-${role}-model`,effortId=`ai-${role}-effort`,key=effortField[role];
       return <div key={role}>
        <AdminField as="div" required><label htmlFor={modelId}>{t(role)}</label>
         <CrmSingleSelect controlId={modelId} label={t(role)} value={selection[role]} options={data.models.map((m:string)=>({value:m,label:m}))}
          onChange={model=>onSelect({...selection,[role]:model,[key]:supportsReasoningEffort(model)?selection[key]:undefined})}
          lang={lang} isLight={isLight} required disabled={busy}/>
        </AdminField>
        {effort?<AdminField as="div"><label htmlFor={effortId}>{t(key)}</label>
         <CrmSingleSelect controlId={effortId} label={t(key)} value={effort} options={reasoningEfforts.map(value=>({value,label:t(value)}))}
          onChange={value=>{const effort=reasoningEfforts.find(item=>item===value);if(effort)onSelect({...selection,[key]:effort===defaultReasoningEffort?undefined:effort});}}
          lang={lang} isLight={isLight} disabled={busy}/>
        </AdminField>:<span className="ai-service-muted">{t('reasoningUnavailable')}</span>}
       </div>;
      })}
     </div>
     <p className="ai-service-muted">{t('reasoningHint')}</p>
    </AdminFormSection>
    <AdminFormSection variant="card" className="access-card ai-service-card" titleId="ai-test-heading" title={<><FlaskConical size={19} aria-hidden="true"/>{t('testEnable')}</>}>
     <div className="ai-test-body" role="status" aria-live="polite">
      {busy?<p className="ai-service-progress"><LoaderCircle size={18} aria-hidden="true"/>{t('busy')}</p>:check?<div className="ai-test-results">{check.results.map((r:any)=><div className="ai-test-result" key={r.model}><div><strong>{r.model}</strong>{r.actualModel&&<span className="ai-service-muted">{t('actualModel')}: {r.actualModel}</span>}</div>{status(r.ok)}</div>)}<p className="ai-service-muted">{t(check.ok?'checksPassed':'testFailed')}</p></div>:<p className="ai-service-muted">{t('testHint')}</p>}
     </div>
     <AdminFormActions className="access-record-action ai-service-actions"><button type="button" className="ai-primary" disabled={busy||unresolved} onClick={onSubmit}><FlaskConical size={16} aria-hidden="true"/>{t(busy?'busy':'testSave')}</button></AdminFormActions>
    </AdminFormSection>
   </div>
   <section className="access-card ai-service-support" aria-label={t('support')}>
    <CrmDisclosure heading={t('actual')}><p className="ai-service-muted">{t('callNote')}</p><ul className="ai-service-records">{data.attempts.map((a:any,i:number)=><li key={i}><strong>{a.model}</strong>{status(a.ok)}<time>{formatCrmEventTime(a.at)}</time>{a.fallbackModel&&<span>{t('fallbackUsed')}: {a.fallbackModel}</span>}</li>)}{!data.attempts.length&&<li>{t('empty')}</li>}</ul></CrmDisclosure>
    <CrmDisclosure heading={t('extract')}><ul className="ai-service-records">{data.extractions.map((a:any,i:number)=><li key={i}><strong>{a.model}</strong>{status(a.status==='completed')}<time>{formatCrmEventTime(a.completed_at)}</time></li>)}{!data.extractions.length&&<li>{t('empty')}</li>}</ul></CrmDisclosure>

    <CrmDisclosure heading={t('history')}><ul className="ai-service-records">{data.history?.map((a:any)=><li key={a.requestId}><strong>{describe(a.current,'primary')} → {describe(a.current,'fallback')}</strong><span>{a.actor}</span><time>{formatCrmEventTime(a.at)}</time></li>)}{!data.history?.length&&<li>{t('empty')}</li>}</ul></CrmDisclosure>
    <CrmDisclosure heading={t('help')}><p>{t('guide')}</p><dl className="ai-config-values">{Object.entries(data.keys).map(([provider,configured])=><div key={provider}><dt>{provider==='openai'?'OpenAI':'DeepSeek'}</dt><dd>{t(configured?'configured':'missing')}</dd></div>)}</dl></CrmDisclosure>
   </section>
  </>}
 </section>;
}
