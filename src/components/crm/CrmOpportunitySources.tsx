import {useEffect,useState} from 'react';
import {opportunitySourceKind,type OpportunitySource,type OpportunitySourceRef} from '../../utils/crmOpportunitySources';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {CrmProgressSourceBody,progressSourceTiming} from './CrmSalesProgressHistory';
import {CrmDisclosure} from './CrmDisclosure';

const copy=(lang:CrmLanguage,zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
const labels={questionnaire:['官网问卷','Website questionnaire','Kuesioner situs web'],message:['客户消息','Customer message','Pesan pelanggan'],sales_record:['销售记录','Sales record','Catatan sales']} as const;
const label=(source:OpportunitySource,lang:CrmLanguage)=>{
  const words=labels[opportunitySourceKind(source)!];
  return copy(lang,words[0],words[1],words[2]);
};

export function CrmOpportunitySourcePicker({leadId,lang,disabled,selected,onChange}:{
  leadId:string;lang:CrmLanguage;disabled:boolean;selected:OpportunitySourceRef[];onChange:(refs:OpportunitySourceRef[])=>void;
}) {
  const [requested,setRequested]=useState(selected.length>0);
  const [sources,setSources]=useState<OpportunitySource[]>();
  const [error,setError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!requested)return;
    const controller=new AbortController();
    setError(false);
    fetch(`/api/crm/leads/${encodeURIComponent(leadId)}/stage-context`,{signal:controller.signal,cache:'no-store'})
      .then(response=>{if(!response.ok)throw Error();return response.json();})
      .then(data=>{
        if(data.leadId!==leadId||!Array.isArray(data.sources))throw Error();
        if(!controller.signal.aborted)setSources(data.sources.filter(opportunitySourceKind));
      }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[leadId,requested,attempt]);
  return <CrmDisclosure heading={copy(lang,'关联客户原文','Link original customer records','Tautkan catatan asli pelanggan')+(selected.length?` (${selected.length})`:'')}
    onToggle={event=>{if(event.currentTarget.open)setRequested(true);}}>
    {error?<p role="alert">{copy(lang,'暂时无法读取客户原文。','Customer records could not be loaded.','Catatan pelanggan belum dapat dimuat.')} <button type="button" className="crm-work-link" onClick={()=>setAttempt(value=>value+1)}>{copy(lang,'重试','Retry','Coba lagi')}</button></p>:
      !sources?<p role="status">{copy(lang,'正在读取客户原文…','Loading customer records…','Memuat catatan pelanggan…')}</p>:
      !sources.length?<p>{copy(lang,'暂无可关联的客户原文。','No original customer records to link.','Belum ada catatan asli untuk ditautkan.')}</p>:
      <>
        <p>{copy(lang,'最多选择 5 条与本次购课有关的原文。','Select up to 5 records relevant to this opportunity.','Pilih hingga 5 catatan yang relevan dengan peluang ini.')}</p>
        {sources.map(source=>{
          const checked=selected.some(ref=>ref.type===source.type&&ref.id===source.id);
          return <div key={`${source.type}:${source.id}`} className="crm-stage-basis-original">
            <label className="admin-field admin-field--choice"><input type="checkbox" checked={checked} disabled={disabled||(!checked&&selected.length>=5)}
              onChange={()=>onChange(checked?selected.filter(ref=>ref.type!==source.type||ref.id!==source.id):[...selected,{type:source.type,id:source.id}])}/>
              {label(source,lang)} · {progressSourceTiming(source,lang)}</label>
            <CrmProgressSourceBody source={source} lang={lang}/>
          </div>;
        })}
      </>}
  </CrmDisclosure>;
}

export function CrmOpportunitySourceLink({source,leadId,lang}:{source:OpportunitySource;leadId:string;lang:CrmLanguage}) {
  const message=source.type==='customer_message';
  const href='/crm?'+new URLSearchParams({tab:'leads',lead:leadId,leadView:message?'chat':'profile',
    target:message?'message':'fact',targetId:source.factId??source.id});
  return <div className="crm-stage-basis-original">
    <a className="crm-work-link" href={href}>{label(source,lang)}</a>
    <span>{progressSourceTiming(source,lang)}</span>
    <CrmProgressSourceBody source={source} lang={lang}/>
  </div>;
}
