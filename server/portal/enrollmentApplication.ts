import type { Express, Request, Response } from 'express';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { tx } from './store.ts';
import { invalid, operation } from './trustWorkflow.ts';
import { validMutationOrigin } from './accessTransport.ts';
import { validContactEmail } from '../../src/utils/contactEmail.ts';
import { permittedRecord, type AccessEmployee } from '../../src/utils/accessControl.ts';
import { enrollmentSimulation } from './enrollmentSimulation.ts';

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
  const row = (await c.query('SELECT email FROM enrollment_email_sessions WHERE digest=:p1 AND expires_at>UTC_TIMESTAMP(6)', [sha(token!)])).rows[0];
  if (!row) invalid('enrollment_verification_required', 401);
  return row.email;
}

async function lockClass(c: Client, classId: string) {
  const row = (await c.query(
    "SELECT id,course_id,state,data,enrollment_closes_at>UTC_TIMESTAMP(6) AS accepting FROM enrollment_classes WHERE id=:p1 FOR UPDATE",
    [classId])).rows[0];
  if (!row) invalid('enrollment_class_unavailable', 404);
  return row;
}

// The class lock serializes releases with all other seat and opening changes.
async function expireSeats(c: Client, classId: string) {
  await c.query(`UPDATE enrollment_orders SET state='expired',upload_id=NULL,upload_expires_at=NULL
    WHERE class_id=:p1 AND state='awaiting_payment' AND received=0 AND payment_due_at<UTC_TIMESTAMP(6)
      AND (upload_expires_at IS NULL OR upload_expires_at<UTC_TIMESTAMP(6))`, [classId]);
}

async function lockOrder(c: Client, id: string, email?: string) {
  const row = (await c.query('SELECT id,class_id,email FROM enrollment_orders WHERE id=:p1', [id])).rows[0];
  if (!row || (email && row.email !== email)) invalid('enrollment_order_not_found', 404);
  const cohort = await lockClass(c, row.class_id);
  await expireSeats(c, row.class_id);
  const order = (await c.query(`SELECT *,payment_due_at>=UTC_TIMESTAMP(6) AS before_due,
    upload_expires_at>=UTC_TIMESTAMP(6) AS upload_active FROM enrollment_orders WHERE id=:p1 FOR UPDATE`, [id])).rows[0];
  return { order, cohort };
}

function view(row: any) {
  return { id: row.id, classId: row.class_id, status: row.state === 'recovered' ? 'expired' : row.state,
    restored: row.state === 'recovered', price: row.price,
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
  staff: (q: Request, permission: string) => Promise<AccessEmployee>;
}) {
  const local = enrollmentSimulation();
  const base = '/api/enrollment';
  const finance = '/api/crm/enrollment/finance';
  app.get(base + '/availability', (_q, r) => r.set('Cache-Control', 'no-store').json({ accepting: !!local }));
  if (!local) return;

  const post = (path: string, handler: Route) => app.post(path, wrap(async (q, r) => {
    if (!validMutationOrigin(q)) invalid('enrollment_origin_rejected', 403);
    r.set('Cache-Control', 'no-store');
    return handler(q, r);
  }));
  const financeActor = async (q: Request) => {
    const actor = await staff(q, 'crm.payments.verify');
    // Orders have no CRM owner until the customer and opportunity integration is added.
    // Only existing all-record finance grants can act on unassigned orders.
    if (!permittedRecord(actor, {}, 'crm.read') || !permittedRecord(actor, {}, 'crm.payments.verify')) {
      invalid('enrollment_finance_forbidden', 403);
    }
    return actor;
  };

  post(base + '/email/request', async (q, r) => {
    const email = contact(q.body.email);
    const id = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await enrollTx(async (c: Client) => {
      await c.query(`INSERT INTO enrollment_email_challenges(email,challenge_id,digest,expires_at,resend_at)
        VALUES(:p1,:p2,:p3,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE email=email`, [email, id, otpHash(id, code)]);
      const row = (await c.query(`SELECT resend_at>UTC_TIMESTAMP(6) AS blocked,locked_until>UTC_TIMESTAMP(6) AS locked
        FROM enrollment_email_challenges WHERE email=:p1 FOR UPDATE`, [email])).rows[0];
      if (Number(row.blocked) || Number(row.locked)) invalid('enrollment_code_wait', 429);
      await c.query(`UPDATE enrollment_email_challenges SET challenge_id=:p1,digest=:p2,attempts=0,used=FALSE,locked_until=NULL,
        expires_at=UTC_TIMESTAMP(6)+INTERVAL 10 MINUTE,resend_at=UTC_TIMESTAMP(6)+INTERVAL 60 SECOND WHERE email=:p3`,
      [id, otpHash(id, code), email]);
      await local.deliver(id, email, code);
    });
    r.json({ challengeId: id });
  });

  post(base + '/email/verify', async (q, r) => {
    const email = contact(q.body.email);
    const { challengeId, code } = q.body;
    if (!uuid.test(challengeId) || typeof code !== 'string' || !/^\d{6}$/.test(code)) invalid('enrollment_invalid_code');
    const token = randomBytes(32).toString('hex');
    const verified = await enrollTx(async (c: Client) => {
      const row = (await c.query(`SELECT *,expires_at>UTC_TIMESTAMP(6) AS active,locked_until>UTC_TIMESTAMP(6) AS locked
        FROM enrollment_email_challenges WHERE email=:p1 FOR UPDATE`, [email])).rows[0];
      if (!row || row.challenge_id !== challengeId || !Number(row.active) || Number(row.used) || Number(row.locked)) return false;
      if (!timingSafeEqual(Buffer.from(otpHash(challengeId, code), 'hex'), Buffer.from(row.digest, 'hex'))) {
        await c.query(`UPDATE enrollment_email_challenges SET attempts=:p1,
          locked_until=IF(:p1>=5,UTC_TIMESTAMP(6)+INTERVAL 10 MINUTE,NULL) WHERE email=:p2`, [Number(row.attempts) + 1, email]);
        return false;
      }
      await c.query('UPDATE enrollment_email_challenges SET used=TRUE WHERE email=:p1', [email]);
      await c.query('INSERT INTO enrollment_email_sessions(digest,email,expires_at) VALUES(:p1,:p2,UTC_TIMESTAMP(6)+INTERVAL 24 HOUR)', [sha(token), email]);
      return true;
    });
    if (!verified) invalid('enrollment_invalid_code', 401);
    r.cookie(sessionCookie, token, { httpOnly: true, secure: q.secure, sameSite: 'strict', path: base, maxAge: 86_400_000 });
    r.json({ verified: true });
  });

  post(base + '/applications', async (q, r) => {
    const { classId, requestId, name, phone, priority } = q.body;
    if (typeof classId !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(classId) ||
        typeof requestId !== 'string' || !uuid.test(requestId) ||
        typeof name !== 'string' || name.trim().length < 1 || name.length > 120 ||
        typeof phone !== 'string' || !/^\+?[0-9 ()-]{7,26}$/.test(phone) || phone.replace(/\D/g,'').length < 7 ||
        typeof priority !== 'boolean') invalid('enrollment_invalid_application');
    const result = await enrollTx(async (c: Client) => {
      const email = await session(c, q);
      const fingerprint = sha(JSON.stringify([classId, name.trim(), phone.trim(), priority]));
      const cohort = await lockClass(c, classId);
      await expireSeats(c, classId);
      const existing = (await c.query('SELECT * FROM enrollment_orders WHERE email=:p1 AND request_id=:p2', [email, requestId])).rows[0];
      if (existing) {
        if (existing.fingerprint !== fingerprint) invalid('enrollment_request_conflict', 409);
        return view(existing);
      }
      const active = (await c.query("SELECT value FROM crm_courses WHERE id=:p1 FOR SHARE", [cohort.course_id])).rows[0]?.value.active;
      if (cohort.state !== 'published' || !Number(cohort.accepting) || active !== true) invalid('enrollment_class_unavailable', 409);
      const existingSeat = (await c.query("SELECT * FROM enrollment_orders WHERE class_id=:p1 AND email=:p2 AND state<>'expired' LIMIT 1", [classId,email])).rows[0];
      if (existingSeat) return view(existingSeat);
      const seats = (await c.query("SELECT COUNT(*) AS count FROM enrollment_orders WHERE class_id=:p1 AND state<>'expired'", [classId])).rows[0].count;
      if (Number(seats) >= cohort.data.capacity) invalid('enrollment_class_full', 409);
      const id = randomUUID();
      await c.query(`INSERT INTO enrollment_orders(id,class_id,email,request_id,fingerprint,state,price,payment_due_at,created_at,data)
        VALUES(:p1,:p2,:p3,:p4,:p5,'awaiting_payment',:p6,UTC_TIMESTAMP(6)+INTERVAL 24 HOUR,UTC_TIMESTAMP(6),:p7)`,
      [id,classId,email,requestId,fingerprint,cohort.data.price,{name:name.trim(),phone:phone.trim(),priority,bank:local.bank}]);
      return view((await c.query('SELECT * FROM enrollment_orders WHERE id=:p1', [id])).rows[0]);
    });
    r.json(result);
  });

  app.get(base + '/orders/:id', wrap(async (q, r) => {
    const result = await enrollTx(async (c: Client) => {
      const { order } = await lockOrder(c, String(q.params.id), await session(c, q));
      return { ...view(order), bank: order.state === 'awaiting_payment' || order.state === 'partial' ? order.data.bank : undefined };
    });
    r.set('Cache-Control', 'no-store').json(result);
  }));

  post(base + '/orders/:id/proofs/start', async (q, r) => {
    const uploadId = await enrollTx(async (c: Client) => {
      const { order } = await lockOrder(c, String(q.params.id), await session(c, q));
      if (order.state === 'paid' || order.state === 'recovered') invalid('enrollment_proof_not_available', 409);
      if (Number(order.upload_active)) return order.upload_id;
      const id = randomUUID();
      await c.query('UPDATE enrollment_orders SET upload_id=:p1,upload_expires_at=UTC_TIMESTAMP(6)+INTERVAL 5 MINUTE WHERE id=:p2', [id,order.id]);
      return id;
    });
    r.json({ uploadId });
  });

  post(base + '/orders/:id/proofs/finish', async (q, r) => {
    const { uploadId, mime, encoded } = q.body;
    if (typeof uploadId !== 'string' || !uuid.test(uploadId)) invalid('enrollment_invalid_proof');
    // End the current attempt on a rejected upload, so a later attempt uses a fresh server clock.
    const result = await enrollTx(async (c: Client) => {
      const { order } = await lockOrder(c, String(q.params.id), await session(c, q));
      const prior = (await c.query('SELECT order_id FROM enrollment_proofs WHERE id=:p1', [uploadId])).rows[0];
      if (prior?.order_id === order.id) return view(order);
      if (order.upload_id !== uploadId || !Number(order.upload_active) || order.state === 'paid' || order.state === 'recovered') {
        invalid('enrollment_upload_expired', 409);
      }
      let digest;
      try { digest = proofContent(encoded, mime); }
      catch {
        await c.query('UPDATE enrollment_orders SET upload_id=NULL,upload_expires_at=NULL WHERE id=:p1', [order.id]);
        await expireSeats(c, order.class_id);
        return null;
      }
      await c.query(`INSERT INTO enrollment_proofs(id,order_id,mime,digest,proof,created_at)
        VALUES(:p1,:p2,:p3,:p4,FROM_BASE64(:p5),UTC_TIMESTAMP(6))`, [uploadId,order.id,mime,digest,encoded]);
      const state = order.state === 'awaiting_payment' ? 'proof_review' : order.state;
      await c.query('UPDATE enrollment_orders SET state=:p1,upload_id=NULL,upload_expires_at=NULL WHERE id=:p2', [state,order.id]);
      return view({...order,state});
    });
    if (!result) invalid('enrollment_invalid_proof');
    r.json(result);
  });

  app.get(finance, wrap(async (q, r) => {
    await financeActor(q);
    const orders = await enrollTx(async (c: Client) => (await c.query(`SELECT o.*,
        EXISTS(SELECT 1 FROM enrollment_class_openings g WHERE g.class_id=o.class_id) AS opened,
        (SELECT p.id FROM enrollment_proofs p WHERE p.order_id=o.id ORDER BY p.created_at DESC LIMIT 1) AS proof_id
      FROM enrollment_orders o WHERE o.state IN ('proof_review','partial','paid','recovered')
        OR EXISTS(SELECT 1 FROM enrollment_proofs p WHERE p.order_id=o.id)
      ORDER BY o.created_at DESC LIMIT 150`)).rows.map(row => ({ ...view(row), name: row.data.name, opened: Number(row.opened) === 1, proofId: row.proof_id })));
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
    const { amount, reference, transferredAt, requestId } = q.body;
    const time = typeof transferredAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(transferredAt) ? new Date(transferredAt) : null;
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000 ||
        typeof reference !== 'string' || !reference.trim() || reference.length > 120 ||
        !time || !Number.isFinite(time.getTime()) || time.getTime() > Date.now() ||
        typeof requestId !== 'string' || !uuid.test(requestId)) invalid('enrollment_invalid_receipt');
    const id = String(q.params.id);
    const result = await enrollTx((c: Client) => operation(c, actor.id, q.body,
      { leadId: 'enrollment:' + id, kind: 'enrollment.receipt', authorize: () => financeActor(q) }, async () => {
      const { order, cohort } = await lockOrder(c, id);
      const ref = reference.trim().toUpperCase();
      try {
        await c.query(`INSERT INTO enrollment_receipts(reference,order_id,amount,actor,settled_at,created_at)
          VALUES(:p1,:p2,:p3,:p4,:p5,UTC_TIMESTAMP(6))`, [ref,id,amount,actor.id,time]);
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') invalid('enrollment_duplicate_receipt', 409);
        throw error;
      }
      const received = Number(order.received) + amount;
      const due = new Date(order.payment_due_at.replace(' ', 'T') + 'Z');
      const timely = (await c.query('SELECT COALESCE(SUM(amount),0) AS sum FROM enrollment_receipts WHERE order_id=:p1 AND settled_at<=:p2', [id,due])).rows[0].sum;
      const mayRestore = cohort.state === 'published' && Number(timely) >= order.price;
      const state = order.state === 'expired' || order.state === 'recovered'
        ? mayRestore || order.state === 'recovered' ? 'recovered' : 'expired'
        : received >= order.price ? 'paid' : 'partial';
      await c.query('UPDATE enrollment_orders SET received=:p1,state=:p2 WHERE id=:p3', [received,state,id]);
      const paid = Number((await c.query("SELECT COUNT(*) AS count FROM enrollment_orders WHERE class_id=:p1 AND state IN ('paid','recovered')", [cohort.id])).rows[0].count);
      if (cohort.state === 'published' && paid >= cohort.data.minimumPaid) {
        await c.query('INSERT INTO enrollment_class_openings(class_id,opened_at) VALUES(:p1,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE class_id=class_id', [cohort.id]);
      }
      const opened = (await c.query('SELECT opened_at FROM enrollment_class_openings WHERE class_id=:p1', [cohort.id])).rows[0];
      return { order: view({...order,state,received}), paidCount: paid, opened: !!opened };
    }));
    r.json(result);
  });
}
