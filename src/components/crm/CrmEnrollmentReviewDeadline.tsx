import {useEffect,useState} from 'react';
import {formatCrmEventTime,formatCrmSummaryTime} from '../../utils/crmOperatingTime';
import type {CrmLanguage} from '../../utils/crmLanguage';

const labels = {
  zh: ['财务首轮核验目标', '首轮核验已到期，请跟进财务'],
  en: ['First payment review due', 'First payment review due. Follow up with Finance'],
  id: ['Target pemeriksaan pembayaran pertama', 'Pemeriksaan pertama jatuh tempo. Tindak lanjuti tim keuangan'],
};

export function CrmEnrollmentReviewDeadline({dueAt,lang,compact=false}:{
  dueAt?:string|null;lang:CrmLanguage;compact?:boolean;
}) {
  const due=dueAt?Date.parse(dueAt):NaN;
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{
    const current=Date.now();
    setNow(current);
    if(!Number.isFinite(due)||due<=current)return;
    const timer=window.setInterval(()=>{
      const time=Date.now();
      if(time>=due){setNow(time);window.clearInterval(timer);}
    },30_000);
    return ()=>window.clearInterval(timer);
  },[due]);
  if(!dueAt||!Number.isFinite(due))return null;
  const label=labels[lang==='zh'||lang==='id'?lang:'en'][now>=due?1:0];
  const full=formatCrmEventTime(dueAt);
  return <div className="crm-work-muted">{label} · <time dateTime={dueAt} title={compact?full:undefined}>
    {compact?formatCrmSummaryTime(dueAt):full}</time></div>;
}
