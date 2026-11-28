import {academicManagePermission} from '../../src/utils/accessControl.ts';
import {enrollmentTimeZone,isEnrollmentClassTimeZone} from '../../src/utils/enrollmentDateFormat.ts';
import {classRecruitmentOpen,classOpeningMidnight} from './enrollmentClassTimeSql.ts';
import {portalPublicOrigin} from './enrollmentEmail.ts';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {enrollmentTemplateIdPattern,enrollmentTemplateKey,listEnrollmentTemplates,mountEnrollmentTemplates,readEnrollmentTemplate} from './enrollmentTemplates.ts';
import type {EnrollmentTeaching} from '../../src/utils/enrollmentTemplates.ts';
import {enrollmentTemplateClassFields} from '../../src/utils/enrollmentTemplates.ts';
import type { Express, Request, Response } from 'express';
import { pool, tx } from './store.ts';
import { invalid, operation } from './trustWorkflow.ts';
import { validMutationOrigin } from './accessTransport.ts';
import { enrollmentClassLookupLimit, enrollmentInstant, enrollmentScheduleReviewFields, enrollmentWeeklyScheduleText, publicEnrollmentClass, validEnrollmentHolidayDate, validateEnrollmentClass } from '../../src/utils/enrollmentCatalog.ts';
import { enrollmentMailDelivery } from './enrollmentMail.ts';
import { enrollmentServicePolicy } from './enrollmentRuntime.ts';
import { matchPublishedEnrollmentClass } from './enrollmentInterests.ts';
import type { EnrollmentClassAdmin, EnrollmentClassConfig } from '../../src/utils/enrollmentCatalog.ts';
import {classFaculty,listFacultyChoices} from './faculty.ts';

const path = '/api/crm/enrollment/classes';
const kind = 'enrollment.class.save';
const deleteKind = 'enrollment.class.delete';

async function readClasses(c: Parameters<Parameters<typeof tx>[0]>[0], id: string | null) {
  return (await c.query(`SELECT e.id,e.revision,e.state,e.data,(g.class_id IS NOT NULL) AS opened,
    EXISTS (SELECT 1 FROM enrollment_orders o WHERE o.class_id=e.id) AS hasOrders,
    (e.state='draft' AND g.class_id IS NULL AND JSON_EXTRACT(e.data,'$.batchNumber') IS NULL
      AND NOT EXISTS (SELECT 1 FROM enrollment_assisted_applications a WHERE a.class_id=e.id)
      AND NOT EXISTS (SELECT 1 FROM enrollment_orders o WHERE o.class_id=e.id)
      AND NOT EXISTS (SELECT 1 FROM enrollment_waitlist w WHERE w.class_id=e.id)
      AND NOT EXISTS (SELECT 1 FROM enrollment_transfer_invitations i WHERE i.source_class_id=e.id OR i.target_class_id=e.id)
      AND NOT EXISTS (SELECT 1 FROM enrollment_transfers x WHERE x.source_class_id=e.id OR x.target_class_id=e.id)
      AND NOT EXISTS (SELECT 1 FROM enrollment_refund_cases f WHERE f.class_id=e.id)
      AND NOT EXISTS (SELECT 1 FROM enrollment_interest_events n WHERE n.class_id=e.id)) AS canDelete
    FROM enrollment_classes e LEFT JOIN enrollment_class_openings g ON g.class_id=e.id
    WHERE (:p1 IS NULL OR e.id=:p1) ORDER BY e.first_lesson_at,e.id`, [id])).rows;
}

function record(row: { id: string; revision: number; state: EnrollmentClassAdmin['state']; data: EnrollmentClassConfig }): EnrollmentClassAdmin {
  return { ...row.data, id: row.id, revision: row.revision, state: row.state };
}

export async function readPublicEnrollmentClasses(c: Parameters<Parameters<typeof tx>[0]>[0], {
  classIds=[],includeAvailability=true,summaryOnly=false,
}: {classIds?:readonly string[];includeAvailability?:boolean;summaryOnly?:boolean} = {}) {
  return (await c.query(`
      SELECT e.id,e.revision,e.state,
        CAST(CASE WHEN :p4=1 THEN JSON_REMOVE(e.data,'$.learningOutcomes','$.material','$.resources','$.teacher')
          ELSE e.data END AS JSON) AS data,
        CASE WHEN :p4=1 THEN NULL ELSE JSON_EXTRACT(c.value,'$.teaching') END AS teaching,
        (g.class_id IS NOT NULL) AS opened,
        CASE WHEN :p3=1 THEN (SELECT COUNT(*) FROM enrollment_orders o WHERE o.class_id=e.id AND o.state NOT IN ('expired','ended','refunding','refunded')
          AND (o.state<>'awaiting_payment' OR o.payment_due_at>=UTC_TIMESTAMP(6) OR o.received>0 OR o.upload_expires_at>=UTC_TIMESTAMP(6))) + (SELECT COUNT(*) FROM enrollment_transfer_invitations i
          WHERE i.target_class_id=e.id AND i.state='offered' AND i.expires_at>UTC_TIMESTAMP(6)) END AS seats
      FROM enrollment_classes e
      JOIN crm_courses c ON c.id=e.course_id
      LEFT JOIN enrollment_class_openings g ON g.class_id=e.id
      WHERE e.state='published' AND ${classRecruitmentOpen('e.')} AND LEAST(e.enrollment_closes_at, ${classOpeningMidnight('e.')})>UTC_TIMESTAMP(6)
        AND JSON_EXTRACT(c.value,'$.active')=true
        AND (:p1 IS NULL OR e.id IN (:p2))
      ORDER BY e.first_lesson_at,e.id
    `, [classIds.length ? 1 : null, classIds, Number(includeAvailability), Number(summaryOnly)])).rows.map((row: Parameters<typeof record>[0] & { opened: number; seats: number | null; teaching?:EnrollmentTeaching|null }) => {
      const publicClass=publicEnrollmentClass(record(row));
      const teaching=summaryOnly||row.teaching?.level!==publicClass.level?undefined:row.teaching;
      if(teaching){
        publicClass.material=[teaching.material,teaching.knowledge].filter(Boolean).join('\n');
        publicClass.learningOutcomes=teaching.learningOutcomes;
        publicClass.resources=teaching.resources;
        if(teaching.introduction)publicClass.introduction=teaching.introduction;
      }
      const available=row.seats!==null&&publicClass.classSize?publicClass.classSize.maximum-Number(row.seats):NaN;
      const availability=Number.isFinite(available)?available<=0?'full':available<=3?'limited':'available':undefined;
      return { ...publicClass, opened: Number(row.opened) === 1, availability };
    });
}

// Match the catalog's public visibility rules without counting seats for a Chat reference.
export async function readPublicEnrollmentClassReference(c: Parameters<Parameters<typeof tx>[0]>[0], classId: string) {
  const row = (await c.query(`
    SELECT e.data
    FROM enrollment_classes e JOIN crm_courses c ON c.id=e.course_id
    WHERE e.id=:p1 AND e.state='published' AND ${classRecruitmentOpen('e.')}
      AND LEAST(e.enrollment_closes_at, ${classOpeningMidnight('e.')})>UTC_TIMESTAMP(6)
      AND JSON_EXTRACT(c.value,'$.active')=true
  `, [classId])).rows[0] as {data: EnrollmentClassConfig} | undefined;
  if (!row) return null;
  const {level, period, format, batchNumber} = row.data;
  return {level, period, format, batchNumber};
}

export async function readPublicEnrollmentAppointments(c: Parameters<Parameters<typeof tx>[0]>[0], appointmentId?:string) {
  const {rows}=await c.query(`
    SELECT t.value AS template, c.value AS course
    FROM portal_settings t JOIN crm_courses c ON c.id=t.value->>'$.courseId'
      AND CAST(c.id AS BINARY)=CAST(t.value->>'$.courseId' AS BINARY)
    WHERE t.id LIKE :p1 AND JSON_TYPE(t.value->'$.courseId')='STRING'
      AND CAST(t.value->>'$.format' AS BINARY)='one-on-one'
      AND (:p2 IS NULL OR t.id=:p2)
    ORDER BY t.id
  `,[enrollmentTemplateIdPattern,appointmentId ? enrollmentTemplateKey(appointmentId) : null]);
  return rows.flatMap(({template,course})=>{
    if(!template.saleUnitPrice||!template.standardUnitPrice||!course?.active||!course.teaching)return [];
    return [{id:template.id,level:course.teaching.level,course:course.name,teacherType:template.teacherType,
      lessons:course.sessions,minutes:course.teaching.minutes,price:template.saleUnitPrice,standardPrice:template.standardUnitPrice,
      ...(appointmentId && {introduction:course.teaching.introduction,material:course.teaching.material})}];
  });
}

export function mountEnrollmentCatalog(app: Express, { wrap, staff }: {
  wrap: (fn: (q: Request, r: Response) => Promise<unknown>) => (q: Request, r: Response) => void;
  staff: (q: Request, permission: string) => Promise<{ id: string }>;
}) {
  mountEnrollmentTemplates(app,{wrap,staff});
  app.get(path, wrap(async (q, r) => {
    const actor = await staff(q, academicManagePermission);
    const data = await tx(async c => {
      const classes = (await readClasses(c,null))
        .map(row=>({...record(row),opened:Number(row.opened)===1,canDelete:Number(row.canDelete)===1,hasOrders:Number(row.hasOrders)===1}));
      const courses = (await c.query('SELECT id,value FROM crm_courses ORDER BY id')).rows.map((row: any) => ({
        id: row.id, name: row.value.name, active: row.value.active === true, sessions:row.value.sessions, teaching:row.value.teaching,
      }));
      return {templates:await listEnrollmentTemplates(c),classes,courses,teachers:await listFacultyChoices(c)};
    });
    r.set('Cache-Control', 'no-store').json({ ...data, actorId: actor.id });
  }));
  app.post(path, wrap(async (q, r) => {
    const actor = await staff(q, academicManagePermission);
    if (!validMutationOrigin(q)) invalid('enrollment_origin_rejected', 403);
    const body = q.body;
    if (typeof body?.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(body.id) ||
      !Number.isSafeInteger(body.revision) || body.revision < 0 ||
      !['draft', 'published'].includes(body.state)) invalid('enrollment_class_invalid');
    if(!body.config||typeof body.config!=='object')invalid('enrollment_class_invalid');
    const result = await tx(c => operation(c, actor.id, body, {
      leadId: 'class:' + body.id, kind, authorize: () => staff(q, academicManagePermission),
    }, async () => {
      // Serialize catalog writes before locking class rows, including new-row gap locks.
      // The counter and class publication commit or roll back together.
      await c.query("INSERT INTO portal_settings(id,value) VALUES('enrollment_batch_lock',JSON_OBJECT()) ON DUPLICATE KEY UPDATE id=id");
      await c.query("SELECT value FROM portal_settings WHERE id='enrollment_batch_lock' FOR UPDATE");
      const current = (await c.query('SELECT revision,state,data FROM enrollment_classes WHERE id=:p1 FOR UPDATE', [body.id])).rows[0];
      if ((current?.revision ?? 0) !== body.revision) invalid('enrollment_class_conflict', 409);
      if(current?.state==='cancelled') invalid('enrollment_class_conflict',409);
      const isPublished=current?.state==='published';
      const isDraft=body.state==='draft';
      const raw=body.config;
      const scheduleReview=raw.scheduleReview ?? current?.data.scheduleReview ?? {};
      if(typeof scheduleReview!=='object'||Array.isArray(scheduleReview)||
        Object.entries(scheduleReview).some(([key,note])=>!enrollmentScheduleReviewFields.some(field=>field===key)||
          typeof note!=='string'||!note.trim()||note.length>1000)) invalid('enrollment_class_invalid');
      if(!isDraft&&Object.keys(scheduleReview).length)invalid('enrollment_class_schedule_review_pending',409);
      if(raw.holidayDates!==undefined&&(!Array.isArray(raw.holidayDates)||!raw.holidayDates.every(validEnrollmentHolidayDate)))
        invalid('enrollment_class_invalid');
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
      if(isPublished&&raw.period!==current.data.period)invalid('enrollment_class_batch_scope_fixed',409);
      const savedTimeZone=current?.data.timeZone??enrollmentTimeZone;
      const timeZone=raw.timeZone===undefined?savedTimeZone:raw.timeZone;
      if(!isEnrollmentClassTimeZone(timeZone))invalid('enrollment_class_invalid');
      if(isPublished&&timeZone!==savedTimeZone)invalid('enrollment_class_timezone_fixed',409);
      const dates={timeZone,firstLesson:raw.firstLesson,enrollmentCloses:raw.enrollmentCloses,
        enrollmentClosesMode:raw.enrollmentClosesMode??current?.data.enrollmentClosesMode,period:raw.period,schedule:raw.schedule};
      const teacherId=raw.teacherId===undefined?current?.data.teacherId:raw.teacherId;
      const existing=current?.data as EnrollmentClassConfig|undefined;
      if(isPublished&&existing?.teacherId&&teacherId!==existing.teacherId&&(enrollmentInstant(existing.firstLesson,existing.timeZone)?.getTime()??Infinity)<=Date.now())
        invalid('faculty_assignment_fixed',409);
      const config={...(isPublished?{...current.data,...dates}:snapshot?{...snapshot,...dates}:{...raw,timeZone}),teacher:existing?.teacher??''};
      const selection=await classFaculty(c,teacherId,config.teacherType,isPublished,existing);
      if(!selection&&!isDraft&&!isPublished)invalid('faculty_required');
      if(selection)config.teacher=selection.teacher;
      else if(existing?.teacherId||raw.teacherId==='')config.teacher='';
      const weeklySchedule=raw.weeklySchedule;
      if(weeklySchedule){
        config.schedule=enrollmentWeeklyScheduleText(weeklySchedule,config.minutes,'zh',timeZone);
        if(!isDraft&&!config.schedule)invalid('enrollment_class_invalid');
        config.weeklySchedule=weeklySchedule;
      }else if(snapshot||current?.data?.weeklySchedule){
        invalid('enrollment_class_invalid');
      }
      const data:EnrollmentClassConfig={...validateEnrollmentClass(config,isDraft),
        ...(selection?{teacherId:selection.teacherId}:{}),
        ...(current?.data.decisionAt!==undefined?{decisionAt:current.data.decisionAt}:{}),
        ...(isDraft&&Object.keys(scheduleReview).length?{scheduleReview}:{}),
        ...(weeklySchedule?{weeklySchedule:{days:[...new Set<number>(weeklySchedule.days)].sort((a:any,b:any)=>a-b),start:weeklySchedule.start,lessons:weeklySchedule.lessons,
          ...(weeklySchedule.startByDay!==undefined?{startByDay:weeklySchedule.startByDay}:{})}}:{}),
        ...(config.templateId?{templateId:config.templateId,templateRevision:config.templateRevision,teacherType:config.teacherType,courseName:config.courseName}:{})};
      const holidayDates=raw.holidayDates===undefined?undefined:[...new Set<string>(raw.holidayDates)].sort();
      const breakDatesChanged=holidayDates!==undefined&&!isDeepStrictEqual(holidayDates,current?.data.holidayDates??[]);
      if(isPublished&&breakDatesChanged){
        // Order creation takes the same class row lock before reserving a seat.
        const orders=await c.query('SELECT id FROM enrollment_orders WHERE class_id=:p1 LIMIT 1 FOR UPDATE',[body.id]);
        if(orders.rows.length)invalid('enrollment_class_break_preview_only',409);
      }
      if(holidayDates!==undefined&&(!isPublished||breakDatesChanged)) data.holidayDates=holidayDates;
      else if(current?.data.holidayDates!==undefined) data.holidayDates=current.data.holidayDates;
      if(body.state==='published'&&data.holidayDates?.includes(data.firstLesson.slice(0,10)))
        invalid('enrollment_class_first_session_on_break',409);

      // Ignore client-supplied numbers. Drafts never consume a number.
      if(current?.data.batchNumber)data.batchNumber=current.data.batchNumber;
      if(body.state==='published'&&!data.batchNumber){
        if(!data.templateId)invalid('enrollment_template_required');
        const key='enrollment_batch:'+createHash('sha256').update(JSON.stringify([data.templateId,data.period])).digest('hex');
        await c.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE id=id',[key,{last:0}]);
        const counter=(await c.query('SELECT value FROM portal_settings WHERE id=:p1 FOR UPDATE',[key])).rows[0].value;
        if(!Number.isSafeInteger(counter.last)||counter.last<0||counter.last>=Number.MAX_SAFE_INTEGER)invalid('enrollment_class_invalid');
        data.batchNumber=counter.last+1;
        await c.query('UPDATE portal_settings SET value=:p2 WHERE id=:p1',[key,{...counter,last:data.batchNumber}]);
      }
      const revision = body.revision + 1;
      const fields = [data.courseId, revision, body.state, enrollmentInstant(data.firstLesson,data.timeZone), enrollmentInstant(data.enrollmentCloses,data.timeZone),
        current?.data.recruitmentPausedAt?{...data,recruitmentPausedAt:current.data.recruitmentPausedAt}:data];
      if (current) {
        await c.query('UPDATE enrollment_classes SET course_id=:p1,revision=:p2,state=:p3,first_lesson_at=:p4,enrollment_closes_at=:p5,data=:p6,updated_at=UTC_TIMESTAMP(6) WHERE id=:p7', [...fields, body.id]);
      } else {
        await c.query('INSERT INTO enrollment_classes (course_id,revision,state,first_lesson_at,enrollment_closes_at,data,id,updated_at) VALUES (:p1,:p2,:p3,:p4,:p5,:p6,:p7,UTC_TIMESTAMP(6))', [...fields, body.id]);
      }
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.class.save',:p2)",
        [actor.id, { classId: body.id, state: body.state, revision }]);
      const breakDatesOnly=isPublished&&breakDatesChanged&&data.firstLesson===current.data.firstLesson&&
        data.enrollmentCloses===current.data.enrollmentCloses;
      if (body.state === 'published' && !breakDatesOnly && enrollmentServicePolicy(process.env,(await enrollmentMailDelivery(c)).mode).maintenance) await matchPublishedEnrollmentClass(c,body.id);
      return { classId: body.id, revision };
    }));
    r.json(result);
  }));
  app.post(path + '/delete', wrap(async (q, r) => {
    const actor = await staff(q, academicManagePermission);
    if (!validMutationOrigin(q)) invalid('enrollment_origin_rejected', 403);
    const body = q.body;
    const {id,revision} = body ?? {};
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(id) ||
      !Number.isSafeInteger(revision) || revision < 1) invalid('enrollment_class_invalid');
    const result = await tx(c => operation(c, actor.id, body, {
      leadId:'class:'+id, kind:deleteKind, authorize:()=>staff(q,academicManagePermission),
    }, async () => {
      // Publication and enrollment writers must acquire this same class row lock.
      const current = (await c.query('SELECT revision FROM enrollment_classes WHERE id=:p1 FOR UPDATE',[id])).rows[0];
      if (current?.revision !== revision) invalid('enrollment_class_conflict',409);
      const [row] = await readClasses(c,id);
      if (Number(row?.canDelete) !== 1) invalid('enrollment_class_cannot_delete',409);
      await c.query('DELETE FROM enrollment_classes WHERE id=:p1',[id]);
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.class.delete',:p2)",
        [actor.id,{classId:id,revision}]);
      return {classId:id};
    }),{isolation:'READ COMMITTED'});
    r.json(result);
  }));
  app.get(path + '/results/:requestId', wrap(async (q, r) => {
    const actor = await staff(q, academicManagePermission);
    const result = await tx(async c => (await c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',
      [actor.id, q.params.requestId])).rows[0]?.result);
    if (![kind,deleteKind].includes(result?.operationKind)) invalid('enrollment_result_missing', 404);
    r.set('Cache-Control', 'no-store').json(result);
  }));
  app.get('/api/enrollment/classes', wrap(async (q, r) => {
    const requested=q.query.classId;
    const appointmentId=q.query.appointmentId;
    if(appointmentId!==undefined){
      if(requested!==undefined||typeof appointmentId!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(appointmentId))
        invalid('enrollment_template_invalid');
      const appointments=await readPublicEnrollmentAppointments(pool,appointmentId);
      r.set('Cache-Control','no-store').json({classes:[],appointments,publicOrigin:portalPublicOrigin()});
      return;
    }
    if(requested!==undefined){
      const classIds=Array.isArray(requested)?requested:[requested];
      if(classIds.length===0||classIds.length>enrollmentClassLookupLimit||
        !classIds.every((id):id is string=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(id))) {
        invalid('enrollment_class_invalid');
      }
      const classes=await readPublicEnrollmentClasses(pool,{
        classIds:[...new Set(classIds)],includeAvailability:q.query.availability!=='0',
      });
      r.set('Cache-Control','no-store').json({classes,appointments:[],publicOrigin:portalPublicOrigin()});
      return;
    }
    const summaryOnly=q.query.view==='summary';
    const {classes,appointments}=await tx(async c=>({
      classes:await readPublicEnrollmentClasses(c,{summaryOnly}),
      appointments:await readPublicEnrollmentAppointments(c),
    }));
    const catalog=summaryOnly
      ? classes.map(({learningOutcomes,material,resources,teacher,introduction,...card})=>card)
      : classes;
    r.set('Cache-Control', 'no-store').json({classes:catalog,appointments,publicOrigin:portalPublicOrigin()});
  }));
}
