import courseBook from '../../src/data/crmCoursePrices.json' with {type:'json'};
import {validMutationOrigin} from './accessTransport.ts';
import {enrollmentTeaching,listEnrollmentTemplates} from './enrollmentTemplates.ts';
import {randomUUID} from 'node:crypto';
import {auditLog} from './audit.ts';
import {assignmentDirectory} from './autoAssignment.ts';
import {invalid,operation} from './trustWorkflow.ts';
import {academicManagePermission,canManageAcademics,permittedRecord} from '../../src/utils/accessControl.ts';
import {paymentAmount,paymentSummary,emptyPaymentLedger} from '../../src/utils/crmPayments.ts';
import {courseDiscount,enrollmentQuoteError,publishedCourseBook} from '../../src/utils/crmCoursePricing.ts';
import {assertIdentitySalesAllowed,lockIdentityRegistry} from './identityConsolidation.ts';
async function actorAccess(c:any,id:string,mode:'crm'|'catalog'|'manage'='crm'){
 const actor=(await assignmentDirectory(c)).find((employee:any)=>employee.id===id);
 const canRead=actor?.permissions.includes('crm.read');
 const canManage=actor&&canManageAcademics(actor);
 if(!actor?.active||!(mode==='manage'?canManage:canRead||mode==='catalog'&&canManage))invalid('course_forbidden',403);
 return actor;
}
function config(b:any){if(!b||Object.keys(b).some(k=>!['name','sessions','price','active','maxDiscountBps','maxDiscountAmount','teaching'].includes(k))||typeof b.name!=='string'||!b.name.trim()||b.name.length>200||!Number.isInteger(b.sessions)||b.sessions<1||b.sessions>10000||typeof b.active!=='boolean'||!Number.isInteger(b.maxDiscountBps)||b.maxDiscountBps<0||b.maxDiscountBps>10000)invalid('course_information_invalid');return {...b,...(b.teaching?{teaching:enrollmentTeaching(b.teaching)}:{}),price:paymentAmount(b.price,true),maxDiscountAmount:b.maxDiscountAmount===null?null:paymentAmount(b.maxDiscountAmount,true)};}
const presetCourseIds=new Set(courseBook.courses.map(course=>'hsk-standard-'+course.id.replace(/^HSK /,'').toLowerCase()));
function systemCourse(id:string,value:{presetKey?:string;history?:{id?:string;actor?:string}[]}){
 return presetCourseIds.has(id)||value.presetKey==='hsk_standard_v1'||
  !!value.history?.some(e=>e.actor==='system'&&e.id==='system-initialize-'+id);
}
export async function listCourses(c:any,actorId:string,stats=false){
 const actor=await actorAccess(c,actorId,'catalog');const courses=(await c.query('SELECT * FROM crm_courses ORDER BY id')).rows.map((r:any)=>({id:r.id,revision:r.revision,...r.value})).sort((a:any,b:any)=>a.name.localeCompare(b.name,'en',{numeric:true}));
 if(canManageAcademics(actor)){
  const references=new Set((await listEnrollmentTemplates(c)).map(template=>template.courseId));
  const {rows}=await c.query('SELECT DISTINCT course_id FROM enrollment_classes');
  for(const row of rows)references.add(row.course_id);
  for(const course of courses){
   course.systemManaged=systemCourse(course.id,course);
   course.canDelete=!course.systemManaged&&!references.has(course.id);
  }
 }
 if(stats&&actor.permissions.includes('crm.read')){
  const profiles=(await c.query('SELECT id,profile FROM portal_leads')).rows.filter((r:any)=>!r.profile.identityMergedInto&&permittedRecord(actor,r.profile,'crm.read'));
  const visible=new Set(profiles.map((r:any)=>r.id));const source=(await c.query('SELECT id,profile FROM portal_leads')).rows;for(const row of source){let p=row.profile,seen=new Set();while(p.identityMergedInto&&!seen.has(p.identityMergedInto)){if(visible.has(p.identityMergedInto)){visible.add(row.id);break;}seen.add(p.identityMergedInto);p=source.find((r:any)=>r.id===p.identityMergedInto)?.profile||{};}}
  const rootOf=(id:string)=>{const seen=new Set();let root=id;while(!seen.has(root)){seen.add(root);const next=source.find((r:any)=>r.id===root)?.profile.identityMergedInto;if(!next)break;root=next;}return root;};
  const rows=visible.size?(await c.query('SELECT lead_id,value FROM crm_payment_ledgers WHERE lead_id IN (:p1)',[[...visible]])).rows:[];
  const voids=visible.size?(await c.query("SELECT data FROM crm_facts WHERE kind='enrollment.confirmation_voided' AND lead_id IN (:p1)",[[...visible]])).rows:[];const voidIds=new Set(voids.map((r:any)=>r.data.targetFactId));
  for(const course of courses){const projects=rows.filter((r:any)=>!r.value.transferredTo).flatMap((r:any)=>r.value.projects.filter((p:any)=>p.priceSnapshot?.courseId===course.id).map((p:any)=>({p,customerId:rootOf(r.lead_id),s:paymentSummary(r.value,p),voided:voidIds.has(p.enrollmentFactId)})));course.stats={enrolled:new Set(projects.filter((v:any)=>!v.voided).map((v:any)=>v.customerId)).size,voided:projects.filter((v:any)=>v.voided).length,received:projects.reduce((n:number,v:any)=>n+v.s.received,0),refunded:projects.reduce((n:number,v:any)=>n+v.s.refunded,0),net:projects.reduce((n:number,v:any)=>n+v.s.net,0),paying:new Set(projects.filter((v:any)=>v.s.net>0).map((v:any)=>v.customerId)).size,paid:new Set(projects.filter((v:any)=>!v.voided&&v.s.state==='paid').map((v:any)=>v.customerId)).size,pending:projects.reduce((n:number,v:any)=>n+v.s.pending,0)};}
 }
 return {courses,actorId,canManage:canManageAcademics(actor)};
}
export async function saveCourse(c:any,actorId:string,b:any){
 await actorAccess(c,actorId,'manage');if(typeof b?.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(b.id))invalid('course_information_invalid');
 return operation(c,actorId,b,{leadId:'course:'+b.id,kind:'course',authorize:()=>actorAccess(c,actorId,'manage')},async()=>{
  const old=(await c.query('SELECT * FROM crm_courses WHERE id=:p1 FOR UPDATE',[b.id])).rows[0];if(b.revision!==(old?.revision||0))invalid('course_conflict',409);
  const before=old?.value?Object.fromEntries(Object.entries(old.value).filter(([k])=>k!=='history')):null,after=config(b.config),at=new Date().toISOString(),revision=(old?.revision||0)+1;
  if(old?.value.teaching){
    if(!after.teaching)after.teaching=old.value.teaching;
    if(after.teaching.material!==old.value.teaching.material||after.teaching.minutes!==old.value.teaching.minutes||
      after.teaching.level!==old.value.teaching.level||after.sessions!==old.value.sessions)invalid('course_information_invalid');
  }
  const value={...after,...(old?.value.presetKey?{presetKey:old.value.presetKey}:{}),updatedAt:at,history:[...(old?.value.history||[]),{id:randomUUID(),actor:actorId,at,before,after}]};
  await c.query('INSERT INTO crm_courses(id,revision,value) VALUES(:p1,:p2,:p3) ON DUPLICATE KEY UPDATE revision=:p2,value=:p3',[b.id,revision,value]);
  await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'course.save',:p2)",[actorId,{courseId:b.id,revision}]);auditLog(actorId,'course.save');return {courseId:b.id,revision};
 });
}
async function deleteCourse(c:any,actorId:string,body:any){
 const id=body?.id;
 if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id)||!Number.isSafeInteger(body.revision)||body.revision<1)
  invalid('course_information_invalid');
 return operation(c,actorId,body,{leadId:'course:'+id,kind:'course.delete',authorize:()=>actorAccess(c,actorId,'manage')},async()=>{
  // Template publishers and class/quote writers take a shared lock on this course.
  const row=(await c.query('SELECT * FROM crm_courses WHERE id=:p1 FOR UPDATE',[id])).rows[0];
  if(!row||row.revision!==body.revision)invalid('course_conflict',409);
  if(systemCourse(id,row.value))invalid('course_system_managed',409);
  const referenced=(await listEnrollmentTemplates(c)).some(template=>template.courseId===id)||
    (await c.query('SELECT id FROM enrollment_classes WHERE course_id=:p1 LIMIT 1',[id])).rows.length||
    (await c.query("SELECT lead_id FROM crm_payment_ledgers WHERE JSON_CONTAINS(value,JSON_OBJECT('priceSnapshot',JSON_OBJECT('courseId',:p1)),'$.projects') LIMIT 1",[id])).rows.length;
  if(referenced)invalid('course_in_use',409);
  await c.query('DELETE FROM crm_courses WHERE id=:p1',[id]);
  await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'course.delete',:p2)",[actorId,{courseId:id,name:row.value.name,revision:body.revision}]);
  auditLog(actorId,'course.delete');
  return {courseId:id};
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
export function mountCourseRoutes(app:any,{wrap,staff,authenticate}:any){
 app.get('/api/crm/courses',wrap(async(q:any,r:any)=>{const e=await authenticate(q);if(!e)invalid('course_forbidden',401);const {tx}=await import('./store.ts');r.set('Cache-Control','no-store').json(await tx(c=>listCourses(c,e.id,q.query.stats==='1')));}));
 app.post('/api/crm/courses',wrap(async(q:any,r:any)=>{const e=await staff(q,academicManagePermission),{tx}=await import('./store.ts');if(!validMutationOrigin(q))invalid('course_forbidden',403);r.json(await tx(c=>saveCourse(c,e.id,q.body)));}));
 app.post('/api/crm/courses/delete',wrap(async(q:any,r:any)=>{
  const actor=await staff(q,academicManagePermission);
  if(!validMutationOrigin(q))invalid('course_forbidden',403);
  const {tx}=await import('./store.ts');
  r.json(await tx(c=>deleteCourse(c,actor.id,q.body),{isolation:'READ COMMITTED'}));
 }));
 app.get('/api/crm/courses/results/:requestId',wrap(async(q:any,r:any)=>{const e=await staff(q,academicManagePermission),{tx}=await import('./store.ts');r.set('Cache-Control','no-store').json(await tx(async c=>{await actorAccess(c,e.id,'manage');const result=(await c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',[e.id,q.params.requestId])).rows[0]?.result;if(!result||!['course','course.delete'].includes(result.operationKind))invalid('course_result_missing',404);return result;}));}));
}

/** Published commercial facts only; no staff or customer data is exposed to consultation. */
export async function managedCoursePrices(c:any){
 const rows=(await c.query('SELECT value FROM crm_courses ORDER BY id')).rows;
 return publishedCourseBook(rows);
}
