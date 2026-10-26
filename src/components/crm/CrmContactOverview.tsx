import {contactOverview} from '../../utils/crmContactOverview';
/** Relative time belongs to the sales timestamp; context adds only cross-record information. */
export function contactElapsedLabel(lead:any,lang='zh',now=Date.now()){
 const ms=contactOverview(lead,undefined,now).elapsedMs;if(ms===null)return '';
 const m=Math.floor(ms/60000),h=Math.floor(m/60),d=Math.floor(h/24);
 if(lang==='zh')return m<1?'不到1分钟前':d?`${d}天${h%24}小时前`:h?`${h}小时${m%60}分钟前`:`${m}分钟前`;
 return lang==='id'?(d?`${d} hari ${h%24} jam lalu`:h?`${h} jam ${m%60} menit lalu`:`${m} menit lalu`):(d?`${d}d ${h%24}h ago`:h?`${h}h ${m%60}m ago`:`${m}m ago`);
}
export function CrmContactOverview({lead,lang='zh'}:any){
 const v=contactOverview(lead),t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const customer=lead.interactionTimeline?.customer;
 const activity=v.customerAfterContact&&!v.replyAfterContact?(customer?.source==='assessment'?t('此后客户完成了测评','Customer completed an assessment afterwards','Setelah itu pelanggan menyelesaikan asesmen'):customer?.source==='chat'||customer?.source==='request'?t('此后客户发来新咨询','Customer sent a new inquiry afterwards','Setelah itu pelanggan mengirim pertanyaan baru'):t('此后客户有新的主动互动','New customer activity afterwards','Ada aktivitas baru dari pelanggan setelah itu')):null;
 if(!v.stale&&!activity)return null;
 const hours=v.thresholdMs/3600000,limit=hours>=24&&hours%24===0?t(`${hours/24}天`,`${hours/24}d`,`${hours/24} hari`):t(`${hours}小时`,`${hours}h`,`${hours} jam`);
 return <div className="crm-sales-contact-context">{v.stale&&<p>{t(`距主动联系已达${limit}参考时长`,`Sales outreach reference interval reached: ${limit}`,`Interval referensi kontak sales tercapai: ${limit}`)}</p>}{activity&&<p>{activity}</p>}</div>;
}
