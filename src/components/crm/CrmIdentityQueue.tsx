import {CrmIdentityAction} from './CrmIdentityAction';
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
    <p>{t('Review these new submissions first. Existing customers continue normally; pending submissions cannot be assigned or followed up.','Tinjau pendaftaran baru ini terlebih dahulu. Pelanggan lama tetap berjalan; catatan tertunda belum dapat ditugaskan atau ditindaklanjuti.','请优先核实这些新登记记录；已有客户正常跟进，待核实记录暂不分配或开展销售跟进。')}</p>
    {error&&<p role="alert">{outreachText(error,lang)} <button type="button" onClick={()=>setRetry(n=>n+1)}>{t('Retry','Coba lagi','重试')}</button></p>}
    {rows.map(r=><CrmIdentityAction lang={lang} key={[r.leadId,r.candidateId].join(':')} onClick={()=>onOpen(r.leadId,r.candidateId)}>{r.name} ↔ {r.candidateName} · {t('Review identity','Verifikasi identitas','核实身份')}</CrmIdentityAction>)}
  </section>;
}
