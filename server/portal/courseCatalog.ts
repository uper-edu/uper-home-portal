import {randomUUID} from 'node:crypto';
import {auditLog} from './audit.ts';
import {assignmentDirectory} from './autoAssignment.ts';
import {invalid,operation} from './trustWorkflow.ts';
import {permittedRecord} from '../../src/utils/accessControl.ts';
import {paymentAmount,paymentSummary,emptyPaymentLedger} from '../../src/utils/crmPayments.ts';
import {courseDiscount,enrollmentQuoteError,publishedCourseBook} from '../../src/utils/crmCoursePricing.ts';
import {assertIdentitySalesAllowed,lockIdentityRegistry} from './identityConsolidation.ts';
async function actorAccess(c:any,id:string,manage=false){const e=(await assignmentDirectory(c)).find((e:any)=>e.id===id);if(!e?.active||!e.permissions.includes(manage?'crm.operations.manage':'crm.read'))invalid('course_forbidden',403);return e;}
function config(b:any){if(!b||Object.keys(b).some(k=>!['name','sessions','price','active','maxDiscountBps','maxDiscountAmount'].includes(k))||typeof b.name!=='string'||!b.name.trim()||b.name.length>200||!Number.isInteger(b.sessions)||b.sessions<1||b.sessions>10000||typeof b.active!=='boolean'||!Number.isInteger(b.maxDiscountBps)||b.maxDiscountBps<0||b.maxDiscountBps>10000)invalid('course_information_invalid');return {...b,price:paymentAmount(b.price,true),maxDiscountAmount:b.maxDiscountAmount===null?null:paymentAmount(b.maxDiscountAmount,true)};}
export async function listCourses(c:any,actorId:string,stats=false){
 const actor=await actorAccess(c,actorId);const courses=(await c.query('SELECT * FROM crm_courses ORDER BY id')).rows.map((r:any)=>({id:r.id,revision:r.revision,...r.value})).sort((a:any,b:any)=>a.name.localeCompare(b.name,'en',{numeric:true}));
 if(stats){
  const profiles=(await c.query('SELECT id,profile FROM portal_leads')).rows.filter((r:any)=>!r.profile.identityMergedInto&&permittedRecord(actor,r.profile,'crm.read'));
  const visible=new Set(profiles.map((r:any)=>r.id));const source=(await c.query('SELECT id,profile FROM portal_leads')).rows;for(const row of source){let p=row.profile,seen=new Set();while(p.identityMergedInto&&!seen.has(p.identityMergedInto)){if(visible.has(p.identityMergedInto)){visible.add(row.id);break;}seen.add(p.identityMergedInto);p=source.find((r:any)=>r.id===p.identityMergedInto)?.profile||{};}}
  const rootOf=(id:string)=>{const seen=new Set();let root=id;while(!seen.has(root)){seen.add(root);const next=source.find((r:any)=>r.id===root)?.profile.identityMergedInto;if(!next)break;root=next;}return root;};
  const rows=visible.size?(await c.query('SELECT lead_id,value FROM crm_payment_ledgers WHERE lead_id IN (:p1)',[[...visible]])).rows:[];
  const voids=visible.size?(await c.query("SELECT data FROM crm_facts WHERE kind='enrollment.confirmation_voided' AND lead_id IN (:p1)",[[...visible]])).rows:[];const voidIds=new Set(voids.map((r:any)=>r.data.targetFactId));
  for(const course of courses){const projects=rows.filter((r:any)=>!r.value.transferredTo).flatMap((r:any)=>r.value.projects.filter((p:any)=>p.priceSnapshot?.courseId===course.id).map((p:any)=>({p,customerId:rootOf(r.lead_id),s:paymentSummary(r.value,p),voided:voidIds.has(p.enrollmentFactId)})));course.stats={enrolled:new Set(projects.filter((v:any)=>!v.voided).map((v:any)=>v.customerId)).size,voided:projects.filter((v:any)=>v.voided).length,received:projects.reduce((n:number,v:any)=>n+v.s.received,0),refunded:projects.reduce((n:number,v:any)=>n+v.s.refunded,0),net:projects.reduce((n:number,v:any)=>n+v.s.net,0),paying:new Set(projects.filter((v:any)=>v.s.net>0).map((v:any)=>v.customerId)).size,paid:new Set(projects.filter((v:any)=>!v.voided&&v.s.state==='paid').map((v:any)=>v.customerId)).size,pending:projects.reduce((n:number,v:any)=>n+v.s.pending,0)};}
 }
 return {courses,actorId,canManage:actor.permissions.includes('crm.operations.manage')};
}
export async function saveCourse(c:any,actorId:string,b:any){
 await actorAccess(c,actorId,true);if(typeof b?.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(b.id))invalid('course_information_invalid');
 return operation(c,actorId,b,{leadId:'course:'+b.id,kind:'course',authorize:()=>actorAccess(c,actorId,true)},async()=>{
  const old=(await c.query('SELECT * FROM crm_courses WHERE id=:p1 FOR UPDATE',[b.id])).rows[0];if(b.revision!==(old?.revision||0))invalid('course_conflict',409);
  const before=old?.value?Object.fromEntries(Object.entries(old.value).filter(([k])=>k!=='history')):null,after=config(b.config),at=new Date().toISOString(),revision=(old?.revision||0)+1;
  const value={...after,updatedAt:at,history:[...(old?.value.history||[]),{id:randomUUID(),actor:actorId,at,before,after}]};
  await c.query('INSERT INTO crm_courses(id,revision,value) VALUES(:p1,:p2,:p3) ON DUPLICATE KEY UPDATE revision=:p2,value=:p3',[b.id,revision,value]);
  await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'course.save',:p2)",[actorId,{courseId:b.id,revision}]);auditLog(actorId,'course.save');return {courseId:b.id,revision};
 });
}
export async function enrollCourse(c:any,leadId:string,actorId:string,q:any,basis:any,factId:string){
 const actor=await actorAccess(c,actorId);const p=(await c.query('SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE',[leadId])).rows[0]?.profile;
 if(!p||!permittedRecord(actor,p,'crm.write'))invalid('course_forbidden',403);await assertIdentitySalesAllowed(c,leadId);
 const error=enrollmentQuoteError(q);if(error)invalid(error);
 const row=(await c.query('SELECT * FROM crm_courses WHERE id=:p1 FOR SHARE',[q.courseId])).rows[0];if(!row?.value.active)invalid('course_unavailable');if(q.courseRevision!==row.revision)invalid('course_changed',409);
 const course={...row.value,id:row.id,revision:row.revision};let price;try{price=courseDiscount(course,q.discountMode,q.discountValue);}catch(e:any){invalid(e.message);}
 const ids=[leadId],source=(await c.query('SELECT id,profile FROM portal_leads')).rows;let changed=true;while(changed){changed=false;for(const s of source)if(ids.includes(s.profile.identityMergedInto)&&!ids.includes(s.id)){ids.push(s.id);changed=true;}}
 const ledgers=(await c.query('SELECT * FROM crm_payment_ledgers WHERE lead_id IN (:p1) FOR UPDATE',[ids])).rows;if(ledgers.some((r:any)=>r.value.projects.length))invalid('enrollment_exists',409);
 const ledger=emptyPaymentLedger(),at=new Date().toISOString(),id=randomUUID();
 const project={id,course:course.name,sourceLeadId:leadId,expected:price!.finalAmount,createdAt:at,createdBy:actorId,enrollmentFactId:factId,priceSnapshot:{courseId:course.id,courseRevision:course.revision,name:course.name,sessions:course.sessions,currency:'IDR',standardPrice:course.price,maxDiscountBps:course.maxDiscountBps,maxDiscountAmount:course.maxDiscountAmount,discountMode:q.discountMode,discountValue:q.discountValue,...price},basis:structuredClone(basis)};
 ledger.projects.push(project);ledger.history.push({id:randomUUID(),action:'enrollment',actor:actorId,at,before:null,after:project});
 await c.query('INSERT INTO crm_payment_ledgers(lead_id,revision,value) VALUES(:p1,1,:p2) ON DUPLICATE KEY UPDATE revision=revision+1,value=:p2',[leadId,ledger]);return {projectId:id,priceSnapshot:project.priceSnapshot};
}
export function mountCourseRoutes(app:any,{wrap,staff}:any){
 app.get('/api/crm/courses',wrap(async(q:any,r:any)=>{const e=await staff(q,'crm.read'),{tx}=await import('./store.ts');r.set('Cache-Control','no-store').json(await tx(c=>listCourses(c,e.id,q.query.stats==='1')));}));
 app.post('/api/crm/courses',wrap(async(q:any,r:any)=>{const e=await staff(q,'crm.operations.manage'),{tx}=await import('./store.ts');r.json(await tx(c=>saveCourse(c,e.id,q.body)));}));
 app.get('/api/crm/courses/results/:requestId',wrap(async(q:any,r:any)=>{const e=await staff(q,'crm.operations.manage'),{tx}=await import('./store.ts');r.set('Cache-Control','no-store').json(await tx(async c=>{await actorAccess(c,e.id,true);const result=(await c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',[e.id,q.params.requestId])).rows[0]?.result;if(!result||result.operationKind!=='course')invalid('course_result_missing',404);return result;}));}));
}

/** Published commercial facts only; no staff or customer data is exposed to consultation. */
export async function managedCoursePrices(c:any){
 const rows=(await c.query('SELECT value FROM crm_courses ORDER BY id')).rows;
 return publishedCourseBook(rows);
}
