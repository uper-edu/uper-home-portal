import type { Express, Request, Response } from 'express';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { tx } from './store.ts';
import { invalid, operation } from './trustWorkflow.ts';
import { validMutationOrigin } from './accessTransport.ts';
import { validContactEmail } from '../../src/utils/contactEmail.ts';
import { permittedRecord } from '../../src/utils/accessControl.ts';
import type { Employee } from './identity.ts';
import { enrollmentSimulation } from './enrollmentSimulation.ts';
import { allowsEnrollment, expireSeats, mountEnrollmentInterests, reconcileWaitlist, startEnrollmentVacancySimulation, takenSeats } from './enrollmentInterests.ts';
import { enrollmentPhone } from '../../src/utils/enrollmentInterests.ts';
import { enrollmentOrderStatus } from '../../src/utils/enrollmentOrderStatus.ts';
import { isEnrollmentInsertionWindow } from '../../src/utils/enrollmentCatalog.ts';
import { mountEnrollmentRules, readEnrollmentRules, readEnrollmentWorkCalendar } from './enrollmentRules.ts';
import { workingDayDeadline } from '../../src/utils/workCalendar.ts';
import { activeLearnerOrder, convertLearnerWaitlist } from './enrollmentLearners.ts';
import { markPriorityTransfersOnCancellation, startEnrollmentPriorityTransferSimulation } from './enrollmentTransferOffers.ts';
import { canSelectTransfer, enrollmentRefundEstimate } from '../../src/utils/enrollmentAftercare.ts';
import { enrollmentAftercareStatus, mountEnrollmentResolution } from './enrollmentResolution.ts';
import { mountEnrollmentCrm, recordEnrollmentCustomer } from './enrollmentCrm.ts';
import { saveSimpleSalesWorkflow } from './simpleSalesWorkflow.ts';
import { proofTransferDetails } from './enrollmentProofTotals.ts';
import { recordEnrollmentAttribution } from './enrollmentAttribution.ts';
import { classOpeningNotices, orderNotice, proofNotices, startEnrollmentWeeklySimulation } from './enrollmentNotices.ts';

import { mountEnrollmentCardTargets } from './enrollmentCardTargets.ts';
import { renderEnrollmentEmail } from './enrollmentEmail.ts';
import { lockEnrollmentEmail } from './enrollmentEmailAccess.ts';
import { mountEnrollmentBank,readEnrollmentBank } from './enrollmentBank.ts';

type Route = (q: Request, r: Response) => Promise<unknown>;
type Client = { query: (sql: string, args?: unknown[]) => Promise<{ rows: any[] }> };
const sessionCookie = 'uper_enrollment_session';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const otpKey = randomBytes(32);
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const otpHash = (id: string, code: string) => createHmac('sha256', otpKey).update(id + ':' + code).digest('hex');

function contact(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!validContactEmail(email)) invalid('enrollment_invalid_email');
  return email;
}

// Reads after a class lock must see the previous holder's committed seats and receipts.
const enrollTx = (work: (c: Client) => Promise<any>) => tx(work, { isolation: 'READ COMMITTED' });

async function session(c: Client, q: Request): Promise<string> {
  const token = q.headers.cookie?.match(/(?:^|;\s*)uper_enrollment_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) invalid('enrollment_verification_required', 401);
  const row = (await c.query('SELECT email FROM enrollment_email_sessions WHERE digest=:p1 AND expires_at>UTC_TIMESTAMP(6) FOR SHARE', [sha(token!)])).rows[0];
  if (!row) invalid('enrollment_verification_required', 401);
  return row.email;
}

async function lockClass(c: Client, classId: string) {
  const row = (await c.query(
    `SELECT id,course_id,state,data,
      LEAST(enrollment_closes_at, DATE(first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6) AS accepting,
      COALESCE((SELECT JSON_EXTRACT(value,'$.active')=true FROM crm_courses WHERE id=enrollment_classes.course_id),0) AS course_active
      FROM enrollment_classes WHERE id=:p1 FOR UPDATE`,
    [classId])).rows[0];
  if (!row) invalid('enrollment_class_unavailable', 404);
  return row;
}

async function lockOrder(c: Client, id: string, email?: string) {
  const row = (await c.query('SELECT id,class_id,email FROM enrollment_orders WHERE id=:p1', [id])).rows[0];
  if (!row || (email && row.email !== email)) invalid('enrollment_order_not_found', 404);
  const cohort = await lockClass(c, row.class_id);
  await expireSeats(c, row.class_id);
  const order = (await c.query(`SELECT *,payment_due_at>=UTC_TIMESTAMP(6) AS before_due,
    upload_expires_at>=UTC_TIMESTAMP(6) AS upload_active FROM enrollment_orders WHERE id=:p1 FOR UPDATE`, [id])).rows[0];
  if (!order || (email && order.email !== email)) invalid('enrollment_order_not_found', 404);
  if(order.class_id!==cohort.id) invalid('enrollment_aftercare_conflict',409);
  return { order, cohort };
}

function view(row: any, classState: string) {
  const status = enrollmentOrderStatus(row.state,classState);
  return { id: row.id, classId: row.class_id, status: status === 'recovered' ? 'expired' : status,
    restored: status === 'recovered', learnerName: row.data?.name, price: row.price,
    received: Number(row.received), deadline: row.payment_due_at.replace(' ', 'T') + 'Z' };
}

function proofContent(raw: unknown, mime: unknown) {
  if (typeof raw !== 'string' || raw.length > 2_800_000 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(raw)) invalid('enrollment_invalid_proof');
  const bytes = Buffer.from(raw as string, 'base64');
  const hex = bytes.subarray(0, 8).toString('hex');
  if (bytes.toString('base64') !== raw || bytes.length < 16 || bytes.length > 2 * 1024 * 1024 ||
      !((mime === 'image/png' && hex === '89504e470d0a1a0a') ||
        (mime === 'image/jpeg' && hex.startsWith('ffd8ff')) ||
        (mime === 'application/pdf' && hex.startsWith('255044462d')))) invalid('enrollment_invalid_proof');
  return createHash('sha256').update(bytes).digest('hex');
}

export function mountEnrollmentApplication(app: Express, { wrap, staff }: {
  wrap: (fn: Route) => (q: Request, r: Response) => void;
  staff: (q: Request, permission: string) => Promise<Employee>;
}) {
  const local = enrollmentSimulation();
  mountEnrollmentRules(app,{wrap,transact:enrollTx,authorize:q=>staff(q,'crm.operations.manage')});
  const base = '/api/enrollment';
  const finance = '/api/crm/enrollment/finance';
  app.get(base + '/availability', (_q, r) => r.set('Cache-Control', 'no-store').json({ accepting: !!local }));
  if (!local) return;
  mountEnrollmentBank(app,{wrap,transact:enrollTx,authorize:q=>staff(q,'crm.operations.manage')});
  mountEnrollmentCrm(app,{wrap,staff,transact:enrollTx,saveProgress:saveSimpleSalesWorkflow});

  const post = (path: string, handler: Route) => app.post(path, wrap(async (q, r) => {
    if (!validMutationOrigin(q)) invalid('enrollment_origin_rejected', 403);
    r.set('Cache-Control', 'no-store');
    return handler(q, r);
  }));
  mountEnrollmentInterests(app,{wrap,post,transact:enrollTx,session,lockClass,expireSeats});
  const financeActor = async (q: Request) => {
    const actor = await staff(q, 'crm.payments.verify');
    // Orders have no CRM owner until the customer and opportunity integration is added.
    // Only existing all-record finance grants can act on unassigned orders.
    if (!permittedRecord(actor, {}, 'crm.read') || !permittedRecord(actor, {}, 'crm.payments.verify')) {
      invalid('enrollment_finance_forbidden', 403);
    }
    return actor;
  };
  const supportActor = async (q:Request) => {
    const actor=await staff(q,'crm.followup');
    if(!permittedRecord(actor,{},'crm.read')||!permittedRecord(actor,{},'crm.followup')) invalid('enrollment_support_forbidden',403);
    return actor;
  };
  mountEnrollmentCardTargets(app,wrap,staff,financeActor,enrollTx);
  startEnrollmentWeeklySimulation(enrollTx);
  startEnrollmentVacancySimulation(enrollTx,lockClass);
  startEnrollmentPriorityTransferSimulation({transact:enrollTx,lockOrder,lockClass});
  mountEnrollmentResolution(app,{wrap,post,transact:enrollTx,session,lockOrder,lockClass,expireSeats,financeActor,supportActor});

  post('/api/crm/enrollment/classes/:id/cancel', async (q,r) => {
    const actor=await staff(q,'crm.operations.manage');
    const id=String(q.params.id);
    const result=await enrollTx(c=>operation(c,actor.id,q.body,
      {leadId:'class:'+id,kind:'enrollment.class.cancel',authorize:()=>staff(q,'crm.operations.manage')},async()=>{
        const cohort=await lockClass(c,id);
        if(cohort.state==='cancelled') return {classId:id,state:'cancelled'};
        const confirmed=(await c.query('SELECT class_id FROM enrollment_class_openings WHERE class_id=:p1',[id])).rows[0];
        if(cohort.state!=='published'||confirmed) invalid('enrollment_class_cannot_cancel',409);
        await c.query("UPDATE enrollment_classes SET state='cancelled',revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=:p1",[id]);
        await markPriorityTransfersOnCancellation(c,id);
        await reconcileWaitlist(c,{...cohort,state:'cancelled'},await takenSeats(c,id));
        await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.class.cancel',:p2)",[actor.id,{classId:id}]);
        const orders=(await c.query("SELECT id FROM enrollment_orders WHERE class_id=:p1 AND state NOT IN ('expired','ended','refunding','refunded')",[id])).rows;
        for(const row of orders) await orderNotice(c,'class_cancelled',row.id,id);
        return {classId:id,state:'cancelled'};
      }));
    r.json(result);
  });

  app.get(base+'/orders/:id/aftercare',wrap(async(q,r)=>{
    const result=await enrollTx(async c=>{
      const email=await session(c,q);
      const {order,cohort}=await lockOrder(c,String(q.params.id),email);
      const verified=Number(order.received);
      const confirmed=(await c.query('SELECT class_id FROM enrollment_class_openings WHERE class_id=:p1',[cohort.id])).rows[0];
      const transfers=canSelectTransfer(order,cohort)?(await c.query(`
        SELECT e.id,e.data FROM enrollment_classes e JOIN crm_courses c ON c.id=e.course_id
        WHERE e.id<>:p1 AND e.state='published' AND LEAST(e.enrollment_closes_at, DATE(e.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6)
          AND JSON_EXTRACT(c.value,'$.active')=true AND e.data->>'$.level'=:p2 AND e.data->>'$.format'=:p3
          AND (SELECT COUNT(*) FROM enrollment_orders o WHERE o.class_id=e.id AND o.state NOT IN ('expired','ended','refunding','refunded')
            AND (o.state<>'awaiting_payment' OR o.payment_due_at>=UTC_TIMESTAMP(6) OR o.received>0 OR o.upload_expires_at>=UTC_TIMESTAMP(6))) + (SELECT COUNT(*) FROM enrollment_transfer_invitations i
          WHERE i.target_class_id=e.id AND i.state='offered' AND i.expires_at>UTC_TIMESTAMP(6))
            < CAST(e.data->>'$.capacity' AS UNSIGNED)
        ORDER BY e.first_lesson_at,e.id`,[cohort.id,cohort.data.level,cohort.data.format])).rows.map(row=>({
          id:row.id,level:row.data.level,format:row.data.format,firstLesson:row.data.firstLesson,schedule:row.data.schedule,
        })):[];
      const status=await enrollmentAftercareStatus(c,order.id);
      const lateProofSubmitted=order.state==='expired'&&verified===0&&
        (await c.query('SELECT 1 FROM enrollment_proofs WHERE order_id=:p1 LIMIT 1',[order.id])).rows.length>0;
      return { originalClassState:cohort.state, currentClass:{
        level:cohort.data.level,format:cohort.data.format,firstLesson:cohort.data.firstLesson,schedule:cohort.data.schedule,
        decisionAt:cohort.data.decisionAt,opened:!!confirmed,
      }, lateProofSubmitted, priorityRequested:typeof order.data?.priority==='boolean' ? order.data.priority : undefined,
        transfers, ...status, refund: verified<=0 ? { mode:'unavailable' } :
        confirmed ? {mode:'special_review'} : {
          mode:'contact_support',
          maximum:enrollmentRefundEstimate({price:order.price,received:verified,refunded:0,transferred:0,sessions:cohort.data.sessions,delivered:0}),
        } };
    });
    r.set('Cache-Control','no-store').json(result);
  }));

  post(base + '/email/request', async (q, r) => {
    const email = contact(q.body.email);
    const id = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await enrollTx(async (c: Client) => {
      await lockEnrollmentEmail(c, email);
      await c.query(`INSERT INTO enrollment_email_challenges(email,challenge_id,digest,expires_at,resend_at)
        VALUES(:p1,:p2,:p3,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE email=email`, [email, id, otpHash(id, code)]);
      const row = (await c.query(`SELECT resend_at>UTC_TIMESTAMP(6) AS blocked,locked_until>UTC_TIMESTAMP(6) AS locked
        FROM enrollment_email_challenges WHERE email=:p1 FOR UPDATE`, [email])).rows[0];
      if (Number(row.blocked) || Number(row.locked)) invalid('enrollment_code_wait', 429);
      const {emailCodeMinutes,emailResendSeconds}=await readEnrollmentRules(c);
      await c.query(`UPDATE enrollment_email_challenges SET challenge_id=:p1,digest=:p2,attempts=0,used=FALSE,locked_until=NULL,
        expires_at=TIMESTAMPADD(MINUTE,:p4,UTC_TIMESTAMP(6)),resend_at=TIMESTAMPADD(SECOND,:p5,UTC_TIMESTAMP(6)) WHERE email=:p3`,
      [id, otpHash(id, code), email,emailCodeMinutes,emailResendSeconds]);
      await local.deliver(id,email,code,renderEnrollmentEmail(q.body.purpose==='mine'?'otp_mine':'otp_apply',{
        language:q.body.language,code,codeMinutes:emailCodeMinutes,
      }));
    });
    r.json({ challengeId: id });
  });

  post(base + '/email/verify', async (q, r) => {
    const email = contact(q.body.email);
    const { challengeId, code } = q.body;
    if (!uuid.test(challengeId) || typeof code !== 'string' || !/^\d{6}$/.test(code)) invalid('enrollment_invalid_code');
    const token = randomBytes(32).toString('hex');
    const sessionHours = await enrollTx(async (c: Client) => {
      await lockEnrollmentEmail(c, email);
      const row = (await c.query(`SELECT *,expires_at>UTC_TIMESTAMP(6) AS active
        FROM enrollment_email_challenges WHERE email=:p1 FOR UPDATE`, [email])).rows[0];
      if (!row || row.challenge_id !== challengeId || !Number(row.active) || Number(row.used) || row.locked_until) return null;
      const rules=await readEnrollmentRules(c);
      if (!timingSafeEqual(Buffer.from(otpHash(challengeId, code), 'hex'), Buffer.from(row.digest, 'hex'))) {
        await c.query(`UPDATE enrollment_email_challenges SET attempts=:p1,
          locked_until=IF(:p1>=:p3,TIMESTAMPADD(MINUTE,:p4,UTC_TIMESTAMP(6)),NULL) WHERE email=:p2`,
        [Number(row.attempts)+1,email,rules.emailAttemptLimit,rules.emailLockMinutes]);
        return null;
      }
      await c.query('UPDATE enrollment_email_challenges SET used=TRUE WHERE email=:p1', [email]);
      await c.query('INSERT INTO enrollment_email_sessions(digest,email,expires_at) VALUES(:p1,:p2,TIMESTAMPADD(HOUR,:p3,UTC_TIMESTAMP(6)))',
        [sha(token),email,rules.emailSessionHours]);
      return rules.emailSessionHours;
    });
    if (sessionHours===null) invalid('enrollment_invalid_code', 401);
    r.cookie(sessionCookie, token, { httpOnly: true, secure: q.secure, sameSite: 'strict', path: base, maxAge: sessionHours*3_600_000 });
    r.json({ verified: true });
  });

  async function reserveSeat(c:Client,cohort:Awaited<ReturnType<typeof lockClass>>,seats:number,input:{
    email:string;name:string;phone:string;requestId:string;fingerprint:string;price:number;priority:boolean;source?:unknown;actor?:string;
  }) {
    const id=randomUUID();
    const {email,name,phone,requestId,fingerprint,price,priority,source,actor}=input;
    const {paymentHours}=await readEnrollmentRules(c);
    const {bank}=await readEnrollmentBank(c);
    await c.query(`INSERT INTO enrollment_orders(id,class_id,email,request_id,fingerprint,state,price,payment_due_at,created_at,data)
      VALUES(:p1,:p2,:p3,:p4,:p5,'awaiting_payment',:p6,TIMESTAMPADD(HOUR,:p8,UTC_TIMESTAMP(6)),UTC_TIMESTAMP(6),:p7)`,
    [id,cohort.id,email,requestId,fingerprint,price,{name,phone,priority,bank},paymentHours]);
    await recordEnrollmentCustomer(c,{kind:'order',id,email,phone,name,level:cohort.data.level,emailVerified:!actor});
    if(actor){
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.order.insert',:p2)",
        [actor,{orderId:id,classId:cohort.id,price}]);
    }else{
      await recordEnrollmentAttribution(c,'order',id,source);
    }
    await orderNotice(c,'seat_reserved',id,undefined,{price});
    await convertLearnerWaitlist(c,cohort.id,email,name,id);
    await reconcileWaitlist(c,cohort,seats+1);
    return view((await c.query('SELECT * FROM enrollment_orders WHERE id=:p1',[id])).rows[0],cohort.state);
  }

  post(base + '/applications', async (q, r) => {
    const { classId, requestId, name, priority } = q.body;
    const phone = enrollmentPhone(q.body.phone);
    if (typeof classId !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(classId) ||
        typeof requestId !== 'string' || !uuid.test(requestId) ||
        typeof name !== 'string' || name.trim().length < 1 || name.length > 120 ||
        !phone ||
        typeof priority !== 'boolean') invalid('enrollment_invalid_application');
    const result = await enrollTx(async (c: Client) => {
      const email = await session(c, q);
      const fingerprint = sha(JSON.stringify([classId, name.trim(), phone.trim(), priority]));
      const cohort = await lockClass(c, classId);
      await expireSeats(c, classId);
      const existing = (await c.query('SELECT * FROM enrollment_orders WHERE email=:p1 AND request_id=:p2', [email, requestId])).rows[0];
      if (existing) {
        if (existing.fingerprint !== fingerprint) invalid('enrollment_request_conflict', 409);
        return view(existing,existing.class_id===classId ? cohort.state :
          (await c.query('SELECT state FROM enrollment_classes WHERE id=:p1',[existing.class_id])).rows[0]?.state);
      }
      const active = (await c.query("SELECT value FROM crm_courses WHERE id=:p1 FOR SHARE", [cohort.course_id])).rows[0]?.value.active;
      if (!allowsEnrollment(cohort) || active !== true) invalid('enrollment_class_unavailable', 409);
      const existingSeat = await activeLearnerOrder(c,classId,email,name);
      if (existingSeat) return view(existingSeat,cohort.state);
      const seats = await takenSeats(c,classId);
      if (Number(seats) >= cohort.data.capacity) invalid('enrollment_class_full', 409);
      return reserveSeat(c,cohort,seats,{email,name:name.trim(),phone,requestId,fingerprint,price:cohort.data.price,priority,source:q.body.source});
    });
    r.json(result);
  });

  post('/api/crm/enrollment/classes/:id/insertions',async(q,r)=>{
    const actor=await staff(q,'crm.operations.manage');
    const classId=String(q.params.id);
    const {name,price,confirmed,requestId,email:rawEmail,phone:rawPhone}=q.body??{};
    const email=contact(rawEmail);
    const phone=enrollmentPhone(rawPhone);
    if(!/^[a-zA-Z0-9-]{1,64}$/.test(classId)||typeof name!=='string'||!name.trim()||name.length>120||!phone||
        typeof requestId!=='string'||!uuid.test(requestId)||!Number.isSafeInteger(price)||price<1||price>1_000_000_000||confirmed!==true)
      invalid('enrollment_invalid_insertion');
    const result=await enrollTx(c=>operation(c,actor.id,q.body,{leadId:'class:'+classId,kind:'enrollment.order.insert',
      authorize:()=>staff(q,'crm.operations.manage')},async()=>{
      const cohort=await lockClass(c,classId);
      const active=(await c.query("SELECT value FROM crm_courses WHERE id=:p1 FOR SHARE",[cohort.course_id])).rows[0]?.value.active;
      if(cohort.state!=='published'||active!==true||!isEnrollmentInsertionWindow(cohort.data)) invalid('enrollment_insertion_unavailable',409);
      await expireSeats(c,classId);
      if(await activeLearnerOrder(c,classId,email,name)) invalid('enrollment_already_has_seat',409);
      const seats=await takenSeats(c,classId);
      if(seats>=cohort.data.capacity) invalid('enrollment_class_full',409);
      return reserveSeat(c,cohort,seats,{email,name:name.trim(),phone,requestId,fingerprint:sha(JSON.stringify(['insertion',classId,email,name.trim(),phone,price])),
        price,priority:false,actor:actor.id});
    }));
    r.json(result);
  });

  app.get(base + '/orders', wrap(async (q, r) => {
    const orders = await enrollTx(async (c: Client) => {
      const email = await session(c, q);
      const { rows } = await c.query(`SELECT o.id,o.class_id,o.price,o.received,o.payment_due_at,
        CASE WHEN o.state='awaiting_payment' AND o.received=0 AND o.payment_due_at<UTC_TIMESTAMP(6)
          AND (o.upload_expires_at IS NULL OR o.upload_expires_at<UTC_TIMESTAMP(6)) THEN 'expired' ELSE o.state END AS state,
        o.data,e.state AS class_state,e.data AS class_data,
        i.id AS invitation_id,DATE_FORMAT(i.expires_at,'%Y-%m-%dT%H:%i:%sZ') AS invitation_deadline,
        (e.state='published' AND (o.state='partial' OR
          (o.state='awaiting_payment' AND o.payment_due_at>=UTC_TIMESTAMP(6)))) AS needs_payment,
        DATE_FORMAT(GREATEST(o.created_at,COALESCE(o.activity_at,o.created_at),COALESCE(n.latest,o.created_at),
          COALESCE(i.created_at,o.created_at),IF(e.state='cancelled',e.updated_at,o.created_at)),
          '%Y-%m-%dT%H:%i:%s.%fZ') AS updated_at_iso
        FROM enrollment_orders o JOIN enrollment_classes e ON e.id=o.class_id
        LEFT JOIN LATERAL (SELECT MAX(recorded_at) AS latest FROM enrollment_notification_receipts
          WHERE subject_id=o.id AND channel='email') n ON TRUE
        LEFT JOIN LATERAL (SELECT offer.id,offer.created_at,offer.expires_at FROM enrollment_transfer_invitations offer
          JOIN enrollment_classes target ON target.id=offer.target_class_id AND target.state='published'
          WHERE offer.order_id=o.id AND offer.source_class_id=o.class_id AND offer.state='offered'
            AND LEAST(offer.expires_at, DATE(target.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6)
            AND e.state='cancelled' AND o.state IN ('paid','recovered')
          ORDER BY offer.created_at DESC,offer.id LIMIT 1) i ON TRUE
        WHERE o.email=:p1 ORDER BY (i.id IS NOT NULL OR needs_payment) DESC,updated_at_iso DESC,o.id DESC LIMIT 100`, [email]);
      return rows.map(row => ({ ...view(row,row.class_state), level: row.class_data.level, firstLesson: row.class_data.firstLesson,
        classCancelled:row.class_state==='cancelled',updatedAt:row.updated_at_iso,needsPayment:Number(row.needs_payment)===1,
        invitation:row.invitation_id?{id:row.invitation_id,deadline:row.invitation_deadline}:undefined }));
    });
    r.set('Cache-Control', 'no-store').json({ orders });
  }));

  app.get(base + '/orders/:id', wrap(async (q, r) => {
    const result = await enrollTx(async (c: Client) => {
      const { order,cohort } = await lockOrder(c, String(q.params.id), await session(c, q));
      return { ...view(order,cohort.state), bank: cohort.state!=='cancelled' && (order.state === 'awaiting_payment' || order.state === 'partial') ? order.data.bank : undefined };
    });
    r.set('Cache-Control', 'no-store').json(result);
  }));

  post(base + '/orders/:id/proofs/start', async (q, r) => {
    const uploadId = await enrollTx(async (c: Client) => {
      const { order,cohort } = await lockOrder(c, String(q.params.id), await session(c, q));
      if (['paid','recovered','ended','refunding','refunded'].includes(order.state)) invalid('enrollment_proof_not_available', 409);
      if (Number(order.upload_active)) return order.upload_id;
      const id = randomUUID();
      await c.query('UPDATE enrollment_orders SET upload_id=:p1,upload_expires_at=UTC_TIMESTAMP(6)+INTERVAL 5 MINUTE WHERE id=:p2', [id,order.id]);
      return id;
    });
    r.json({ uploadId });
  });

  post(base + '/orders/:id/proofs/finish', async (q, r) => {
    const { uploadId, mime, encoded, reportedAmount, bankReference } = q.body;
    if (typeof uploadId !== 'string' || !uuid.test(uploadId)) invalid('enrollment_invalid_proof');
    // End the current attempt on a rejected upload, so a later attempt uses a fresh server clock.
    const result = await enrollTx(async (c: Client) => {
      const { order,cohort } = await lockOrder(c, String(q.params.id), await session(c, q));
      const prior = (await c.query('SELECT order_id FROM enrollment_proofs WHERE id=:p1', [uploadId])).rows[0];
      if (prior?.order_id === order.id) return view(order,cohort.state);
      if (order.upload_id !== uploadId || !Number(order.upload_active) || ['paid','recovered','ended','refunding','refunded'].includes(order.state)) {
        invalid('enrollment_upload_expired', 409);
      }
      let digest, transferDetails;
      try {
        digest = proofContent(encoded, mime);
        transferDetails = proofTransferDetails(reportedAmount,bankReference);
      }
      catch {
        await c.query('UPDATE enrollment_orders SET upload_id=NULL,upload_expires_at=NULL WHERE id=:p1', [order.id]);
        await expireSeats(c, order.class_id);
        return null;
      }
      await c.query(`INSERT INTO enrollment_proofs(id,order_id,mime,digest,proof,transfer_details,created_at)
        VALUES(:p1,:p2,:p3,:p4,FROM_BASE64(:p5),:p6,UTC_TIMESTAMP(6))`, [uploadId,order.id,mime,digest,encoded,transferDetails]);
      const state = order.state === 'awaiting_payment' ? 'proof_review' : order.state;
      if (!order.data.firstReviewDueAt) {
        const first=(await c.query(`SELECT id,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS availableAt
          FROM enrollment_proofs WHERE order_id=:p1 ORDER BY created_at,id LIMIT 1`,[order.id])).rows[0];
        if(first.id===uploadId){
          const {firstReviewBusinessDays}=await readEnrollmentRules(c);
          const calendar=await readEnrollmentWorkCalendar(c);
          const dueAt=workingDayDeadline(new Date(first.availableAt),firstReviewBusinessDays,calendar);
          await c.query("UPDATE enrollment_orders SET data=JSON_SET(data,'$.firstReviewDueAt',:p2,'$.firstProofAvailableAt',:p3) WHERE id=:p1",
            [order.id,dueAt,first.availableAt]);
        }
      }
      await c.query('UPDATE enrollment_orders SET state=:p1,activity_at=UTC_TIMESTAMP(6),upload_id=NULL,upload_expires_at=NULL WHERE id=:p2', [state,order.id]);
      await proofNotices(c,order.id,cohort.id,digest,cohort.data.level);
      return view({...order,state},cohort.state);
    });
    if (!result) invalid('enrollment_invalid_proof');
    r.json(result);
  });

  app.get(finance, wrap(async (q, r) => {
    await financeActor(q);
    const orders = await enrollTx(async (c: Client) => {
      const rows=(await c.query(`SELECT o.*,e.state AS class_state,
        EXISTS(SELECT 1 FROM enrollment_class_openings g WHERE g.class_id=o.class_id) AS opened,
        CASE WHEN o.state IN ('proof_review','partial','expired') AND NOT EXISTS (
          SELECT 1 FROM enrollment_receipts r WHERE r.order_id=o.id
            AND r.created_at>=STR_TO_DATE(o.data->>'$.firstProofAvailableAt','%Y-%m-%dT%H:%i:%s.%fZ')
        ) THEN o.data->>'$.firstReviewDueAt' END AS first_review_due_at,
        (SELECT p.id FROM enrollment_proofs p WHERE p.order_id=o.id ORDER BY p.created_at DESC LIMIT 1) AS proof_id
      FROM enrollment_orders o JOIN enrollment_classes e ON e.id=o.class_id WHERE (:p1='' OR o.id=:p1) AND (o.state IN ('proof_review','partial','paid','recovered','refunding','refunded')
        OR (o.state='ended' AND o.received>0) OR EXISTS(SELECT 1 FROM enrollment_proofs p WHERE p.order_id=o.id))
      ORDER BY o.created_at DESC LIMIT 150`,[typeof q.query.order==='string'?q.query.order:''])).rows;
      const receiptsByOrder=new Map<string,any[]>();
      if(rows.length){
        const receipts=(await c.query(`SELECT order_id, reference, amount, receiving_account AS account,
          DATE_FORMAT(settled_at,'%Y-%m-%dT%H:%i:%sZ') AS settledAt
          FROM enrollment_receipts WHERE JSON_CONTAINS(:p1,JSON_QUOTE(order_id))
          ORDER BY settled_at DESC,reference`,[JSON.stringify(rows.map(row=>row.id))])).rows;
        for(const {order_id,amount,...receipt} of receipts){
          const history=receiptsByOrder.get(order_id)??[];
          history.push({...receipt,amount:Number(amount)});
          receiptsByOrder.set(order_id,history);
        }
      }
      return rows.map(row=>({...view(row,row.class_state),name:row.data.name,opened:Number(row.opened)===1,
        proofId:row.proof_id,firstReviewDueAt:row.first_review_due_at,receipts:receiptsByOrder.get(row.id)??[]}));
    });
    r.set('Cache-Control', 'no-store').json({ orders });
  }));
  app.get(finance + '/proofs/:id', wrap(async (q, r) => {
    await financeActor(q);
    const proof = await enrollTx(async (c: Client) => (await c.query('SELECT proof,mime FROM enrollment_proofs WHERE id=:p1', [q.params.id])).rows[0]);
    if (!proof) invalid('enrollment_proof_not_found', 404);
    const suffix = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' }[proof.mime as string] || 'bin';
    r.set('Cache-Control', 'no-store').attachment('transfer-proof.' + suffix).send(proof.proof);
  }));

  post(finance + '/:id/receipts', async (q, r) => {
    const actor = await financeActor(q);
    const { amount, reference, receivingAccount, transferredAt, requestId } = q.body;
    const time = typeof transferredAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(transferredAt) ? new Date(transferredAt) : null;
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000 ||
        typeof reference !== 'string' || !reference.trim() || reference.length > 120 ||
        !time || !Number.isFinite(time.getTime()) || time.getTime() > Date.now() ||
        typeof requestId !== 'string' || !uuid.test(requestId)) invalid('enrollment_invalid_receipt');
    const id = String(q.params.id);
    const result = await enrollTx((c: Client) => operation(c, actor.id, q.body,
      { leadId: 'enrollment:' + id, kind: 'enrollment.receipt', authorize: () => financeActor(q) }, async () => {
      if(typeof receivingAccount!=='string'||!receivingAccount.trim()||receivingAccount.trim().length>160)
        invalid('enrollment_receiving_account_required');
      const { order, cohort } = await lockOrder(c, id);
      if(['refunding','refunded'].includes(order.state)) invalid('enrollment_refund_in_progress',409);
      const ref = reference.trim().toUpperCase();
      try {
        await c.query(`INSERT INTO enrollment_receipts(reference,order_id,amount,actor,settled_at,receiving_account,created_at)
          VALUES(:p1,:p2,:p3,:p4,:p5,:p6,UTC_TIMESTAMP(6))`, [ref,id,amount,actor.id,time,receivingAccount.trim()]);
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') invalid('enrollment_duplicate_receipt', 409);
        throw error;
      }
      const received = Number(order.received) + amount;
      const due = new Date(order.payment_due_at.replace(' ', 'T') + 'Z');
      const timely = (await c.query('SELECT COALESCE(SUM(amount),0) AS sum FROM enrollment_receipts WHERE order_id=:p1 AND settled_at<=:p2', [id,due])).rows[0].sum;
      let state=order.state;
      if(order.state==='expired'&&Number(timely)>=order.price){
        if(cohort.state==='published') state='recovered';
        if(cohort.state==='cancelled') state='paid';
      } else if(!['ended','expired','recovered'].includes(order.state)){
        state=received>=order.price?'paid':'partial';
      }
      await c.query('UPDATE enrollment_orders SET received=:p1,state=:p2,activity_at=UTC_TIMESTAMP(6) WHERE id=:p3', [received,state,id]);
      const paid = cohort.state==='cancelled' ? 0 : Number((await c.query("SELECT COUNT(*) AS count FROM enrollment_orders WHERE class_id=:p1 AND state IN ('paid','recovered')", [cohort.id])).rows[0].count);
      const openedBefore = (await c.query('SELECT opened_at FROM enrollment_class_openings WHERE class_id=:p1', [cohort.id])).rows[0];
      const newlyPaid=cohort.state==='published'&&['paid','recovered'].includes(state)&&!['paid','recovered'].includes(order.state);
      if (cohort.state === 'published' && paid >= cohort.data.minimumPaid) {
        await c.query('INSERT INTO enrollment_class_openings(class_id,opened_at) VALUES(:p1,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE class_id=class_id', [cohort.id]);
      }
      const opened = (await c.query('SELECT opened_at FROM enrollment_class_openings WHERE class_id=:p1', [cohort.id])).rows[0];
      if (newlyPaid) await orderNotice(c,opened?'payment_and_opening':'payment_confirmed',id,undefined,{received});
      if (opened&&!openedBefore) await classOpeningNotices(c,cohort,newlyPaid?id:undefined);
      return { order: view({...order,state,received},cohort.state), paidCount: paid, opened: !!opened };
    }));
    r.json(result);
  });
}
