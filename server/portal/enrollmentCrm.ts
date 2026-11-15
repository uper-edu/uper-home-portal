import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { allowed, type Employee } from './identity.ts';
import { permittedRecord } from '../../src/utils/accessControl.ts';
import { isSalesProgressStage } from '../../src/utils/crmSalesProgress.ts';
import { enrollmentLearnerNameKey, enrollmentOrderStatus } from '../../src/utils/enrollmentOrderStatus.ts';
import { validMutationOrigin } from './accessTransport.ts';
import { assignNewLead } from './autoAssignment.ts';
import { canonicalIdentity, lockIdentityRegistry } from './identityConsolidation.ts';
import { discoverIdentity } from './identityReview.ts';
import { invalid, normalizeContactPhone, operation } from './trustWorkflow.ts';

type Client = { query: (sql: string, params?: unknown[]) => Promise<{rows: any[]}> };
type RecordKind = 'order' | 'waitlist' | 'demand';
type Submission = { kind: RecordKind; id: string; email: string; phone: string; name?: string; level?: string };

async function identityForSubmission(c: Client, { email, phone, name }: Submission) {
  const normalized = normalizeContactPhone(phone);
  const anchors = (await c.query(`SELECT id,profile FROM portal_leads
    WHERE LOWER(profile->>'$.email')=:p1 AND profile->>'$.enrollmentEmailVerified'='true'`, [email])).rows;
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
    entryPoint:'enrollment', enrollmentEmailVerified:true, submittedAt, identityLifecycle:'independent',
  };
  const inserted = (await c.query('INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)', [id,profile])).rows[0];
  const visitorId = randomUUID();
  await c.query('INSERT INTO visitor_sessions(id,lead_id,expires_at) VALUES(:p1,:p2,UTC_TIMESTAMP(6))', [visitorId,id]);
  const matched = await discoverIdentity(c,visitorId,id,profile);
  const saved = {...profile,businessNumber:inserted.business_number,
    ...(matched ? {identityLifecycle:'pending'} : {currentStage:'progress:unreached',tier:'Unqualified',stageUpdatedAt:submittedAt})};
  await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1', [id,saved]);
  if (!matched) await assignNewLead(c,id,'registration');
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
  if (record.level) {
    const active = (await c.query(`SELECT o.id FROM enrollment_opportunities o JOIN portal_leads l ON l.id=o.lead_id
      WHERE (l.id=:p1 OR l.profile->>'$.identityMergedInto'=:p1) AND o.level=:p2
      AND (o.sales_stage IS NULL OR o.sales_stage<>'progress:closed')
      AND NOT EXISTS (SELECT 1 FROM enrollment_customer_records r JOIN enrollment_orders e ON r.kind='order' AND e.id=r.record_id
        WHERE r.opportunity_id=o.id AND e.state IN ('paid','recovered','refunding','refunded'))
      ORDER BY o.created_at,o.id LIMIT 2`, [lead.id,record.level])).rows;
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

const courseRecords = `SELECT r.kind,r.record_id,r.opportunity_id,DATE_FORMAT(r.created_at,'%Y-%m-%dT%H:%i:%sZ') AS created_at,
    CASE WHEN o.state='awaiting_payment' AND o.received=0 AND o.payment_due_at<UTC_TIMESTAMP(6)
      AND (o.upload_expires_at IS NULL OR o.upload_expires_at<UTC_TIMESTAMP(6)) THEN 'expired'
      ELSE COALESCE(o.state,w.state,d.state) END AS state,
    o.price,o.received,d.criteria,b.state AS class_state,b.data AS class_data,g.opened_at,a.attribution,e.latest_notice
  FROM enrollment_customer_records r
  LEFT JOIN enrollment_orders o ON r.kind='order' AND o.id=r.record_id
  LEFT JOIN enrollment_waitlist w ON r.kind='waitlist' AND w.id=r.record_id
  LEFT JOIN enrollment_demands d ON r.kind='demand' AND d.id=r.record_id
  LEFT JOIN enrollment_classes b ON b.id=COALESCE(o.class_id,w.class_id)
  LEFT JOIN enrollment_class_openings g ON g.class_id=b.id
  LEFT JOIN enrollment_record_attribution a ON a.kind=r.kind AND a.record_id=r.record_id
  LEFT JOIN LATERAL (SELECT payload->>'$.subject' AS latest_notice FROM enrollment_notification_receipts
    WHERE channel='email' AND subject_id=r.record_id ORDER BY recorded_at DESC,event_key DESC LIMIT 1) e ON TRUE`;

function displayRecord(row: any) {
  return {
    id:row.record_id,kind:row.kind,opportunityId:row.opportunity_id,state:enrollmentOrderStatus(row.state,row.class_state),createdAt:row.created_at,
    class:row.class_data ? {level:row.class_data.level,firstLesson:row.class_data.firstLesson,schedule:row.class_data.schedule,opened:!!row.opened_at} : null,
    price:row.price===null?null:Number(row.price),received:row.received===null?null:Number(row.received),
    criteria:row.criteria?{level:row.criteria.level,period:row.criteria.period,format:row.criteria.format,notes:row.criteria.notes}:null,
    attribution:row.attribution?{entry:row.attribution.entry,source:row.attribution.source,campaign:row.attribution.campaign,verified:row.attribution.verified}:null,
    latestNotice:row.latest_notice,
  };
}

function projectOpportunity(row: any, records: ReturnType<typeof displayRecord>[], profile: any) {
  const states = records.map(record => record.state);
  const state = states.some(state=>['paid','recovered'].includes(state)) ? 'enrolled'
    : states.includes('paid_cancelled') ? 'aftercare'
    : states.some(state=>['awaiting_payment','partial','proof_review'].includes(state)) ? 'applying'
    : states.includes('waiting') ? 'waiting' : states.some(state=>['active','expired'].includes(state)) ? 'interest' : 'closed';
  const salesStage=state==='enrolled'?'progress:enrolled':state==='aftercare'?'progress:paused':row.sales_stage ??
    (state==='applying'?'progress:registration':state==='closed'?'progress:closed':'progress:unreached');
  return {id:row.id,level:row.level,customerId:profile.id,customerName:profile.fullName,
    businessNumber:profile.businessNumber,owner:profile.owner ?? null,identityPending:profile.identityLifecycle==='pending',
    createdAt:row.created_at,state,salesStage,revision:Number(row.revision),records};
}

export function mountEnrollmentCrm(app:Express,{ wrap, staff, transact }:{
  wrap:(fn:(q:Request,r:Response)=>Promise<unknown>)=>(q:Request,r:Response)=>void;
  staff:(q:Request,permission:string)=>Promise<Employee>;
  transact:(fn:(c:Client)=>Promise<any>)=>Promise<any>;
}) {
  const read = (fn:(c:Client,q:Request,actor:Employee)=>Promise<unknown>) => wrap(async(q,r)=>{
    const actor=await staff(q,'crm.read');
    const data=await transact(c=>fn(c,q,actor));
    r.set('Cache-Control','no-store').json(data);
  });
  const readProfile=(actor:Employee,profile:any)=>profile && allowed(actor,profile);
  const byOpportunity=async(c:Client,id:string)=>(await c.query(courseRecords+' WHERE r.opportunity_id=:p1 ORDER BY r.created_at,r.record_id',[id])).rows.map(displayRecord);
  const canProgress=(actor:Employee,profile:any)=>profile.identityLifecycle!=='pending'&&permittedRecord(actor,profile,'crm.followup');

  app.get('/api/crm/opportunities',read(async(c,q,actor)=>{
    const rows=(await c.query(`SELECT o.*, customer.profile
      FROM enrollment_opportunities o JOIN portal_leads original ON original.id=o.lead_id
      JOIN portal_leads customer ON customer.id=COALESCE(NULLIF(original.profile->>'$.identityMergedInto','null'),original.id)
      ORDER BY o.created_at DESC,o.id`)).rows.filter(row=>readProfile(actor,row.profile));
    const recordsById=new Map<string, ReturnType<typeof displayRecord>[]>();
    for (let start=0;start<rows.length;start+=100) {
      const ids=rows.slice(start,start+100).map(row=>row.id);
      const predicates=ids.map((_,index)=>':p'+(index+1)).join(',');
      const data=(await c.query(courseRecords+` WHERE r.opportunity_id IN (${predicates}) ORDER BY r.created_at,r.record_id`,ids)).rows;
      for (const row of data) {
        const records=recordsById.get(row.opportunity_id)??[];
        records.push(displayRecord(row));
        recordsById.set(row.opportunity_id,records);
      }
    }
    const opportunities=rows.map(row=>projectOpportunity(row,recordsById.get(row.id)??[],row.profile));
    return {opportunities};
  }));
  app.get('/api/crm/opportunities/:id',read(async(c,q,actor)=>{
    const row=(await c.query('SELECT * FROM enrollment_opportunities WHERE id=:p1',[q.params.id])).rows[0];
    const customer=row && await canonicalIdentity(c,row.lead_id);
    if (!customer || !readProfile(actor,customer.profile)) invalid('enrollment_opportunity_not_found',404);
    const progress=(await c.query(`SELECT id,actor,sales_stage AS stage,note,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS createdAt
      FROM enrollment_opportunity_progress WHERE opportunity_id=:p1 ORDER BY created_at DESC,id DESC`,[row.id])).rows;
    return {...projectOpportunity(row,await byOpportunity(c,row.id),customer.profile),progress,canProgress:canProgress(actor,customer.profile)};
  }));
  app.post('/api/crm/opportunities/:id/progress',wrap(async(q,r)=>{
    if (!validMutationOrigin(q)) invalid('enrollment_origin_rejected',403);
    const actor=await staff(q,'crm.followup');
    const id=String(q.params.id);
    const {stage,note,revision}=q.body ?? {};
    if (!isSalesProgressStage(stage)||stage==='progress:enrolled'||typeof note!=='string'||!note.trim()||
      note.length>2000||!Number.isSafeInteger(revision)||revision<0) invalid('enrollment_invalid_opportunity_progress');
    const result=await transact(async c=>{
      await lockIdentityRegistry(c);
      const row=(await c.query('SELECT * FROM enrollment_opportunities WHERE id=:p1 FOR UPDATE',[id])).rows[0];
      const customer=row && await canonicalIdentity(c,row.lead_id);
      if (!customer||!readProfile(actor,customer.profile)) invalid('enrollment_opportunity_not_found',404);
      if (!canProgress(actor,customer.profile)) invalid('enrollment_opportunity_progress_forbidden',403);
      return operation(c,actor.id,q.body,{leadId:customer.id,kind:'enrollment.opportunity.progress:'+id},async()=>{
        if (revision!==Number(row.revision)) invalid('enrollment_opportunity_progress_conflict',409);
        const current=projectOpportunity(row,await byOpportunity(c,id),customer.profile);
        if (current.state==='enrolled') invalid('enrollment_opportunity_is_enrolled',409);
        await c.query('UPDATE enrollment_opportunities SET sales_stage=:p1,revision=revision+1 WHERE id=:p2',[stage,id]);
        await c.query(`INSERT INTO enrollment_opportunity_progress(id,opportunity_id,actor,sales_stage,note,created_at)
          VALUES(:p1,:p2,:p3,:p4,:p5,UTC_TIMESTAMP(6))`,[randomUUID(),id,actor.id,stage,note.trim()]);
        return {revision:revision+1};
      });
    });
    r.set('Cache-Control','no-store').json(result);
  }));
  app.get('/api/crm/leads/:id/enrollment-records',read(async(c,q,actor)=>{
    const customer=await canonicalIdentity(c,String(q.params.id));
    if (!customer || !readProfile(actor,customer.profile)) invalid('enrollment_customer_not_found',404);
    return {records:(await c.query(courseRecords+` JOIN portal_leads l ON l.id=r.lead_id
      WHERE l.id=:p1 OR l.profile->>'$.identityMergedInto'=:p1 ORDER BY r.created_at DESC,r.record_id`,[customer.id])).rows.map(displayRecord)};
  }));
}
