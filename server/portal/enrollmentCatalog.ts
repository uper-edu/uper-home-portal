import {listEnrollmentTemplates,mountEnrollmentTemplates,readEnrollmentTemplate} from './enrollmentTemplates.ts';
import {enrollmentTemplateClassFields} from '../../src/utils/enrollmentTemplates.ts';
import type { Express, Request, Response } from 'express';
import { tx } from './store.ts';
import { invalid, operation } from './trustWorkflow.ts';
import { validMutationOrigin } from './accessTransport.ts';
import { enrollmentInstant, enrollmentWeeklyScheduleText, isEnrollmentInsertionWindow, publicEnrollmentClass, validateEnrollmentClass } from '../../src/utils/enrollmentCatalog.ts';
import { enrollmentSimulation } from './enrollmentSimulation.ts';
import { matchPublishedEnrollmentClass } from './enrollmentInterests.ts';
import type { EnrollmentClassAdmin, EnrollmentClassConfig } from '../../src/utils/enrollmentCatalog.ts';

const path = '/api/crm/enrollment/classes';
const kind = 'enrollment.class.save';

function record(row: { id: string; revision: number; state: EnrollmentClassAdmin['state']; data: EnrollmentClassConfig }): EnrollmentClassAdmin {
  return { ...row.data, id: row.id, revision: row.revision, state: row.state };
}

export function mountEnrollmentCatalog(app: Express, { wrap, staff }: {
  wrap: (fn: (q: Request, r: Response) => Promise<unknown>) => (q: Request, r: Response) => void;
  staff: (q: Request, permission: string) => Promise<{ id: string }>;
}) {
  mountEnrollmentTemplates(app,{wrap,staff});
  app.get(path, wrap(async (q, r) => {
    const actor = await staff(q, 'crm.operations.manage');
    const data = await tx(async c => {
      const classes = (await c.query(`SELECT e.id,e.revision,e.state,e.data,(g.class_id IS NOT NULL) AS opened
        FROM enrollment_classes e LEFT JOIN enrollment_class_openings g ON g.class_id=e.id ORDER BY e.first_lesson_at,e.id`)).rows
        .map((row:any)=>({...record(row),opened:Number(row.opened)===1}));
      const courses = (await c.query('SELECT id,value FROM crm_courses ORDER BY id')).rows.map((row: any) => ({
        id: row.id, name: row.value.name, active: row.value.active === true, sessions:row.value.sessions, teaching:row.value.teaching,
      }));
      const active = new Set(courses.filter(course=>course.active).map(course=>course.id));
      const canOperate = !!enrollmentSimulation();
      return { templates:await listEnrollmentTemplates(c), classes:classes.map(row=>({...row,canInsert:canOperate&&row.state==='published'&&active.has(row.courseId)&&isEnrollmentInsertionWindow(row)})), courses };
    });
    r.set('Cache-Control', 'no-store').json({ ...data, actorId: actor.id });
  }));
  app.post(path, wrap(async (q, r) => {
    const actor = await staff(q, 'crm.operations.manage');
    if (!validMutationOrigin(q)) invalid('enrollment_origin_rejected', 403);
    const body = q.body;
    if (typeof body?.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(body.id) ||
      !Number.isSafeInteger(body.revision) || body.revision < 0 ||
      !['draft', 'published'].includes(body.state)) invalid('enrollment_class_invalid');
    if(!body.config||typeof body.config!=='object')invalid('enrollment_class_invalid');
    const result = await tx(c => operation(c, actor.id, body, {
      leadId: 'class:' + body.id, kind, authorize: () => staff(q, 'crm.operations.manage'),
    }, async () => {
      const current = (await c.query('SELECT revision,state,data FROM enrollment_classes WHERE id=:p1 FOR UPDATE', [body.id])).rows[0];
      if ((current?.revision ?? 0) !== body.revision) invalid('enrollment_class_conflict', 409);
      if(current?.state==='cancelled') invalid('enrollment_class_conflict',409);
      const isPublished=current?.state==='published';
      const raw=body.config;
      if(isPublished&&body.state!=='published')invalid('enrollment_class_conflict',409);
      if(!isPublished&&(!current||body.state==='published'||current.data?.templateId)&&!raw.templateId)invalid('enrollment_template_required');
      const useTemplate=raw.templateId&&!isPublished;
      const template=useTemplate?await readEnrollmentTemplate(c,raw.templateId):undefined;
      if(useTemplate&&(!template||template.revision!==raw.templateRevision))invalid('enrollment_template_conflict',409);
      const courseId=isPublished?current.data.courseId:template?.courseId??raw.courseId;
      const course=(await c.query('SELECT value FROM crm_courses WHERE id=:p1 FOR SHARE',[courseId])).rows[0]?.value;
      if(!course||body.state==='published'&&!course.active)invalid('enrollment_course_unavailable',409);
      const snapshot=template?enrollmentTemplateClassFields(template,{...course,id:courseId}):null;
      if(template&&!snapshot)invalid('enrollment_template_invalid');
      if(snapshot&&body.state==='published'&&!snapshot.price)invalid('enrollment_template_missing_quote',409);
      const dates={firstLesson:raw.firstLesson,enrollmentCloses:raw.enrollmentCloses,decisionAt:raw.decisionAt,period:raw.period,schedule:raw.schedule};
      const teacher=raw.teacher===undefined?current?.data.teacher??'':raw.teacher;
      const config={...(isPublished?{...current.data,...dates}:snapshot?{...snapshot,...dates}:raw),teacher};
      const weeklySchedule=raw.weeklySchedule;
      if(weeklySchedule){
        config.schedule=enrollmentWeeklyScheduleText(weeklySchedule,config.minutes);
        if(!config.schedule)invalid('enrollment_class_invalid');
        config.weeklySchedule=weeklySchedule;
      }else if(snapshot||current?.data?.weeklySchedule){
        invalid('enrollment_class_invalid');
      }
      const data={...validateEnrollmentClass(config,!!snapshot&&body.state==='draft'),
        ...(weeklySchedule?{weeklySchedule:{days:[...new Set(weeklySchedule.days)].sort((a:any,b:any)=>a-b),start:weeklySchedule.start,lessons:weeklySchedule.lessons}}:{}),
        ...(config.templateId?{templateId:config.templateId,templateRevision:config.templateRevision,teacherType:config.teacherType,courseName:config.courseName}:{})};

      const revision = body.revision + 1;
      const fields = [data.courseId, revision, body.state, enrollmentInstant(data.firstLesson), enrollmentInstant(data.enrollmentCloses), data];
      if (current) {
        await c.query('UPDATE enrollment_classes SET course_id=:p1,revision=:p2,state=:p3,first_lesson_at=:p4,enrollment_closes_at=:p5,data=:p6,updated_at=UTC_TIMESTAMP(6) WHERE id=:p7', [...fields, body.id]);
      } else {
        await c.query('INSERT INTO enrollment_classes (course_id,revision,state,first_lesson_at,enrollment_closes_at,data,id,updated_at) VALUES (:p1,:p2,:p3,:p4,:p5,:p6,:p7,UTC_TIMESTAMP(6))', [...fields, body.id]);
      }
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.class.save',:p2)",
        [actor.id, { classId: body.id, state: body.state, revision }]);
      if (body.state === 'published' && enrollmentSimulation()) await matchPublishedEnrollmentClass(c,body.id);
      return { classId: body.id, revision };
    }));
    r.json(result);
  }));
  app.get(path + '/results/:requestId', wrap(async (q, r) => {
    const actor = await staff(q, 'crm.operations.manage');
    const result = await tx(async c => (await c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',
      [actor.id, q.params.requestId])).rows[0]?.result);
    if (result?.operationKind !== kind && result?.operationKind !== 'enrollment.order.insert') invalid('enrollment_result_missing', 404);
    r.set('Cache-Control', 'no-store').json(result);
  }));
  app.get('/api/enrollment/classes', wrap(async (_q, r) => {
    const classes = await tx(async c => (await c.query(`
      SELECT e.id,e.revision,e.state,e.data,(g.class_id IS NOT NULL) AS opened,
        (SELECT COUNT(*) FROM enrollment_orders o WHERE o.class_id=e.id AND o.state NOT IN ('expired','ended','refunding','refunded')
          AND (o.state<>'awaiting_payment' OR o.payment_due_at>=UTC_TIMESTAMP(6) OR o.received>0 OR o.upload_expires_at>=UTC_TIMESTAMP(6))) + (SELECT COUNT(*) FROM enrollment_transfer_invitations i
          WHERE i.target_class_id=e.id AND i.state='offered' AND i.expires_at>UTC_TIMESTAMP(6)) AS seats
      FROM enrollment_classes e
      JOIN crm_courses c ON c.id=e.course_id
      LEFT JOIN enrollment_class_openings g ON g.class_id=e.id
      WHERE e.state='published' AND LEAST(e.enrollment_closes_at, DATE(e.first_lesson_at + INTERVAL 7 HOUR) - INTERVAL 7 HOUR)>UTC_TIMESTAMP(6)
        AND JSON_EXTRACT(c.value,'$.active')=true
      ORDER BY e.first_lesson_at,e.id
    `)).rows.map((row: Parameters<typeof record>[0] & { opened: number; seats: number }) => {
      const available = row.data.capacity - Number(row.seats);
      const availability = available <= 0 ? 'full' : available <= 3 ? 'limited' : 'available';
      return { ...publicEnrollmentClass(record(row)), opened: Number(row.opened) === 1, availability };
    }));
    const appointments=await tx(async c=>{
      const templates=await listEnrollmentTemplates(c);
      const courses=(await c.query('SELECT id,value FROM crm_courses ORDER BY id')).rows;
      return templates.flatMap(template=>{
        const course=courses.find((row:any)=>row.id===template.courseId)?.value;
        if(template.format!=='one-on-one'||!template.saleUnitPrice||!template.standardUnitPrice||!course?.active||!course.teaching)return [];
        return [{id:template.id,level:course.teaching.level,course:course.name,teacherType:template.teacherType,
          lessons:course.sessions,minutes:course.teaching.minutes,price:template.saleUnitPrice,standardPrice:template.standardUnitPrice}];
      });
    });
    r.set('Cache-Control', 'no-store').json({ classes,appointments });
  }));
}
