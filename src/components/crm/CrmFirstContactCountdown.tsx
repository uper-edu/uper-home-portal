import {Clock3} from 'lucide-react';
import {useEffect,useState} from 'react';
import {firstContactCountdown} from '../../utils/crmCountdown';
import {crmInstant} from '../../utils/crmOperatingTime';
/** Shared visual treatment; deadline, precision and refresh cadence remain unchanged. */
export function CrmFirstContactCountdown({dueAt,lang='zh'}:{dueAt?:string;lang?:string}){
 const[now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer)},[]);
 const due=crmInstant(dueAt),text=firstContactCountdown(dueAt,now,lang);
 return <span className="crm-countdown-badge" role="timer" aria-live="off" data-tone={due&&due.getTime()>0&&due.getTime()<now?'overdue':'normal'}>
  <Clock3 size={14} strokeWidth={1.75} aria-hidden="true"/>
  <span>{text.split(/(\d+)/).map((part,i)=>/^\d+$/.test(part)?<strong key={i}>{part}</strong>:part)}</span>
 </span>;
}
