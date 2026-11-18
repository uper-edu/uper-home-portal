import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { demandMatches, enrollmentPhone, parseDemand } from '../../src/utils/enrollmentInterests.ts';
import { enrollmentLearnerNameKey } from '../../src/utils/enrollmentOrderStatus.ts';
import { invalid } from './trustWorkflow.ts';
import { recordEnrollmentCustomer } from './enrollmentCrm.ts';
import { recordEnrollmentAttribution } from './enrollmentAttribution.ts';
import { activeLearnerOrder, learnerWaitlist } from './enrollmentLearners.ts';
import { interestNotice } from './enrollmentNotices.ts';

type Client = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };
type Handler = (q: Request, r: Response) => Promise<unknown>;
type Cohort = { id: string; state: string; accepting: string | number; course_active: string | number; data: any };
type Demand = { id: string; email: string; revision: number; criteria: Parameters<typeof demandMatches>[0] };
type Offer = Pick<Cohort,'id'|'data'>;
type Context = {
  wrap: (fn: Handler) => (q: Request, r: Response) => void;
  post: (path: string, fn: Handler) => void;
  transact: (fn: (c: Client) => Promise<any>) => Promise<any>;
  session: (c: Client, q: Request) => Promise<string>;
  lockClass: (c: Client, id: string) => Promise<Cohort>;
  expireSeats: (c: Client, id: string) => Promise<void>;
  requireNewEnrollment: (c: Client) => Promise<void>;
};

export async function takenSeats(c: Client, id: string) {
  return Number((await c.query(`SELECT (SELECT COUNT(*) FROM enrollment_orders WHERE class_id=:p1 AND state NOT IN ('expired','ended','refunding','refunded'))
    + (SELECT COUNT(*) FROM enrollment_transfer_invitations i JOIN enrollment_classes e ON e.id=i.target_class_id
      WHERE i.target_class_id=:p1 AND i.state='offered'
        AND LEAST(i.expires_at, DATE(e.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6)) AS count`, [id])).rows[0].count);
}

export function allowsEnrollment(cohort: Cohort) {
  return cohort.state === 'published' && Number(cohort.accepting) === 1 && Number(cohort.course_active) === 1;
}

// The caller holds the class lock so an upload and an expiry cannot release the same seat.
export async function expireSeats(c: Client, classId: string) {
  await c.query(`UPDATE enrollment_orders SET state='expired',activity_at=UTC_TIMESTAMP(6),upload_id=NULL,upload_expires_at=NULL
    WHERE class_id=:p1 AND state='awaiting_payment' AND received=0 AND payment_due_at<UTC_TIMESTAMP(6)
      AND (upload_expires_at IS NULL OR upload_expires_at<UTC_TIMESTAMP(6))`, [classId]);
}

export async function reconcileWaitlist(c: Client, cohort: Cohort, seats: number) {
  if (!allowsEnrollment(cohort)) {
    if (!Number(cohort.accepting) || cohort.state === 'cancelled') {
      await c.query("UPDATE enrollment_waitlist SET state='closed',activity_at=UTC_TIMESTAMP(6) WHERE class_id=:p1 AND state='waiting'", [cohort.id]);
    }
    return;
  }
  const full = seats >= cohort.data.capacity;
  const previous = (await c.query('SELECT is_full,cycle FROM enrollment_vacancy_cycles WHERE class_id=:p1 FOR UPDATE', [cohort.id])).rows[0];
  if (!previous) {
    await c.query('INSERT INTO enrollment_vacancy_cycles(class_id,is_full,cycle) VALUES(:p1,:p2,0)',[cohort.id,full]);
    return;
  }
  if (full === Boolean(Number(previous.is_full))) return;
  const cycle = Number(previous.cycle) + (full ? 0 : 1);
  await c.query('UPDATE enrollment_vacancy_cycles SET is_full=:p1,cycle=:p2 WHERE class_id=:p3',[full,cycle,cohort.id]);
  if (full) return;
  const waiting=(await c.query(`SELECT w.id,w.email,COALESCE(w.learner_name,NULLIF(l.profile->>'$.fullName',w.email)) AS learner_name
    FROM enrollment_waitlist w LEFT JOIN enrollment_customer_records a ON a.kind='waitlist' AND a.record_id=w.id
    LEFT JOIN portal_leads l ON l.id=a.lead_id
    WHERE w.class_id=:p1 AND w.state='waiting' ORDER BY w.created_at,w.id`,[cohort.id])).rows;
  const notified=new Set<string>();
  for (const row of waiting) {
    // Learners sharing an email keep separate seats. A duplicate row for the same learner is not a second notice.
    const learner=JSON.stringify([row.email,enrollmentLearnerNameKey(row.learner_name??'')]);
    if (notified.has(learner)) continue;
    notified.add(learner);
    await c.query(`INSERT INTO enrollment_interest_events(kind,interest_id,class_id,cycle,created_at)
      VALUES('vacancy',:p1,:p2,:p3,UTC_TIMESTAMP(6))
      ON DUPLICATE KEY UPDATE created_at=enrollment_interest_events.created_at`,[row.id,cohort.id,cycle]);
    await interestNotice(c,'waitlist_vacancy',row.id,row.email,cohort,cycle);
  }
}

async function recordDemandMatch(c: Client, demand: Demand, offer: Offer) {
  const current=(await c.query("SELECT id FROM enrollment_demands WHERE id=:p1 AND state='active' AND revision=:p2 FOR SHARE",[demand.id,demand.revision])).rows[0];
  if (!current) return;
  await c.query(`INSERT INTO enrollment_interest_events(kind,interest_id,class_id,cycle,created_at)
    VALUES('match',:p1,:p2,0,UTC_TIMESTAMP(6))
    ON DUPLICATE KEY UPDATE created_at=enrollment_interest_events.created_at`,[demand.id,offer.id]);
  await interestNotice(c,'demand_match',demand.id,demand.email,offer,0);
}

// Run inside the publication transaction, with the class already locked by the save.
export async function matchPublishedEnrollmentClass(c: Client, classId: string) {
  const offer=(await c.query(`SELECT id,data FROM enrollment_classes
    WHERE id=:p1 AND state='published' AND LEAST(enrollment_closes_at, DATE(first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6)`,[classId])).rows[0];
  if (!offer) return;
  await expireSeats(c,classId);
  if (await takenSeats(c,classId)>=offer.data.capacity) return;
  const demands=(await c.query(`SELECT d.id,d.email,d.criteria,d.revision FROM enrollment_demands d
    WHERE d.state='active' AND NOT EXISTS (
      SELECT 1 FROM enrollment_interest_events e
      WHERE e.kind='match' AND e.interest_id=d.id AND e.class_id=:p1 AND e.cycle=0)
    ORDER BY d.id`,[classId])).rows as Demand[];
  for (const demand of demands) {
    if (demandMatches(demand.criteria,offer.data)) await recordDemandMatch(c,demand,offer);
  }
}

export function startEnrollmentVacancySimulation(transact:Context['transact'],lockClass:Context['lockClass']) {
  let busy=false;
  const tick=async()=>{
    if (busy) return;
    busy=true;
    try {
      const candidates=await transact(async c=>(await c.query(`SELECT e.id AS class_id FROM enrollment_classes e
        LEFT JOIN enrollment_vacancy_cycles v ON v.class_id=e.id
        WHERE (e.state='published' AND EXISTS (
          SELECT 1 FROM enrollment_orders o WHERE o.class_id=e.id AND o.state='awaiting_payment' AND o.received=0
            AND o.payment_due_at<UTC_TIMESTAMP(6) AND (o.upload_expires_at IS NULL OR o.upload_expires_at<UTC_TIMESTAMP(6))
        )) OR ((v.is_full=TRUE OR e.state='cancelled'
          OR LEAST(e.enrollment_closes_at, DATE(e.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)<=UTC_TIMESTAMP(6))
          AND EXISTS (SELECT 1 FROM enrollment_waitlist w WHERE w.class_id=e.id AND w.state='waiting'))
        ORDER BY e.id`)).rows);
      for (const {class_id:id} of candidates) {
        await transact(async c=>{
          const cohort=await lockClass(c,id);
          if(cohort.state==='published') await expireSeats(c,id);
          await reconcileWaitlist(c,cohort,await takenSeats(c,id));
        });
      }
    } catch {
      console.error('Enrollment vacancy simulation could not reconcile waitlists');
    } finally {
      busy=false;
    }
  };
  const timer=setInterval(()=>void tick(),10_000);
  timer.unref();
}

async function offers(c: Client) {
  return (await c.query(`SELECT e.id,e.data FROM enrollment_classes e JOIN crm_courses c ON c.id=e.course_id
    WHERE e.state='published' AND LEAST(e.enrollment_closes_at, DATE(e.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6) AND JSON_EXTRACT(c.value,'$.active')=true
    AND (SELECT COUNT(*) FROM enrollment_orders o WHERE o.class_id=e.id AND o.state NOT IN ('expired','ended','refunding','refunded')
      AND (o.state<>'awaiting_payment' OR o.payment_due_at>=UTC_TIMESTAMP(6) OR o.received>0 OR o.upload_expires_at>=UTC_TIMESTAMP(6))) + (SELECT COUNT(*) FROM enrollment_transfer_invitations i
          WHERE i.target_class_id=e.id AND i.state='offered' AND i.expires_at>UTC_TIMESTAMP(6))
      < CAST(e.data->>'$.capacity' AS UNSIGNED)
    ORDER BY e.first_lesson_at,e.id`)).rows;
}

export function mountEnrollmentInterests(app: Express, ctx: Context) {
  const { wrap, post, transact, session, lockClass, expireSeats,requireNewEnrollment }=ctx;
  const base='/api/enrollment';
  function send(r: Response, data: unknown) {
    return r.set('Cache-Control','no-store').json(data);
  }

  post(base+'/waitlist',async (q,r)=>{
    const phone=enrollmentPhone(q.body?.phone);
    const name=learnerName(q.body?.name);
    const id=q.body?.classId;
    if (!phone || typeof id!=='string' || !/^[a-zA-Z0-9-]{1,64}$/.test(id)) invalid('enrollment_invalid_waitlist');
    const result=await transact(async c=>{
      const email=await session(c,q);
      const cohort=await lockClass(c,id);
      await expireSeats(c,id);
      const seats=await takenSeats(c,id);
      if (!allowsEnrollment(cohort)) invalid('enrollment_class_unavailable',409);
      if (seats<cohort.data.capacity) invalid('enrollment_seat_available',409);
      await reconcileWaitlist(c,cohort,seats);
      const own=await activeLearnerOrder(c,id,email,name);
      if (own) invalid('enrollment_already_has_seat',409);
      const prior=await learnerWaitlist(c,id,email,name);
      if (prior) return { id:prior.id };
      await requireNewEnrollment(c);
      const waiting=randomUUID();
      await c.query("INSERT INTO enrollment_waitlist(id,class_id,email,phone,learner_name,state,created_at) VALUES(:p1,:p2,:p3,:p4,:p5,'waiting',UTC_TIMESTAMP(6))",
        [waiting,id,email,phone,name??null]);
      await recordEnrollmentCustomer(c,{kind:'waitlist',id:waiting,email,phone,name,level:cohort.data.level});
      await recordEnrollmentAttribution(c,'waitlist',waiting,q.body.source);
      return { id:waiting };
    });
    send(r,result);
  });

  post(base+'/waitlist/:id/withdraw',async(q,r)=>{
    await transact(async c=>{
      const email=await session(c,q);
      const [entry]=(await c.query('SELECT class_id FROM enrollment_waitlist WHERE id=:p1 AND email=:p2',[q.params.id,email])).rows;
      if (!entry) invalid('enrollment_interest_not_found',404);
      await lockClass(c,entry.class_id);
      await c.query("UPDATE enrollment_waitlist SET state='withdrawn',activity_at=UTC_TIMESTAMP(6) WHERE id=:p1 AND email=:p2 AND state='waiting'",[q.params.id,email]);
    });
    send(r,{ok:true});
  });

  app.get(base+'/interests',wrap(async(q,r)=>{
    const data=await transact(async c=>{
      const email=await session(c,q);
      const {rows:waiting}=await c.query('SELECT id,class_id,state,order_id,learner_name FROM enrollment_waitlist WHERE email=:p1 ORDER BY created_at DESC,id DESC',[email]);
      const availability=new Map<string,{cohort:Cohort;available:boolean}>();
      for(const id of [...new Set(waiting.map(w=>String(w.class_id)))].sort()) {
        const cohort=await lockClass(c,id);
        await expireSeats(c,id);
        const seats=await takenSeats(c,id);
        await reconcileWaitlist(c,cohort,seats);
        availability.set(id,{cohort,available:allowsEnrollment(cohort)&&seats<cohort.data.capacity});
      }
      const entries=availability.size ? (await c.query(`SELECT id,state,order_id,
        DATE_FORMAT(COALESCE(activity_at,created_at),'%Y-%m-%dT%H:%i:%s.%fZ') AS updatedAt
        FROM enrollment_waitlist WHERE email=:p1`,[email])).rows : [];
      const latestWaitlist=new Map(entries.map(entry=>[entry.id,entry]));
      const {rows:demands}=await c.query(`SELECT id,email,criteria,state,revision,DATE_FORMAT(updated_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS updatedAt
        FROM enrollment_demands WHERE email=:p1 ORDER BY updated_at DESC,id DESC`,[email]);
      const candidates=demands.some(d=>d.state==='active') ? await offers(c) : [];
      const enriched=[];
      for(const demand of demands){
        const matched=demand.state==='active'?candidates.filter(cohort=>demandMatches(demand.criteria,cohort.data)):[];
        for (const match of matched) await recordDemandMatch(c,demand,match);
        enriched.push({id:demand.id,criteria:demand.criteria,state:demand.state,revision:demand.revision,updatedAt:demand.updatedAt,
          matches:matched.map(v=>({id:v.id,level:v.data.level,firstLesson:v.data.firstLesson}))});
      }
      const interestIds=[...waiting,...demands].map(row=>row.id);
      const activity=interestIds.length?(await c.query(`SELECT interest_id,
        DATE_FORMAT(MAX(created_at),'%Y-%m-%dT%H:%i:%s.%fZ') AS updatedAt FROM enrollment_interest_events
        WHERE JSON_CONTAINS(:p1,JSON_QUOTE(interest_id)) GROUP BY interest_id`,[JSON.stringify(interestIds)])).rows:[];
      const latestActivity=new Map(activity.map(row=>[row.interest_id,row.updatedAt]));
      const mostRecent=(row:{id:string;updatedAt:string})=>[row.updatedAt,latestActivity.get(row.id)].filter(Boolean).sort().at(-1);
      return {
        waitlist:waiting.map(w=>{
          const current=availability.get(w.class_id);
          const latest=latestWaitlist.get(w.id) ?? w;
          const state=latest.state;
          return {id:w.id,classId:w.class_id,learnerName:w.learner_name,state,orderId:latest.order_id,available:state==='waiting'&&current?.available,updatedAt:mostRecent(latest),
            level:current?.cohort.data.level,firstLesson:current?.cohort.data.firstLesson};
        }),
        demands:enriched.map(row=>({...row,updatedAt:mostRecent(row)})),
      };
    });
    send(r,data);
  }));

  post(base+'/demands',async(q,r)=>{
    const {id,revision}=q.body || {};
    const criteria=parseDemand(q.body?.criteria ?? {});
    const name=learnerName(q.body?.name);
    if (!criteria || typeof id!=='string' || !/^[a-f0-9-]{36}$/.test(id) || !Number.isInteger(revision) || revision<0) {
      invalid('enrollment_invalid_demand');
    }
    const saved=await transact(async c=>{
      const email=await session(c,q);
      const level=['unsure','other'].includes(criteria.level)?undefined:criteria.level;
      const existing=(await c.query('SELECT email,revision,state,criteria FROM enrollment_demands WHERE id=:p1 FOR UPDATE',[id])).rows[0];
      if (!existing) {
        if (revision!==0) invalid('enrollment_interest_not_found',404);
        await requireNewEnrollment(c);
        await c.query("INSERT INTO enrollment_demands(id,email,revision,state,criteria,updated_at) VALUES(:p1,:p2,1,'active',:p3,UTC_TIMESTAMP(6))",
          [id,email,criteria]);
        await recordEnrollmentCustomer(c,{kind:'demand',id,email,phone:criteria.phone,name,level});
        await recordEnrollmentAttribution(c,'demand',id,q.body.source);
        return 1;
      }
      if(existing.email!==email) invalid('enrollment_interest_not_found',404);
      if(existing.state!=='active') invalid('enrollment_demand_conflict',409);
      if(Number(existing.revision)!==revision){
        const same=Object.entries(criteria!).every(([key,value])=>existing.criteria[key]===value);
        if(Number(existing.revision)===revision+1 && same) return Number(existing.revision);
        invalid('enrollment_demand_conflict',409);
      }
      await c.query('UPDATE enrollment_demands SET criteria=:p1,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=:p2',[criteria,id]);
      await recordEnrollmentCustomer(c,{kind:'demand',id,email,phone:criteria.phone,level});
      return revision+1;
    });
    send(r,{id,revision:saved});
  });

  post(base+'/demands/:id/withdraw',async(q,r)=>{
    await transact(async c=>{
      const email=await session(c,q);
      const row=(await c.query('SELECT state FROM enrollment_demands WHERE id=:p1 AND email=:p2 FOR UPDATE',[q.params.id,email])).rows[0];
      if(!row) invalid('enrollment_interest_not_found',404);
      if(row.state==='withdrawn') return;
      await c.query("UPDATE enrollment_demands SET state='withdrawn',revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=:p1",[q.params.id]);
    });
    send(r,{ok:true});
  });
}

function learnerName(value:unknown):string|undefined {
  if (value===undefined) return;
  if (typeof value!=='string'||!value.trim()||value.trim().length>120) invalid('enrollment_invalid_application');
  return value.trim();
}
