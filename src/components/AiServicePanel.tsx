import {useEffect,useRef,useState,type ReactNode} from 'react';
import {CheckCircle2,FlaskConical,LoaderCircle,Save,XCircle} from 'lucide-react';
import {AdminEditor} from './admin/AdminEditor';
import {AdminListState} from './admin/AdminList';
import {AdminRefreshAction} from './admin/AdminRefreshAction';
import {AdminField,AdminForm,AdminRequiredNote} from './AdminForm';
import {AdminFormFeedback,AdminSavedReadError,AdminFormGrid,AdminFormSection,AdminFormSummary} from './AdminFormLayout';
import {CrmSingleSelect} from './crm/CrmSingleSelect';
import {CrmDisclosure} from './crm/CrmDisclosure';
import {CrmPageAction} from './crm/CrmPageAction';
import {aiModelSlots,defaultReasoningEffort,effortField,reasoningEfforts,sameAiSelection,selectedReasoningEffort,supportsReasoningEffort,type AiSelection} from '../utils/aiModelSelection';
import {aiServiceText} from '../utils/aiServiceLanguage';
import {testAndSaveAi} from '../utils/aiServiceSubmit';
import {formatCrmEventTime} from '../utils/crmOperatingTime';
import type {CrmLanguage} from '../utils/crmLanguage';

type AiHistoryRecord={requestId:string;current:AiSelection;actor:string;at:string};
type AiServiceData={
  current:AiSelection;
  revision:number;
  models:string[];
  history?:AiHistoryRecord[];
  attempts?:{model:string;ok:boolean;at:string;fallbackModel?:string}[];
  extractions?:{model:string;status:string;completed_at:string}[];
};
type AiServiceCheck={ok:boolean;results:{model:string;actualModel?:string;ok:boolean}[]};
type Notice=''|'verified'|'unknown'|'queryPendingFailed'|'error'|'conflict'|'required';
type ReadFailure='error'|'denied';
const pendingKey='uper-ai-pending',draftKey='uper-ai-draft';
const emptySelection:AiSelection={primary:'',fallback:''};
const words=(lang:CrmLanguage)=>(key:keyof typeof aiServiceText)=>aiServiceText[key][lang==='zh'?2:lang==='id'?1:0];

async function call(path='',body?:object){
  const response=await fetch('/api/admin/ai-service'+path,{
    method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,
    body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(body?155000:15000),
  });
  const data=await response.json();
  if(!response.ok)throw Object.assign(Error(data.error),{status:response.status});
  return data;
}
function readDraft():AiSelection|undefined{
  if(typeof sessionStorage==='undefined')return;
  try {
    const draft=JSON.parse(sessionStorage.getItem(draftKey)??'null');
    if(typeof draft?.primary==='string'&&typeof draft.fallback==='string')return draft;
  }catch{/* Ignore invalid browser storage. */}
}
function isDenied(error:unknown){
  return [401,403].includes((error as {status?:number}).status??0);
}

export function AiServicePanel({lang,isLight,renderHeading,children,onDraftChange,onBusyChange}:{
  lang:CrmLanguage;isLight:boolean;
  renderHeading:(actions:ReactNode,required:boolean)=>ReactNode;
  children:ReactNode;onDraftChange:(dirty:boolean)=>void;onBusyChange:(busy:boolean)=>void;
}){
  const [data,setData]=useState<AiServiceData>();
  const [draft,setDraft]=useState<AiSelection|undefined>(readDraft);
  const [check,setCheck]=useState<AiServiceCheck>();
  const [busy,setBusy]=useState(false),[querying,setQuerying]=useState(false);
  const [failure,setFailure]=useState<ReadFailure>(),[notice,setNotice]=useState<Notice>('');
  const [unresolved,setUnresolved]=useState(()=>typeof sessionStorage!=='undefined'&&!!sessionStorage.getItem(pendingKey));
  const [awaitingSavedRead,setAwaitingSavedRead]=useState(false);
  const [diagnosing,setDiagnosing]=useState(false);
  const submitting=useRef(false),reading=useRef(false);
  const selection=draft??data?.current??emptySelection;
  const dirty=!!data&&!sameAiSelection(selection,data.current);
  useEffect(()=>{
    onDraftChange(dirty);
    return ()=>onDraftChange(false);
  },[dirty,onDraftChange]);
  useEffect(()=>{
    onBusyChange(busy);
    return ()=>onBusyChange(false);
  },[busy,onBusyChange]);

  const clearPending=()=>{
    sessionStorage.removeItem(pendingKey);
    sessionStorage.removeItem(draftKey);
    setUnresolved(false);
  };
  const clearDenied=()=>{
    setData(undefined);setDraft(undefined);setCheck(undefined);setDiagnosing(false);setNotice('');
    setFailure('denied');
  };
  const load=async()=>{
    if(reading.current)return;
    reading.current=true;setQuerying(true);
    try{
      const next:AiServiceData=await call();
      setData(next);setFailure(undefined);setAwaitingSavedRead(false);
      const pending=sessionStorage.getItem(pendingKey);
      if(pending&&next.history?.some(record=>record.requestId===pending)){
        clearPending();setDraft(undefined);setCheck(undefined);setNotice('');
      }else if(pending)setNotice('unknown');
      else if(notice==='conflict'||notice==='queryPendingFailed'){
        setNotice('');setCheck(undefined);
      }
    }catch(error){
      if(isDenied(error))clearDenied();
      else if(sessionStorage.getItem(pendingKey)){
        if(!data)setFailure('error');
        setNotice('queryPendingFailed');
      }
      else setFailure('error');
    }finally{reading.current=false;setQuerying(false);}
  };
  useEffect(()=>{
    if(!sessionStorage.getItem(pendingKey))sessionStorage.removeItem(draftKey);
    void load();
  },[]);
  const choose=(next:AiSelection)=>{
    setDraft(data&&sameAiSelection(next,data.current)?undefined:next);
    setCheck(undefined);setNotice('');
  };
  const submit=async(diagnostic=false)=>{
    if(!data||submitting.current||reading.current||failure||unresolved||notice==='conflict')return;
    const candidate=diagnostic?data.current:selection;
    if(!candidate.primary||!candidate.fallback||candidate.primary===candidate.fallback){
      setNotice('required');return;
    }
    if(!diagnostic&&!dirty)return;
    submitting.current=true;setBusy(true);setNotice('');setCheck(undefined);
    let activating=false;
    const requestId=crypto.randomUUID();
    try{
      const result=await testAndSaveAi({
        call,current:data.current,selection:candidate,revision:data.revision,requestId,onChecked:setCheck,
        beforeActivate:()=>{
          activating=true;
          sessionStorage.setItem(draftKey,JSON.stringify(candidate));
          sessionStorage.setItem(pendingKey,requestId);
        },
      });
      if(result.unchanged)setNotice('verified');
      if(result.saved){
        clearPending();setDraft(undefined);setCheck(undefined);setAwaitingSavedRead(true);
        setData(previous=>previous&&{...previous,current:result.result.current,revision:result.result.revision});
        await load();
      }
    }catch(error){
      const message=(error as Error).message;
      if(isDenied(error))clearDenied();
      else if(message==='conflict'||message==='test_required'){
        clearPending();setNotice('conflict');
      }else if(activating){
        setNotice('unknown');setUnresolved(true);
      }else setNotice('error');
    }finally{submitting.current=false;setBusy(false);}
  };

  return <AiServiceContent {...{lang,isLight,data,selection,check,busy,notice,unresolved,diagnosing,querying,failure,awaitingSavedRead,renderHeading}}
    onSelect={choose} onSubmit={()=>void submit()} onQuery={()=>void load()}
    onDiagnose={()=>{setCheck(undefined);setNotice('');setDiagnosing(true);}}
    onTestCurrent={()=>void submit(true)}
    onCloseDiagnostics={()=>{if(!busy){setDiagnosing(false);setCheck(undefined);setNotice('');}}}>
    {children}
  </AiServiceContent>;
}

type ContentProps={
  lang:CrmLanguage;isLight:boolean;data?:AiServiceData;selection:AiSelection;check?:AiServiceCheck|null;
  busy:boolean;notice:Notice;unresolved:boolean;diagnosing?:boolean;querying?:boolean;failure?:ReadFailure;awaitingSavedRead?:boolean;
  renderHeading:(actions:ReactNode,required:boolean)=>ReactNode;children?:ReactNode;
  onSelect:(selection:AiSelection)=>void;onSubmit:()=>void;onQuery:()=>void;onDiagnose:()=>void;
  onTestCurrent:()=>void;onCloseDiagnostics:()=>void;
};
export function AiServiceContent({lang,isLight,data,selection,check,busy,notice,unresolved,diagnosing,querying,failure,awaitingSavedRead,
  renderHeading,children,onSelect,onSubmit,onQuery,onDiagnose,onTestCurrent,onCloseDiagnostics}:ContentProps){
  const t=words(lang);
  const status=(ok:boolean)=><span className="ai-check" data-ok={ok}>
    {ok?<CheckCircle2 size={15} aria-hidden="true"/>:<XCircle size={15} aria-hidden="true"/>}{t(ok?'ready':'failed')}
  </span>;
  const describe=(value:AiSelection,role:typeof aiModelSlots[number])=>{
    const effort=selectedReasoningEffort(value,role);
    return effort?value[role]+' · '+t(effort):value[role];
  };
  const feedback=notice&&<AdminFormFeedback lang={lang}
    state={notice==='verified'?'saved':notice==='unknown'||notice==='queryPendingFailed'?'unknown':'error'}>
    {t(notice)}
  </AdminFormFeedback>;
  const results=(busy||check)&&<div role="status" aria-live="polite">
    {busy?<p className="ai-service-progress"><LoaderCircle size={18} aria-hidden="true"/>{t('busy')}</p>:
      check&&<div className="ai-test-results">
        {check.results.map(result=><div className="ai-test-result" key={result.model}>
          <div><strong>{result.model}</strong>{result.actualModel&&<span className="ai-service-muted">{t('actualModel')} · {result.actualModel}</span>}</div>
          {status(result.ok)}
        </div>)}
        <p className="ai-service-muted">{t(check.ok?'checksPassed':'testFailed')}</p>
      </div>}
  </div>;
  const blocked=busy||!!querying||!!failure||unresolved||notice==='conflict';
  const actionDisabled=!data||!selection.primary||!selection.fallback||sameAiSelection(selection,data.current);
  const attempts=data?.attempts??[],extractions=data?.extractions??[],history=data?.history??[];
  return <>
    <AdminForm lang={lang} onSubmit={(event:React.FormEvent)=>{event.preventDefault();onSubmit();}}
      className="integration-settings-body" aria-busy={!diagnosing&&busy||undefined}>
      {renderHeading(failure!=='denied'&&<>
        <AdminRefreshAction label={t(unresolved||notice==='conflict'?'checkOperation':'refresh')}
          loading={querying} disabled={busy} onClick={onQuery}/>
        {data&&!unresolved&&notice!=='conflict'&&<CrmPageAction icon={Save} type="submit" variant="primary"
          label={t(busy&&!diagnosing?'busy':'testSave')} keepFocusWhileLoading loading={busy&&!diagnosing}
          disabled={actionDisabled||(!busy&&blocked)||!!diagnosing} />}
      </>,!!data)}
      {awaitingSavedRead&&failure==='error'?<AdminSavedReadError lang={lang} busy={querying} onRetry={onQuery}/>:(!data||failure)&&<AdminListState lang={lang} state={failure??'loading'} onRetry={onQuery}/>}
      {!data&&!diagnosing&&feedback}
      {data&&<AdminFormSection variant="card" title={t('models')} actions={<CrmPageAction icon={FlaskConical}
        label={t('testCurrent')} onClick={onDiagnose} disabled={blocked}/>}>
        <AdminFormGrid>
          {aiModelSlots.map(role=>{
            const effort=selectedReasoningEffort(selection,role);
            const modelId='ai-'+role+'-model',effortId='ai-'+role+'-effort',key=effortField[role];
            return <div key={role} data-admin-stack>
              <AdminField as="div" required><label htmlFor={modelId}>{t(role)}</label>
                <CrmSingleSelect controlId={modelId} label={t(role)} value={selection[role]}
                  options={data.models.map(model=>({value:model,label:model}))}
                  onChange={model=>onSelect({...selection,[role]:model,[key]:supportsReasoningEffort(model)?selection[key]:undefined})}
                  lang={lang} isLight={isLight} required disabled={blocked}/>
              </AdminField>
              {effort?<AdminField as="div"><label htmlFor={effortId}>{t(key)}</label>
                <CrmSingleSelect controlId={effortId} label={t(key)} value={effort} options={reasoningEfforts.map(value=>({value,label:t(value)}))}
                  onChange={value=>{
                    const effort=reasoningEfforts.find(item=>item===value);
                    if(effort)onSelect({...selection,[key]:effort===defaultReasoningEffort?undefined:effort});
                  }} lang={lang} isLight={isLight} disabled={blocked}/>
              </AdminField>:<p className="ai-service-muted">{t('reasoningUnavailable')}</p>}
            </div>;
          })}
        </AdminFormGrid>
        <p className="ai-service-muted">{t('shortGuide')}</p>
        {!diagnosing&&<>{feedback}{results}{!busy&&!notice&&!check&&!actionDisabled&&<AdminFormFeedback state="dirty" lang={lang}/>}</>}
      </AdminFormSection>}
    </AdminForm>
    {children}
    {data&&<AdminFormSection variant="card" title={t('support')}>
      <div className="ai-service-support">
        <CrmDisclosure heading={t('actual')}>
          <p className="ai-service-muted">{t('callNote')}</p>
          <ul className="ai-service-records">{attempts.map((attempt,i)=><li key={i}>
            <strong>{attempt.model}</strong>{status(attempt.ok)}<time>{formatCrmEventTime(attempt.at)}</time>
            {attempt.fallbackModel&&<span>{t('fallbackUsed')} · {attempt.fallbackModel}</span>}
          </li>)}{!attempts.length&&<li>{t('empty')}</li>}</ul>
        </CrmDisclosure>
        <CrmDisclosure heading={t('extract')}>
          <ul className="ai-service-records">{extractions.map((attempt,i)=><li key={i}>
            <strong>{attempt.model}</strong>{status(attempt.status==='completed')}<time>{formatCrmEventTime(attempt.completed_at)}</time>
          </li>)}{!extractions.length&&<li>{t('empty')}</li>}</ul>
        </CrmDisclosure>
        <CrmDisclosure heading={t('history')}>
          <ul className="ai-service-records">{history.map(record=><li key={record.requestId}>
            <strong>{describe(record.current,'primary')} → {describe(record.current,'fallback')}</strong>
            <span>{record.actor}</span><time>{formatCrmEventTime(record.at)}</time>
          </li>)}{!history.length&&<li>{t('empty')}</li>}</ul>
        </CrmDisclosure>
        <CrmDisclosure heading={t('help')}><p>{t('guide')}</p><p>{t('reasoningHint')}</p></CrmDisclosure>
      </div>
    </AdminFormSection>}
    {data&&diagnosing&&<AdminEditor lang={lang} light={isLight} title={t('testCurrent')} busy={busy}
      onClose={onCloseDiagnostics} footer={<>
        <button type="button" onClick={onCloseDiagnostics} disabled={busy}>{t('close')}</button>
        <button type="button" data-primary disabled={blocked} onClick={onTestCurrent}>{t('testCurrent')}</button>
      </>}>
      <AdminFormSummary title={t('active')} fields={aiModelSlots.map(role=>[t(role),describe(data.current,role)])}/>
      {feedback}{results}
      {notice==='conflict'&&<button type="button" className="crm-work-button" disabled={querying} onClick={onQuery}>{t('checkOperation')}</button>}
    </AdminEditor>}
  </>;
}
