import {useEffect,useRef,useState} from 'react';
import {testAndSaveAi} from '../utils/aiServiceSubmit';
import type {CrmLanguage} from '../utils/crmLanguage';
import {aiServiceText} from '../utils/aiServiceLanguage';
import {AdminField,AdminRequiredNote} from './AdminForm';
import {FlaskConical, Settings2, RefreshCw, CheckCircle2, XCircle, LoaderCircle} from 'lucide-react';
import {CrmSingleSelect} from './crm/CrmSingleSelect';
import {CrmDisclosure} from './crm/CrmDisclosure';
import {formatCrmEventTime} from '../utils/crmOperatingTime';
export function AiServicePanel({lang,isLight}:{lang:CrmLanguage;isLight:boolean}){
 const [data,setData]=useState<any>(null),[selection,setSelection]=useState({primary:'',fallback:''}),[check,setCheck]=useState<any>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[unresolved,setUnresolved]=useState(typeof sessionStorage!=='undefined'&&!!sessionStorage.getItem('uper-ai-pending'));
 const submitting=useRef(false);
 const call=async(path='',body?:any)=>{const r=await fetch('/api/admin/ai-service'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(body?155000:15000)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
 const load=async(initial=false)=>{try{const d=await call();setData(d);const recent=d.checks?.find((c:any)=>c.ok&&c.revision===d.revision&&c.expiresAt>Date.now()&&JSON.stringify(c.selection)===JSON.stringify(selection));if(recent)setCheck(recent);if(initial){let draft;try{draft=JSON.parse(sessionStorage.getItem('uper-ai-draft')||'null')}catch{}setSelection(draft||d.current);}const pending=sessionStorage.getItem('uper-ai-pending');if(pending&&d.history?.some((v:any)=>v.requestId===pending)){setNotice('saved');setUnresolved(false);sessionStorage.removeItem('uper-ai-pending');sessionStorage.removeItem('uper-ai-draft');setSelection(d.current);setCheck(null);}}catch{setNotice('error');}};
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

 return <AiServiceContent {...{lang,isLight,data,selection,check,busy,notice,unresolved}} onSelect={choose} onQuery={()=>void load()} onSubmit={submit}/>;
}
type ContentProps={lang:CrmLanguage;isLight:boolean;data:any;selection:{primary:string;fallback:string};check:any;busy:boolean;notice:string;unresolved:boolean;onSelect:(s:{primary:string;fallback:string})=>void;onQuery:()=>void;onSubmit:()=>void};
export function AiServiceContent({lang,isLight,data,selection,check,busy,notice,unresolved,onSelect,onQuery,onSubmit}:ContentProps){
 const col=lang==='zh'?2:lang==='id'?1:0,t=(k:keyof typeof aiServiceText)=>aiServiceText[k][col];
 const status=(ok:boolean)=> <span className="ai-check" data-ok={ok}>{ok?<CheckCircle2 size={15} aria-hidden="true"/>:<XCircle size={15} aria-hidden="true"/>}{t(ok?'ready':'failed')}</span>;
 const fields=(value:any)=> <dl className="ai-config-values">{(['primary','fallback'] as const).map(k=><div key={k}><dt>{t(k)}</dt><dd>{value[k]}</dd></div>)}</dl>;
 return <section className="ai-service-panel" aria-busy={busy}>
  <div className="access-toolbar ai-service-toolbar"><p>{t('shortGuide')}</p><button type="button" disabled={busy} onClick={onQuery}><RefreshCw size={16} aria-hidden="true"/>{t('refresh')}</button></div>
  {notice&&<p className="ai-service-feedback" data-tone={(notice==='saved'||notice==='verified')?'success':notice==='error'?'danger':'warning'} role="status">{t(notice as keyof typeof aiServiceText)}</p>}
  {!data?<p role="status">{t(notice?'error':'busy')}</p>:<>
   <div className="access-grid ai-service-grid">
    <section className="access-card ai-service-card" aria-labelledby="ai-model-heading">
     <header className="access-record-heading"><h2 id="ai-model-heading"><Settings2 size={19} aria-hidden="true"/>{t('models')}</h2><AdminRequiredNote lang={lang}/></header>
     <div className="ai-config-active"><span>{t('active')}</span>{fields(data.current)}</div>
     <div className="ai-service-fields">{(['primary','fallback'] as const).map(k=><AdminField as="div" key={k} required><label>{t(k)}</label><CrmSingleSelect label={t(k)} value={selection[k]} options={data.models.map((m:string)=>({value:m,label:m}))} onChange={v=>onSelect({...selection,[k]:v})} lang={lang} isLight={isLight} required disabled={busy}/></AdminField>)}</div>
    </section>
    <section className="access-card ai-service-card" aria-labelledby="ai-test-heading">
     <header className="access-record-heading"><h2 id="ai-test-heading"><FlaskConical size={19} aria-hidden="true"/>{t('testEnable')}</h2></header>
     <div className="ai-test-body" role="status" aria-live="polite">
      {busy?<p className="ai-service-progress"><LoaderCircle size={18} aria-hidden="true"/>{t('busy')}</p>:check?<div className="ai-test-results">{check.results.map((r:any)=><div className="ai-test-result" key={r.model}><div><strong>{r.model}</strong>{r.actualModel&&<span className="ai-service-muted">{t('actualModel')}: {r.actualModel}</span>}</div>{status(r.ok)}</div>)}<p className="ai-service-muted">{t(check.ok?'checksPassed':'testFailed')}</p></div>:<p className="ai-service-muted">{t('testHint')}</p>}
     </div>
     <footer className="access-record-action ai-service-actions"><button type="button" className="ai-primary" disabled={busy||unresolved} onClick={onSubmit}><FlaskConical size={16} aria-hidden="true"/>{t(busy?'busy':'testSave')}</button></footer>
    </section>
   </div>
   <section className="access-card ai-service-support" aria-label={t('support')}>
    <CrmDisclosure heading={t('actual')}><p className="ai-service-muted">{t('callNote')}</p><ul className="ai-service-records">{data.attempts.map((a:any,i:number)=><li key={i}><strong>{a.model}</strong>{status(a.ok)}<time>{formatCrmEventTime(a.at)}</time>{a.fallbackModel&&<span>{t('fallbackUsed')}: {a.fallbackModel}</span>}</li>)}{!data.attempts.length&&<li>{t('empty')}</li>}</ul></CrmDisclosure>
    <CrmDisclosure heading={t('extract')}><ul className="ai-service-records">{data.extractions.map((a:any,i:number)=><li key={i}><strong>{a.model}</strong>{status(a.status==='completed')}<time>{formatCrmEventTime(a.completed_at)}</time></li>)}{!data.extractions.length&&<li>{t('empty')}</li>}</ul></CrmDisclosure>

    <CrmDisclosure heading={t('history')}><ul className="ai-service-records">{data.history?.map((a:any)=><li key={a.requestId}><strong>{a.current.primary} → {a.current.fallback}</strong><span>{a.actor}</span><time>{formatCrmEventTime(a.at)}</time></li>)}{!data.history?.length&&<li>{t('empty')}</li>}</ul></CrmDisclosure>
    <CrmDisclosure heading={t('help')}><p>{t('guide')}</p><dl className="ai-config-values">{Object.entries(data.keys).map(([provider,configured])=><div key={provider}><dt>{provider==='openai'?'OpenAI':'DeepSeek'}</dt><dd>{t(configured?'configured':'missing')}</dd></div>)}</dl></CrmDisclosure>
   </section>
  </>}
 </section>;
}
