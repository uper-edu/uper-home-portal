import type { Express, Request, Response } from 'express';
import { allowed, type Employee } from './identity.ts';
import { permittedRecord } from '../../src/utils/accessControl.ts';
import { enrollmentManagementScopes, enrollmentRosterStates, type EnrollmentClassSummary, type EnrollmentRosterEntry, type EnrollmentRosterState } from '../../src/utils/crmEnrollmentManagement.ts';
import { enrollmentClosureReason } from '../../src/utils/enrollmentOrderStatus.ts';
import { invalid } from './trustWorkflow.ts';
import { tx } from './store.ts';

type Client={query:(sql:string,args?:unknown[])=>Promise<{rows:any[]}>};
type Wrap=(handler:(q:Request,r:Response)=>Promise<unknown>)=>(q:Request,r:Response)=>void;
type Scope=ReturnType<typeof enrollmentManagementScopes>;

// Keep the live view read-only. Use the admission deadline rules even if the expiry worker has not run yet.
const orderState=`CASE WHEN o.state='awaiting_payment' AND o.received=0 AND o.payment_due_at<UTC_TIMESTAMP(6)
  AND (o.upload_expires_at IS NULL OR o.upload_expires_at<UTC_TIMESTAMP(6)) THEN 'expired' ELSE o.state END`;
const inviteDeadline=`LEAST(i.expires_at,DATE(b.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)`;
const orders=`SELECT o.class_id,o.id,o.id AS record_id,'order' AS kind,${orderState} AS state,
    o.data->>'$.name' AS name,o.email,o.data->>'$.phone' AS phone,o.price,o.received,o.payment_due_at AS due_at,o.data->>'$.closureReason' AS recorded_closure
  FROM enrollment_orders o WHERE (:p1 IS NULL OR o.class_id=:p1)`;
const waitlist=`SELECT w.class_id,w.id,w.id AS record_id,'waitlist' AS kind,w.state,w.learner_name AS name,
    w.email,w.phone,NULL AS price,NULL AS received,NULL AS due_at,NULL AS recorded_closure
  FROM enrollment_waitlist w WHERE (:p1 IS NULL OR w.class_id=:p1)`;
const invitations=`SELECT i.target_class_id AS class_id,i.id,o.id AS record_id,'order' AS kind,
    'held' AS state,o.data->>'$.name' AS name,o.email,o.data->>'$.phone' AS phone,NULL AS price,NULL AS received,${inviteDeadline} AS due_at,NULL AS recorded_closure
  FROM enrollment_transfer_invitations i JOIN enrollment_classes b ON b.id=i.target_class_id
  JOIN enrollment_orders o ON o.id=i.order_id
  WHERE i.state='offered' AND ${inviteDeadline}>UTC_TIMESTAMP(6) AND (:p1 IS NULL OR i.target_class_id=:p1)`;
const activity=`${orders} UNION ALL ${waitlist} UNION ALL ${invitations}`;

function bucket(state:string):EnrollmentRosterState {
  if(state==='recovered')return 'paid';
  return enrollmentRosterStates.some(item=>item===state)?state as EnrollmentRosterState:'history';
}

async function summaries(c:Client,actor:Employee,scope:Scope,id:string|null){
  const rows=(await c.query(`WITH activity AS (${activity}),
    counts AS (SELECT class_id,state,COUNT(*) AS amount FROM activity GROUP BY class_id,state),
    historical_access AS (
      SELECT DISTINCT a.class_id FROM activity a
      JOIN enrollment_customer_records r ON r.kind=a.kind AND r.record_id=a.record_id
      JOIN portal_leads l ON l.id=r.lead_id
      JOIN portal_leads customer ON customer.id=COALESCE(NULLIF(l.profile->>'$.identityMergedInto','null'),l.id)
      WHERE customer.profile->>'$.owner'=:p3
    )
    SELECT b.id,b.state,b.data,b.first_lesson_at,g.class_id IS NOT NULL AS opened,
      b.state='published' AND JSON_EXTRACT(course.value,'$.active')=true
        AND LEAST(b.enrollment_closes_at,DATE(b.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6) AS accepting,
      counts.state AS entry_state,counts.amount
    FROM enrollment_classes b JOIN crm_courses course ON course.id=b.course_id
    LEFT JOIN enrollment_class_openings g ON g.class_id=b.id LEFT JOIN counts ON counts.class_id=b.id
    LEFT JOIN historical_access h ON h.class_id=b.id
    WHERE (:p1 IS NULL OR b.id=:p1) AND (b.state='published' OR
      (b.state='cancelled' AND (:p2=1 OR h.class_id IS NOT NULL)))
    ORDER BY b.first_lesson_at DESC,b.id`,[id,Number(scope.operations||scope.finance||permittedRecord(actor,{},'crm.read')),actor.id])).rows;
  const classes=new Map<string,EnrollmentClassSummary>();
  for(const row of rows){
    let cohort=classes.get(row.id);
    if(!cohort){
      const accepting=Number(row.accepting)===1;
      const status=row.state==='cancelled'?'cancelled':Number(row.opened)===1?'opened':accepting?'recruiting':'closed';
      cohort={id:row.id,level:row.data.level,format:row.data.format,schedule:row.data.schedule,
        firstLessonAt:row.first_lesson_at,capacity:row.data.capacity,minimumPaid:row.data.minimumPaid,status,accepting,
        counts:{awaiting_payment:0,proof_review:0,partial:0,paid:0,held:0,waiting:0,history:0},occupied:0,available:0};
      classes.set(row.id,cohort);
    }
    if(row.entry_state)cohort.counts[bucket(row.entry_state)]+=Number(row.amount);
  }
  return [...classes.values()].map(cohort=>{
    const {counts}=cohort;
    const occupied=cohort.status==='cancelled'?0:counts.awaiting_payment+counts.proof_review+counts.partial+counts.paid+counts.held;
    return {...cohort,occupied,available:cohort.status==='cancelled'?0:Math.max(0,cohort.capacity-occupied)};
  });
}

async function roster(c:Client,actor:Employee,scope:Scope,id:string){
  const rows=(await c.query(`WITH activity AS (${activity})
    SELECT a.*,r.opportunity_id,customer.id AS customer_id,customer.profile
    FROM activity a
    LEFT JOIN enrollment_customer_records r ON r.kind=a.kind AND r.record_id=a.record_id
    LEFT JOIN portal_leads original ON original.id=r.lead_id
    LEFT JOIN portal_leads customer ON customer.id=COALESCE(NULLIF(original.profile->>'$.identityMergedInto','null'),original.id)
    ORDER BY a.name,a.id`,[id])).rows;
  return rows.flatMap((row):EnrollmentRosterEntry[]=>{
    const customerVisible=Boolean(row.profile && (scope.followup||scope.operations) && allowed(actor,row.profile));
    const canVerify=scope.finance&&['proof_review','partial'].includes(row.state);
    if(!customerVisible&&!canVerify)return [];
    const contact=customerVisible&&row.profile.identityLifecycle!=='pending'&&permittedRecord(actor,row.profile,'crm.read');
    return [{
      id:row.id,status:bucket(row.state),actualStatus:row.state,name:row.name??(customerVisible?row.profile.fullName:''),
      customerId:customerVisible?row.customer_id:null,opportunityId:customerVisible?row.opportunity_id:null,
      owner:customerVisible?row.profile.owner??null:null,
      ...(contact?{email:row.email??undefined,phone:row.phone??undefined}:{}),
      closureReason:row.kind==='order'?enrollmentClosureReason(row.state,row.recorded_closure):undefined,
      dueAt:row.due_at??null,
      ...(row.price!==null&&(customerVisible||canVerify)?{price:Number(row.price),received:Number(row.received)}:{}),canVerify,
    }];
  });
}

export function mountEnrollmentManagement(app:Express,wrap:Wrap,staff:(q:Request,permission:string)=>Promise<Employee>){
  app.get(['/api/crm/enrollment/management','/api/crm/enrollment/management/:id'],wrap(async(q,r)=>{
    const actor=await staff(q,'crm.read');
    const scope=enrollmentManagementScopes(actor);
    if(!Object.values(scope).some(Boolean))invalid('enrollment_management_forbidden',403);
    const id=q.params.id===undefined?null:String(q.params.id);
    const data=await tx(async c=>{
      const classes=await summaries(c,actor,scope,id);
      if(!id)return {classes};
      const cohort=classes[0];
      if(!cohort)invalid('enrollment_management_class_not_found',404);
      return {cohort,rows:await roster(c,actor,scope,id)};
    });
    r.set('Cache-Control','no-store').json(data);
  }));
}
