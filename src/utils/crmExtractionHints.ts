import {crmInstant} from './crmOperatingTime';
import {signalLabels} from './crmExtractionContract';
import {activeExtractionEvidence} from './crmExtractionEvidence';
/** Counts source interactions, not extraction jobs, amendments, or ingestion dates. */
export function extractionHints(rows:any[],now=Date.now()){
 const entries=activeExtractionEvidence(rows).filter(e=>!e.supersededBy&&e.root.countable!==false&&e.observation.kind==='signal'&&e.observation.subject==='customer');
 const time=(e:any)=>crmInstant(e.root.occurredAt)?.getTime()??-Infinity;
 entries.sort((a,b)=>time(b)-time(a)||(crmInstant(b.row.created_at)?.getTime()||0)-(crmInstant(a.row.created_at)?.getTime()||0));
 const latest=new Map<string,any>(),counts=new Map<string,Set<string>>();
 for(const e of entries){const o=e.observation;if(!latest.has(o.field))latest.set(o.field,e);if(e.root.countable!==false&&o.temporality==='current'&&time(e)>=now-7*86400000&&time(e)<=now){const set=counts.get(o.field)||new Set<string>();set.add(e.family);counts.set(o.field,set);}}
 return [...latest].filter(([,e])=>e.observation.temporality==='current').map(([field,e])=>({id:'text-signal:'+field,kind:'evidence',text:signalLabels[field]+' · '+e.observation.quote+((counts.get(field)?.size||0)>=2?'（近7天 '+counts.get(field)!.size+' 条独立互动记录）':'')+(!Number.isFinite(time(e))?'（发生时间未注明，不计入近7天统计）':''),evidenceIds:[e.row.source_id],interactionCount:counts.get(field)?.size||0}));
}
