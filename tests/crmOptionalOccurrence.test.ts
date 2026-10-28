import {progressDetails} from '../src/utils/crmProgressDetails';
import test from 'node:test';import assert from 'node:assert/strict';
import {optionalOccurrence,contactOccurrence,projectInteractionTimeline} from '../src/utils/crmInteractionTimeline';
import {prepareProgressDraft} from '../src/utils/crmProgressDraft';
import {groupSameSourceChanges} from '../src/utils/crmFollowupPresentation';
import {saveProfileUpdates} from '../server/portal/dynamicProfile';
const clock=new Date('2026-10-25T10:00:00Z');
test('unknown stays unknown; explicit local without offset, invalid dates and future rejected',()=>{
 for(const v of [null,undefined])assert.equal(optionalOccurrence(v,clock),null);
 for(const v of ['',0,{},'2026-10-25T09:00','2026-02-31T09:00:00Z','2026-10-26T09:00:00Z'])assert.throws(()=>optionalOccurrence(v,clock));
 assert.equal(optionalOccurrence('2026-10-24T17:00:00+07:00',clock),'2026-10-24T10:00:00.000Z');
});
test('plain notes omit legacy hidden occurrence and contact fields',()=>{
 const draft={recordKind:'internal',summary:'客户资料说明',internalLocal:'2026-10-24T17:00',contactLocal:'2026-10-23T12:00',occurrenceMode:'specified',contactDirection:'sales',channel:'WhatsApp',connectStatus:'Connected'};
 const b=prepareProgressDraft(draft,'Asia/Jakarta');assert.equal(b.occurredAt,undefined);assert.equal(b.internalLocal,undefined);assert.equal(b.contactDirection,undefined);assert.equal(b.channel,undefined);assert.equal(b.occurrenceMode,undefined);
 assert.deepEqual(contactOccurrence(b,clock),{});
 assert.equal(prepareProgressDraft({...draft,internalLocal:''},'Asia/Jakarta').occurredAt,undefined);
 assert.equal(prepareProgressDraft({...draft,recordKind:'contact'},'Asia/Jakarta').occurredAt,'2026-10-23T05:00:00.000Z');
 assert.deepEqual(projectInteractionTimeline({followUpLogs:[{...b,recordKind:'closure',at:clock.toISOString()}]}),{communication:null,customer:null,sales:null});
});
test('unknown fields merge only for one identical evidence and source type; no history is rewritten',()=>{
 const row=(key:string,id:string,at:any=null)=>({kind:'hint',value:{id:'change:'+key,kind:'change',evidenceIds:id?[id]:[]},times:[{at}]});
 const p={profileFieldMeta:{city:{sourceType:'sales_edit'},mode:{sourceType:'sales_edit'},goal:{sourceType:'ai_customer_text'}}};
 const rows=[row('city','e'),row('mode','e'),row('goal','e'),row('city','other'),row('mode',''),row('city','e','2026-10-24T10:00:00Z')],before=JSON.stringify(rows);
 const grouped=groupSameSourceChanges(rows,p);assert.equal(grouped.length,5);assert.equal(grouped[0].changes.length,2);assert.equal(grouped[0].commonEvidenceId,'e');assert.equal(JSON.stringify(rows),before);
});
function db(){const queries:any[]=[];let current:any={id:'lead',tier:'B',owner:'owner',firstContact:{status:'open',dueAt:'2026-10-26T00:00:00Z'}};const operations=new Map();return {queries,get current(){return current},async query(sql:string,params:any[]){queries.push([sql,params]);if(sql.includes('FROM portal_leads'))return {rows:[{id:'lead',profile:current}]};if(sql.includes('FROM crm_operations'))return {rows:operations.has(params[1])?[operations.get(params[1])]:[]};if(sql.startsWith('UPDATE portal_leads'))current=params[1];if(sql.startsWith('INSERT INTO crm_operations'))operations.set(params[1],{fingerprint:params[2],result:params[3]});return {rows:[]};}};}
test('profile save missing occurrence persists null separately from recording time, idempotent result retained',async()=>{
 const c=db(),body={requestId:'optional-unknown',updates:{city:'Bandung',availability:'周六'},versions:{city:0,availability:0},reason:'客户资料原文'};
 const result=await saveProfileUpdates(c,'lead','staff',body,()=>true,clock);assert.equal(result.saved,true);
 assert.equal(c.current.profileFieldMeta.city.effectiveAt,null);assert.equal(c.current.profileFieldMeta.city.recordedAt,clock.toISOString());assert.equal(c.current.tier,'B');assert.equal(c.current.owner,'owner');assert.equal(c.current.firstContact.status,'open');
 const fact=c.queries.find(([s]:any)=>s.startsWith('INSERT INTO crm_facts'))[1][4];assert.equal(fact.occurredAt,null);assert.equal(fact.summary,body.reason);assert.equal(fact.changes.length,2);
 assert.equal((await saveProfileUpdates(c,'lead','staff',body,()=>true,clock)).replayed,true);assert.equal(c.queries.filter(([s]:any)=>s.startsWith('INSERT INTO crm_facts')).length,1);
});
test('profile explicit occurrence preserved; invalid future rejected before writes and permission remains enforced',async()=>{
 const body={requestId:'explicit',updates:{city:'Jakarta'},versions:{city:0},reason:'原文',occurredAt:'2026-10-24T17:00:00+07:00'},c=db();await saveProfileUpdates(c,'lead','staff',body,()=>true,clock);assert.equal(c.current.profileFieldMeta.city.effectiveAt,'2026-10-24T10:00:00.000Z');
 for(const at of ['',7,'2026-10-27T00:00:00Z']){const invalid=db();await assert.rejects(saveProfileUpdates(invalid,'lead','staff',{...body,occurredAt:at},()=>true,clock));assert.equal(invalid.queries.some(([s]:any)=>s.startsWith('INSERT')||s.startsWith('UPDATE')),false);}
 await assert.rejects(saveProfileUpdates(db(),'lead','staff',body,()=>false,clock));
});

test('internal original record exposes known or unknown occurrence without masking recording time',()=>{
 const rows=progressDetails({recordKind:'closure',at:clock.toISOString()}, {}, [],'zh','Asia/Jakarta');assert.equal(rows.find(r=>r.label==='实际发生时间')?.value,'未注明；记录时间另行保留');
 const known=progressDetails({recordKind:'internal',occurredAt:'2026-10-24T10:00:00Z'}, {}, [],'zh','Asia/Jakarta');assert.ok(!known.find(r=>r.label==='实际发生时间')?.value.includes('未注明'));
});
