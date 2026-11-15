import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { demandMatches, enrollmentPhone, parseDemand } from '../../src/utils/enrollmentInterests.ts';
import { invalid } from './trustWorkflow.ts';

type Client = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };
type Handler = (q: Request, r: Response) => Promise<unknown>;
type Cohort = { id: string; state: string; accepting: string | number; course_active: string | number; data: any };
type Context = {
  wrap: (fn: Handler) => (q: Request, r: Response) => void;
  post: (path: string, fn: Handler) => void;
  transact: (fn: (c: Client) => Promise<any>) => Promise<any>;
  session: (c: Client, q: Request) => Promise<string>;
  lockClass: (c: Client, id: string) => Promise<Cohort>;
  expireSeats: (c: Client, id: string) => Promise<void>;
};

export async function takenSeats(c: Client, id: string) {
  return Number((await c.query("SELECT COUNT(*) AS count FROM enrollment_orders WHERE class_id=:p1 AND state<>'expired'", [id])).rows[0].count);
}

export function allowsEnrollment(cohort: Cohort) {
  return cohort.state === 'published' && Number(cohort.accepting) === 1 && Number(cohort.course_active) === 1;
}

export async function reconcileWaitlist(c: Client, cohort: Cohort, seats: number) {
  if (!allowsEnrollment(cohort)) {
    if (!Number(cohort.accepting) || cohort.state === 'cancelled') {
      await c.query("UPDATE enrollment_waitlist SET state='closed' WHERE class_id=:p1 AND state='waiting'", [cohort.id]);
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
  // Durable event for the notice stage. No mail transport is invoked here.
  await c.query(`INSERT INTO enrollment_interest_events(kind,interest_id,class_id,cycle,created_at)
    SELECT 'vacancy',w.id,w.class_id,:p2,UTC_TIMESTAMP(6) FROM enrollment_waitlist w
    WHERE w.class_id=:p1 AND w.state='waiting'
    ON DUPLICATE KEY UPDATE created_at=enrollment_interest_events.created_at`, [cohort.id,cycle]);
}

async function offers(c: Client) {
  return (await c.query(`SELECT e.id,e.data FROM enrollment_classes e JOIN crm_courses c ON c.id=e.course_id
    WHERE e.state='published' AND e.enrollment_closes_at>UTC_TIMESTAMP(6) AND JSON_EXTRACT(c.value,'$.active')=true
    AND (SELECT COUNT(*) FROM enrollment_orders o WHERE o.class_id=e.id AND o.state<>'expired'
      AND (o.state<>'awaiting_payment' OR o.payment_due_at>=UTC_TIMESTAMP(6) OR o.received>0 OR o.upload_expires_at>=UTC_TIMESTAMP(6)))
      < CAST(e.data->>'$.capacity' AS UNSIGNED)
    ORDER BY e.first_lesson_at,e.id`)).rows;
}

export function mountEnrollmentInterests(app: Express, ctx: Context) {
  const { wrap, post, transact, session, lockClass, expireSeats }=ctx;
  const base='/api/enrollment';
  function send(r: Response, data: unknown) {
    return r.set('Cache-Control','no-store').json(data);
  }

  post(base+'/waitlist',async (q,r)=>{
    const phone=enrollmentPhone(q.body?.phone);
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
      const own=(await c.query("SELECT id FROM enrollment_orders WHERE class_id=:p1 AND email=:p2 AND state<>'expired' LIMIT 1",[id,email])).rows[0];
      if (own) invalid('enrollment_already_has_seat',409);
      const prior=(await c.query("SELECT id FROM enrollment_waitlist WHERE class_id=:p1 AND email=:p2 AND state='waiting' LIMIT 1", [id,email])).rows[0];
      if (prior) return { id:prior.id };
      const waiting=randomUUID();
      await c.query("INSERT INTO enrollment_waitlist(id,class_id,email,phone,state,created_at) VALUES(:p1,:p2,:p3,:p4,'waiting',UTC_TIMESTAMP(6))",
        [waiting,id,email,phone]);
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
      await c.query("UPDATE enrollment_waitlist SET state='withdrawn' WHERE id=:p1 AND email=:p2 AND state='waiting'",[q.params.id,email]);
    });
    send(r,{ok:true});
  });

  app.get(base+'/interests',wrap(async(q,r)=>{
    const data=await transact(async c=>{
      const email=await session(c,q);
      const {rows:waiting}=await c.query('SELECT id,class_id,state,order_id FROM enrollment_waitlist WHERE email=:p1 ORDER BY created_at DESC,id DESC',[email]);
      const availability=new Map<string,{cohort:Cohort;available:boolean}>();
      for(const id of [...new Set(waiting.map(w=>String(w.class_id)))].sort()) {
        const cohort=await lockClass(c,id);
        await expireSeats(c,id);
        const seats=await takenSeats(c,id);
        await reconcileWaitlist(c,cohort,seats);
        availability.set(id,{cohort,available:allowsEnrollment(cohort)&&seats<cohort.data.capacity});
      }
      const entries=availability.size ? (await c.query('SELECT id,state,order_id FROM enrollment_waitlist WHERE email=:p1',[email])).rows : [];
      const latestWaitlist=new Map(entries.map(entry=>[entry.id,entry]));
      const {rows:demands}=await c.query('SELECT id,criteria,state,revision FROM enrollment_demands WHERE email=:p1 ORDER BY updated_at DESC,id DESC',[email]);
      const candidates=demands.some(d=>d.state==='active') ? await offers(c) : [];
      const enriched=[];
      for(const demand of demands){
        const matched=demand.state==='active'?candidates.filter(cohort=>demandMatches(demand.criteria,cohort.data)):[];
        for(const match of matched) {
          await c.query(`INSERT INTO enrollment_interest_events(kind,interest_id,class_id,cycle,created_at)
            SELECT 'match',id,:p2,0,UTC_TIMESTAMP(6) FROM enrollment_demands WHERE id=:p1 AND state='active' AND revision=:p3
            ON DUPLICATE KEY UPDATE created_at=enrollment_interest_events.created_at`,[demand.id,match.id,demand.revision]);
        }
        enriched.push({...demand,matches:matched.map(v=>({id:v.id,level:v.data.level,firstLesson:v.data.firstLesson}))});
      }
      return {
        waitlist:waiting.map(w=>{
          const current=availability.get(w.class_id);
          const latest=latestWaitlist.get(w.id) ?? w;
          const state=latest.state;
          return {id:w.id,classId:w.class_id,state,orderId:latest.order_id,available:state==='waiting'&&current?.available,
            level:current?.cohort.data.level,firstLesson:current?.cohort.data.firstLesson};
        }),
        demands:enriched,
      };
    });
    send(r,data);
  }));

  post(base+'/demands',async(q,r)=>{
    const {id,revision}=q.body || {};
    const criteria=parseDemand(q.body?.criteria ?? {});
    if (!criteria || typeof id!=='string' || !/^[a-f0-9-]{36}$/.test(id) || !Number.isInteger(revision) || revision<0) {
      invalid('enrollment_invalid_demand');
    }
    const saved=await transact(async c=>{
      const email=await session(c,q);
      const existing=(await c.query('SELECT email,revision,state,criteria FROM enrollment_demands WHERE id=:p1 FOR UPDATE',[id])).rows[0];
      if (!existing) {
        if (revision!==0) invalid('enrollment_interest_not_found',404);
        await c.query("INSERT INTO enrollment_demands(id,email,revision,state,criteria,updated_at) VALUES(:p1,:p2,1,'active',:p3,UTC_TIMESTAMP(6))",
          [id,email,criteria]);
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
