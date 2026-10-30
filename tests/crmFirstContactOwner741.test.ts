import test from 'node:test';
import assert from 'node:assert/strict';
import {appendRecordAmendment} from '../server/portal/recordAmendments';
import {canAmendSalesRecord,amendmentSaveNotice} from '../src/utils/crmRecordAmendments';

function fixture({owner='new-sales',due='2099-11-01T10:00:00Z',another=false}:any={}){
 const log={id:'log',recordKind:'contact',actor:'original-author',summary:'TEST original contact',connectStatus:'Connected',at:'2026-10-28T10:00:00Z',result:{logId:'log',completedTaskIds:['task']}};
 let profile:any={id:'lead',owner,followUpLogs:[log,...(another?[{...log,id:'other',connectStatus:'No Response'}]:[])],recordAmendments:[],firstRequirementTaskIds:['task'],firstRequirementDueAt:due,firstFollowup:{logId:'log',actor:'original-author',dueAt:due},contactArrangement:{state:'stopped'}};
 const task:any={id:'task',lead_id:'lead',kind:'consultation',owner_id:'old-sales',status:'completed',due_at:due,original_due_at:due,details:{completedBy:'original-author',completedAt:'2026-10-28T10:00:00Z'}};
 const queries:any[]=[],operations=new Map(),facts:any[]=[],audits:any[]=[];
 const db={query:async(sql:string,args:any[]=[])=>{
  queries.push({sql,args});
  if(sql.startsWith('SELECT profile FROM portal_leads'))return {rows:[{profile}]};
  if(sql.startsWith('SELECT * FROM crm_facts'))return {rows:args[0]==='fact'&&args[1]==='lead'?[{id:'fact',kind:'followup.recorded',data:{...log,result:log.result}}]:[]};
  if(sql.startsWith('SELECT * FROM crm_operations'))return {rows:operations.has(args[1])?[operations.get(args[1])]:[]};
  if(sql.startsWith('SELECT * FROM followup_tasks'))return {rows:[task]};
  if(sql.startsWith('SELECT display_name'))return {rows:[{display_name:'TEST Manager'}]};
  if(sql.startsWith('UPDATE followup_tasks')){task.status=args[1];task.details=args[2];if(sql.includes('owner_id=:p4'))task.owner_id=args[3];}
  if(sql.startsWith('UPDATE portal_leads'))profile=args[1];
  if(sql.startsWith('INSERT INTO crm_operations'))operations.set(args[1],{fingerprint:args[2],result:args[3]});
  if(sql.startsWith('INSERT INTO crm_facts'))facts.push(args);
  if(sql.startsWith('INSERT INTO portal_audit'))audits.push(args[1]);
  return {rows:[],rowCount:1};
 }};
 const body={requestId:'request-741',targetFactId:'fact',expectedAmendmentRevision:0,kind:'correction',text:'TEST incorrect contact did not take place',reason:'Wrong customer selected',contactResult:'Not Occurred'};
 const save=(patch:any={},allowed=true)=>appendRecordAmendment(db,'lead','manager',{...body,...patch},()=>allowed,new Date('2026-10-29T10:00:00Z'));
 return {task,queries,facts,audits,save,profile:()=>profile};
}
test('restored first task uses locked current owner and retains ID, deadlines and historical actor',async()=>{
 const f=fixture();const result=await f.save();
 assert.equal(result.firstRequirementStatus,'restored');assert.equal(f.task.owner_id,'new-sales');assert.equal(f.task.status,'open');assert.equal(f.task.id,'task');
 assert.equal(f.task.due_at,'2099-11-01T10:00:00Z');assert.equal(f.task.original_due_at,f.task.due_at);assert.equal(f.task.details.completedBy,'original-author');
 assert.equal(f.profile().followUpLogs[0].actor,'original-author');assert.equal(f.profile().contactArrangement.state,'stopped');assert.equal(result.createdTaskId,null);
 assert.deepEqual(result.restoredTasks[0],{taskId:'task',previousOwner:'old-sales',owner:'new-sales',dueAt:f.task.due_at,originalDueAt:f.task.original_due_at});
 assert.ok(f.queries.find(q=>q.sql.startsWith('SELECT profile')).sql.endsWith('FOR UPDATE'));
 assert.ok(f.queries.some(q=>q.sql.includes('record_amendment_no_history_replay')));
 assert.ok(!f.queries.some(q=>/^INSERT(?: IGNORE)? INTO (?:followup_tasks|outbox|notification_jobs)\b/i.test(q.sql)));
 assert.equal(f.audits[0].restoredTasks[0].owner,'new-sales');
});
test('unassigned lead restores an unassigned task; elapsed original deadline remains overdue',async()=>{
 const f=fixture({owner:null,due:'2026-10-20T10:00:00Z'});await f.save();assert.equal(f.task.owner_id,null);assert.equal(f.task.status,'overdue');assert.equal(f.task.due_at,f.task.original_due_at);
});
test('another valid contact keeps first requirement completed and its historical task owner intact',async()=>{
 const f=fixture({another:true});const r=await f.save();assert.equal(r.firstRequirementStatus,'satisfied');assert.equal(f.task.status,'completed');assert.equal(f.task.owner_id,'old-sales');assert.deepEqual(r.restoredTasks,[]);
});
test('identical request does not repeat task restoration, AI queue or audit; stale revision is refused',async()=>{
 const f=fixture();await f.save();const writes=f.queries.filter(q=>!q.sql.startsWith('SELECT')).length;const r=await f.save();assert.equal(r.replayed,true);assert.equal(f.queries.filter(q=>!q.sql.startsWith('SELECT')).length,writes);
 await assert.rejects(f.save({requestId:'another-request'}),e=>(e as any).status===409);assert.equal(f.facts.length,1);
});
test('denied scope and a foreign source cannot restore tasks or change owners',async()=>{
 const f=fixture();await assert.rejects(f.save({},false),e=>(e as any).status===403);assert.equal(f.task.status,'completed');assert.equal(f.task.owner_id,'old-sales');assert.equal(f.audits.length,0);
 await assert.rejects(f.save({targetFactId:'foreign'}),e=>(e as any).status===404);assert.equal(f.task.owner_id,'old-sales');
});
test('Customer 360 permits amendments only for authorized sales originals; feedback is trilingual',()=>{
 const sales={eventType:'followup.recorded',eventId:'fact'};assert.equal(canAmendSalesRecord(sales,true),true);assert.equal(canAmendSalesRecord(sales,false),false);
 for(const eventType of ['questionnaire.submitted','customer.message','stage.changed','assessment.completed','profile.fields_updated'])assert.equal(canAmendSalesRecord({...sales,eventType},true),false);
 for(const status of ['restored','satisfied','needs_review','unchanged']){const zh=amendmentSaveNotice({firstRequirementStatus:status},'zh');for(const lang of ['en','id'])assert.notEqual(amendmentSaveNotice({firstRequirementStatus:status},lang),zh);}
});
