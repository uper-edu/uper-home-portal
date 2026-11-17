import {enrollmentMailConfigured,enrollmentMailMode} from './enrollmentMail.ts';
import { enrollmentOrderEmailPath, renderEnrollmentEmail, type EnrollmentEmailKind } from './enrollmentEmail.ts';
import { cardMoney, enrollmentCard } from './enrollmentCards.ts';
import { enrollmentWeekOf, enrollmentWeekTotals, latestDueEnrollmentWeek } from './enrollmentWeekly.ts';
import { pendingEnrollmentProofTotals } from './enrollmentProofTotals.ts';
import { enrollmentAssistancePath } from '../../src/utils/enrollmentAssistance.ts';
import type { enrollmentSimulation } from './enrollmentSimulation.ts';

type Client = { query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}> };
type Notice = Exclude<EnrollmentEmailKind,'otp_apply'|'otp_mine'|'assistance_confirmation'>;
const pendingMoney=(amount:number|null,unknown:number)=>cardMoney(amount)+(amount!==null&&unknown?'（另有 '+unknown+' 笔金额未知）':'');

async function record(c:Client,key:string,channel:'email'|'lark',kind:string,subjectId:string,payload:object) {
  const queued=channel==='email'&&enrollmentMailMode()!=='disabled'&&await enrollmentMailConfigured(c);
  await c.query(`INSERT INTO enrollment_notification_receipts(event_key,channel,kind,subject_id,payload,state,recorded_at)
    VALUES(:p1,:p2,:p3,:p4,:p5,:p6,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE event_key=event_key`,
    [key,channel,kind,subjectId,queued?{...payload,environment:process.env.PORTAL_ENV}:payload,queued?'queued':'simulated']);
}
export async function latestAssistanceMail(c:Client,id:string){
  return (await c.query(`SELECT event_key AS id,state,DATE_FORMAT(recorded_at,'%Y-%m-%dT%H:%i:%sZ') AS recordedAt
    FROM enrollment_notification_receipts WHERE subject_id=:p1 AND channel='email' AND kind='assistance_confirmation'
    ORDER BY recorded_at DESC,event_key DESC LIMIT 1`,[id])).rows[0];
}

export async function sendAssistanceMail(c:Client,local:NonNullable<ReturnType<typeof enrollmentSimulation>>,
  offer:any,attempt:string){
  const {id,email,data,expiresAt}=offer;
  const content={salutation:data.name,language:data.lang,class:data.quote.level,format:data.quote.format,period:data.quote.period,firstLesson:data.quote.firstLesson,
    schedule:data.quote.schedule,price:data.quote.price,deadline:expiresAt,url:enrollmentAssistancePath(id,data.lang)};
  const message=renderEnrollmentEmail('assistance_confirmation',content);
  if(await enrollmentMailConfigured(c)){
    await record(c,'email:assistance_confirmation:'+id+':'+attempt,'email','assistance_confirmation',id,{
      ...message,recipient:email,environment:process.env.PORTAL_ENV,deliveryId:'assistance-'+attempt,
    });
    return latestAssistanceMail(c,id);
  }
  let state='simulated';
  try{await local.deliverMessage('assistance-'+attempt,email,message);}
  catch{state='failed';}
  await c.query(`INSERT INTO enrollment_notification_receipts(event_key,channel,kind,subject_id,payload,state,recorded_at)
    VALUES(:p1,'email','assistance_confirmation',:p2,:p3,:p4,UTC_TIMESTAMP(6))`,
    ['email:assistance_confirmation:'+id+':'+attempt,id,{recipient:email,...content,subject:message.subject},state]);
  return latestAssistanceMail(c,id);
}
export async function orderNotice(c:Client,kind:Notice,orderId:string,discriminator='',facts:object={}) {
  const row=(await c.query(`SELECT o.email,o.data,o.state,b.data AS class_data,a.attribution,
    DATE_FORMAT(o.payment_due_at,'%Y-%m-%dT%H:%i:%sZ') AS deadline
    FROM enrollment_orders o JOIN enrollment_classes b ON b.id=o.class_id
    LEFT JOIN enrollment_record_attribution a ON a.kind='order' AND a.record_id=o.id WHERE o.id=:p1`,[orderId])).rows[0];
  if (!row) return;
  const language=row.attribution?.lang??'en';
  const content={
    salutation:row.data.name, language, orderId, orderState:row.state,
    class:row.class_data.level,format:row.class_data.format,period:row.class_data.period,firstLesson:row.class_data.firstLesson,schedule:row.class_data.schedule,
    deadline:row.deadline,...facts,url:enrollmentOrderEmailPath(kind,language,orderId,discriminator),
  };
  await record(c,'email:'+kind+':'+orderId+':'+discriminator,'email',kind,orderId,{
    recipient:row.email,...content,...renderEnrollmentEmail(kind,content),
  });
}
export async function interestNotice(c:Client,kind:'waitlist_vacancy'|'demand_match',interestId:string,email:string,cohort:{id:string;data:any},cycle:number) {
  const type=kind==='waitlist_vacancy'?'waitlist':'demand';
  const attribution=(await c.query('SELECT attribution FROM enrollment_record_attribution WHERE kind=:p1 AND record_id=:p2',[type,interestId])).rows[0]?.attribution;
  const language=attribution?.lang??'en';
  const content={language,class:cohort.data.level,format:cohort.data.format,period:cohort.data.period,firstLesson:cohort.data.firstLesson,schedule:cohort.data.schedule,
    url:'/enrollment/'+encodeURIComponent(cohort.id)+'?'+new URLSearchParams({lang:language})};
  await record(c,'email:'+kind+':'+interestId+':'+cohort.id+':'+cycle,'email',kind,interestId,{
    recipient:email,...content,...renderEnrollmentEmail(kind,content),
  });
}
export async function proofNotices(c:Client,orderId:string,classId:string,digest:string,level:string) {
  await orderNotice(c,'proof_received',orderId,digest);
  await record(c,'lark:proof:'+orderId+':'+digest,'lark','proof_received',orderId,{
    title:'学员已提交转账记录 · 待财务核实',level,orderId,classId,verified:false,
    ...enrollmentCard('payment',orderId,'学员已提交转账记录 · 待财务核实',{
      班次:level,报名编号:orderId,提交时间:new Date().toISOString(),核款状态:'待财务核实',
    }),
  });
}
export async function classOpeningNotices(c:Client,cohort:any) {
  const {rows}=await c.query(`SELECT
    SUM(state IN ('paid','recovered')) AS paid,
    COALESCE(SUM(received),0) AS received,
    SUM(received=0 AND state='awaiting_payment' AND payment_due_at>=UTC_TIMESTAMP(6)) AS waiting,
    DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%d %H:%i:%s.%f') AS cutoff
    FROM enrollment_orders o WHERE class_id=:p1 AND state NOT IN ('refunding','refunded')`,[cohort.id]);
  const [totals]=rows;
  const {pendingParticipants,pendingAmount,pendingUnknownCount}=await pendingEnrollmentProofTotals(c,totals.cutoff,cohort.id);
  await record(c,'lark:class:'+cohort.id,'lark','class_confirmed',cohort.id,{
    title:'已确认开班',level:cohort.data.level, firstLesson:cohort.data.firstLesson,timezone:'Asia/Jakarta',
    paid:Number(totals.paid), minimumPaid:cohort.data.minimumPaid, capacity:cohort.data.capacity,
    verifiedReceipts:Number(totals.received), waiting:Number(totals.waiting), pending:pendingParticipants,pendingAmount,pendingUnknownCount,
    ...enrollmentCard('class',cohort.id,'已确认开班',{
      班次:cohort.data.level,首课时间:cohort.data.firstLesson.replace('T',' ')+' WIB',
      足额到账:Number(totals.paid)+' / '+cohort.data.minimumPaid,招生上限:cohort.data.capacity,
      核实实收:cardMoney(Number(totals.received)),待核实人数:pendingParticipants,
      待核实金额:pendingMoney(pendingAmount,pendingUnknownCount),待付款人数:Number(totals.waiting),
    }),
  });
}

export async function recordDueEnrollmentWeekly(c:Client,now=new Date()) {
  const weekStart=latestDueEnrollmentWeek(now);
  const week=enrollmentWeekOf(weekStart)!;
  const key='lark:weekly:'+weekStart;
  const prior=(await c.query('SELECT event_key FROM enrollment_notification_receipts WHERE event_key=:p1',[key])).rows[0];
  if (prior) return;
  const totals=await enrollmentWeekTotals(c,week);
  await record(c,key,'lark','weekly_report',weekStart,{
    weekStart,endDate:week.endDate,...totals,
    ...enrollmentCard('report',weekStart,'UPER 课程报名经营周报',{
      统计周:weekStart+' 至 '+week.endDate+'（WIB，结束日期不含）',
      新增足额到账报名:totals.enrolled,确认开班:totals.opened,核实实收:cardMoney(totals.received),
      已发出退款:cardMoney(totals.refunded),期末待付款人数:totals.waiting,期末待核实笔数:totals.pending,
      期末待核实金额:pendingMoney(totals.pendingAmount,totals.pendingUnknownCount),
    }),
  });
}

export function startEnrollmentWeeklySimulation(transact:(fn:(c:Client)=>Promise<unknown>)=>Promise<unknown>) {
  let busy=false;
  const tick=async()=>{
    if(busy)return;
    busy=true;
    try { await transact(c=>recordDueEnrollmentWeekly(c)); }
    catch { console.error('Enrollment weekly simulation could not record the report'); }
    finally { busy=false; }
  };
  const timer=setInterval(()=>void tick(),30_000);
  timer.unref();
  void tick();
}
