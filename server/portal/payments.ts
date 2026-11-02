import {isPaymentMethod,paymentMethods,paymentExceptionNoteRequired,paymentImageTypes} from '../../src/utils/crmPaymentMethods.ts';
import {validatePaymentImages,storePaymentImages} from './paymentImages.ts';
import {createHash,randomUUID} from 'node:crypto';
import {assignmentDirectory} from './autoAssignment.ts';
import {operation,invalid} from './trustWorkflow.ts';
import {canonicalIdentity,assertIdentitySalesAllowed,lockIdentityRegistry} from './identityConsolidation.ts';
import {permittedRecord} from '../../src/utils/accessControl.ts';
import {emptyPaymentLedger,paymentAmount,paymentInstant,paymentSummary,type PaymentLedger} from '../../src/utils/crmPayments.ts';
const verifyActions=new Set(['receive','refund','verify','reject','void']);
const commandPermission=(action:string)=>action==='revise_project'?'crm.operations.manage':verifyActions.has(action)?'crm.payments.verify':'crm.followup';
const text=(v:any,max=4000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)invalid('payment_information_required');return v;};
const referenceKey=(account:string,reference:string)=>createHash('sha256').update(JSON.stringify([account.trim().toUpperCase(),reference.trim().toUpperCase()])).digest('hex');
const optionalText=(v:any,max=4000)=>{if(v===undefined)return '';if(typeof v!=='string'||v.length>max)invalid('payment_information_required');return v.trim()?v:'';};
function paymentDetails(b:any,entry?:any){
 const method=b.method??entry?.method,verified=['verify','receive','refund'].includes(b.action);
 // Existing free-text payment records remain readable and can be verified without guessing a channel.
 const legacy=!isPaymentMethod(method)&&b.action==='verify'&&b.method===undefined&&entry?.method===method;
 if(!isPaymentMethod(method)&&!legacy)invalid('payment_method_invalid');
 const provider=optionalText(b.provider??entry?.provider,100),methodName=optionalText(b.methodName??entry?.methodName,100);
 if(!legacy&&method==='cash'&&provider||!legacy&&method!=='other'&&methodName)invalid('payment_details_invalid');
 if(!legacy&&method==='other')text(methodName,100);
 if(!legacy&&verified&&paymentMethods[method].providerRequired)text(provider,100);
 const account=verified?text(b.account,200):optionalText(b.account,200),reference=verified?text(b.reference,200):optionalText(b.reference,200);
 const expectedRole=b.action==='refund'||b.action==='verify'&&entry?.kind==='refund'||b.action==='submit'&&b.kind==='refund'?'refund_destination':'company_receiving';
 if(b.accountRole!==undefined&&b.accountRole!==expectedRole)invalid('payment_details_invalid');
 const accountRole=b.accountRole||(['receive','refund'].includes(b.action)?expectedRole:undefined);
 return {method,provider,methodName,account,reference,...(accountRole?{accountRole}:{})};
}
async function reservePaymentReference(c:any,leadId:string,entryId:string,d:any){
 const legacyKey=referenceKey(d.account,d.reference);
 const key=isPaymentMethod(d.method)?referenceKey(JSON.stringify([d.method,paymentMethods[d.method].providerRequired?d.provider.trim().toUpperCase():'',d.methodName.trim().toUpperCase(),d.account.trim().toUpperCase()]),d.reference):legacyKey;
 // Legacy account/reference reservations continue to block reuse; they are never rewritten.
 if(key!==legacyKey&&(await c.query('SELECT fingerprint FROM crm_payment_references WHERE fingerprint=:p1',[legacyKey])).rows.length)invalid('payment_duplicate_reference',409);
 try{await c.query('INSERT INTO crm_payment_references(fingerprint,lead_id,entry_id) VALUES(:p1,:p2,:p3)',[key,leadId,entryId]);}catch(e:any){if(e.code==='ER_DUP_ENTRY')invalid('payment_duplicate_reference',409);throw e;}
}
async function authorize(c:any,actorId:string,profile:any,permission:string){
 const actor=(await assignmentDirectory(c)).find((e:any)=>e.id===actorId);
 if(!actor?.active||!permittedRecord(actor,profile,'crm.read')||(permission!=='crm.read'&&!permittedRecord(actor,profile,permission)))invalid('payment_forbidden',403);
 return actor;
}
async function family(c:any,leadId:string){
 const ids=[leadId];let frontier=[leadId];
 while(frontier.length){const rows=(await c.query("SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto' IN (:p1)",[frontier])).rows;frontier=rows.map((r:any)=>r.id).filter((id:string)=>!ids.includes(id));ids.push(...frontier);}
 return ids;
}
async function ledgerState(c:any,leadId:string,lock=false){
 const ids=await family(c,leadId),rows=(await c.query('SELECT * FROM crm_payment_ledgers WHERE lead_id IN (:p1) ORDER BY lead_id'+(lock?' FOR UPDATE':''),[ids])).rows;
 const active=rows.filter((r:any)=>!r.value.transferredTo),ledger=emptyPaymentLedger();
 for(const r of active){ledger.projects.push(...r.value.projects);ledger.entries.push(...r.value.entries);ledger.history.push(...r.value.history);}
 ledger.history.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
 return {ids,rows,ledger,revision:active.reduce((n:number,r:any)=>n+Number(r.revision),0)};
}
export async function readPayments(c:any,leadId:string,actorId:string){
 const profile=(await c.query('SELECT profile FROM portal_leads WHERE id=:p1',[leadId])).rows[0]?.profile;if(!profile)invalid('payment_missing',404);
 const actor=await authorize(c,actorId,profile,'crm.read');
 const {ledger,revision}=await ledgerState(c,leadId);
 const directory=await assignmentDirectory(c),ids=new Set([profile.owner,...ledger.projects.map(p=>p.createdBy),...ledger.entries.flatMap(e=>[e.createdBy,e.verifiedBy]),...ledger.history.map(h=>h.actor)].filter(Boolean));
 const people=Object.fromEntries([...ids].map(id=>[id,directory.find((e:any)=>e.id===id)?.displayName||id]));
 return {leadId,customerName:profile.fullName||leadId,ownerName:people[profile.owner]||'',people,revision,ledger,summary:ledger.projects.map(project=>({projectId:project.id,...paymentSummary(ledger,project)})),canSubmit:permittedRecord(actor,profile,'crm.followup'),canVerify:permittedRecord(actor,profile,'crm.payments.verify'),canReviseProject:permittedRecord(actor,profile,'crm.operations.manage')};
}
export async function paymentResult(c:any,leadId:string,actorId:string,requestId:string){
 await readPayments(c,leadId,actorId);
 const r=(await c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',[actorId,requestId])).rows[0]?.result;
 if(!r||r.operationKind!=='payment.command'||(r.leadId!==leadId&&(await canonicalIdentity(c,r.leadId))?.id!==leadId))invalid('payment_result_missing',404);
 // A revoked financial permission must not expose an old successful financial command.
 const profile=(await c.query('SELECT profile FROM portal_leads WHERE id=:p1',[leadId])).rows[0]?.profile;
 await authorize(c,actorId,profile,commandPermission(r.action));return r;
}
export async function savePayment(c:any,leadId:string,actorId:string,b:any){
 if(!b||typeof b!=='object'||!['project','revise_project','submit','receive','refund','verify','reject','void'].includes(b.action))invalid('payment_action_invalid');
 const keys=['action','requestId','revision','projectId','entryId','course','expected','kind','amount','reportedAt','method','evidence','reference','account','accountRole','receivedAt','reason','provider','methodName','images'];
 if(Object.keys(b).some(k=>!keys.includes(k)))invalid('payment_action_invalid');
 await lockIdentityRegistry(c);
 const profile=(await c.query('SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE',[leadId])).rows[0]?.profile;
 if(!profile||profile.identityMergedInto)invalid('payment_missing',404);
 if(b.action==='project')invalid('请通过更新已报名选择课程并确认金额',410);
 const permission=commandPermission(b.action);
 await authorize(c,actorId,profile,permission);await assertIdentitySalesAllowed(c,leadId);
 return operation(c,actorId,b,{leadId,kind:'payment.command',authorize:()=>authorize(c,actorId,profile,permission)},async()=>{
  const {rows,ids,ledger,revision}=await ledgerState(c,leadId,true);if(b.revision!==revision)invalid('payment_conflict',409);
  const at=new Date().toISOString();let before:any=null,after:any;
  const uploads=await validatePaymentImages(b.images);if(uploads.length&&!['submit','receive','refund','verify'].includes(b.action))invalid('payment_action_invalid');
  let project=ledger.projects.find(p=>p.id===b.projectId),entry=ledger.entries.find(e=>e.id===b.entryId);
  if(b.action==='project'){
   after={id:randomUUID(),sourceLeadId:leadId,course:text(b.course,200),expected:b.expected===null?null:paymentAmount(b.expected,true),createdAt:at,createdBy:actorId};ledger.projects.push(after);
  }else if(b.action==='revise_project'){
   if(!project)invalid('payment_missing',404);if(project.priceSnapshot)invalid('已确认报价不可在收款核验中更改');before=structuredClone(project);text(b.reason);project.course=text(b.course,200);project.expected=b.expected===null?null:paymentAmount(b.expected,true);after=project;
  }else if(b.action==='submit'){
   if(!project||!['receipt','refund'].includes(b.kind))invalid('payment_project_required');
   const details=paymentDetails(b);
   after={id:randomUUID(),projectId:project.id,kind:b.kind,amount:paymentAmount(b.amount),reportedAt:paymentInstant(b.reportedAt),...details,evidence:optionalText(b.evidence),state:'pending',createdAt:at,createdBy:actorId};
   const images=await storePaymentImages(c,leadId,actorId,after.id,uploads);if(images.length)after.images=images;ledger.entries.push(after);
  }else if(b.action==='receive'||b.action==='refund'){
   if(!project)invalid('payment_project_required');
   const refund=b.action==='refund';
   // Review existing reports before recording another receipt; never silently duplicate them.
   if(ledger.entries.some(e=>e.projectId===project.id&&e.kind===(refund?'refund':'receipt')&&e.state==='pending'))invalid(refund?'payment_pending_refund':'payment_pending_receipt',409);
   const amount=paymentAmount(b.amount),receivedAt=paymentInstant(b.receivedAt),details=paymentDetails(b),evidence=optionalText(b.evidence);
   if(paymentExceptionNoteRequired(b.action,amount,paymentSummary(ledger,project).remaining))text(evidence);
   if(refund&&amount>paymentSummary(ledger,project).net)invalid('payment_refund_exceeds_received');
   after={id:randomUUID(),projectId:project.id,kind:refund?'refund':'receipt',amount,reportedAt:receivedAt,...details,evidence,state:'verified',createdAt:at,createdBy:actorId,verifiedAmount:amount,receivedAt,verificationEvidence:evidence,verifiedBy:actorId,verifiedAt:at};
   await reservePaymentReference(c,leadId,after.id,details);
   const images=await storePaymentImages(c,leadId,actorId,after.id,uploads);if(images.length)after.images=images;
   ledger.entries.push(after);
  }else{
   if(!entry)invalid('payment_missing',404);project=ledger.projects.find(p=>p.id===entry.projectId);if(!project)invalid('payment_missing',404);before=structuredClone(entry);
   if(b.action==='verify'){
    if(entry.state!=='pending')invalid('payment_state_conflict',409);
    const amount=paymentAmount(b.amount),receivedAt=paymentInstant(b.receivedAt),details=paymentDetails(b,entry),evidence=optionalText(b.evidence);
    if(paymentExceptionNoteRequired('verify',amount,paymentSummary(ledger,project).remaining,entry,details))text(evidence);
    if(entry.kind==='refund'&&amount>paymentSummary(ledger,project).net)invalid('payment_refund_exceeds_received');
    await reservePaymentReference(c,leadId,entry.id,details);
    const images=await storePaymentImages(c,leadId,actorId,entry.id,uploads);
    Object.assign(entry,{state:'verified',verifiedAmount:amount,receivedAt,...details,verificationEvidence:evidence,verifiedBy:actorId,verifiedAt:at,...(images.length?{verificationImages:images}:{})});
   }else if(b.action==='reject'){
    if(entry.state!=='pending')invalid('payment_state_conflict',409);Object.assign(entry,{state:'rejected',reason:text(b.reason),verifiedBy:actorId,verifiedAt:at});
   }else{
    if(entry.state!=='verified')invalid('payment_state_conflict',409);text(b.reason);
    entry.state='void';if(paymentSummary(ledger,project).net<0)invalid('payment_refund_exceeds_received');
    entry.reason=b.reason;await c.query('DELETE FROM crm_payment_references WHERE lead_id IN (:p1) AND entry_id=:p2',[ids,entry.id]);
   }
   after=entry;
  }
  const history={id:randomUUID(),action:b.action,actor:actorId,at,before,after:structuredClone(after),...(['verify','receive','refund'].includes(b.action)?{reason:after.verificationEvidence}:b.reason?{reason:b.reason}:{})};ledger.history.push(history);
  // Preserve archived ledgers verbatim; consolidate only identities already merged by the existing workflow.
  for(const row of rows.filter((r:any)=>r.lead_id!==leadId&&!r.value.transferredTo))await c.query('UPDATE crm_payment_ledgers SET value=:p1 WHERE lead_id=:p2',[{...row.value,transferredTo:leadId},row.lead_id]);
  await c.query('UPDATE crm_payment_references SET lead_id=:p1 WHERE lead_id IN (:p2)',[leadId,ids]);
  await c.query('INSERT INTO crm_payment_ledgers(lead_id,revision,value) VALUES(:p1,:p2,:p3) ON DUPLICATE KEY UPDATE revision=:p2,value=:p3',[leadId,revision+1,ledger]);
  await c.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',[actorId,'payment.'+b.action,{leadId,historyId:history.id,targetId:after.id}]);
  return {action:b.action,revision:revision+1,targetId:after.id,projectId:project!.id,historyId:history.id};
 });
}
export async function readPaymentImage(c:any,leadId:string,actorId:string,imageId:string){
 const d=await readPayments(c,leadId,actorId);
 const meta=d.ledger.entries.flatMap(e=>[...(e.images||[]),...(e.verificationImages||[])]).find(image=>image.id===imageId);
 if(!meta)invalid('payment_image_missing',404);
 const row=(await c.query('SELECT mime,content FROM crm_payment_images WHERE id=:p1',[imageId])).rows[0];
 if(!row||!paymentImageTypes.includes(row.mime)||!Buffer.isBuffer(row.content))invalid('payment_image_missing',404);
 return row;
}
export function mountPaymentRoutes(app:any,{wrap,leadAccess,staff}:any){
 app.get('/api/crm/leads/:id/payment-images/:imageId',wrap(async(req:any,res:any)=>{const {l,e}=await leadAccess(req);const {tx}=await import('./store.ts');const image=await tx(c=>readPaymentImage(c,l.id,e.id,String(req.params.imageId)));res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':'inline; filename="payment-image.'+(image.mime==='image/jpeg'?'jpg':image.mime==='image/png'?'png':'webp')+'"'}).type(image.mime).send(image.content);}));
 app.get('/api/crm/payments',wrap(async(req:any,res:any)=>{const actor=await staff(req,'crm.payments.verify');const {tx}=await import('./store.ts');const {listPaymentVerification}=await import('./paymentWorklist.ts');res.set('Cache-Control','no-store').json(await tx(c=>listPaymentVerification(c,actor.id,req.query)));}));
 app.get('/api/crm/leads/:id/payments',wrap(async(req:any,res:any)=>{const {l,e}=await leadAccess(req);const {tx}=await import('./store.ts');res.set('Cache-Control','no-store').json(await tx(c=>readPayments(c,l.id,e.id)));}));
 app.get('/api/crm/leads/:id/payments/results/:requestId',wrap(async(req:any,res:any)=>{const {l,e}=await leadAccess(req);const {tx}=await import('./store.ts');res.set('Cache-Control','no-store').json(await tx(c=>paymentResult(c,l.id,e.id,String(req.params.requestId))));}));
 app.post('/api/crm/leads/:id/payments',wrap(async(req:any,res:any)=>{const {l,e}=await leadAccess(req);const {tx}=await import('./store.ts');res.set('Cache-Control','no-store').json(await tx(c=>savePayment(c,l.id,e.id,req.body)));}));
}

/** Only already-authorized customer profiles are projected; no bank details leave the payment view. */
export async function attachPaymentSummaries(c:any,leads:any[]){
 const targets=new Map<string,any>();for(const lead of leads){lead.verifiedPayments={received:0,refunded:0,net:0,sources:[]};for(const source of [lead,...(lead.identitySources||[])])if(source.id)targets.set(source.id,lead);}
 if(!targets.size)return;
 const rows=(await c.query('SELECT lead_id,value FROM crm_payment_ledgers WHERE lead_id IN (:p1)',[[...targets.keys()]])).rows;
 for(const row of rows){if(row.value.transferredTo)continue;const lead=targets.get(row.lead_id),ledger:PaymentLedger=row.value;for(const project of ledger.projects){const summary=paymentSummary(ledger,project);lead.verifiedPayments.received+=summary.received;lead.verifiedPayments.refunded+=summary.refunded;lead.verifiedPayments.net+=summary.net;lead.verifiedPayments.sources.push({sourceLeadId:project.sourceLeadId||row.lead_id,received:summary.received,refunded:summary.refunded,net:summary.net});}}
}
