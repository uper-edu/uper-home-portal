import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {test} from 'node:test';

const databaseHook = registerHooks({
  load(url,context,next) {
    if (!url.endsWith('/cloud/mysql/runtime.mjs')) return next(url,context);
    return {shortCircuit:true,format:'module',source:`
      const unexpected = () => { throw Error('Payment credits test attempted to open a database'); };
      export const nativePool={},pool={},initialize=unexpected,connection=unexpected,tx=unexpected,event=unexpected,id=unexpected;
    `};
  },
});
const {applyEnrollmentPaymentCredits} = await import('../server/portal/enrollmentPaymentCredits.ts');
databaseHook.deregister();

const cohort = {id:'fixture-class',state:'published',data:{level:'HSK 1',minimumPaid:3}};
const learner = {name:'Test Learner',phone:'+628123456789'};
const expired = {
  id:'past-order',email:'learner@example.test',data:learner,state:'expired',received:160,price:300,
  created_at:'2026-10-01 01:00:00.000000',
};
const current = {
  ...expired,id:'new-order',state:'proof_review',received:20,
  created_at:'2026-10-02 01:00:00.000000',
};

type Order = typeof current;
function creditFixture(related: Order[], target = current) {
  const locks: string[] = [];
  const allocations: unknown[] = [];
  const adjustments: unknown[] = [];
  const db = {
    async query(sql: string, args: unknown[] = []) {
      if (sql.startsWith('SELECT GET_LOCK')) return {rows:[{acquired:true}]};
      if (sql.includes('FROM enrollment_customer_records root')) {
        assert.deepEqual(args.slice(1),[current.email,cohort.data.level]);
        return {rows:related};
      }
      if (sql.includes('AS available FROM enrollment_receipts')) {
        assert.deepEqual(args,[expired.id]);
        return {rows:[{reference:'receipt-a',available:100},{reference:'receipt-b',available:90}]};
      }
      if (sql.startsWith('INSERT INTO enrollment_payment_credits')) allocations.push(args.slice(1));
      else if (sql.startsWith('UPDATE enrollment_orders')) adjustments.push(args);
      else if (sql.startsWith('SELECT COUNT(*)')) return {rows:[{count:0}]};
      else if (!sql.startsWith('SELECT opened_at FROM enrollment_class_openings')) assert.fail(sql);
      return {rows:[]};
    },
  };
  async function lockOrder(_db: typeof db, id: string) {
    locks.push(id);
    assert.ok([expired.id,target.id].includes(id));
    return {order:id===expired.id?expired:target,cohort};
  }
  return {db,lockOrder,locks,allocations,adjustments};
}

test('bank receipts credit the only later same-learner order in either arrival order', async () => {
  const sharedEmail = {...current,id:'different-learner',data:{...learner,name:'Another Learner'}};
  for (const trigger of [expired,current]) {
    const fixture = creditFixture([expired,current,sharedEmail]);
    await applyEnrollmentPaymentCredits(fixture.db,{order:trigger,cohort},fixture.lockOrder);
    assert.deepEqual(fixture.locks,trigger===expired?[current.id]:[expired.id,current.id]);
    assert.deepEqual(fixture.allocations,[
      ['receipt-a',expired.id,current.id,100],
      ['receipt-b',expired.id,current.id,60],
    ]);
    assert.deepEqual(fixture.adjustments,[
      [160,{...learner,creditOut:160},expired.id],
      [180,'partial',{...learner,creditIn:160},current.id],
    ]);
  }
});

test('ambiguous later orders and a target no longer payable under the lock receive no funds', async () => {
  const ambiguous=creditFixture([expired,current,{...current,id:'third-order'}]);
  await applyEnrollmentPaymentCredits(ambiguous.db,{order:expired,cohort},ambiguous.lockOrder);
  assert.deepEqual(ambiguous.locks,[]);
  assert.deepEqual(ambiguous.allocations,[]);
  assert.deepEqual(ambiguous.adjustments,[]);

  const changed=creditFixture([expired,current],{...current,state:'cancelled'});
  await applyEnrollmentPaymentCredits(changed.db,{order:expired,cohort},changed.lockOrder);
  assert.deepEqual(changed.locks,[current.id]);
  assert.deepEqual(changed.allocations,[]);
  assert.deepEqual(changed.adjustments,[]);
});
