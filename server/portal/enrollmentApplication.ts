import {academicManagePermission} from '../../src/utils/accessControl.ts';
import {classOpeningMidnight} from './enrollmentClassTimeSql.ts';
import {measureEnrollmentPhase} from '../requestTracing.ts';
import {enrollmentSessionCookie,enrollmentVisitorDigest,inspectEnrollmentEmailSession,readEnrollmentEmailSession,readEnrollmentSessionDigest,revokeEnrollmentEmailSession} from './enrollmentVisitorSession.ts';
import {dispatchEnrollmentMail,enrollmentMailDelivery,enrollmentMailDeliveryState,enrollmentMailbox,enrollmentMailReadiness} from './enrollmentMail.ts';
import express, {type Express, type Request, type Response} from 'express';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { tx } from './store.ts';
import { invalid, operation } from './trustWorkflow.ts';
import { validMutationOrigin } from './accessTransport.ts';
import { validContactEmail } from '../../src/utils/contactEmail.ts';
import { maskEnrollmentEmail } from '../../src/utils/enrollmentEmailIdentity.ts';
import { canManageEnrollmentFinance } from '../../src/utils/accessControl.ts';
import type { Employee } from './identity.ts';
import { enrollmentServicePolicy } from './enrollmentRuntime.ts';
import { allowsEnrollment, expireSeats, mountEnrollmentInterests, reconcileWaitlist, startEnrollmentVacancySimulation, takenSeats } from './enrollmentInterests.ts';
import { enrollmentInsertionPhone, enrollmentPhone, enrollmentPhoneDisplay } from '../../src/utils/enrollmentInterests.ts';
import { allowsEnrollmentProof, enrollmentClosureReason, enrollmentOrderStatus } from '../../src/utils/enrollmentOrderStatus.ts';
import {enrollmentProofAccept,enrollmentProofFileIssue,matchesEnrollmentProofSignature,maxEnrollmentProofBytes} from '../../src/utils/enrollmentProofFile.ts';
import { isEnrollmentInsertionWindow } from '../../src/utils/enrollmentCatalog.ts';
import { mountEnrollmentRules, readEnrollmentRules, readEnrollmentWorkCalendar } from './enrollmentRules.ts';
import { workingDayDeadline } from '../../src/utils/workCalendar.ts';
import { activeLearnerOrder, convertLearnerWaitlist } from './enrollmentLearners.ts';
import { markPriorityTransfersOnCancellation, startEnrollmentPriorityTransferSimulation } from './enrollmentTransferOffers.ts';
import { canSelectTransfer, enrollmentRefundEstimate } from '../../src/utils/enrollmentAftercare.ts';
import { enrollmentAftercareStatus, mountEnrollmentResolution } from './enrollmentResolution.ts';
import { assistedEnrollmentOpportunity, mountEnrollmentCrm, recordEnrollmentCustomer, validateAssistedContacts } from './enrollmentCrm.ts';
import { lockIdentityRegistry } from './identityConsolidation.ts';
import { saveSimpleSalesWorkflow } from './simpleSalesWorkflow.ts';
import { isEnrollmentProofAmount,proofTransferDetails } from './enrollmentProofTotals.ts';
import {enrollmentFinanceEvidence,enrollmentLearnerPayment,enrollmentProofGroupId,enrollmentReceiptProofId,readEnrollmentLearnerPaymentRows,withEnrollmentReceiptProofLinks} from './enrollmentLearnerPayments.ts';
import {readEnrollmentFinanceProgress,readEnrollmentFinanceWorklist} from './enrollmentFinanceWorklist.ts';
import { recordEnrollmentAttribution } from './enrollmentAttribution.ts';
import { latestAssistanceMail, orderNotice, proofNotices, retryAssistanceMail, sendAssistanceMail, startEnrollmentWeeklySimulation } from './enrollmentNotices.ts';

import { applyEnrollmentPaymentCredits, lockEnrollmentFunds, updateEnrollmentPayment } from './enrollmentPaymentCredits.ts';
import { mountEnrollmentCardTargets } from './enrollmentCardTargets.ts';
import { enrollmentAssistanceLink, enrollmentEmailWhatsAppDestination, enrollmentEmailWhatsAppPath, renderEnrollmentEmail } from './enrollmentEmail.ts';
import { lockEnrollmentEmail } from './enrollmentEmailAccess.ts';
import { hasConfiguredEnrollmentBank,mountEnrollmentBank,readEnrollmentBank,readEnrollmentReceivingAccounts } from './enrollmentBank.ts';
import {enrollmentReceivingAccountMaxLength} from '../../src/utils/enrollmentBank.ts';

type Route = (q: Request, r: Response) => Promise<unknown>;
type Client = { query: (sql: string, args?: unknown[]) => Promise<{ rows: any[] }> };

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
const moneyTx = (work:(c:Client)=>Promise<any>)=>enrollTx(async c=>{await lockEnrollmentFunds(c);return work(c);});

async function session(c: Client, q: Request): Promise<string> {
  const email=await readEnrollmentEmailSession(c,q.headers.cookie,q.get('X-Enrollment-Email'));
  if (!email) invalid('enrollment_verification_required', 401);
  return email;
}

export async function enrollmentAssistancePreview(c:Client,offer:{
  class_id:string;email:string;active:number;order_id:string|null;data:{quote:unknown;name:string;phone:string};
},mode:unknown,cookie:string|undefined,expectedEmail?:string) {
  const preview={classId:offer.class_id,quote:offer.data.quote};
  if(mode===true||mode==='if-verified'){
    const sessionRead=readEnrollmentEmailSession(c,cookie,expectedEmail);
    const email=await (mode===true?sessionRead:sessionRead.catch(()=>undefined));
    if(email&&email===offer.email)return {...preview,name:offer.data.name,phone:offer.data.phone,email,orderId:offer.order_id};
    if(mode===true){
      if(!email)invalid('enrollment_verification_required',401);
      invalid('enrollment_assistance_email',403);
    }
  }
  return {...preview,maskedEmail:maskEnrollmentEmail(activeAssistanceEmail(offer))};
}

function activeAssistanceEmail(offer?:{email:string;active:number}) {
  if(!offer||!Number(offer.active))invalid('enrollment_assistance_unavailable',404);
  return offer.email;
}

async function lockClass(c: Client, classId: string) {
  const row = (await c.query(
    `SELECT id,course_id,state,data,revision,
      LEAST(enrollment_closes_at, ${classOpeningMidnight()})>UTC_TIMESTAMP(6) AS accepting,
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

function view(row: any, classState: string, timeZone=row.class_time_zone??row.class_data?.timeZone) {
  const status = enrollmentOrderStatus(row.state,classState);
  return { id: row.id, classId: row.class_id, status: status === 'recovered' ? 'expired' : status,
    timeZone, restored: status === 'recovered', learnerName: row.data?.name, price: row.price,
    received: Number(row.received), closureReason:enrollmentClosureReason(row.state,row.data?.closureReason), deadline: row.payment_due_at.replace(' ', 'T') + 'Z',
    ...(row.data?.creditIn?{creditIn:Number(row.data.creditIn)}:{}),...(row.data?.creditOut?{creditOut:Number(row.data.creditOut)}:{}) };
}

async function learnerPaymentView(c:Client,order:any,classState:string,timeZone?:string) {
  const rows=await readEnrollmentLearnerPaymentRows(c,[order.id]);
  const {payment,transfers}=enrollmentLearnerPayment(order,classState,withEnrollmentReceiptProofLinks(rows.get(order.id),order.data?.learnerReceiptProofLinks));
  return {...view(order,classState,timeZone),payment,transfers,
    bank:payment.action==='transfer'||payment.action==='top_up'?order.data.bank:undefined};
}

export function proofContent(raw: unknown, mime: unknown) {
  const binary = Buffer.isBuffer(raw);
  if (!binary && (typeof raw !== 'string' || raw.length > 2_800_000 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(raw))) invalid('enrollment_invalid_proof');
  const bytes = binary ? raw : Buffer.from(raw as string, 'base64');
  if (enrollmentProofFileIssue(bytes.length,mime) ||
      !matchesEnrollmentProofSignature(bytes,mime)) invalid('enrollment_invalid_proof');
  const encoded = bytes.toString('base64');
  if (!binary && encoded !== raw) invalid('enrollment_invalid_proof');
  return {digest:createHash('sha256').update(bytes).digest('hex'),encoded};
}

const proofMimeTypes = enrollmentProofAccept.split(',');
const readBinaryProof = express.raw({type:proofMimeTypes,limit:maxEnrollmentProofBytes,inflate:false});

export async function readProofSubmission(q:Request,r:Response) {
  const header=q.get('X-Enrollment-Proof');
  let metadata=q.body;
  if(header!==undefined){
    if(header.length>4096)invalid('enrollment_invalid_proof');
    try { metadata=JSON.parse(decodeURIComponent(header)); }
    catch { invalid('enrollment_invalid_proof'); }
  }
  const {uploadId,reportedAmount,bankReference,transferId}=metadata??{};
  if(typeof uploadId!=='string'||!uuid.test(uploadId))invalid('enrollment_invalid_proof');
  const transferFields={uploadId,reportedAmount,bankReference,...(transferId!==undefined&&{transferId})};
  if(header===undefined)return {...transferFields,mime:metadata.mime,content:metadata.encoded};
  const mime=q.is(proofMimeTypes)||undefined;
  if(mime){
    await new Promise<void>((resolve,reject)=>readBinaryProof(q,r,(error?:{status?:number})=>{
      // Let the existing invalid-proof path clear an oversized or unsupported attempt.
      if(error && error.status!==413 && error.status!==415){reject(error);return;}
      if(error)q.body=undefined;
      resolve();
    }));
  }
  return {...transferFields,mime,content:Buffer.isBuffer(q.body)?q.body:undefined};
}

async function readEnrollmentIntake(c:Client,policy?:ReturnType<typeof enrollmentServicePolicy>,includeBank=false) {
  if(!(policy??enrollmentServicePolicy()).servicing)
    return {readiness:{accepting:false,servicing:false,reasons:['service_disabled']}};
  const mail=policy?undefined:await enrollmentMailReadiness(c);
  policy??=enrollmentServicePolicy(process.env,mail?.mode);
  const bank=includeBank||!policy.simulation?await readEnrollmentBank(c):undefined;
  const reasons:string[]=[];
  if(!policy.simulation){
    if(!bank||!hasConfiguredEnrollmentBank(bank))reasons.push('bank_required');
    if(!await (mail??await enrollmentMailReadiness(c)).smtpReady())reasons.push('mail_required');
  }
  return {readiness:{accepting:reasons.length===0,servicing:true,reasons},bank:bank?.bank};
}

export async function enrollmentReadiness(c:Client,policy?:ReturnType<typeof enrollmentServicePolicy>) {
  return (await readEnrollmentIntake(c,policy)).readiness;
}

export function startEnrollmentMaintenance(){
  if(!enrollmentServicePolicy().servicing)return;
  const maintenanceMode=async()=>enrollmentServicePolicy(process.env,(await enrollmentMailDelivery()).mode);
  startEnrollmentWeeklySimulation(enrollTx,async()=>{
    const current=await maintenanceMode();
    return current.simulation&&current.maintenance;
  });
  const maintenance=async()=>(await maintenanceMode()).maintenance;
  startEnrollmentVacancySimulation(enrollTx,lockClass,maintenance);
  startEnrollmentPriorityTransferSimulation({transact:moneyTx,lockOrder,lockClass},maintenance);
}

export function mountEnrollmentApplication(app: Express, { wrap, staff, visitor }: {
  wrap: (fn: Route) => (q: Request, r: Response) => void;
  staff: (q: Request, permission: string) => Promise<Employee>;
  visitor: (q:Request,r:Response)=>Promise<{id:string}>;
}) {
  const policy = enrollmentServicePolicy();
  mountEnrollmentRules(app,{wrap,transact:enrollTx,authorize:q=>staff(q,'crm.operations.manage')});
  const financeActor = async (q: Request) => {
    const actor = await staff(q, 'crm.payments.verify');
    // Enrollment orders and the shared receiving account require all-record finance access.
    if (!canManageEnrollmentFinance(actor)) invalid('enrollment_finance_forbidden', 403);
    return actor;
  };
  mountEnrollmentBank(app,{wrap,transact:enrollTx,authorize:financeActor});
  const base = '/api/enrollment';
  const finance = '/api/crm/enrollment/finance';
  app.get(enrollmentEmailWhatsAppPath,(q,r)=>{
    r.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    r.redirect(302,enrollmentEmailWhatsAppDestination(q.query.text));
  });

  async function requireNewEnrollment(c:Client) {
    const {reasons}=await enrollmentReadiness(c);
    if(reasons.length)invalid('enrollment_intake_'+reasons[0],503);
  }
  app.get(base + '/availability', wrap(async (q,r) => {
    if(q.query.scope==='servicing'||!policy.servicing){
      r.set('Cache-Control','no-store').json({accepting:false,servicing:policy.servicing,
        reasons:policy.servicing?[]:['service_disabled']});
      return;
    }
    const readiness=await enrollTx(c=>enrollmentReadiness(c)).catch(()=>({
      accepting:false,servicing:policy.servicing,reasons:['check_failed'],
    }));
    r.set('Cache-Control','no-store').json(readiness);
  }));
  app.get('/api/crm/enrollment/readiness', wrap(async (q,r) => {
    await staff(q,'crm.operations.manage');
    r.set('Cache-Control','no-store').json(await enrollTx(c=>enrollmentReadiness(c)));
  }));
  mountEnrollmentCrm(app,{wrap,staff,transact:enrollTx,saveProgress:saveSimpleSalesWorkflow,servicing:policy.servicing});
  if (!policy.servicing) return;

  const post = (path: string, handler: Route, contentTypes?: string[]) => app.post(path, wrap(async (q, r) => {
    if (!validMutationOrigin(q, contentTypes)) invalid('enrollment_origin_rejected', 403);
    r.set('Cache-Control', 'no-store');
    return handler(q, r);
  }));
  mountEnrollmentInterests(app,{wrap,post,transact:enrollTx,session,lockClass,expireSeats,requireNewEnrollment});
  const supportActor = async (q:Request) => {
    const actor=await staff(q,'crm.followup');
    if(!actor.permissions.includes('crm.read')) invalid('enrollment_support_forbidden',403);
    return actor;
  };
  mountEnrollmentCardTargets(app,wrap,staff,financeActor,enrollTx);
  mountEnrollmentResolution(app,{wrap,post,transact:moneyTx,read:enrollTx,session,lockOrder,lockClass,expireSeats,financeActor,supportActor});

  post('/api/crm/enrollment/classes/:id/cancel', async (q,r) => {
    const actor=await staff(q,academicManagePermission);
    const id=String(q.params.id);
    const result=await moneyTx(c=>operation(c,actor.id,q.body,
      {leadId:'class:'+id,kind:'enrollment.class.cancel',authorize:()=>staff(q,academicManagePermission)},async()=>{
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
        WHERE e.id<>:p1 AND e.state='published' AND LEAST(e.enrollment_closes_at, ${classOpeningMidnight('e.')})>UTC_TIMESTAMP(6)
          AND JSON_EXTRACT(c.value,'$.active')=true AND e.data->>'$.level'=:p2 AND e.data->>'$.format'=:p3
          AND (SELECT COUNT(*) FROM enrollment_orders o WHERE o.class_id=e.id AND o.state NOT IN ('expired','ended','refunding','refunded')
            AND (o.state<>'awaiting_payment' OR o.payment_due_at>=UTC_TIMESTAMP(6) OR o.received>0 OR o.upload_expires_at>=UTC_TIMESTAMP(6))) + (SELECT COUNT(*) FROM enrollment_transfer_invitations i
          WHERE i.target_class_id=e.id AND i.state='offered' AND i.expires_at>UTC_TIMESTAMP(6))
            < CAST(e.data->>'$.capacity' AS UNSIGNED)
        ORDER BY e.first_lesson_at,e.id`,[cohort.id,cohort.data.level,cohort.data.format])).rows.map(row=>({
          id:row.id,level:row.data.level,format:row.data.format,period:row.data.period,batchNumber:row.data.batchNumber,teacherType:row.data.teacherType,timeZone:row.data.timeZone,firstLesson:row.data.firstLesson,schedule:row.data.schedule,
          weeklySchedule:row.data.weeklySchedule,minutes:row.data.minutes,sessions:row.data.sessions,
        })):[];
      const status=await enrollmentAftercareStatus(c,order.id);
      const lateProofSubmitted=(order.state==='expired'||enrollmentClosureReason(order.state,order.data?.closureReason)==='learner_cancelled')&&verified===0&&!order.data?.creditOut&&
        (await c.query('SELECT 1 FROM enrollment_proofs WHERE order_id=:p1 LIMIT 1',[order.id])).rows.length>0;
      return { originalClassState:cohort.state, currentClass:{
        level:cohort.data.level,format:cohort.data.format,period:cohort.data.period,batchNumber:cohort.data.batchNumber,teacherType:cohort.data.teacherType,timeZone:cohort.data.timeZone,firstLesson:cohort.data.firstLesson,schedule:cohort.data.schedule,
        weeklySchedule:cohort.data.weeklySchedule,minutes:cohort.data.minutes,sessions:cohort.data.sessions,
        opened:!!confirmed,
      }, lateProofSubmitted, priorityRequested:typeof order.data?.priority==='boolean' ? order.data.priority : undefined,
        transfers, ...status, refund: verified<=0 ? { mode:'unavailable' } :
        confirmed ? {mode:'special_review'} : {
          mode:'contact_support',
          maximum:enrollmentRefundEstimate({price:order.price,received:verified,refunded:0,transferred:0,sessions:cohort.data.sessions,delivered:0}),
        } };
    });
    r.set('Cache-Control','no-store').json(result);
  }));

  const requestEmailCode=(assisted=false):Route=>async (q,r) => {
    const suppliedEmail=assisted?undefined:contact(q.body.email);
    const id = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const pending=await measureEnrollmentPhase(r,'transaction',()=>enrollTx(async (c: Client) => {
      const email=suppliedEmail??await readAssistanceEmail(c,q.body);
      const {delivery,configured}=await enrollmentMailDeliveryState(c);
      const local=enrollmentMailbox(delivery.mode);
      if(delivery.mode==='disabled'||delivery.mode==='simulation'&&!local)invalid('enrollment_email_unavailable',503);
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
      const message=renderEnrollmentEmail(!assisted&&q.body.purpose==='mine'?'otp_mine':'otp_apply',{
        language:q.body.language,code,codeMinutes:emailCodeMinutes,
      });
      if(configured)return {message,delivery,email};
      if(!local)invalid('enrollment_email_unavailable',503);
      await local.deliver(id,email,code,message);
    }));
    if(pending){
      const {email}=pending;
      const result=await measureEnrollmentPhase(r,'mail_dispatch',()=>dispatchEnrollmentMail('otp:'+id,email,pending.message,{code,deliveryId:id,expected:pending.delivery}));
      if(result.state!=='accepted'&&result.state!=='simulated'){
        await enrollTx(c=>c.query(`UPDATE enrollment_email_challenges SET used=TRUE,
          resend_at=IF(:p3,UTC_TIMESTAMP(6),resend_at) WHERE email=:p1 AND challenge_id=:p2`,
          [email,id,result.state!=='unknown']));
        if(result.state==='waiting')invalid('enrollment_code_wait',429);
        invalid('enrollment_email_unavailable',503);
      }
    }
    r.json({ challengeId: id });
  };
  post(base + '/email/request',requestEmailCode());
  post(base + '/assistance/email/request',requestEmailCode(true));

  post(base + '/email/session', async (q, r) => {
    if(q.body?.email===undefined){
      const verifiedEmail=await inspectEnrollmentEmailSession(enrollTx,q.headers.cookie);
      r.json({verifiedEmail:verifiedEmail??null});
      return;
    }
    const email=contact(q.body?.email);
    const verified=!!await inspectEnrollmentEmailSession(enrollTx,q.headers.cookie,email);
    r.json({verified});
  });

  post(base + '/email/logout', async (q,r)=>{
    const expected=q.get('X-Enrollment-Email');
    const revoked=await enrollTx(c=>revokeEnrollmentEmailSession(c,q.headers.cookie,expected));
    if(!revoked)invalid('enrollment_verification_required',401);
    r.clearCookie(enrollmentSessionCookie,{path:base,httpOnly:true,secure:q.secure,sameSite:'strict'});
    r.json({signedOut:true});
  });

  const verifyEmailCode=(assisted=false):Route=>async (q,r) => {
    const suppliedEmail=assisted?undefined:contact(q.body.email);
    const { challengeId, code } = q.body;
    if (!uuid.test(challengeId) || typeof code !== 'string' || !/^\d{6}$/.test(code)) invalid('enrollment_invalid_code');
    const token = randomBytes(32).toString('hex');
    const scope=await visitor(q,r);
    const sessionHours = await enrollTx(async (c: Client) => {
      const email=suppliedEmail??await readAssistanceEmail(c,q.body);
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
      await revokeEnrollmentEmailSession(c,q.headers.cookie);
      await c.query('INSERT INTO enrollment_email_sessions(digest,email,expires_at) VALUES(:p1,:p2,TIMESTAMPADD(HOUR,:p3,UTC_TIMESTAMP(6)))',
        [enrollmentVisitorDigest(token,scope.id),email,rules.emailSessionHours]);
      return rules.emailSessionHours;
    });
    if (sessionHours===null) invalid('enrollment_invalid_code', 401);
    r.cookie(enrollmentSessionCookie, 'v2.'+token, { httpOnly: true, secure: q.secure, sameSite: 'strict', path: base, maxAge: sessionHours*3_600_000 });
    r.json({ verified: true });
  };
  post(base + '/email/verify',verifyEmailCode());
  post(base + '/assistance/email/verify',verifyEmailCode(true));

  async function reserveSeat(c:Client,cohort:Awaited<ReturnType<typeof lockClass>>,seats:number,input:{
    email:string;name:string;phone:string;requestId:string;fingerprint:string;price:number;priority:boolean;source?:unknown;actor?:string;assistance?:{id:string;customerId:string;opportunityId:string};
  }) {
    const id=randomUUID();
    const {email,name,phone,requestId,fingerprint,price,priority,source,actor,assistance}=input;
    const {paymentHours}=await readEnrollmentRules(c);
    const {readiness,bank}=await readEnrollmentIntake(c,undefined,true);
    if(!readiness.accepting)invalid('enrollment_intake_'+readiness.reasons[0],503);
    if(!bank)invalid('enrollment_intake_bank_required',503);
    await c.query(`INSERT INTO enrollment_orders(id,class_id,email,request_id,fingerprint,state,price,payment_due_at,created_at,data)
      VALUES(:p1,:p2,:p3,:p4,:p5,'awaiting_payment',:p6,TIMESTAMPADD(HOUR,:p8,UTC_TIMESTAMP(6)),UTC_TIMESTAMP(6),:p7)`,
    [id,cohort.id,email,requestId,fingerprint,price,{name,phone,priority,bank},paymentHours]);
    if(assistance){
      await c.query(`INSERT INTO enrollment_customer_records(kind,record_id,lead_id,opportunity_id,created_at)
        VALUES('order',:p1,:p2,:p3,UTC_TIMESTAMP(6))`,[id,assistance.customerId,assistance.opportunityId]);
      await c.query(`UPDATE enrollment_assisted_applications SET order_id=:p2,confirmed_at=UTC_TIMESTAMP(6) WHERE id=:p1`,[assistance.id,id]);
    }else await recordEnrollmentCustomer(c,{kind:'order',id,email,phone,name,level:cohort.data.level,emailVerified:!actor});
    if(actor){
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.order.insert',:p2)",
        [actor,{orderId:id,classId:cohort.id,price}]);
    }else{
      await recordEnrollmentAttribution(c,'order',id,source);
    }
    await convertLearnerWaitlist(c,cohort.id,email,name,id);
    await reconcileWaitlist(c,cohort,seats+1);
    const reservedOrderSql='SELECT * FROM enrollment_orders WHERE id=:p1';
    let reserved=(await c.query(reservedOrderSql,[id])).rows[0];
    if(!actor&&await applyEnrollmentPaymentCredits(c,{order:reserved,cohort},lockOrder))
      reserved=(await c.query(reservedOrderSql,[id])).rows[0];
    if(Number(reserved.received)<price)await orderNotice(c,'seat_reserved',id,undefined,{price:price-Number(reserved.received)});
    return view(reserved,cohort.state,cohort.data.timeZone);
  }

  const assistanceToken=(token:unknown)=>{
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))invalid('enrollment_assistance_unavailable',404);
    return sha(token);
  };
  const offerProjection=`SELECT *,expires_at>UTC_TIMESTAMP(6) AS active,
    DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%sZ') AS expiresAt
    FROM enrollment_assisted_applications WHERE token_digest=:p1 OR id=:p2`;
  function offerLookup(body:any){
    if(typeof body?.applicationId==='string'&&uuid.test(body.applicationId))return [null,body.applicationId];
    return [assistanceToken(body?.token),null];
  }
  async function readAssistanceEmail(c:Client,body:unknown){
    const offer=(await c.query(offerProjection+' FOR UPDATE',offerLookup(body))).rows[0];
    return activeAssistanceEmail(offer);
  }
  post('/api/crm/opportunities/:id/enrollment-assistance',async(q,r)=>{
    const actor=await staff(q,'crm.followup');
    const {token,classId,requestId,name:rawName,phone:rawPhone,email:rawEmail,lang}=q.body??{};
    const email=contact(rawEmail),phone=enrollmentPhone(rawPhone);
    const name=typeof rawName==='string'?rawName.trim():'',opportunityId=String(q.params.id);
    if(!name||name.length>120||!phone||typeof classId!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(classId)||!uuid.test(requestId))
      invalid('enrollment_invalid_application');
    const result=await moneyTx(async c=>{
      const cohort=await lockClass(c,classId);
      await lockIdentityRegistry(c);
      const {customer,level}=await assistedEnrollmentOpportunity(c,opportunityId,actor);
      return operation(c,actor.id,q.body,{leadId:customer.id,kind:'enrollment.assistance:'+opportunityId},async()=>{
        await requireNewEnrollment(c);
        await validateAssistedContacts(c,customer,name,email,phone);
        if(cohort.data.level!==level||!allowsEnrollment(cohort)||!Number(cohort.course_active))
          invalid('enrollment_class_unavailable',409);
        await expireSeats(c,classId);
        if(await takenSeats(c,classId)>=cohort.data.capacity)invalid('enrollment_class_full',409);
        const id=randomUUID(),{timeZone,firstLesson,schedule,weeklySchedule,minutes,price,period,format}=cohort.data;
        const digest=token===undefined?sha(id):assistanceToken(token);
        await c.query(`UPDATE enrollment_assisted_applications SET expires_at=UTC_TIMESTAMP(6)
          WHERE opportunity_id=:p1 AND order_id IS NULL AND expires_at>UTC_TIMESTAMP(6)`,[opportunityId]);
        await c.query(`INSERT INTO enrollment_assisted_applications(id,token_digest,opportunity_id,customer_id,class_id,class_revision,
          actor,email,data,expires_at,created_at) VALUES(:p1,:p2,:p3,:p4,:p5,:p6,:p7,:p8,:p9,UTC_TIMESTAMP(6)+INTERVAL 24 HOUR,UTC_TIMESTAMP(6))`,
          [id,digest,opportunityId,customer.id,classId,cohort.revision,actor.id,email,
            {name,phone,quote:{level,timeZone,firstLesson,schedule,weeklySchedule,minutes,price,period,format},termsVersion:1,lang:['zh','en','id'].includes(lang)?lang:'en'}]);
        const expiry=(await c.query("SELECT DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%sZ') AS expiresAt FROM enrollment_assisted_applications WHERE id=:p1",[id])).rows[0];
        return {id,expiresAt:expiry.expiresAt,lang:['zh','en','id'].includes(lang)?lang:'en'};
      });
    });
    const mail=await enrollTx(async c=>{
      const offer=(await c.query(offerProjection+' FOR UPDATE',[null,result.id])).rows[0];
      if(!offer||offer.opportunity_id!==opportunityId)invalid('enrollment_assistance_unavailable',404);
      const latest=await latestAssistanceMail(c,result.id);
      return latest??(Number(offer.active)&&!offer.order_id
        ?await sendAssistanceMail(c,offer,sha(actor.id+':'+requestId)):undefined);
    });
    r.json({...result,mail,confirmationUrl:enrollmentAssistanceLink(result.id,result.lang)});
  });
  post('/api/crm/opportunities/:id/enrollment-assistance/:applicationId/retry',async(q,r)=>{
    const actor=await staff(q,'crm.followup');
    const opportunityId=String(q.params.id),applicationId=String(q.params.applicationId);
    if(!uuid.test(applicationId))invalid('enrollment_assistance_unavailable',404);
    const mail=await moneyTx(async c=>{
      await lockIdentityRegistry(c);
      const {customer}=await assistedEnrollmentOpportunity(c,opportunityId,actor);
      const offer=(await c.query(offerProjection+' FOR UPDATE',[null,applicationId])).rows[0];
      if(!offer||offer.opportunity_id!==opportunityId||offer.customer_id!==customer.id||
          !Number(offer.active)||offer.order_id)invalid('enrollment_assistance_unavailable',404);
      return retryAssistanceMail(c,offer,q.body?.previousAttempt);
    });
    r.json({mail});
  });
  post(base+'/assistance/preview',async(q,r)=>{
    const lookup=offerLookup(q.body);
    const result=await enrollTx(async c=>{
      const offer=(await c.query(offerProjection,lookup)).rows[0];
      if(!offer||!Number(offer.active)&&!offer.order_id)invalid('enrollment_assistance_unavailable',404);
      return enrollmentAssistancePreview(c,offer,q.body?.verified,q.headers.cookie,q.get('X-Enrollment-Email'));
    });
    r.json(result);
  });
  post(base+'/assistance/confirm',async(q,r)=>{
    const lookup=offerLookup(q.body);
    if(q.body?.termsVersion!==1||q.body?.confirmed!==true)invalid('enrollment_assistance_confirmation');
    const result=await moneyTx(async c=>{
      const email=await session(c,q);
      const saved=(await c.query(offerProjection+' FOR UPDATE',lookup)).rows[0];
      if(!saved||saved.email!==email)invalid('enrollment_assistance_unavailable',404);
      if(saved.order_id){
        const {order,cohort}=await lockOrder(c,saved.order_id,email);
        return view(order,cohort.state,cohort.data.timeZone);
      }
      if(!Number(saved.active))invalid('enrollment_assistance_unavailable',404);
      const cohort=await lockClass(c,saved.class_id);
      if(!allowsEnrollment(cohort)||!Number(cohort.course_active)||cohort.revision!==saved.class_revision)
        invalid('enrollment_assistance_quote_changed',409);
      await lockIdentityRegistry(c);
      const {customer,level}=await assistedEnrollmentOpportunity(c,saved.opportunity_id);
      if(customer.id!==saved.customer_id||cohort.data.level!==level)invalid('enrollment_assistance_identity',409);
      await validateAssistedContacts(c,customer,saved.data.name,email,saved.data.phone);
      await expireSeats(c,cohort.id);
      if(await activeLearnerOrder(c,cohort.id,email,saved.data.name))invalid('enrollment_assistance_existing_order',409);
      const seats=await takenSeats(c,cohort.id);
      if(seats>=cohort.data.capacity)invalid('enrollment_class_full',409);
      return reserveSeat(c,cohort,seats,{email,name:saved.data.name,phone:saved.data.phone,requestId:saved.id,fingerprint:saved.token_digest,
        price:saved.data.quote.price,priority:q.body?.priority===true,source:{lang:saved.data.lang},
        assistance:{id:saved.id,customerId:customer.id,opportunityId:saved.opportunity_id}});
    });
    r.json(result);
  });

  app.get(base+'/applications/results/:requestId',wrap(async(q,r)=>{
    r.set('Cache-Control','no-store');
    const requestId=String(q.params.requestId);
    if(!uuid.test(requestId))invalid('enrollment_invalid_application');
    const result=await enrollTx(async(c:Client)=>{
      const email=await session(c,q);
      const {rows:[row]}=await c.query(`SELECT o.*, b.state AS class_state, b.data->>'$.timeZone' AS class_time_zone FROM enrollment_orders o
        JOIN enrollment_classes b ON b.id=o.class_id WHERE o.email=:p1 AND o.request_id=:p2`,[email,requestId]);
      return row?{state:'saved',order:view(row,row.class_state)}:{state:'unconfirmed'};
    });
    r.json(result);
  }));

  post(base + '/applications', async (q, r) => {
    const { classId, requestId, name, priority } = q.body;
    const phone = enrollmentPhone(q.body.phone);
    if (typeof classId !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(classId) ||
        typeof requestId !== 'string' || !uuid.test(requestId) ||
        typeof name !== 'string' || name.trim().length < 1 || name.length > 120 ||
        !phone ||
        typeof priority !== 'boolean') invalid('enrollment_invalid_application');
    const result = await measureEnrollmentPhase(r,'transaction',()=>moneyTx(async (c: Client) => {
      const email = await session(c, q);
      const fingerprint = sha(JSON.stringify([classId, name.trim(), phone.trim(), priority]));
      const cohort = await lockClass(c, classId);
      await expireSeats(c, classId);
      const existing = (await c.query('SELECT * FROM enrollment_orders WHERE email=:p1 AND request_id=:p2', [email, requestId])).rows[0];
      if (existing) {
        if (existing.fingerprint !== fingerprint) invalid('enrollment_request_conflict', 409);
        const registeredClass=existing.class_id===classId?cohort:
          (await c.query('SELECT state,data FROM enrollment_classes WHERE id=:p1',[existing.class_id])).rows[0];
        return view(existing,registeredClass?.state,registeredClass?.data?.timeZone);
      }
      const active = (await c.query("SELECT value FROM crm_courses WHERE id=:p1 FOR SHARE", [cohort.course_id])).rows[0]?.value.active;
      if (!allowsEnrollment(cohort) || active !== true) invalid('enrollment_class_unavailable', 409);
      const existingSeat = await activeLearnerOrder(c,classId,email,name);
      if (existingSeat) return view(existingSeat,cohort.state,cohort.data.timeZone);
      const seats = await takenSeats(c,classId);
      if (Number(seats) >= cohort.data.capacity) invalid('enrollment_class_full', 409);
      return reserveSeat(c,cohort,seats,{email,name:name.trim(),phone,requestId,fingerprint,price:cohort.data.price,priority,source:q.body.source});
    }));
    r.json(result);
  });

  post('/api/crm/enrollment/classes/:id/insertions',async(q,r)=>{
    const actor=await staff(q,'crm.operations.manage');
    const classId=String(q.params.id);
    const {name,price,confirmed,requestId,email:rawEmail,phone:rawPhone}=q.body??{};
    const email=contact(rawEmail);
    const phone=enrollmentInsertionPhone(rawPhone);
    if(!/^[a-zA-Z0-9-]{1,64}$/.test(classId)||typeof name!=='string'||!name.trim()||name.length>120||!phone||
        typeof requestId!=='string'||!uuid.test(requestId)||!Number.isSafeInteger(price)||price<1||price>1_000_000_000||confirmed!==true)
      invalid('enrollment_invalid_insertion');
    const result=await moneyTx(c=>operation(c,actor.id,q.body,{leadId:'class:'+classId,kind:'enrollment.order.insert',
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
  app.get('/api/crm/enrollment/classes/:id/insertions/results/:requestId',wrap(async(q,r)=>{
    const actor=await staff(q,'crm.operations.manage');
    const result=await enrollTx(async c=>(await c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',
      [actor.id,q.params.requestId])).rows[0]?.result);
    if(result?.operationKind!=='enrollment.order.insert'||result.classId!==q.params.id)invalid('enrollment_result_missing',404);
    r.set('Cache-Control','no-store').json(result);
  }));

  app.get(base + '/orders', wrap(async (q, r) => {
    if(!readEnrollmentSessionDigest(q.headers.cookie))invalid('enrollment_verification_required',401);
    const result = await tx(async (c: Client) => {
      const email = await session(c, q);
      const { rows } = await c.query(`SELECT o.id,o.class_id,o.price,o.received,o.payment_due_at,
        CASE WHEN o.state='awaiting_payment' AND o.received=0 AND o.payment_due_at<UTC_TIMESTAMP(6)
          AND (o.upload_expires_at IS NULL OR o.upload_expires_at<UTC_TIMESTAMP(6)) THEN 'expired' ELSE o.state END AS state,
        o.data,e.state AS class_state,e.data AS class_data,
        i.id AS invitation_id,i.time_zone AS invitation_time_zone,DATE_FORMAT(i.expires_at,'%Y-%m-%dT%H:%i:%sZ') AS invitation_deadline,
        o.payment_due_at>=UTC_TIMESTAMP(6) AS before_due,
        (e.state='published' AND (o.state='partial' OR
          (o.state IN ('awaiting_payment','proof_review') AND o.payment_due_at>=UTC_TIMESTAMP(6)))) AS needs_payment,
        DATE_FORMAT(GREATEST(o.created_at,COALESCE(o.activity_at,o.created_at),COALESCE(n.latest,o.created_at),
          COALESCE(i.created_at,o.created_at),IF(e.state='cancelled',e.updated_at,o.created_at)),
          '%Y-%m-%dT%H:%i:%s.%fZ') AS updated_at_iso
        FROM enrollment_orders o JOIN enrollment_classes e ON e.id=o.class_id
        LEFT JOIN LATERAL (SELECT MAX(recorded_at) AS latest FROM enrollment_notification_receipts
          WHERE subject_id=o.id AND channel='email') n ON TRUE
        LEFT JOIN LATERAL (SELECT offer.id,offer.created_at,offer.expires_at,target.data->>'$.timeZone' AS time_zone FROM enrollment_transfer_invitations offer
          JOIN enrollment_classes target ON target.id=offer.target_class_id AND target.state='published'
          WHERE offer.order_id=o.id AND offer.source_class_id=o.class_id AND offer.state='offered'
            AND LEAST(offer.expires_at, ${classOpeningMidnight('target.')})>UTC_TIMESTAMP(6)
            AND e.state='cancelled' AND o.state IN ('paid','recovered')
          ORDER BY offer.created_at DESC,offer.id LIMIT 1) i ON TRUE
        WHERE o.email=:p1 ORDER BY (i.id IS NOT NULL OR needs_payment) DESC,updated_at_iso DESC,o.id DESC LIMIT 100`, [email]);
      const applications=(await c.query(`SELECT id,data,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS createdAt,
        DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%sZ') AS expiresAt,expires_at>UTC_TIMESTAMP(6) AS active
        FROM enrollment_assisted_applications WHERE email=:p1 AND order_id IS NULL ORDER BY created_at DESC,id LIMIT 100`,[email])).rows
        .map(row=>({id:row.id,quote:row.data.quote,name:row.data.name,createdAt:row.createdAt,expiresAt:row.expiresAt,active:Number(row.active)===1}));
      const paymentRows=await readEnrollmentLearnerPaymentRows(c,rows.filter(row=>['proof_review','partial'].includes(row.state)).map(row=>row.id));
      const orders=rows.map(row => {
        const {payment}=enrollmentLearnerPayment(row,row.class_state,withEnrollmentReceiptProofLinks(paymentRows.get(row.id),row.data?.learnerReceiptProofLinks));
        return { ...view(row,row.class_state), level: row.class_data.level, firstLesson: row.class_data.firstLesson,
          classCancelled:row.class_state==='cancelled',updatedAt:row.updated_at_iso,payment,
          needsPayment:['transfer','top_up','support'].includes(payment.action),
          invitation:row.invitation_id?{id:row.invitation_id,deadline:row.invitation_deadline,timeZone:row.invitation_time_zone??undefined}:undefined };
      });
      return {orders,applications,verifiedEmail:email};
    });
    r.set('Cache-Control', 'no-store').json(result);
  }));

  app.get(base + '/orders/:id', wrap(async (q, r) => {
    if(!readEnrollmentSessionDigest(q.headers.cookie))invalid('enrollment_verification_required',401);
    const result = await enrollTx(async (c: Client) => {
      const verifiedEmail = await session(c,q);
      const { order,cohort } = await lockOrder(c, String(q.params.id), verifiedEmail);
      return { ...await learnerPaymentView(c,order,cohort.state,cohort.data.timeZone), verifiedEmail, phoneDisplay:enrollmentPhoneDisplay(order.data?.phone) };
    });
    r.set('Cache-Control', 'no-store').json(result);
  }));

  app.get(base+'/orders/:id/proofs/:uploadId/result',wrap(async(q,r)=>{
    r.set('Cache-Control','no-store');
    const {id,uploadId}=q.params;
    if(!uuid.test(String(id))||!uuid.test(String(uploadId)))invalid('enrollment_invalid_proof');
    const result=await enrollTx(async(c:Client)=>{
      const email=await session(c,q);
      const {rows:[row]}=await c.query(`SELECT o.*, b.state AS class_state, b.data->>'$.timeZone' AS class_time_zone, p.id AS saved_proof,
        o.payment_due_at>=UTC_TIMESTAMP(6) AS before_due,
        (o.upload_id=:p3 AND o.upload_expires_at>=UTC_TIMESTAMP(6)) AS upload_active
        FROM enrollment_orders o JOIN enrollment_classes b ON b.id=o.class_id
        LEFT JOIN enrollment_proofs p ON p.order_id=o.id AND p.id=:p3
        WHERE o.id=:p1 AND o.email=:p2`,[id,email,uploadId]);
      if(!row)invalid('enrollment_order_not_found',404);
      return row.saved_proof?{state:'saved',order:await learnerPaymentView(c,row,row.class_state)}:
        {state:'unconfirmed',proofTransport:'binary-v1',uploadActive:Number(row.upload_active)===1};
    });
    r.json(result);
  }));

  post(base + '/orders/:id/proofs/start', async (q, r) => {
    const previousUploadId=q.body?.previousUploadId;
    if(previousUploadId!==undefined&&(typeof previousUploadId!=='string'||!uuid.test(previousUploadId)))
      invalid('enrollment_invalid_proof');
    const result = await enrollTx(async (c: Client) => {
      const { order,cohort } = await lockOrder(c, String(q.params.id), await session(c, q));
      // A delayed finish may have committed while this retry waited for the
      // same order lock. Return its result before opening another upload.
      if(previousUploadId&&(await c.query('SELECT id FROM enrollment_proofs WHERE id=:p1 AND order_id=:p2',
        [previousUploadId,order.id])).rows.length)return {state:'saved',order:await learnerPaymentView(c,order,cohort.state,cohort.data.timeZone)};
      if (!allowsEnrollmentProof(order.state,order.data?.closureReason)) invalid('enrollment_proof_not_available', 409);
      if (Number(order.upload_active)) {
        if (previousUploadId && previousUploadId===order.upload_id &&
            (order.state!=='awaiting_payment' || Number(order.before_due))) {
          // Keep the idempotency key. After the payment deadline the original
          // expiry still controls when an unpaid seat can be released.
          await c.query(`UPDATE enrollment_orders SET upload_expires_at=UTC_TIMESTAMP(6)+INTERVAL 5 MINUTE
            WHERE id=:p1 AND upload_id=:p2 AND upload_expires_at<UTC_TIMESTAMP(6)+INTERVAL 190 SECOND
              AND (state<>'awaiting_payment' OR payment_due_at>=UTC_TIMESTAMP(6))`,[order.id,previousUploadId]);
        }
        return {uploadId:order.upload_id,transport:'binary-v1'};
      }
      const id = randomUUID();
      await c.query('UPDATE enrollment_orders SET upload_id=:p1,upload_expires_at=UTC_TIMESTAMP(6)+INTERVAL 5 MINUTE WHERE id=:p2', [id,order.id]);
      return {uploadId:id,transport:'binary-v1'};
    });
    r.json(result);
  });

  post(base + '/orders/:id/proofs/finish', async (q, r) => {
    const {uploadId,reportedAmount,bankReference,transferId,mime,content}=await readProofSubmission(q,r);
    // End the current attempt on a rejected upload, so a later attempt uses a fresh server clock.
    const result = await measureEnrollmentPhase(r,'transaction',()=>enrollTx(async (c: Client) => {
      const { order,cohort } = await lockOrder(c, String(q.params.id), await session(c, q));
      const prior = (await c.query('SELECT order_id FROM enrollment_proofs WHERE id=:p1', [uploadId])).rows[0];
      if (prior?.order_id === order.id) return learnerPaymentView(c,order,cohort.state,cohort.data.timeZone);
      if (order.upload_id !== uploadId || !Number(order.upload_active) || !allowsEnrollmentProof(order.state,order.data?.closureReason)) {
        invalid('enrollment_upload_expired', 409);
      }
      if(transferId!==undefined&&(typeof transferId!=='string'||!uuid.test(transferId)))invalid('enrollment_invalid_proof_transfer');
      if(transferId===undefined&&!isEnrollmentProofAmount(reportedAmount))invalid('enrollment_invalid_proof_amount');
      let proof, transferDetails;
      try {
        proof = await measureEnrollmentPhase(r,'proof_validation',()=>proofContent(content,mime));
        transferDetails = transferId===undefined?proofTransferDetails(reportedAmount,bankReference):null;
      }
      catch {
        await c.query('UPDATE enrollment_orders SET upload_id=NULL,upload_expires_at=NULL WHERE id=:p1', [order.id]);
        await expireSeats(c, order.class_id);
        return null;
      }
      const rows=(await readEnrollmentLearnerPaymentRows(c,[order.id])).get(order.id);
      const groupId=enrollmentProofGroupId(rows?.proofs??[],uploadId,proof.digest,transferDetails?.reference,transferId);
      if(!groupId)invalid('enrollment_invalid_proof_transfer',409);
      await c.query(`INSERT INTO enrollment_proofs(id,order_id,mime,digest,proof,transfer_details,created_at)
        VALUES(:p1,:p2,:p3,:p4,FROM_BASE64(:p5),:p6,UTC_TIMESTAMP(6))`, [uploadId,order.id,mime,proof.digest,proof.encoded,{
        ...transferDetails,amount:groupId===uploadId?transferDetails?.amount:undefined,transferId:groupId,
      }]);
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
      await proofNotices(c,order.id,cohort.id,proof.digest,cohort.data.level);
      return learnerPaymentView(c,{...order,state},cohort.state,cohort.data.timeZone);
    }));
    if (!result) invalid('enrollment_invalid_proof');
    r.json(result);
  }, ['application/json', ...proofMimeTypes]);

  app.get(finance+'/worklist',wrap(async(q,r)=>{
    await financeActor(q);
    const search=typeof q.query.q==='string'?q.query.q.trim().slice(0,120).toLowerCase():'';
    const status=typeof q.query.status==='string'&&['all','pending','proof_review','partial','paid','refund','closed'].includes(q.query.status)
      ?q.query.status:'proof_review';
    const page=Math.max(1,Math.min(1_000_000,Math.floor(Number(q.query.page)||1)));
    const pageSize=25,offset=(page-1)*pageSize;
    if(status==='proof_review'){
      const result=await tx((c:Client)=>readEnrollmentFinanceWorklist(c,search,page,pageSize));
      return r.set('Cache-Control','no-store').json(result);
    }
    const result=await enrollTx(async c=>{
      const sql=`SELECT ranked.* FROM (
        SELECT filtered.*,COUNT(*) OVER() AS total,
          ROW_NUMBER() OVER(ORDER BY
          CASE WHEN :p2='pending' THEN filtered.review_due IS NULL ELSE 0 END,
          CASE WHEN :p2='pending' THEN filtered.review_due END ASC,
          filtered.created_at DESC,filtered.id) AS position
        FROM (
          SELECT o.id,o.state,o.price,o.received,o.created_at,o.data->>'$.name' AS name,e.state AS class_state,
            e.data->>'$.level' AS level,e.data->>'$.format' AS format,e.data->>'$.period' AS period,
            e.first_lesson_at AS firstLessonAt,
            latest_proof.created_at IS NOT NULL AS has_proof,
            DATE_FORMAT(latest_proof.created_at,'%Y-%m-%dT%H:%i:%sZ') AS proof_at,
            CASE WHEN o.state IN ('proof_review','partial','expired') AND NOT EXISTS (
              SELECT 1 FROM enrollment_receipts r WHERE r.order_id=o.id
                AND r.created_at>=STR_TO_DATE(o.data->>'$.firstProofAvailableAt','%Y-%m-%dT%H:%i:%s.%fZ')
            ) THEN o.data->>'$.firstReviewDueAt' END AS review_due,
            IF(:p2='all',CAST(o.data->'$.learnerReceiptProofLinks' AS CHAR),NULL) AS receipt_proof_links,
            o.data->>'$.creditOut' IS NOT NULL AS has_credit
          FROM enrollment_orders o JOIN enrollment_classes e ON e.id=o.class_id
          LEFT JOIN LATERAL (SELECT p.created_at FROM enrollment_proofs p WHERE p.order_id=o.id
            ORDER BY p.created_at DESC,p.id DESC LIMIT 1) latest_proof ON TRUE
          WHERE (:p1='' OR LOCATE(:p1,LOWER(CONCAT_WS(' ',o.data->>'$.name',o.id,e.id,e.data->>'$.level',
            REPLACE(e.data->>'$.level',' ',''),e.data->>'$.schedule')))>0)
        ) filtered
        WHERE (filtered.state IN ('proof_review','partial','paid','recovered','refunding','refunded') OR filtered.has_proof=1
          OR (filtered.state IN ('ended','expired') AND (filtered.received>0 OR filtered.has_credit=1)))
        AND (:p2='all' OR (:p2='pending' AND (filtered.state IN ('proof_review','partial')
              OR (filtered.state='expired' AND filtered.has_proof=1 AND filtered.received<filtered.price)))
          OR (:p2='paid' AND filtered.state IN ('paid','recovered'))
          OR (:p2='refund' AND filtered.state IN ('refunding','refunded'))
          OR (:p2='closed' AND filtered.state IN ('ended','expired'))
          OR (:p2='partial' AND filtered.state='partial'))
      ) ranked WHERE ranked.position>:p3 AND ranked.position<=:p3+:p4 ORDER BY ranked.position`;
      let rows=(await c.query(sql,[search,status,offset,pageSize])).rows;
      const actualPage=page>1&&!rows.length?1:page;
      if(actualPage!==page)rows=(await c.query(sql,[search,status,0,pageSize])).rows;
      const progress=status==='all'?await readEnrollmentFinanceProgress(c,rows.map(row=>({
        id:row.id,state:row.state,learnerReceiptProofLinks:row.receipt_proof_links?JSON.parse(row.receipt_proof_links):undefined,
      }))):undefined;
      return {orders:rows.map(row=>({id:row.id,name:row.name,price:Number(row.price),received:Number(row.received),
        level:row.level,format:row.format,period:row.period,firstLessonAt:row.firstLessonAt,
        status:enrollmentOrderStatus(row.state,row.class_state),hasProof:Number(row.has_proof)===1,
        proofAt:row.proof_at,reviewDueAt:row.review_due,progress:progress?.get(row.id)})),
        page:actualPage,pageSize,total:Number(rows[0]?.total??0)};
    });
    r.set('Cache-Control','no-store').json(result);
  }));

  app.get(finance, wrap(async (q, r) => {
    await financeActor(q);
    const orderId=typeof q.query.order==='string'?q.query.order:'';
    const bankLookup=q.query.bankLookup==='1';
    if(bankLookup&&!uuid.test(orderId))invalid('enrollment_invalid_order_number');
    const orders = await enrollTx(async (c: Client) => {
      const rows=(await c.query(`SELECT o.*,e.state AS class_state,e.first_lesson_at AS firstLessonAt,
        e.data->>'$.level' AS level,e.data->>'$.format' AS format,e.data->>'$.period' AS period,
        EXISTS(SELECT 1 FROM enrollment_class_openings g WHERE g.class_id=o.class_id) AS opened,
        latest_proof.id AS proof_id,latest_proof.mime AS proof_mime
      FROM enrollment_orders o JOIN enrollment_classes e ON e.id=o.class_id
      LEFT JOIN LATERAL (SELECT p.id,p.mime FROM enrollment_proofs p
        WHERE p.order_id=o.id ORDER BY p.created_at DESC,p.id DESC LIMIT 1) latest_proof ON TRUE
      WHERE (:p1='' OR o.id=:p1) AND (:p2=1 OR o.state IN ('proof_review','partial','paid','recovered','refunding','refunded')
        OR (o.state IN ('ended','expired') AND (o.received>0 OR o.data->>'$.creditOut' IS NOT NULL)) OR latest_proof.id IS NOT NULL)
      ORDER BY o.created_at DESC LIMIT 150`,[orderId,Number(bankLookup)])).rows;
      const receivingAccounts=orderId&&rows.length?await readEnrollmentReceivingAccounts(c,rows[0].data.bank):undefined;
      const proofRows=orderId&&rows[0]?.proof_id?(await c.query(`SELECT id,mime,digest,
        DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS submittedAt,transfer_details AS transfer
        FROM enrollment_proofs WHERE order_id=:p1 ORDER BY created_at DESC,id DESC`,[orderId])).rows:[];
      const proofs=proofRows.map(({digest,...proof})=>proof);
      const receiptsByOrder=new Map<string,any[]>();
      const creditsByOrder=new Map<string,any[]>();
      if(rows.length){
        const orderIds=JSON.stringify(rows.map(row=>row.id));
        const receipts=(await c.query(`SELECT order_id, reference, amount, receiving_account AS account,
          DATE_FORMAT(settled_at,'%Y-%m-%dT%H:%i:%sZ') AS settledAt
          FROM enrollment_receipts WHERE JSON_CONTAINS(:p1,JSON_QUOTE(order_id))
          ORDER BY settled_at DESC,reference`,[orderIds])).rows;
        for(const {order_id,amount,...receipt} of receipts){
          const history=receiptsByOrder.get(order_id)??[];
          history.push({...receipt,amount:Number(amount)});
          receiptsByOrder.set(order_id,history);
        }
        const credits=(await c.query(`SELECT id,source_order_id,target_order_id,receipt_reference AS reference,amount,
          DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS appliedAt FROM enrollment_payment_credits
          WHERE JSON_CONTAINS(:p1,JSON_QUOTE(source_order_id)) OR JSON_CONTAINS(:p1,JSON_QUOTE(target_order_id))
          ORDER BY created_at DESC,id`,[orderIds])).rows;
        for(const {source_order_id:source,target_order_id:target,amount,...credit} of credits){
          for(const [id,other,direction] of [[source,target,'out'],[target,source,'in']]){
            const history=creditsByOrder.get(id)??[];
            history.push({...credit,orderId:other,direction,amount:Number(amount)});
            creditsByOrder.set(id,history);
          }
        }
      }
      return rows.map(row=>{
        const receipts=receiptsByOrder.get(row.id)??[];
        const paymentRows=proofRows.length?{proofs:proofRows.slice().reverse().map(({id,digest,submittedAt,transfer})=>({id,digest,submittedAt,details:transfer})),receipts}:undefined;
        const evidence=paymentRows?enrollmentFinanceEvidence(withEnrollmentReceiptProofLinks(paymentRows,row.data?.learnerReceiptProofLinks)):undefined;
        const learnerTransfers=evidence?.transfers.map(transfer=>({...transfer,
          reviewDueAt:transfer.verifiedAmount===undefined&&transfer.submittedAt===row.data?.firstProofAvailableAt?row.data.firstReviewDueAt:undefined,
        }));
        return {...view(row,row.class_state),name:row.data.name,opened:Number(row.opened)===1,
          proofId:row.proof_id,proofMime:row.proof_mime,proofs,receivingAccounts,receipts,credits:creditsByOrder.get(row.id)??[],
          learnerTransfers,unmatchedReferences:evidence?.unmatchedReferences,level:row.level,format:row.format,period:row.period,firstLessonAt:row.firstLessonAt};
      });
    });
    r.set('Cache-Control', 'no-store').json({ orders });
  }));
  app.get(finance + '/proofs/:id', wrap(async (q, r) => {
    await financeActor(q);
    const proof = await enrollTx(async (c: Client) => (await c.query('SELECT proof,mime FROM enrollment_proofs WHERE id=:p1', [q.params.id])).rows[0]);
    if (!proof) invalid('enrollment_proof_not_found', 404);
    const suffix = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' }[proof.mime as string] || 'bin';
    r.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    if(q.query.preview==='image'&&(proof.mime==='image/png'||proof.mime==='image/jpeg')){
      r.type(proof.mime).send(proof.proof);
      return;
    }
    r.attachment('transfer-proof.' + suffix).send(proof.proof);
  }));

  post(finance + '/:id/receipts', async (q, r) => {
    const actor = await financeActor(q);
    const { amount, reference, receivingAccount, transferredAt, requestId, proofId, existingReference } = q.body;
    const linking=existingReference!==undefined;
    const bankReference=linking?existingReference:reference;
    const time = typeof transferredAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(transferredAt) ? new Date(transferredAt) : null;
    if(typeof bankReference!=='string'||!bankReference.trim()||bankReference.length>120||
      typeof requestId!=='string'||!uuid.test(requestId)||
      (linking?!proofId:(!Number.isSafeInteger(amount)||amount<1||amount>1_000_000_000||
        !time||!Number.isFinite(time.getTime())||time.getTime()>Date.now())))invalid('enrollment_invalid_receipt');
    const id = String(q.params.id);
    const result = await measureEnrollmentPhase(r,'transaction',()=>moneyTx((c: Client) => operation(c, actor.id, q.body,
      { leadId: 'enrollment:' + id, kind: 'enrollment.receipt', authorize: () => financeActor(q) }, async () => {
      if(!linking&&(typeof receivingAccount!=='string'||!receivingAccount.trim()||receivingAccount.trim().length>enrollmentReceivingAccountMaxLength))
        invalid('enrollment_receiving_account_required');
      const { order, cohort } = await lockOrder(c, id);
      if(['refunding','refunded'].includes(order.state)) invalid('enrollment_refund_in_progress',409);
      const ref = bankReference.trim().toUpperCase();
      let receiptProofId:string|null=null;
      if(proofId!==undefined){
        if(typeof proofId!=='string'||!uuid.test(proofId))invalid('enrollment_invalid_receipt_proof');
        const rows=withEnrollmentReceiptProofLinks((await readEnrollmentLearnerPaymentRows(c,[order.id])).get(order.id),order.data?.learnerReceiptProofLinks);
        if(linking&&!enrollmentFinanceEvidence(rows).unmatchedReferences.includes(ref))invalid('enrollment_invalid_receipt_proof',409);
        const groupId=enrollmentReceiptProofId(rows.proofs,proofId,ref,rows.receipts);
        if(!groupId)invalid('enrollment_invalid_receipt_proof',409);
        receiptProofId=groupId;
      }
      const receiptData={...order.data,learnerReceiptProofLinks:{...order.data?.learnerReceiptProofLinks,[ref]:receiptProofId}};
      if(linking){
        await c.query('UPDATE enrollment_orders SET data=:p1,activity_at=UTC_TIMESTAMP(6) WHERE id=:p2',[receiptData,id]);
        return {order:view(order,cohort.state,cohort.data.timeZone)};
      }
      try {
        await c.query(`INSERT INTO enrollment_receipts(reference,order_id,amount,actor,settled_at,receiving_account,created_at)
          VALUES(:p1,:p2,:p3,:p4,:p5,:p6,UTC_TIMESTAMP(6))`, [ref,id,amount,actor.id,time,receivingAccount.trim()]);
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') invalid('enrollment_duplicate_receipt', 409);
        throw error;
      }
      const received = Number(order.received) + amount;
      const due = new Date(order.payment_due_at.replace(' ', 'T') + 'Z');
      const timely = (await c.query(`SELECT COALESCE(SUM(r.amount-(SELECT COALESCE(SUM(a.amount),0) FROM enrollment_payment_credits a
        WHERE a.receipt_reference=r.reference)),0) AS sum FROM enrollment_receipts r WHERE r.order_id=:p1 AND r.settled_at<=:p2`, [id,due])).rows[0].sum;
      let state=order.state;
      if(order.state==='expired'&&Number(timely)>=order.price){
        if(cohort.state==='published') state='recovered';
        if(cohort.state==='cancelled') state='paid';
      } else if(!['ended','expired','recovered'].includes(order.state)){
        state=received>=order.price?'paid':'partial';
      }
      const summary=await updateEnrollmentPayment(c,{order,cohort},received,state,receiptData);
      await applyEnrollmentPaymentCredits(c,{order:{...order,data:receiptData,state,received},cohort},lockOrder);
      const latest=(await c.query('SELECT * FROM enrollment_orders WHERE id=:p1',[id])).rows[0];
      return {order:view(latest,cohort.state,cohort.data.timeZone),...summary};
    })));
    r.json(result);
  });
}
