import {useEffect,useState} from 'react';
import {canReviewIdentityRole,outreachText} from '../../utils/crmOutreach';
export function CrmIdentityQueue({employee,lang,refresh,onOpen,policyConfig}:any){
  const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const manager=canReviewIdentityRole(employee,policyConfig);
  useEffect(()=>{if(!manager){setRows([]);setError('');return;}const controller=new AbortController();void fetch('/api/crm/identity-reviews',{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setRows(d.reviews);setError('');}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[manager,employee.id,refresh,retry]);
  if(!manager||(!rows.length&&!error))return null;
  const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
  return <section className="crm-customer-context" aria-label={t('Identity review queue','Antrean verifikasi identitas','身份核实队列')}>
    <h3>{t('Identity review queue','Antrean verifikasi identitas','身份核实队列')} · {rows.length}</h3>
    <p>{t('Review identity before assignment or sales outreach. Existing owners and deadlines stay unchanged.','Verifikasi identitas sebelum penugasan atau kontak sales. Penanggung jawab dan tenggat tetap.','先由具备双方权限的核实人员核实，再分配和开展销售外联；现有归属与期限保持。')}</p>
    {error&&<p role="alert">{outreachText(error,lang)} <button type="button" onClick={()=>setRetry(n=>n+1)}>{t('Retry','Coba lagi','重试')}</button></p>}
    {rows.map(r=><button type="button" className="crm-work-button" key={[r.leadId,r.candidateId].join(':')} onClick={()=>onOpen(r.leadId,r.candidateId)}>{r.name} ↔ {r.candidateName} · {t('Review identity','Verifikasi identitas','核实身份')}</button>)}
  </section>;
}
