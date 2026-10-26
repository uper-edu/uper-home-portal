import {enrollmentMilestoneLabel} from '../../utils/crmFactMilestones';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';
import type {CrmLeadRecord} from '../../types/crmLead';
/** Compact event facts only; scores stay in Learning needs, history stays in Follow-up. */
export function CrmListMilestones({lead,onOpen}:{lead:CrmLeadRecord;onOpen:()=>void}){
 const groups=[...(lead.factMilestoneSummary||[])].sort((a,b)=>Number(b.key==='enrollment_confirmation')-Number(a.key==='enrollment_confirmation'));
 if(!groups.length)return null;
 return <div className="crm-list-milestones" aria-label="事实里程碑"><span className="crm-list-progress-label">已完成</span>{groups.map(g=>{const name=g.key==='enrollment_confirmation'?enrollmentMilestoneLabel(g):g.key==='assessment:full'?'完整测评':g.key==='assessment:express'?'快速测评':'测评';const stamp=g.latest.occurredAt?formatCrmOperatingTime(g.latest.occurredAt,viewerTimeZone()):null;const count=g.key==='enrollment_confirmation'?`确认${g.count}条`:`${g.count}次`;return <button type="button" key={g.key} className="crm-work-support-link" title={`${name} · ${count} · ${stamp||'实际发生时间未知'}${g.unknownCount?'；含'+g.unknownCount+'条时间未知':''}`} aria-label={`查看${name}的历次记录和依据，${count}，${stamp||'实际发生时间未知'}`} onClick={onOpen}><span>{name}{g.key==='enrollment_confirmation'?'':` ${count}`}</span><span className="crm-work-muted"> · {stamp?stamp.slice(5,10):'时间未知'}</span></button>;})}</div>;
}
