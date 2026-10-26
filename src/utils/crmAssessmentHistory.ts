import type {HskResult} from '../data/hskAssessment';
export type AssessmentHistoryEntry={id:string;recordedAt?:string;result:HskResult};
export type AssessmentDifference={newerId:string;olderId:string;reason:'score'|'conclusion';gap:number};
const num=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as any:{};
/** Compares stored evidence only. Never grades answers, averages or selects a placement. */
export function assessmentDifferences(entries:AssessmentHistoryEntry[]):AssessmentDifference[]{
 const previous=new Map<string,AssessmentHistoryEntry>();const differences:AssessmentDifference[]=[];
 for(const row of entries){
  const r=obj(row.result),a=obj(r.attempt),mode=a.mode;
  if(!['express','full'].includes(mode))continue;
  const newer=previous.get(mode);previous.set(mode,row);if(!newer)continue;
  const n=obj(newer.result),na=obj(n.attempt);
  const complete=(x:any)=>num(x.skippedCount)&&x.skippedCount===0&&num(x.unansweredCount)&&x.unansweredCount===0&&!obj(x.screeningPlacement).needsReview;
  if(!complete(n)||!complete(r))continue;
  const comparable=typeof a.examVersion==='string'&&!!a.examVersion&&a.examVersion===na.examVersion&&typeof a.scoringVersion==='string'&&!!a.scoringVersion&&a.scoringVersion===na.scoringVersion;
  if(comparable&&num(n.score)&&num(r.score)&&num(n.maxScore)&&n.maxScore>0&&n.maxScore===r.maxScore&&n.score>=0&&r.score>=0&&n.score<=n.maxScore&&r.score<=r.maxScore){
   const gap=Math.abs(n.score-r.score)/n.maxScore*100;
   if(gap>=30){differences.push({newerId:newer.id,olderId:row.id,reason:'score',gap:Math.round(gap)});continue;}
  }
  const rank=(x:any):number|null=>{
   if(mode==='express'){const p=obj(x.screeningPlacement);return !p.needsReview&&[0,1,2,3].includes(p.stage)?p.stage:null;}
   if(!Array.isArray(x.thresholds)||x.thresholds.length!==3)return null;
   const flags=[1,2,3].map(k=>x.thresholds.filter((t:any)=>t?.level===`HSK ${k}`));
   if(flags.some(f=>f.length!==1||typeof f[0].reached!=='boolean'))return null;
   const passed=flags.map(f=>f[0].reached);if(passed.some((v,i)=>v&&passed.slice(0,i).some(p=>!p)))return null;
   return passed.filter(Boolean).length;
  };
  const x=rank(n),y=rank(r);if(x!==null&&y!==null&&Math.abs(x-y)>=2)differences.push({newerId:newer.id,olderId:row.id,reason:'conclusion',gap:Math.abs(x-y)});
 }
 return differences;
}
export function assessmentHistory(entries:AssessmentHistoryEntry[],latest?:HskResult):AssessmentHistoryEntry[]{
 const seen=new Set<string>();const rows=entries.filter(v=>{if(!v||typeof v.id!=='string'||seen.has(v.id))return false;seen.add(v.id);return true;});
 const id=latest?.attempt?.attemptId;if(id&&!seen.has(id))rows.push({id,result:latest});
 return rows.sort((a,b)=>(Date.parse(b.recordedAt||'')||0)-(Date.parse(a.recordedAt||'')||0)||b.id.localeCompare(a.id));
}

/** Different modes have different scopes: this is a caution, never a numeric score comparison. */
export function crossTypeConclusionDifference(entries:AssessmentHistoryEntry[]):boolean{
 const quick=entries.find(v=>v.result?.attempt?.mode==='express');
 const full=entries.find(v=>v.result?.attempt?.mode==='full');
 const q=quick?.result,f=full?.result;
 if(!q||!f||q.skippedCount!==0||q.unansweredCount!==0||f.skippedCount!==0||f.unansweredCount!==0||q.screeningPlacement?.needsReview)return false;
 const stage=q.screeningPlacement?.stage;if(![0,1,2,3].includes(stage as number)||!Array.isArray(f.thresholds)||f.thresholds.length!==3)return false;
 const flags=[1,2,3].map(n=>f.thresholds.filter(t=>t.level===`HSK ${n}`));
 if(flags.some(v=>v.length!==1||typeof v[0].reached!=='boolean'))return false;
 const passed=flags.map(v=>v[0].reached);if(passed.some((v,i)=>v&&passed.slice(0,i).some(p=>!p)))return false;
 return Math.abs((stage as number)-passed.filter(Boolean).length)>=2;
}
