import {crmInstant} from './crmOperatingTime';
export const observationKey=(o:any)=>o.kind+':'+o.field;
export function extractionRoot(row:any){return row.input?.sourceRoot||{type:row.source_type,id:row.source_id,occurredAt:row.input?.occurredAt??row.output?.occurredAt??null};}
export function extractionFamily(row:any){const r=extractionRoot(row);return r.type+':'+r.id;}
const recorded=(r:any)=>crmInstant(r.created_at)?.getTime()||0;
/** A linked correction replaces only its named interpretations. Originals are never removed. */
export function activeExtractionEvidence(rows:any[]){
 const ordered=rows.slice().sort((a,b)=>recorded(a)-recorded(b)||(extractionFamily(a)===extractionFamily(b)?(a.input?.amendment?.sequence||0)-(b.input?.amendment?.sequence||0):0)||String(a.id).localeCompare(String(b.id)));
 const entries:any[]=[];const countability=new Map<string,boolean>();
 for(const row of ordered){const family=extractionFamily(row),observations=row.status==='completed'?row.output?.observations||[]:[];if(row.input?.sourceRoot?.countable!==undefined)countability.set(family,row.input.sourceRoot.countable);
  if(row.input?.amendment?.kind==='correction'){
   const keys=new Set(observations.filter((o:any)=>o.subject==='customer').map(observationKey));
   for(const field of row.input.explicitFields||[])keys.add('field:'+field);
   for(const e of entries)if(e.family===family&&keys.has(observationKey(e.observation)))e.supersededBy=row.source_id;
  }
  for(const observation of observations)entries.push({row,observation,family,root:extractionRoot(row),supersededBy:null});
 }
 return entries.map(e=>({...e,root:{...e.root,countable:countability.get(e.family)??e.root.countable}}));
}
/** Only explicit linked corrections affect the original source's current signal projection. */
export function correctedSignalSources(rows:any[]){return activeExtractionEvidence(rows).filter(e=>!e.supersededBy&&e.row.input?.amendment?.kind==='correction'&&e.observation.kind==='signal'&&e.observation.subject==='customer'&&e.observation.temporality==='negated').map(e=>({sourceType:e.root.type,sourceId:e.root.id,field:e.observation.field,correctionId:e.row.source_id}));}
