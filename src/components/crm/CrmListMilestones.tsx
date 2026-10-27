import {enrollmentMilestoneLabel} from '../../utils/crmFactMilestones';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';
import {useCrmUiText,useCrmUiLanguage} from './CrmUiLanguage';
import type {CrmLeadRecord} from '../../types/crmLead';
/** Compact established facts only; original assessment decisions remain unchanged. */
export function CrmListMilestones({lead,onOpen,lang:requested}:{lead:CrmLeadRecord;onOpen:()=>void;lang?:string}){
 const lang=useCrmUiLanguage(requested),ui=useCrmUiText(lang),t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const groups=[...(lead.factMilestoneSummary||[])].sort((a,b)=>Number(b.key==='enrollment_confirmation')-Number(a.key==='enrollment_confirmation'));
 if(!groups.length)return null;
 return <div className="crm-list-milestones" aria-label={ui('事实里程碑')}><span className="crm-list-progress-label">{ui('已完成')}</span>{groups.map(g=>{
 const name=ui(g.key==='enrollment_confirmation'?enrollmentMilestoneLabel(g):g.key==='assessment:full'?'完整测评':g.key==='assessment:express'?'快速测评':'测评');
 const stamp=g.latest.occurredAt?formatCrmOperatingTime(g.latest.occurredAt,viewerTimeZone()):null;
 const count=g.key==='enrollment_confirmation'?t(`确认${g.count}条`,`${g.count} confirmations`,`${g.count} konfirmasi`):t(`${g.count}次`,`${g.count} attempts`,`${g.count} kali`);
 const unknown=t('实际发生时间未知','Occurrence time unknown','Waktu kejadian tidak diketahui');
 const history=t(`查看${name}的历次记录和依据，${count}，${stamp||unknown}`,`View ${name} history and evidence, ${count}, ${stamp||unknown}`,`Lihat riwayat dan bukti ${name}, ${count}, ${stamp||unknown}`);
 return <button type="button" key={g.key} className="crm-work-support-link" title={`${name} · ${count} · ${stamp||unknown}${g.unknownCount?t('；含'+g.unknownCount+'条时间未知',`; ${g.unknownCount} undated`,`; ${g.unknownCount} tanpa waktu`):''}`} aria-label={history} onClick={onOpen}><span>{name}{g.key==='enrollment_confirmation'?'':lang==='zh'?` ${count}`:` ×${g.count}`}</span><span className="crm-work-muted"> · {stamp?stamp.slice(5,10):ui('时间未知')}</span></button>;
 })}</div>;
}
