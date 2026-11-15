import type { Express, Request, Response } from 'express';
import { tx } from './store.ts';
import { invalid, operation } from './trustWorkflow.ts';
import { validMutationOrigin } from './accessTransport.ts';
import { enrollmentInstant, publicEnrollmentClass, validateEnrollmentClass } from '../../src/utils/enrollmentCatalog.ts';
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
  app.get(path, wrap(async (q, r) => {
    const actor = await staff(q, 'crm.operations.manage');
    const data = await tx(async c => {
      const classes = (await c.query('SELECT id,revision,state,data FROM enrollment_classes ORDER BY first_lesson_at,id')).rows.map(record);
      const courses = (await c.query('SELECT id,value FROM crm_courses ORDER BY id')).rows.map((row: any) => ({
        id: row.id, name: row.value.name, active: row.value.active === true,
      }));
      return { classes, courses };
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
    const data = validateEnrollmentClass(body.config);
    const result = await tx(c => operation(c, actor.id, body, {
      leadId: 'class:' + body.id, kind, authorize: () => staff(q, 'crm.operations.manage'),
    }, async () => {
      const current = (await c.query('SELECT revision FROM enrollment_classes WHERE id=:p1 FOR UPDATE', [body.id])).rows[0];
      if ((current?.revision ?? 0) !== body.revision) invalid('enrollment_class_conflict', 409);
      const course = (await c.query('SELECT value FROM crm_courses WHERE id=:p1 FOR SHARE', [data.courseId])).rows[0];
      if (!course || (body.state === 'published' && course.value.active !== true)) invalid('enrollment_course_unavailable', 409);
      const revision = body.revision + 1;
      const fields = [data.courseId, revision, body.state, enrollmentInstant(data.firstLesson), enrollmentInstant(data.enrollmentCloses), data];
      if (current) {
        await c.query('UPDATE enrollment_classes SET course_id=:p1,revision=:p2,state=:p3,first_lesson_at=:p4,enrollment_closes_at=:p5,data=:p6,updated_at=UTC_TIMESTAMP(6) WHERE id=:p7', [...fields, body.id]);
      } else {
        await c.query('INSERT INTO enrollment_classes (course_id,revision,state,first_lesson_at,enrollment_closes_at,data,id,updated_at) VALUES (:p1,:p2,:p3,:p4,:p5,:p6,:p7,UTC_TIMESTAMP(6))', [...fields, body.id]);
      }
      await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'enrollment.class.save',:p2)",
        [actor.id, { classId: body.id, state: body.state, revision }]);
      return { classId: body.id, revision };
    }));
    r.json(result);
  }));
  app.get(path + '/results/:requestId', wrap(async (q, r) => {
    const actor = await staff(q, 'crm.operations.manage');
    const result = await tx(async c => (await c.query('SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2',
      [actor.id, q.params.requestId])).rows[0]?.result);
    if (result?.operationKind !== kind) invalid('enrollment_result_missing', 404);
    r.set('Cache-Control', 'no-store').json(result);
  }));
  app.get('/api/enrollment/classes', wrap(async (_q, r) => {
    const classes = await tx(async c => (await c.query(`
      SELECT e.id,e.revision,e.state,e.data,(g.class_id IS NOT NULL) AS opened FROM enrollment_classes e
      JOIN crm_courses c ON c.id=e.course_id
      LEFT JOIN enrollment_class_openings g ON g.class_id=e.id
      WHERE e.state='published' AND e.enrollment_closes_at>UTC_TIMESTAMP(6)
        AND JSON_EXTRACT(c.value,'$.active')=true
      ORDER BY e.first_lesson_at,e.id
    `)).rows.map((row: Parameters<typeof record>[0] & { opened: number }) => ({ ...publicEnrollmentClass(record(row)), opened: Number(row.opened) === 1 })));
    r.set('Cache-Control', 'no-store').json({ classes });
  }));
}
