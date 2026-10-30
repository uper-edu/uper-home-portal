import {sameProfileValue} from './crmFieldValues';
import type {HistoryGroup} from './crmHistoryTimeline';
import type {HistoryInformation} from './crmHistoryInformation';

/** A correction is a result of this exact record, never a reconstruction from today's profile.
 * Ambiguous or superseded results remain in the audit details instead of being guessed here. */
export function historyRecordCorrections(group:HistoryGroup,items:HistoryInformation[]){
 const scopes=new Set(group.events.filter(e=>e.eventType==='record.amended'&&e.payload?.kind==='correction').map(e=>e.payload.id||e.eventId));
 const candidates=items.filter(i=>scopes.has(i.scope)&&!i.superseded&&i.status==='applied'&&i.value!==undefined&&['field','insight'].includes(i.kind));
 return candidates.filter((item,index)=>{
  const same=candidates.filter(i=>i.kind===item.kind&&i.field===item.field);
  return same.every(i=>sameProfileValue(item.field,i.value,item.value))&&!candidates.slice(0,index).some(i=>i.kind===item.kind&&i.field===item.field);
 });
}

/** Recording time is secondary provenance; equivalent offsets do not create a second time. */
export function historyHasSeparateRecordingTime(group:HistoryGroup){
 if(!group.recordedAt)return false;
 const recorded=Date.parse(group.recordedAt),displayed=Date.parse(group.displayAt||'');
 return Number.isFinite(recorded)&&(!Number.isFinite(displayed)||recorded!==displayed);
}

/** Explicitly historical captions, without changing the log, agreement, or first-contact state. */
export function historyCardDetailRows(rows:{label:string;value:string}[]){
 return rows.map(row=>({...row,label:({'实际联系结果':'当时记录的联系结果','首次联系要求':'当时首次联系要求','销售阶段变更':'当次销售阶段变更','主动联系安排':'当次主动联系安排'}as Record<string,string>)[row.label]||row.label}));
}
