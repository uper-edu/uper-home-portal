import {useCrmUiText} from './CrmUiLanguage';
import {useEffect,useState} from 'react';
import {crmStageValue}from'../../utils/crmLanguage';
import {CrmSalesProgressHistory}from'./CrmSalesProgressHistory';
/** Profile is a read-only record of stage and history. Editing belongs to the follow-up workspace. */
export function CrmSalesStageReadOnly({lead,lang,request=fetch}:any){
 const ui=useCrmUiText(lang);

 const[context,setContext]=useState<any>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true;setContext(null);setFailed(false);request(`/api/crm/leads/${lead.id}/stage-context`).then(async(r:any)=>{const d=await r.json();if(!r.ok||d.leadId!==lead.id)throw Error();if(alive)setContext(d);}).catch(()=>{if(alive)setFailed(true);});return()=>{alive=false;};},[lead.id,lead.stageRevision,retry]);
 return <div className="crm-stage-readonly"><strong>{crmStageValue(lead.currentStage,lang)}</strong>{context?<CrmSalesProgressHistory context={context} lang={lang}/>:failed?<p role="alert">{ui("阶段历史暂不可用。")}<button type="button" onClick={()=>setRetry(n=>n+1)}>{ui("重试")}</button></p>:<p role="status">{ui("正在加载阶段历史…")}</p>}</div>;
}
