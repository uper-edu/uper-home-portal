import {historyInformation,historyQuoteRange,type HistoryCitation} from './crmHistoryInformation';
import type {HistoryGroup} from './crmHistoryTimeline';

/** Resolve saved field citations only; never infer a quotation from a formatted value. */
export function historyFieldCitation(group:HistoryGroup,fields:string[],rows:any[]=group.extractions,sourceId?:string):HistoryCitation|null{
  const items=historyInformation(group,rows).filter(item=>fields.includes(item.field));
  const linked=sourceId?items.filter(item=>item.factIds.includes(sourceId)||item.extractionIds.includes(sourceId)):[];
  const known=[group.id,...(group.aliases||[]),...group.events.flatMap(event=>[event.eventId,event.sourceRecordId]),...(group.extractions||[]).flatMap(row=>[row.id,row.source_id])];
  if(sourceId&&!linked.length&&!known.includes(sourceId))return null;
  const selected=linked.length?linked:items.filter(item=>item.scope==='main');
  const sources=new Map<string,string>([['main',group.original]]);
  for(const event of group.events.filter(e=>e.eventType==='record.amended'))sources.set(event.payload?.id||event.eventId,event.original||event.payload?.text||'');
  const candidates=new Map<string,HistoryCitation>();
  for(const item of selected)for(const citation of item.citations){
    const text=sources.get(citation.scope);
    if(!text||citation.sourceText!==text)continue;
    const range=historyQuoteRange(text,citation);
    if(range)candidates.set(JSON.stringify([citation.scope,range.start,range.end]),citation);
  }
  return candidates.size===1?[...candidates.values()][0]:null;
}
