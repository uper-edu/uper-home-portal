import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { allowed, type Employee } from './identity.ts';
import { permittedRecord } from '../../src/utils/accessControl.ts';
import { canReviewIdentityRole } from '../../src/utils/crmOutreach.ts';
import { validContactEmail } from '../../src/utils/contactEmail.ts';
import { isSalesProgressStage } from '../../src/utils/crmSalesProgress.ts';
import { contactPaused } from '../../src/utils/crmContact.ts';
import { priorityAgreements } from '../../src/utils/crmAgreementPresentation.ts';
import { pendingFollowUps } from '../../src/utils/crmFollowUp.ts';
import { enrollmentLearnerNameKey, enrollmentOrderStatus } from '../../src/utils/enrollmentOrderStatus.ts';
import { validMutationOrigin } from './accessTransport.ts';
import { assignNewLead } from './autoAssignment.ts';
import { canonicalIdentity, lockIdentityRegistry } from './identityConsolidation.ts';
import { discoverIdentity, identityControls, pendingIdentity } from './identityReview.ts';
import { fact, invalid, normalizeContactPhone, operation } from './trustWorkflow.ts';
import { lockEnrollmentEmail } from './enrollmentEmailAccess.ts';
import { opportunitySourceKind, type OpportunitySourceRef } from '../../src/utils/crmOpportunitySources.ts';
import { salesProgressContext } from './salesProgress.ts';
import { enrollmentOpportunityLevels } from '../../src/utils/enrollmentCatalog.ts';
import { latestAssistanceMail } from './enrollmentNotices.ts';

type Client = { query: (sql: string, params?: unknown[]) => Promise<{rows: any[];rowCount?:number}> };
type RecordKind = 'order' | 'waitlist' | 'demand';
type Submission = { kind: RecordKind; id: string; email: string; phone: string; name?: string; level?: string; emailVerified?: boolean };

async function activeOpportunityCandidates(c:Client,lead:{id:string;profile:any},level:string) {
  const rows=(await c.query(`SELECT o.* FROM enrollment_opportunities o JOIN portal_leads l ON l.id=o.lead_id
    WHERE (l.id=:p1 OR l.profile->>'$.identityMergedInto'=:p1) AND o.level=:p2
    AND (o.sales_stage IS NULL OR o.sales_stage<>'progress:closed')
    AND NOT EXISTS (SELECT 1 FROM enrollment_customer_records r JOIN enrollment_orders e ON r.kind='order' AND e.id=r.record_id
      WHERE r.opportunity_id=o.id AND e.state IN ('paid','recovered','refunding','refunded'))
    ORDER BY o.created_at,o.id`,[lead.id,level])).rows;
  const records=await opportunityRecordsById(c,rows);
  return rows.filter(row=>isOpenOpportunity(projectOpportunity(row,records.get(row.id)??[],lead.profile)));
}

async function identityForSubmission(c: Client, { email, phone, name, emailVerified = true }: Submission) {
  const normalized = normalizeContactPhone(phone);
  const anchors = emailVerified ? (await c.query(`SELECT id,profile FROM portal_leads
    WHERE LOWER(profile->>'$.email')=:p1 AND profile->>'$.enrollmentEmailVerified'='true'`, [email])).rows : [];
  const compatible = anchors.filter(row => normalizeContactPhone(row.profile.whatsapp) === normalized &&
    (!name || enrollmentLearnerNameKey(name) === enrollmentLearnerNameKey(row.profile.fullName)));
  // An identical registration already held for review may add facts to that same submission.
  const roots = new Map();
  for (const anchor of compatible) {
    const root = await canonicalIdentity(c, anchor.id);
    if (root) roots.set(root.id, root);
  }
  if (roots.size === 1 && (name || anchors.length === 1)) {
    const root = [...roots.values()][0];
    const aliases = (await c.query(`SELECT id,profile FROM portal_leads
      WHERE LOWER(profile->>'$.email')=:p1 OR REGEXP_REPLACE(profile->>'$.whatsapp','[^0-9]','') IN (:p2,:p3,:p4)`,
    [email,normalized,normalized.startsWith('62')?'0'+normalized.slice(2):normalized,'00'+normalized])).rows;
    const otherMatches = aliases.filter(row => row.id !== root.id && row.profile.identityMergedInto !== root.id);
    if (!otherMatches.length || root.profile.identityLifecycle === 'pending') return root;
    // Respect human decisions on a previously confirmed group with shared contacts.
    const reviewed = (await c.query(`SELECT candidate_id FROM identity_candidates
      WHERE lead_id=:p1 AND decision IN ('different','shared')`, [root.id])).rows;
    if (otherMatches.every(row => reviewed.some(decision => decision.candidate_id===row.id))) return root;
  }

  const id = randomUUID();
  const submittedAt = new Date().toISOString();
  const profile = {
    id, fullName:name || email, name:name || email, email, whatsapp:phone, team:'sales', owner:null,
    entryPoint:'enrollment', enrollmentEmailVerified:emailVerified, submittedAt, identityLifecycle:'independent',
  };
  const inserted = (await c.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)', [id,profile])).rows[0];
  const visitorId = randomUUID();
  await c.query('INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES(:p1,:p2,UTC_TIMESTAMP(6))', [visitorId,id]);
  const matched = await discoverIdentity(c,visitorId,id,profile);
  const saved = {...profile,businessNumber:inserted.business_number,
    ...(matched ? {identityLifecycle:'pending'} : {currentStage:'progress:unreached',tier:'Unqualified',stageUpdatedAt:submittedAt})};
  await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1', [id,saved]);
  if (!matched && emailVerified) await assignNewLead(c,id,'registration');
  return {id,profile:saved};
}

/** Keep the learner-facing ownership unchanged. This association follows CRM identity consolidation only on staff reads. */
export async function recordEnrollmentCustomer(c: Client, record: Submission) {
  await lockIdentityRegistry(c);
  const existing = (await c.query(`SELECT r.lead_id,r.opportunity_id,o.level FROM enrollment_customer_records r
    LEFT JOIN enrollment_opportunities o ON o.id=r.opportunity_id WHERE r.kind=:p1 AND r.record_id=:p2`,
  [record.kind,record.id])).rows[0];
  if (existing && record.level === (existing.level ?? undefined)) return;
  const lead = existing ? await canonicalIdentity(c,existing.lead_id) : await identityForSubmission(c,record);
  if (!lead) invalid('enrollment_customer_unavailable',409);
  const leadId = existing?.lead_id ?? lead.id;
  let opportunityId: string | null = null;
  if (record.level && lead.profile.identityLifecycle!=='pending') {
    const active=await activeOpportunityCandidates(c,lead,record.level);
    if (active.length===1) opportunityId=active[0].id;
    if (!active.length) {
      opportunityId=randomUUID();
      await c.query(`INSERT INTO enrollment_opportunities(id,lead_id,level,created_at)
        VALUES(:p1,:p2,:p3,UTC_TIMESTAMP(6))`, [opportunityId,leadId,record.level]);
    }
  }
  await c.query(`INSERT INTO enrollment_customer_records(kind,record_id,lead_id,opportunity_id,created_at)
    VALUES(:p1,:p2,:p3,:p4,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE opportunity_id=:p4`,
  [record.kind,record.id,leadId,opportunityId]);
}

const courseRecords = `SELECT r.kind,r.record_id,r.opportunity_id,DATE_FORMAT(r.created_at,'%Y-%m-%dT%H:%i:%sZ') AS record_created_at_iso,
    CASE WHEN o.state='awaiting_payment' AND o.received=0 AND o.payment_due_at<UTC_TIMESTAMP(6)
      AND (o.upload_expires_at IS NULL OR o.upload_expires_at<UTC_TIMESTAMP(6)) THEN 'expired'
      ELSE COALESCE(o.state,w.state,d.state) END AS state,
    o.price,o.received,COALESCE(o.data->>'$.name',w.learner_name) AS learner_name,COALESCE(o.email,w.email,d.email) AS enrollment_email,
    CASE WHEN o.state IN ('proof_review','partial','expired') AND NOT EXISTS (
      SELECT 1 FROM enrollment_receipts v WHERE v.order_id=o.id
        AND v.created_at>=STR_TO_DATE(o.data->>'$.firstProofAvailableAt','%Y-%m-%dT%H:%i:%s.%fZ')
    ) THEN o.data->>'$.firstReviewDueAt' END AS first_review_due_at,
    DATE_FORMAT(o.payment_due_at,'%Y-%m-%dT%H:%i:%sZ') AS payment_due_at,
    d.criteria,b.id AS class_id,b.state AS class_state,b.data AS class_data,g.opened_at,a.attribution,e.latest_notice
  FROM enrollment_customer_records r
  LEFT JOIN enrollment_orders o ON r.kind='order' AND o.id=r.record_id
  LEFT JOIN enrollment_waitlist w ON r.kind='waitlist' AND w.id=r.record_id
  LEFT JOIN enrollment_demands d ON r.kind='demand' AND d.id=r.record_id
  LEFT JOIN enrollment_classes b ON b.id=COALESCE(o.class_id,w.class_id)
  LEFT JOIN enrollment_class_openings g ON g.class_id=b.id
  LEFT JOIN enrollment_record_attribution a ON a.kind=r.kind AND a.record_id=r.record_id
  LEFT JOIN LATERAL (SELECT payload->>'$.subject' AS latest_notice FROM enrollment_notification_receipts
    WHERE channel='email' AND subject_id=r.record_id AND kind NOT IN ('otp_apply','otp_mine')
    ORDER BY recorded_at DESC,event_key DESC LIMIT 1) e ON TRUE`;

function displayRecord(row: any) {
  return {
    id:row.record_id,kind:row.kind,opportunityId:row.opportunity_id,state:enrollmentOrderStatus(row.state,row.class_state),createdAt:row.record_created_at_iso??null,
    learnerName:row.learner_name,paymentDueAt:row.payment_due_at,firstReviewDueAt:row.first_review_due_at,
    class:row.class_data ? {id:row.class_id,level:row.class_data.level,firstLesson:row.class_data.firstLesson,schedule:row.class_data.schedule,opened:!!row.opened_at} : null,
    price:row.price===null?null:Number(row.price),received:row.received===null?null:Number(row.received),
    criteria:row.criteria?{level:row.criteria.level,period:row.criteria.period,format:row.criteria.format,notes:row.criteria.notes}:null,
    attribution:row.attribution?{entry:row.attribution.entry,via:row.attribution.via,source:row.attribution.source,campaign:row.attribution.campaign,
      campaignId:row.attribution.campaignId,promotionId:row.attribution.promotionId,
      promotionName:row.attribution.promotionName,verified:row.attribution.verified}:null,
    latestNotice:row.latest_notice,
  };
}

function recordOpportunityLevel(row:any):string|undefined {
  const level=row.class_data?.level??row.criteria?.level;
  if(enrollmentOpportunityLevels.includes(level))return level;
}

async function attachUnassignedEnrollmentRecord(c:Client,customerId:string,actor:string,row:{kind:RecordKind;record_id:string},opportunityId:string,via?:'identity_review'|'purchase_intent'){
  const changed=await c.query(`UPDATE enrollment_customer_records SET opportunity_id=:p1 WHERE kind=:p2 AND record_id=:p3
    AND opportunity_id IS NULL`,[opportunityId,row.kind,row.record_id]);
  if(changed.rowCount!==1)invalid('enrollment_opportunity_already_linked',409);
  await c.query('UPDATE enrollment_opportunities SET revision=revision+1 WHERE id=:p1',[opportunityId]);
  await fact(c,customerId,'enrollment.opportunity.linked',actor,{opportunityId,recordId:row.record_id,kind:row.kind,...(via?{via}:{})});
}

/** Call from a transaction holding the identity registry lock. */
async function reconcileEnrollmentRecords(c:Client,customerId:string,actor:string,intentLevel?:string){
  const customer=await canonicalIdentity(c,customerId);
  if(!customer||customer.profile.identityLifecycle==='pending')return;
  const rows=(await c.query(courseRecords+` JOIN portal_leads l ON l.id=r.lead_id
    WHERE (l.id=:p1 OR l.profile->>'$.identityMergedInto'=:p1) AND r.opportunity_id IS NULL
    ORDER BY r.created_at,r.record_id`,[customer.id])).rows;
  const byLevel=new Map<string,typeof rows>();
  for(const row of rows){
    const level=recordOpportunityLevel(row);
    if(!level||!row.state||intentLevel&&(level!==intentLevel||row.kind!=='order'))continue;
    const group=byLevel.get(level)??[];
    group.push(row);
    byLevel.set(level,group);
  }
  for(const [level,unlinked] of byLevel){
    const candidates=await activeOpportunityCandidates(c,customer,level);
    if(candidates.length!==1)continue;
    const [{id}]=candidates;
    const prior=await recordsForOpportunity(c,id);
    // Several standalone orders can represent separate purchases at one level.
    if([...prior,...unlinked].filter(row=>row.kind==='order').length>1)continue;
    for(const row of unlinked)await attachUnassignedEnrollmentRecord(c,customer.id,actor,row,id,intentLevel?'purchase_intent':'identity_review');
  }
}

export async function reconcileEnrollmentAfterIdentityReview(c:Client,customerId:string,actor:string){
  await reconcileEnrollmentRecords(c,customerId,actor);
}

function projectOpportunity(row: any, records: ReturnType<typeof displayRecord>[], profile: any) {
  const states = records.map(record => record.state);
  const state = states.some(state=>['paid','recovered'].includes(state)) ? 'enrolled'
    : states.includes('paid_cancelled') ? 'aftercare'
    : states.some(state=>['awaiting_payment','partial','proof_review'].includes(state)) ? 'applying'
    : states.includes('waiting') ? 'waiting'
    : states.some(state=>['active','expired'].includes(state))||(!records.length&&row.sales_stage&&row.sales_stage!=='progress:closed') ? 'interest' : 'closed';
  const salesStage=state==='enrolled'?'progress:enrolled':state==='aftercare'?'progress:paused':row.sales_stage ??
    (state==='applying'?'progress:registration':state==='closed'?'progress:closed':'progress:unreached');
  return {id:row.id,level:row.level,customerId:profile.id,customerName:profile.fullName,
    businessNumber:profile.businessNumber,owner:profile.owner ?? null,identityPending:profile.identityLifecycle==='pending',
    createdAt:row.created_at,state,salesStage,revision:Number(row.revision),records};
}

const recordsForOpportunity=async(c:Client,id:string)=>(await c.query(courseRecords+' WHERE r.opportunity_id=:p1 ORDER BY r.created_at,r.record_id',[id])).rows.map(displayRecord);
const isOpenOpportunity=(row:ReturnType<typeof projectOpportunity>)=>
  !['enrolled','closed'].includes(row.state)&&row.salesStage!=='progress:closed';
const canProgress=(actor:Employee,profile:any)=>profile.identityLifecycle!=='pending'&&permittedRecord(actor,profile,'crm.followup');

export async function assistedEnrollmentOpportunity(c:Client,id:string,actor?:Employee) {
  const row=(await c.query('SELECT * FROM enrollment_opportunities WHERE id=:p1 FOR UPDATE',[id])).rows[0];
  const customer=row&&await canonicalIdentity(c,row.lead_id);
  if(!customer||actor&&(!allowed(actor,customer.profile)||!canProgress(actor,customer.profile)))
    invalid('enrollment_opportunity_not_found',404);
  if(customer.profile.identityLifecycle==='pending'||(await pendingIdentity(c,customer.id)).length)
    invalid('enrollment_assistance_identity',409);
  const records=await recordsForOpportunity(c,id);
  if(!isOpenOpportunity(projectOpportunity(row,records,customer.profile))
    ||records.some(record=>record.kind==='order'&&!['ended','expired'].includes(record.state)))
    invalid('enrollment_assistance_existing_order',409);
  return {customer,level:String(row.level)};
}

export async function validateAssistedContacts(c:Client,customer:{id:string;profile:any},name:string,email:string,phone:string) {
  const profile=customer.profile, digits=normalizeContactPhone(phone);
  if(enrollmentLearnerNameKey(name)!==enrollmentLearnerNameKey(profile.fullName??'')
    ||profile.email&&String(profile.email).trim().toLowerCase()!==email
    ||profile.whatsapp&&normalizeContactPhone(profile.whatsapp)!==digits) invalid('enrollment_assistance_identity',409);
  const matches=(await c.query(`SELECT id,profile FROM portal_leads WHERE LOWER(profile->>'$.email')=:p1
    OR REGEXP_REPLACE(profile->>'$.whatsapp','[^0-9]','') IN (:p2,:p3,:p4)`,
    [email,digits,digits.startsWith('62')?'0'+digits.slice(2):digits,'00'+digits])).rows;
  if(matches.some(match=>match.id!==customer.id&&match.profile.identityMergedInto!==customer.id))
    invalid('enrollment_assistance_identity',409);
}

const changeEmailStatements = {
  order: {
    lock: 'SELECT email FROM enrollment_orders WHERE id=:p1 FOR UPDATE',
    save: 'UPDATE enrollment_orders SET email=:p2,activity_at=UTC_TIMESTAMP(6) WHERE id=:p1',
  },
  waitlist: {
    lock: 'SELECT email FROM enrollment_waitlist WHERE id=:p1 FOR UPDATE',
    save: 'UPDATE enrollment_waitlist SET email=:p2,activity_at=UTC_TIMESTAMP(6) WHERE id=:p1',
  },
  demand: {
    lock: 'SELECT email FROM enrollment_demands WHERE id=:p1 FOR UPDATE',
    save: 'UPDATE enrollment_demands SET email=:p2,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=:p1',
  },
};
const emailChangeKind = 'enrollment.record.email.change';
const canChangeEnrollmentEmail = async (c:Client, actor:Employee, customer:{id:string;profile:any}) =>
  actor.permissions.includes('crm.write') && canReviewIdentityRole(actor,await identityControls(c)) &&
  permittedRecord(actor,customer.profile,'crm.write') && canProgress(actor,customer.profile) &&
  !(await pendingIdentity(c,customer.id)).length;
type OpportunityProfile={id:string;enrollmentOpportunitySummary?:{count:number;only?:{id:string;level:string;stage:string}}};

function opportunityAgreement(profile:any,id:string) {
  const sources=new Set((profile.followUpLogs??[]).filter((log:any)=>log.result?.opportunity?.id===id)
    .flatMap((log:any)=>[log.id,log.requestId]).filter(Boolean));
  const commitments=(profile.commitments??[]).filter((agreement:any)=>sources.has(agreement.sourceId));
  const selected=priorityAgreements({commitments},'Asia/Jakarta')[0];
  if(!selected)return null;
  const {id:agreementId,action,at,date}=selected.agreement;
  return {kind:'agreement' as const,id:agreementId,action,...(selected.status==='invalid'?{}:{at,date})};
}

async function opportunityTasks(c:Client,profiles:any[]) {
  if(!profiles.length)return [];
  const ids=[...new Set(profiles.map(profile=>profile.id))];
  return (await c.query(`SELECT t.id,t.kind,t.status,t.owner_id,t.details,
    DATE_FORMAT(t.due_at,'%Y-%m-%dT%H:%i:%sZ') AS dueAt,customer.id AS customerId
    FROM followup_tasks t JOIN portal_leads original ON original.id=t.lead_id
    JOIN portal_leads customer ON customer.id=COALESCE(NULLIF(original.profile->>'$.identityMergedInto','null'),original.id)
    WHERE t.status IN ('open','overdue') AND JSON_CONTAINS(:p1,JSON_QUOTE(customer.id))
      AND (t.details->>'$.opportunityId' IS NOT NULL OR t.details->>'$.enrollmentOrderId' IS NOT NULL)`,[JSON.stringify(ids)])).rows;
}

function attachOpportunityActions(actor:Employee,profile:any,row:ReturnType<typeof projectOpportunity>,tasks:any[]) {
  const eligible=isOpenOpportunity(row)&&canProgress(actor,profile);
  const orderIds=new Set(row.records.filter(record=>record.kind==='order').map(record=>record.id));
  const attached=eligible?pendingFollowUps(tasks.filter(task=>task.customerId===row.customerId&&
    (!task.owner_id||task.owner_id===actor.id||actor.grants?.['crm.followup']?.includes('all'))&&
    (task.details.opportunityId?task.details.opportunityId===row.id:orderIds.has(task.details.enrollmentOrderId)))):[];
  const task=attached[0];
  const followup=task?{kind:'task' as const,id:task.id,type:task.kind,action:(task as any).details.action,at:task.dueAt}:
    eligible?opportunityAgreement(profile,row.id):null;
  return {...row,followup,canProgress:eligible,canInitiateFollowup:eligible&&!contactPaused(profile)};
}

async function opportunityRecordsById(c:Client,rows:{id:string}[]) {
  const records=new Map<string,ReturnType<typeof displayRecord>[]>();
  for(let start=0;start<rows.length;start+=100){
    const ids=rows.slice(start,start+100).map(row=>row.id);
    const predicates=ids.map((_,index)=>':p'+(index+1)).join(',');
    const data=(await c.query(courseRecords+` WHERE r.opportunity_id IN (${predicates}) ORDER BY r.created_at,r.record_id`,ids)).rows;
    for(const row of data){
      const group=records.get(row.opportunity_id)??[];
      group.push(displayRecord(row));
      records.set(row.opportunity_id,group);
    }
  }
  return records;
}

/** Only called with profiles from the employee's authorized customer list. */
export async function attachEnrollmentOpportunitySummaries(c:Client,profiles:OpportunityProfile[]) {
  if(!profiles.length)return;
  const rows=(await c.query(`SELECT o.*,customer.id AS customer_id
    FROM enrollment_opportunities o JOIN portal_leads original ON original.id=o.lead_id
    JOIN portal_leads customer ON customer.id=COALESCE(NULLIF(original.profile->>'$.identityMergedInto','null'),original.id)
    WHERE JSON_CONTAINS(:p1,JSON_QUOTE(customer.id))`,[JSON.stringify(profiles.map(profile=>profile.id))])).rows;
  const records=await opportunityRecordsById(c,rows);
  const summaries=new Map(profiles.map(profile=>{
    const summary:NonNullable<OpportunityProfile['enrollmentOpportunitySummary']>={count:0};
    profile.enrollmentOpportunitySummary=summary;
    return [profile.id,summary];
  }));
  for(const row of rows){
    const summary=summaries.get(row.customer_id);
    if(!summary)continue;
    const opportunity=projectOpportunity(row,records.get(row.id)??[],{id:row.customer_id});
    if(!isOpenOpportunity(opportunity))continue;
    summary.count++;
    if(summary.count===1) summary.only={id:opportunity.id,level:opportunity.level,stage:opportunity.salesStage};
    else delete summary.only;
  }
}

export async function linkEnrollmentOpportunity(c:Client,leadId:string,link:any) {
  if(!link || typeof link.id!=='string' || !link.id || link.id.length>36 ||
    !Number.isSafeInteger(link.revision) || link.revision<0 ||
    (link.stage!==undefined && (!isSalesProgressStage(link.stage)||link.stage==='progress:enrolled'))) {
    invalid('enrollment_invalid_opportunity_progress');
  }
  const row=(await c.query('SELECT * FROM enrollment_opportunities WHERE id=:p1 FOR UPDATE',[link.id])).rows[0];
  const customer=row && await canonicalIdentity(c,row.lead_id);
  if(!customer || customer.id!==leadId) invalid('enrollment_opportunity_not_found',404);
  const current=projectOpportunity(row,await recordsForOpportunity(c,row.id),customer.profile);
  if(link.revision!==current.revision || !isOpenOpportunity(current) || (current.state==='aftercare'&&link.stage!==undefined)) {
    invalid('enrollment_opportunity_progress_conflict',409);
  }
  const sourceRefs:OpportunitySourceRef[]=[];
  if(link.sourceRefs!==undefined){
    if(!Array.isArray(link.sourceRefs)||link.sourceRefs.length>5) invalid('enrollment_invalid_opportunity_progress');
    for(const ref of link.sourceRefs){
      if(!ref||!['fact','customer_message','sales_record'].includes(ref.type)||typeof ref.id!=='string'||!ref.id||ref.id.length>191||
        Object.keys(ref).length!==2||
        sourceRefs.some(saved=>saved.type===ref.type&&saved.id===ref.id)) invalid('enrollment_invalid_opportunity_progress');
      sourceRefs.push({type:ref.type,id:ref.id});
    }
    if(sourceRefs.length){
      const {sources}=await salesProgressContext(c,customer.id,customer.profile);
      if(sourceRefs.some(ref=>!sources.some(source=>source.type===ref.type&&source.id===ref.id&&opportunitySourceKind(source))))
        invalid('enrollment_opportunity_source_not_found',404);
    }
  }
  await c.query('UPDATE enrollment_opportunities SET sales_stage=COALESCE(:p1,sales_stage),revision=revision+1 WHERE id=:p2',[link.stage??null,row.id]);
  return {id:row.id,revision:current.revision+1,stage:link.stage??current.salesStage,...(sourceRefs.length?{sourceRefs}:{})};
}

export function mountEnrollmentCrm(app:Express,{ wrap, staff, transact, saveProgress }:{
  wrap:(fn:(q:Request,r:Response)=>Promise<unknown>)=>(q:Request,r:Response)=>void;
  staff:(q:Request,permission:string)=>Promise<Employee>;
  transact:(fn:(c:Client)=>Promise<any>)=>Promise<any>;
  saveProgress:(c:Client,leadId:string,actor:string,body:any,canWrite:(profile:any)=>boolean)=>Promise<any>;
}) {
  const read = (fn:(c:Client,q:Request,actor:Employee)=>Promise<unknown>) => wrap(async(q,r)=>{
    const actor=await staff(q,'crm.read');
    const data=await transact(c=>fn(c,q,actor));
    r.set('Cache-Control','no-store').json(data);
  });
  const readProfile=(actor:Employee,profile:any)=>profile && allowed(actor,profile);

  app.get('/api/crm/opportunities',read(async(c,q,actor)=>{
    const customerId=q.query.customerId;
    if(customerId!==undefined&&(typeof customerId!=='string'||!customerId||customerId.length>191)) invalid('enrollment_customer_not_found',404);
    const customer=typeof customerId==='string'?await canonicalIdentity(c,customerId):undefined;
    if(customerId!==undefined&&(!customer||!readProfile(actor,customer.profile))) invalid('enrollment_customer_not_found',404);
    const rows=(await c.query(`SELECT o.*, customer.profile,
      (SELECT DATE_FORMAT(a.expires_at,'%Y-%m-%dT%H:%i:%sZ') FROM enrollment_assisted_applications a
        WHERE a.opportunity_id=o.id AND a.order_id IS NULL AND a.expires_at>UTC_TIMESTAMP(6)
        ORDER BY a.created_at DESC,a.id LIMIT 1) AS assistanceDueAt
      FROM enrollment_opportunities o JOIN portal_leads original ON original.id=o.lead_id
      JOIN portal_leads customer ON customer.id=COALESCE(NULLIF(original.profile->>'$.identityMergedInto','null'),original.id)
      WHERE (:p1 IS NULL OR customer.id=:p1)
      ORDER BY o.created_at DESC,o.id`,[customer?.id??null])).rows.filter(row=>readProfile(actor,row.profile));
    const recordsById=await opportunityRecordsById(c,rows);
    const tasks=await opportunityTasks(c,rows.filter(row=>canProgress(actor,row.profile)).map(row=>row.profile));
    const opportunities=rows.map(row=>({...attachOpportunityActions(actor,row.profile,
      projectOpportunity(row,recordsById.get(row.id)??[],row.profile),tasks),assistanceDueAt:row.assistanceDueAt}));
    return {opportunities,customer:customer?{id:customer.id,name:customer.profile.fullName}:undefined};
  }));
  app.get('/api/crm/opportunities/:id',read(async(c,q,actor)=>{
    const row=(await c.query('SELECT * FROM enrollment_opportunities WHERE id=:p1',[q.params.id])).rows[0];
    const customer=row && await canonicalIdentity(c,row.lead_id);
    if (!customer || !readProfile(actor,customer.profile)) invalid('enrollment_opportunity_not_found',404);
    const legacyProgress=(await c.query(`SELECT id,actor,sales_stage AS stage,note,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS createdAt
      FROM enrollment_opportunity_progress WHERE opportunity_id=:p1 ORDER BY created_at DESC,id DESC`,[row.id])).rows;
    const linkedProgress=(await c.query(`SELECT f.id AS factId,f.actor,f.data->>'$.result.logId' AS id,
      f.data->>'$.result.opportunity.stage' AS stage,f.data->>'$.summary' AS note,
      f.data->'$.result.opportunity.sourceRefs' AS sourceRefs,
      DATE_FORMAT(f.created_at,'%Y-%m-%dT%H:%i:%sZ') AS createdAt
      FROM crm_facts f JOIN portal_leads l ON l.id=f.lead_id
      WHERE (l.id=:p1 OR l.profile->>'$.identityMergedInto'=:p1) AND f.kind='followup.recorded'
        AND f.data->>'$.result.opportunity.id'=:p2`,[customer.id,row.id])).rows;
    const emails=(await c.query(`SELECT n.event_key AS id,n.subject_id AS orderId,n.kind,n.state,
      n.payload->>'$.subject' AS subject,n.payload->>'$.language' AS language,
      DATE_FORMAT(n.recorded_at,'%Y-%m-%dT%H:%i:%sZ') AS recordedAt
      FROM enrollment_customer_records r JOIN enrollment_notification_receipts n ON n.subject_id=r.record_id
      WHERE r.kind='order' AND r.opportunity_id=:p1 AND n.channel='email'
        AND n.kind NOT IN ('otp_apply','otp_mine')
      ORDER BY n.recorded_at DESC,n.event_key DESC`,[row.id])).rows;
    const current=projectOpportunity(row,await recordsForOpportunity(c,row.id),customer.profile);
    const sources=linkedProgress.some(entry=>Array.isArray(entry.sourceRefs)&&entry.sourceRefs.length)
      ?(await salesProgressContext(c,customer.id,customer.profile)).sources:[];
    const progress=[...linkedProgress,...legacyProgress].map(({sourceRefs,...entry})=>({
      ...entry,sources:Array.isArray(sourceRefs)?sourceRefs.flatMap(ref=>{
        const source=sources.find(item=>item.type===ref.type&&item.id===ref.id);
        return source&&opportunitySourceKind(source)?[source]:[];
      }):[],
    })).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    const tasks=await opportunityTasks(c,canProgress(actor,customer.profile)?[customer.profile]:[]);
    const actions=attachOpportunityActions(actor,customer.profile,current,tasks);
    const assistance=actions.canProgress?{
      email:customer.profile.email||'',phone:customer.profile.whatsapp||'',
      allowed:!current.records.some(record=>record.kind==='order'&&!['ended','expired'].includes(record.state)),
    }:undefined;
    const assistanceHistory=(await c.query(`SELECT id,class_id AS classId,order_id AS orderId,actor,
      data->>'$.lang' AS lang,expires_at>UTC_TIMESTAMP(6) AS active,
      DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%sZ') AS expiresAt,
      DATE_FORMAT(confirmed_at,'%Y-%m-%dT%H:%i:%sZ') AS confirmedAt FROM enrollment_assisted_applications
      WHERE opportunity_id=:p1 ORDER BY created_at DESC,id LIMIT 1`,[row.id])).rows[0];
    const mail=assistanceHistory?await latestAssistanceMail(c,assistanceHistory.id):undefined;
    return {...actions,progress,emails,assistance,
      assistanceDueAt:Number(assistanceHistory?.active)===1&&!assistanceHistory?.orderId?assistanceHistory.expiresAt:undefined,
      assistanceHistory:assistanceHistory&&{...assistanceHistory,mail}};
  }));
  app.post('/api/crm/opportunities/:id/progress',wrap(async(q,r)=>{
    if (!validMutationOrigin(q)) invalid('enrollment_origin_rejected',403);
    const actor=await staff(q,'crm.followup');
    const id=String(q.params.id);
    const {stage,note,revision}=q.body ?? {};
    if (typeof note!=='string'||!note.trim()||
      note.length>2000||!Number.isSafeInteger(revision)||revision<0) invalid('enrollment_invalid_opportunity_progress');
    const result=await transact(async c=>{
      await lockIdentityRegistry(c);
      const row=(await c.query('SELECT * FROM enrollment_opportunities WHERE id=:p1',[id])).rows[0];
      const customer=row && await canonicalIdentity(c,row.lead_id);
      if (!customer||!readProfile(actor,customer.profile)) invalid('enrollment_opportunity_not_found',404);
      if(!canProgress(actor,customer.profile)) invalid('enrollment_opportunity_progress_forbidden',403);
      return operation(c,actor.id,q.body,{leadId:customer.id,kind:'enrollment.opportunity.progress:'+id},async()=>{
        const saved=await saveProgress(c,customer.id,actor.id,{
          workflowVersion:3,requestId:q.body.requestId,summary:note,recordKind:'internal',expectedRevision:customer.profile.simpleRevision||0,
          opportunityLink:{id,revision,stage,sourceRefs:q.body.sourceRefs},
        },profile=>readProfile(actor,profile)&&canProgress(actor,profile));
        return {revision:saved.opportunity.revision,logId:saved.logId};
      });
    });
    r.set('Cache-Control','no-store').json(result);
  }));
  app.post('/api/crm/leads/:id/enrollment-opportunities',wrap(async(q,r)=>{
    if(!validMutationOrigin(q)) invalid('enrollment_origin_rejected',403);
    const actor=await staff(q,'crm.followup');
    const {level,note,requestId,sourceRefs}=q.body??{};
    if(!enrollmentOpportunityLevels.includes(level)||typeof note!=='string'||!note.trim()||note.length>2000)
      invalid('enrollment_invalid_opportunity_progress');
    const result=await transact(async c=>{
      await lockIdentityRegistry(c);
      const customer=await canonicalIdentity(c,String(q.params.id));
      if(!customer||!readProfile(actor,customer.profile)) invalid('enrollment_customer_not_found',404);
      if(!canProgress(actor,customer.profile)) invalid('enrollment_opportunity_progress_forbidden',403);
      return operation(c,actor.id,q.body,{leadId:customer.id,kind:'enrollment.opportunity.open'},async()=>{
        const active=await activeOpportunityCandidates(c,customer,level);
        if(active.length>1) invalid('enrollment_opportunity_selection_required',409);
        const created=!active.length;
        const id=active[0]?.id??randomUUID();
        if(created) await c.query(`INSERT INTO enrollment_opportunities(id,lead_id,level,sales_stage,created_at)
          VALUES(:p1,:p2,:p3,'progress:unreached',UTC_TIMESTAMP(6))`,[id,customer.id,level]);
        const saved=await saveProgress(c,customer.id,actor.id,{
          workflowVersion:3,requestId,summary:note,recordKind:'internal',expectedRevision:customer.profile.simpleRevision||0,
          opportunityLink:{id,revision:Number(active[0]?.revision??0),sourceRefs},
        },profile=>readProfile(actor,profile)&&canProgress(actor,profile));
        await reconcileEnrollmentRecords(c,customer.id,actor.id,level);
        return {opportunityId:id,created,logId:saved.logId};
      });
    });
    r.set('Cache-Control','no-store').json(result);
  }));
  app.get('/api/crm/leads/:id/enrollment-opportunities',read(async(c,q,actor)=>{
    const customer=await canonicalIdentity(c,String(q.params.id));
    if(!customer || !readProfile(actor,customer.profile)) invalid('enrollment_customer_not_found',404);
    if(!canProgress(actor,customer.profile)) return {opportunities:[]};
    const rows=(await c.query(`SELECT o.* FROM enrollment_opportunities o JOIN portal_leads l ON l.id=o.lead_id
      WHERE l.id=:p1 OR l.profile->>'$.identityMergedInto'=:p1 ORDER BY o.created_at DESC,o.id`,[customer.id])).rows;
    const options=[];
    for(const row of rows){
      const current=projectOpportunity(row,await recordsForOpportunity(c,row.id),customer.profile);
      if(isOpenOpportunity(current)) options.push({
        id:current.id,level:current.level,state:current.state,salesStage:current.salesStage,revision:current.revision,
      });
    }
    return {opportunities:options};
  }));
  app.get('/api/crm/leads/:id/enrollment-records',read(async(c,q,actor)=>{
    const customer=await canonicalIdentity(c,String(q.params.id));
    if (!customer || !readProfile(actor,customer.profile)) invalid('enrollment_customer_not_found',404);
    const canChangeEmail=await canChangeEnrollmentEmail(c,actor,customer);
    const rows=(await c.query(courseRecords+` JOIN portal_leads l ON l.id=r.lead_id
      WHERE l.id=:p1 OR l.profile->>'$.identityMergedInto'=:p1 ORDER BY r.created_at DESC,r.record_id`,[customer.id])).rows;
    const canLink=canProgress(actor,customer.profile);
    return {records:rows.map(row=>({...displayRecord(row),enrollmentEmail:canChangeEmail?row.enrollment_email:undefined,
      canLinkOpportunity:canLink&&!row.opportunity_id&&Boolean(recordOpportunityLevel(row))})),canChangeEmail};
  }));
  const linkPath='/api/crm/leads/:id/enrollment-records/:kind/:recordId/opportunity';
  const readLinkContext=async(c:Client,q:Request,actor:Employee)=>{
    const customer=await canonicalIdentity(c,String(q.params.id));
    if(!customer||!readProfile(actor,customer.profile))invalid('enrollment_customer_not_found',404);
    if(!canProgress(actor,customer.profile))invalid('enrollment_opportunity_progress_forbidden',403);
    const kind=String(q.params.kind),recordId=String(q.params.recordId);
    if(!Object.hasOwn(changeEmailStatements,kind)||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(recordId))
      invalid('enrollment_record_not_found',404);
    const row=(await c.query(courseRecords+` JOIN portal_leads l ON l.id=r.lead_id
      WHERE (l.id=:p1 OR l.profile->>'$.identityMergedInto'=:p1) AND r.kind=:p2 AND r.record_id=:p3`,[customer.id,kind,recordId])).rows[0];
    if(!row)invalid('enrollment_record_not_found',404);
    return {customer,row,kind,recordId};
  };
  app.get(linkPath,read(async(c,q,actor)=>{
    const {customer,row}=await readLinkContext(c,q,actor);
    const level=recordOpportunityLevel(row);
    const candidates=!row.opportunity_id&&level?await activeOpportunityCandidates(c,customer,level):[];
    const records=await opportunityRecordsById(c,candidates);
    return {opportunityId:row.opportunity_id,opportunities:candidates.map(item=>{
      const projected=projectOpportunity(item,records.get(item.id)??[],customer.profile);
      const latest=projected.records.at(-1);
      return {id:item.id,level:item.level,stage:projected.salesStage,createdAt:item.created_at,
        class:latest?.class??null,criteria:latest?.criteria??null};
    })};
  }));
  app.post(linkPath,wrap(async(q,r)=>{
    if(!validMutationOrigin(q))invalid('enrollment_origin_rejected',403);
    const actor=await staff(q,'crm.followup');
    const {opportunityId}=q.body??{};
    if(typeof opportunityId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(opportunityId))
      invalid('enrollment_opportunity_not_found',404);
    const result=await transact(async c=>{
      await lockIdentityRegistry(c);
      const {customer,row,kind,recordId}=await readLinkContext(c,q,actor);
      return operation(c,actor.id,q.body,{leadId:customer.id,kind:`enrollment.opportunity.link.${kind}:${recordId}`},async()=>{
        if(row.opportunity_id){
          if(row.opportunity_id!==opportunityId)invalid('enrollment_opportunity_already_linked',409);
          return {opportunityId,recordId,kind};
        }
        const level=recordOpportunityLevel(row);
        const candidates=level?await activeOpportunityCandidates(c,customer,level):[];
        if(!candidates.some(candidate=>candidate.id===opportunityId))invalid('enrollment_opportunity_not_found',404);
        await c.query(`UPDATE enrollment_customer_records SET opportunity_id=:p1 WHERE kind=:p2 AND record_id=:p3
          AND opportunity_id IS NULL`,[opportunityId,kind,recordId]);
        await c.query('UPDATE enrollment_opportunities SET revision=revision+1 WHERE id=:p1',[opportunityId]);
        await fact(c,customer.id,'enrollment.opportunity.linked',actor.id,{opportunityId,recordId,kind});
        return {opportunityId,recordId,kind};
      });
    });
    r.set('Cache-Control','no-store').json(result);
  }));
  const emailPath='/api/crm/leads/:id/enrollment-records/email';
  app.get(emailPath+'/results/:requestId',read(async(c,q,actor)=>{
    const customer=await canonicalIdentity(c,String(q.params.id));
    if(!customer||!readProfile(actor,customer.profile)||!await canChangeEnrollmentEmail(c,actor,customer))
      invalid('enrollment_customer_not_found',404);
    const result=(await c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',[actor.id,q.params.requestId])).rows[0]?.result;
    if(result?.operationKind!==emailChangeKind||result?.leadId!==customer.id) invalid('enrollment_result_missing',404);
    return result;
  }));
  app.post(emailPath,wrap(async(q,r)=>{
    if(!validMutationOrigin(q)) invalid('enrollment_origin_rejected',403);
    const actor=await staff(q,'crm.write');
    const {kind,recordId,previousEmail,email,reason,confirmed}=q.body??{};
    if(typeof kind!=='string'||!Object.hasOwn(changeEmailStatements,kind)||
        typeof recordId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(recordId)||
        typeof email!=='string'||typeof previousEmail!=='string'||!validContactEmail(email)||!validContactEmail(previousEmail)||typeof reason!=='string'||
        !reason.trim()||reason.length>500||confirmed!==true) invalid('enrollment_invalid_email_change');
    const next=email.trim().toLowerCase();
    const previous=previousEmail.trim().toLowerCase();
    if(next===previous) invalid('enrollment_invalid_email_change');
    const result=await transact(async c=>{
      const customer=await canonicalIdentity(c,String(q.params.id));
      if(!customer||!readProfile(actor,customer.profile)) invalid('enrollment_customer_not_found',404);
      if(!await canChangeEnrollmentEmail(c,actor,customer)) invalid('enrollment_email_change_forbidden',403);
      await lockEnrollmentEmail(c,next);
      return operation(c,actor.id,q.body,{leadId:customer.id,kind:emailChangeKind},async()=>{
        // Finish active requests and require a fresh code for the destination mailbox before access can move.
        await c.query('DELETE FROM enrollment_email_sessions WHERE email=:p1',[next]);
        await c.query('DELETE FROM enrollment_email_challenges WHERE email=:p1',[next]);
        const sql=changeEmailStatements[kind as RecordKind];
        const record=(await c.query(sql.lock,[recordId])).rows[0];
        await lockIdentityRegistry(c);
        const current=await canonicalIdentity(c,customer.id);
        const linked=(await c.query('SELECT lead_id FROM enrollment_customer_records WHERE kind=:p1 AND record_id=:p2',[kind,recordId])).rows[0];
        const owner=linked&&await canonicalIdentity(c,linked.lead_id);
        if(!current||current.id!==customer.id||owner?.id!==customer.id||!readProfile(actor,current.profile))
          invalid('enrollment_customer_not_found',404);
        if(!await canChangeEnrollmentEmail(c,actor,current)) invalid('enrollment_email_change_forbidden',403);
        if(record?.email!==previous) invalid('enrollment_email_changed',409);
        await c.query(sql.save,[recordId,next]);
        await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.record.email.change',:p2)",
          [actor.id,{customerId:customer.id,kind,recordId,previousEmail:previous,email:next,reason:reason.trim()}]);
        return {recordId,email:next};
      });
    });
    r.set('Cache-Control','no-store').json(result);
  }));
}
