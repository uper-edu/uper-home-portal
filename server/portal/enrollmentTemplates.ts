import type {Express, Request, Response} from 'express';
import {enrollmentLevels} from '../../src/utils/enrollmentCatalog.ts';
import {enrollmentTeacherTypes,enrollmentTemplateFormats,enrollmentTemplateQuote, type EnrollmentTeaching, type EnrollmentTemplate} from '../../src/utils/enrollmentTemplates.ts';
import {validMutationOrigin} from './accessTransport.ts';
import {tx} from './store.ts';
import {invalid,operation} from './trustWorkflow.ts';

export function enrollmentTeaching(value:any):EnrollmentTeaching {
  const text=(key:string,max:number,required=true)=>{
    const input=value?.[key]??(required?undefined:'');
    if(typeof input!=='string'||input.length>max||(required&&!input.trim()))invalid('course_information_invalid');
    return input.trim();
  };
  if(!enrollmentLevels.includes(value?.level)||!Number.isInteger(value?.minutes)||value.minutes<1||value.minutes>600)invalid('course_information_invalid');
  return {level:value.level,minutes:value.minutes,
    material:text('material',1200),knowledge:text('knowledge',1200,false),learningOutcomes:text('learningOutcomes',2500,false),resources:text('resources',2500,false)};
}

const prefix='enrollment_template:';
const isId=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(value);
export async function listEnrollmentTemplates(c:any):Promise<EnrollmentTemplate[]>{
  const {rows}=await c.query('SELECT value FROM portal_settings WHERE id LIKE :p1 ORDER BY id',[prefix.replace('_','\\_')+'%']);
  return rows.map((row:any)=>row.value);
}
export async function readEnrollmentTemplate(c:any,id:string):Promise<EnrollmentTemplate|undefined>{
  if(!isId(id))invalid('enrollment_template_invalid');
  return (await c.query('SELECT value FROM portal_settings WHERE id=:p1 FOR SHARE',[prefix+id])).rows[0]?.value;
}

export function mountEnrollmentTemplates(app:Express,{wrap,staff}:{
  wrap:(fn:(q:Request,r:Response)=>Promise<unknown>)=>(q:Request,r:Response)=>void;
  staff:(q:Request,permission:string)=>Promise<{id:string}>;
}){
  const path='/api/crm/enrollment/templates';
  const access=(q:Request)=>staff(q,'crm.operations.manage');
  app.post(path,wrap(async(q,r)=>{
    const actor=await access(q);
    if(!validMutationOrigin(q))invalid('enrollment_origin_rejected',403);
    const body=q.body;
    const {id,revision,name,courseId,format,teacherType,capacity,minimumPaid,standardUnitPrice,saleUnitPrice}=body??{};
    const validPrice=(p:unknown)=>p===null||typeof p==='number'&&Number.isSafeInteger(p)&&p>0;
    if(!isId(id)||!isId(courseId)||!Number.isSafeInteger(revision)||revision<0||
      typeof name!=='string'||!name.trim()||name.length>200||!enrollmentTemplateFormats.includes(format)||
      !enrollmentTeacherTypes.includes(teacherType)||!Number.isInteger(capacity)||capacity<1||capacity>200||
      !Number.isInteger(minimumPaid)||minimumPaid<1||minimumPaid>capacity||
      !validPrice(standardUnitPrice)||!validPrice(saleUnitPrice)||(standardUnitPrice===null)!==(saleUnitPrice===null)||
      (saleUnitPrice!==null&&standardUnitPrice!==null&&saleUnitPrice>standardUnitPrice))invalid('enrollment_template_invalid');
    const result=await tx(c=>operation(c,actor.id,body,{
      leadId:'template:'+id,kind:'enrollment.template.save',authorize:()=>access(q),
    },async()=>{
      const prior=(await c.query('SELECT value FROM portal_settings WHERE id=:p1 FOR UPDATE',[prefix+id])).rows[0]?.value;
      if(revision!==(prior?.revision??0))invalid('enrollment_template_conflict',409);
      if(prior&&(prior.courseId!==courseId||prior.format!==format||prior.teacherType!==teacherType))
        invalid('enrollment_template_identity_locked',409);
      const course=(await c.query('SELECT value FROM crm_courses WHERE id=:p1 FOR SHARE',[courseId])).rows[0]?.value;
      if(!course?.teaching)invalid('enrollment_course_unavailable',409);
      const value:EnrollmentTemplate={id,revision:revision+1,name:name.trim(),courseId,format,teacherType,capacity,minimumPaid,standardUnitPrice,saleUnitPrice};
      if((enrollmentTemplateQuote(value,course.sessions)?.price??0)>1_000_000_000||
        (standardUnitPrice??0)*course.sessions>1_000_000_000)invalid('enrollment_template_invalid');
      await c.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE value=:p2',[prefix+id,value]);
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.template.save',:p2)",[actor.id,{templateId:id,revision:value.revision}]);
      return {templateId:id,revision:value.revision};
    }));
    r.json(result);
  }));
  app.post(path+'/delete',wrap(async(q,r)=>{
    const actor=await access(q);
    if(!validMutationOrigin(q))invalid('enrollment_origin_rejected',403);
    const body=q.body;
    const {id,revision}=body??{};
    if(!isId(id)||!Number.isSafeInteger(revision)||revision<1)invalid('enrollment_template_invalid');
    const result=await tx(c=>operation(c,actor.id,body,{
      leadId:'template:'+id,kind:'enrollment.template.delete',authorize:()=>access(q),
    },async()=>{
      // Class creation holds a shared template lock until its class row is committed.
      const {rows}=await c.query('SELECT value FROM portal_settings WHERE id=:p1 FOR UPDATE',[prefix+id]);
      if(rows[0]?.value?.revision!==revision)invalid('enrollment_template_conflict',409);
      const usage=await c.query("SELECT id FROM enrollment_classes WHERE JSON_UNQUOTE(JSON_EXTRACT(data,'$.templateId'))=:p1 LIMIT 1",[id]);
      if(usage.rows.length)invalid('enrollment_template_in_use',409);
      await c.query('DELETE FROM portal_settings WHERE id=:p1',[prefix+id]);
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.template.delete',:p2)",[actor.id,{templateId:id,revision}]);
      return {templateId:id};
    }),{isolation:'READ COMMITTED'});
    r.json(result);
  }));
  app.get(path+'/results/:requestId',wrap(async(q,r)=>{
    const actor=await access(q);
    const {rows}=await tx(c=>c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',[actor.id,q.params.requestId]));
    const result=rows[0]?.result;
    if(result?.operationKind!=='enrollment.template.save'&&result?.operationKind!=='enrollment.template.delete')invalid('enrollment_result_missing',404);
    r.set('Cache-Control','no-store').json(result);
  }));
}
