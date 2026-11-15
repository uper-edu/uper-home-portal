import type { Express,Request,Response } from 'express';
import { enrollmentOrderStatus } from '../../src/utils/enrollmentOrderStatus.ts';
import { permittedRecord } from '../../src/utils/accessControl.ts';
import type { Employee } from './identity.ts';
import { invalid } from './trustWorkflow.ts';

type Client={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
type Staff=(req:Request,permission:string)=>Promise<Employee>;
type Actor=(req:Request)=>Promise<Employee>;
type Wrap=(fn:(q:Request,r:Response)=>Promise<unknown>)=>(q:Request,r:Response)=>void;

export function mountEnrollmentCardTargets(app:Express,wrap:Wrap,staff:Staff,finance:Actor,transact:(fn:(c:Client)=>Promise<unknown>)=>Promise<unknown>) {
  app.get('/api/crm/enrollment/notification-target/:type/:id',wrap(async(q,r)=>{
    const type=q.params.type, id=String(q.params.id);
    if(type==='payment') await finance(q);
    else if(type==='class'||type==='report'){
      const actor=await staff(q,'crm.operations.manage');
      if(!permittedRecord(actor,{},'crm.operations.manage')||!permittedRecord(actor,{},'crm.read'))
        invalid('enrollment_notice_forbidden',403);
    } else invalid('enrollment_notice_target_not_found',404);
    const result=await transact(async c=>{
      if(type==='report'){
        const receipt=(await c.query(`SELECT payload FROM enrollment_notification_receipts
          WHERE channel='lark' AND kind='weekly_report' AND event_key=:p1`,['lark:weekly:'+id])).rows[0];
        if(!receipt) invalid('enrollment_notice_target_not_found',404);
        const {weekStart,endDate,enrolled,opened,received,refunded,waiting,pending,pendingAmount}=receipt.payload;
        return {type,weekStart,endDate,enrolled,opened,received,refunded,waiting,pending,pendingAmount};
      }
      if(type==='class'){
        const cohort=(await c.query(`SELECT b.data,p.payload FROM enrollment_classes b
          JOIN enrollment_notification_receipts p ON p.event_key=CONCAT('lark:class:',b.id) WHERE b.id=:p1`,[id])).rows[0];
        if(!cohort) invalid('enrollment_notice_target_not_found',404);
        const {paid,minimumPaid,capacity,verifiedReceipts,waiting,pending,pendingAmount}=cohort.payload;
        return {type,id,level:cohort.data.level,firstLesson:cohort.data.firstLesson,schedule:cohort.data.schedule,
          paid,minimumPaid,capacity,received:verifiedReceipts,waiting,pending,pendingAmount};
      }
      const order=(await c.query(`SELECT o.id,o.state,o.price,o.received,b.state AS class_state,b.data AS class_data,
        DATE_FORMAT(p.first_proof,'%Y-%m-%dT%H:%i:%sZ') AS proofAt
        FROM enrollment_orders o JOIN enrollment_classes b ON b.id=o.class_id
        JOIN (SELECT order_id,MIN(created_at) AS first_proof FROM enrollment_proofs WHERE order_id=:p1 GROUP BY order_id) p
        ON p.order_id=o.id WHERE o.id=:p1`,[id])).rows[0];
      if(!order) invalid('enrollment_notice_target_not_found',404);
      return {type,id,level:order.class_data.level,price:Number(order.price),received:Number(order.received),state:enrollmentOrderStatus(order.state,order.class_state),proofAt:order.proofAt};
    });
    r.set('Cache-Control','no-store').json(result);
  }));
}
