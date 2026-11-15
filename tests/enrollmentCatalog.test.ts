import assert from 'node:assert/strict';
import test from 'node:test';
import { enrollmentInstant, publicEnrollmentClass, validateEnrollmentClass } from '../src/utils/enrollmentCatalog';

const sample = {
  courseId: 'hsk1', level: 'HSK 1', format: 'standard', period: 'weekend',
  firstLesson: '2026-12-19T15:00', decisionAt: '2026-12-17T17:00', enrollmentCloses: '2026-12-19T00:00',
  schedule: 'Saturday and Sunday, 15:00–15:45 WIB', sessions: 23, minutes: 45, minimumPaid: 13, capacity: 20,
  price: 575000, standardPrice: null, learningOutcomes: 'Introduction and greetings',
  material: 'Sample materials', resources: 'Sample practice', teacher: 'Sample teacher',
};

test('the first class uses WIB with an explicit cutoff and decision time', () => {
  const config = validateEnrollmentClass(sample);
  assert.deepEqual(config, sample);
  assert.equal(enrollmentInstant(config.firstLesson)?.toISOString(), '2026-12-19T08:00:00.000Z');
  for (const change of [
    { firstLesson: '2026-02-30T15:00' }, { enrollmentCloses: '2026-12-20T00:00' },
    { decisionAt: '2026-12-20T00:00' }, { minimumPaid: 21 }, { price: 575000.5 }, { format: 'one-on-one' },
    { standardPrice: 575000 },
  ]) {
    assert.throws(() => validateEnrollmentClass({ ...sample, ...change }), /enrollment_class_invalid/);
  }
});

test('only public class fields are returned to visitors', () => {
  const admin = { ...validateEnrollmentClass(sample), id: 'sample-hsk1', revision: 2, state: 'published' as const };
  const view = publicEnrollmentClass(admin);
  assert.equal(view.id, admin.id);
  assert.equal(view.price, 575000);
  for (const key of ['capacity', 'minimumPaid', 'courseId', 'revision', 'state', 'enrollmentCloses']) {
    assert.equal(Object.hasOwn(view, key), false);
  }
});
