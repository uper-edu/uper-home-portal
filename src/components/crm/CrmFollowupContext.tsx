import {viewerTimeZone} from '../../utils/crmOperatingTime';
import { contactRestriction } from '../../utils/crmContact';
import { CrmNoResponseSummary } from './CrmNoResponseSummary';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CrmDisclosure } from './CrmDisclosure';
import { followupOverview, messageTaskLinks } from '../../utils/crmFollowupOverview';
import { crmMessageTimestamp } from '../../utils/crmMessageTime';
import { presentFollowUpTask } from '../../utils/crmTaskPresentation';
import { crmValue } from '../../utils/crmLanguage';
import { formatCrmOperatingTime } from '../../utils/crmOperatingTime';
const wording=(lang:string,en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;

/** Restrictions describe permission to contact, never the mere presence of a future task. */
export function CrmContactRestriction({lead,lang,timezone,onArrange}:any){
 const restriction=contactRestriction(lead);
 if(!restriction)return null;
 const t=(en:string,id:string,zh:string)=>wording(lang,en,id,zh);
 const reason=restriction==='until'?lead.contactReview?.reason:lead.contactArrangement?.reason;
 const at=lead.contactReview?.reviewAt;
 return <aside className="crm-contact-restriction" data-restriction={restriction} aria-label={t('Contact restriction','Pembatasan kontak','联系限制')}>
  <div><strong>{restriction==='stopped'?t('Proactive contact stopped','Kontak proaktif dihentikan','停止主动联系'):restriction==='legacy'?t('Previous contact arrangement needs review','Pengaturan kontak sebelumnya perlu ditinjau','原联系安排待核对'):t('Do not initiate contact before the agreed time','Jangan hubungi sebelum waktu yang disepakati','约定时间前不主动联系')}</strong>
  {restriction==='until'&&<span>{at&&Number.isFinite(Date.parse(at))?formatCrmOperatingTime(at,timezone):t('Time needs review','Waktu perlu ditinjau','时间待核对')}</span>}
  {reason&&<p>{reason}</p>}</div>
  {onArrange&&<button type="button" className="crm-work-link" onClick={onArrange}>{t('Adjust arrangement','Ubah pengaturan','调整安排')}</button>}
 </aside>;
}
function Excerpt({text,lang}:any){
 const [expanded,setExpanded]=useState(false);
 if(typeof text!=='string'||!text)return null;
 const long=text.length>120||text.includes('\n');
 return <><p className={`crm-recent-excerpt ${expanded?'is-expanded':''}`}>{text}</p>{long&&<button type="button" className="crm-work-link" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{wording(lang,expanded?'Show less':'Read full note',expanded?'Tutup':'Baca selengkapnya',expanded?'收起':'展开全文')}</button>}</>;
}
function ContactRecord({log,heading,lang,timezone,onSource}:any){
 timezone=viewerTimeZone();
 return <section className="crm-recent-row"><h4>{heading}</h4><div>
  <p className="crm-recent-meta"><strong>{crmValue(log.connectStatus,lang)}</strong><span>{crmValue(log.channel,lang)}</span>{log.staffName&&<span>{log.staffName}</span>}<span>{wording(lang,'Recorded','Dicatat','记录于')} {formatCrmOperatingTime(log.timestamp||log.at,timezone)}</span></p>
  {log.contactCorrectionId&&<p className="crm-simple-help">联系结果按后续修正显示；原文及修正依据保留在下方完整记录。</p>}
  <Excerpt text={log.summary} lang={lang}/>
  {onSource&&log.sourceMessageId&&log.sourceConversationId&&<button type="button" className="crm-work-link" onClick={()=>onSource({details:log})}>{wording(lang,'View linked message','Lihat pesan terkait','查看关联原文')}</button>}
 </div></section>;
}
export function CrmFollowupContext({lead,lang,timezone,onSource,tasks,facts,requests,taskError,onTask}:any){
 timezone=viewerTimeZone();
 const t=(en:string,id:string,zh:string)=>wording(lang,en,id,zh);
 const stats=followupOverview(lead),latest=stats.lastAttempt,message=stats.message;
 const links=messageTaskLinks(message,lead.chatTranscript||[],tasks||[],facts||[],requests||[]);
 return <div className="crm-recent-communication">
  {message&&<section className="crm-recent-row crm-recent-message"><h4>{t('Latest customer message','Pesan pelanggan terbaru','最近客户消息')}</h4><div>
   <p className="crm-recent-meta"><span>{formatCrmOperatingTime(crmMessageTimestamp(message)!,timezone)}</span></p>
   <Excerpt key={lead.id+'-message-'+(message.id||message.request_id||crmMessageTimestamp(message))} text={message.content} lang={lang}/>
   {onSource&&message.conversation_id&&(message.id||message.request_id)&&<button type="button" className="crm-work-link" onClick={()=>onSource({details:{sourceConversationId:message.conversation_id,sourceMessageId:message.id||message.request_id}})}><ArrowUpRight size={13} aria-hidden="true"/>{t('View original message','Lihat pesan asli','查看原文')}</button>}
   {taskError?<p className="crm-recent-warning">{t('Task links unavailable. Retry loading follow-up information.','Tautan tugas tidak tersedia. Coba muat ulang informasi tindak lanjut.','任务关联暂不可用，请重试加载跟进信息。')}</p>:links.length>0&&<div className="crm-recent-task-links">{links.map(({id,task})=>{const view=task&&presentFollowUpTask(task,lang,timezone);return view?<button key={id} type="button" className="crm-work-link crm-message-task-link" onClick={()=>onTask?.(id)}>{view.action} · {view.status}</button>:<p key={id}>{t('Linked task information unavailable','Informasi tugas terkait tidak tersedia','关联任务信息暂不可用')}</p>;})}</div>}
  </div></section>}
  {latest?<ContactRecord key={lead.id+'-latest-'+(latest.id||latest.timestamp||latest.at)} log={latest} heading={t('Latest saved contact record','Catatan kontak terakhir disimpan','最近保存的联系记录')} lang={lang} timezone={timezone} onSource={onSource}/>:<p className="crm-recent-empty">{(lead.recordAmendments||[]).length?'当前没有计入统计的人工联系记录；原记录和修正仍保留在下方。':t('No human contact recorded yet','Belum ada catatan kontak oleh staf','尚无人工联系记录')}</p>}
  {stats.lastConnected&&stats.lastConnected!==latest&&<ContactRecord key={lead.id+'-connected-'+(stats.lastConnected.id||stats.lastConnected.timestamp||stats.lastConnected.at)} log={stats.lastConnected} heading={t('Previous saved connected / replied record','Catatan tersambung / dibalas tersimpan sebelumnya','此前保存的已接通／回复记录')} lang={lang} timezone={timezone} onSource={onSource}/>}

  {lead.nextAction&&<div className="crm-recent-note"><CrmDisclosure heading={t('Saved customer note','Catatan pelanggan tersimpan','客户人工备注')}><p className="crm-followup-record-text">{lead.nextAction}</p></CrmDisclosure></div>}
 </div>;
}
