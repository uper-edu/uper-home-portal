import {agreementTime} from '../../utils/crmProgressDetails';
/** Each active agreement keeps its own title, original date precision and detail entry. */
export function CrmListAgreements({lead,lang,timezone,onOpen}:any){
 const active=(lead.commitments||[]).filter((v:any)=>v.status==='active');if(!active.length)return null;
 const title=lang==='zh'?'客户约定':lang==='id'?'Kesepakatan pelanggan':'Customer agreements';
 return <section className="crm-list-agreements" aria-label={title+(active.length>1?' · '+active.length:'')}>{active.map((v:any,index:number)=><div key={v.id} className="crm-list-agreement" onClick={e=>e.stopPropagation()}>
  <span className="crm-list-agreement-heading"><span className="crm-list-agreements-label">{title}{active.length>1?' '+(index+1):''}</span><span className="crm-list-agreement-date">{agreementTime(v,timezone,lang,true)}</span></span>
  <button type="button" className="crm-work-link crm-interaction-agreement" onClick={onOpen} title={v.action} aria-label={title+'：'+v.action}><span className="crm-list-agreement-preview">{v.action}</span></button>
 </div>)}</section>;
}
