import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  courseCatalogueInstruction,
  escapeControlCharsInJsonStrings,
  formatConsultationHistory,
  isRecoverableConsultationError,
  managedEnrollmentCatalogueSelection,
  parseConsultationJson,
  parseConsultationReply,
  renderConsultationReply,
} from '../server/portal/coursePrices.ts';
import { chatConsultationCore } from '../server/portal/chatConsultationKnowledge.ts';
import { enrollmentConsultationPolicy } from '../server/portal/enrollmentConsultationPolicy.ts';

const legacyBook = {
  courses: [
    { id: 'HSK 1', sessions: 23, total: 1150000 },
    { id: 'HSK 2', sessions: 24, total: 1200000 },
    { id: 'HSK 5A', sessions: 55, total: 2750000 },
    { id: 'HSK 5B', sessions: 55, total: 2750000 },
  ],
};

const managedBook = {
  courses: [
    { id: 'HSK 1 · 新概念汉语 · 23 × 45 min', sessions: 23, total: 1150000, enrollmentLevel: 'HSK 1' },
    { id: 'Winter Study Tour Beijing', sessions: 10, total: 15000000 },
  ],
};

test('escapeControlCharsInJsonStrings, parseConsultationJson, and parseConsultationReply recover raw control chars and fences while enforcing price guards', () => {
  const withRawNewlines = '{"replyLanguage":"zh","enrollment":null,"catalogue":null,"reply":"第一行\n第二行\t制表\r回车"}';
  const escaped = escapeControlCharsInJsonStrings(withRawNewlines);
  assert.deepEqual(JSON.parse(escaped), {
    replyLanguage: 'zh',
    enrollment: null,
    catalogue: null,
    reply: '第一行\n第二行\t制表\r回车',
  });

  const fenced = '```json\n{"replyLanguage":"en",\n"enrollment":null,"catalogue":null,"reply":"Line 1\nLine 2 \\"quoted\\""}\n```';
  assert.deepEqual(parseConsultationJson(fenced), {
    replyLanguage: 'en',
    enrollment: null,
    catalogue: null,
    reply: 'Line 1\nLine 2 "quoted"',
  });

  for (const empty of ['', '   ', ' \n\t  ']) {
    assert.throws(() => parseConsultationJson(empty), /Empty provider response/);
  }
  assert.throws(() => parseConsultationJson('not json at all'), SyntaxError);

  assert.throws(() => parseConsultationReply('{"reply":"Rp 99,999"}'), /Invalid catalogue selection/);
  assert.deepEqual(
    parseConsultationReply('{"replyLanguage":"zh","enrollment":{"kind":"quote","level":"HSK 1"},"reply":""}'),
    { replyLanguage: 'zh', enrollment: { kind: 'quote', level: 'HSK 1' }, catalogue: null, reply: '' },
  );
  assert.deepEqual(
    renderConsultationReply(
      JSON.stringify({ replyLanguage: 'en', catalogue: { courses: ['HSK 1'], detail: 'price' }, reply: '' }),
      legacyBook,
      'en',
    ),
    { reply: 'Published courses\n\n- HSK 1 · 23 sessions · course total Rp 1,150,000', catalogueUsed: true },
  );
});

test('formatConsultationHistory emits valid JSON assistant turns for enrollment-managed conversations and merges consecutive user turns', () => {
  const formatted = formatConsultationHistory(
    [
      { role: 'user', content: '我想找 HSK 1 周末标准班，周六下午有空。' },
      {
        role: 'assistant',
        content: '按你给出的条件，可以先看 HSK 1 · 标准班 · 周末班。',
        metadata: {
          replyLanguage: 'zh',
          enrollment: {
            kind: 'class',
            level: 'HSK 1',
            format: 'standard',
            period: 'weekend',
            replyLanguage: 'zh',
            rows: [{ id: 'cls-1', price: 920000 }],
          },
        },
      },
      { role: 'user', content: '第一个班什么时候开课？' },
      {
        role: 'assistant',
        content: '**HSK 1 · 标准班 · 周末班 · 第 1 期**，首课 2026-12-19 15:00 WIB。',
        metadata: JSON.stringify({
          enrollment: {
            kind: 'class',
            inspection: true,
            detailFields: ['first'],
            replyLanguage: 'zh',
            rows: [{ id: 'cls-1', price: 920000 }],
          },
        }),
      },
      { role: 'user', content: '我要不要给另一个账号再付？' },
      { role: 'user', content: '我怎么证明我已付？' },
    ],
    { enrollmentManaged: true },
  );

  assert.equal(formatted.length, 5);
  assert.equal(formatted[1].role, 'assistant');
  assert.deepEqual(JSON.parse(formatted[1].content), {
    replyLanguage: 'zh',
    enrollment: { kind: 'recommend', level: 'HSK 1', format: 'standard', period: 'weekend' },
    catalogue: null,
    reply: '按你给出的条件，可以先看 HSK 1 · 标准班 · 周末班。',
  });
  assert.equal(formatted[3].role, 'assistant');
  assert.deepEqual(JSON.parse(formatted[3].content), {
    replyLanguage: 'zh',
    enrollment: { kind: 'inspect', fields: ['first'], referenceIds: ['cls-1'] },
    catalogue: null,
    reply: '**HSK 1 · 标准班 · 周末班 · 第 1 期**，首课 2026-12-19 15:00 WIB。',
  });
  assert.equal(formatted[4].role, 'user');
  assert.match(formatted[4].content, /Earlier learner message\(s\) whose reply did not complete/);
  assert.match(formatted[4].content, /我要不要给另一个账号再付？/);
  assert.match(formatted[4].content, /\[Latest learner message\]\n我怎么证明我已付？/);
});

test('formatConsultationHistory maps waitlists/catalog/unavailable safely and merges consecutive assistant turns', () => {
  const formatted = formatConsultationHistory(
    [
      {
        role: 'assistant',
        content: '建议先从 HSK 1 开始。',
        metadata: {
          replyLanguage: 'zh',
          enrollment: { kind: 'catalog', level: 'HSK 1', question: 'starting_point' },
        },
      },
      {
        role: 'assistant',
        content: '暂无可核实班次。',
        metadata: {
          enrollment: { kind: 'unavailable' },
        },
      },
      { role: 'user', content: '那能查我的订单吗？' },
    ],
    { enrollmentManaged: true },
  );

  assert.equal(formatted.length, 2);
  assert.deepEqual(JSON.parse(formatted[0].content), {
    replyLanguage: 'zh',
    enrollment: { kind: 'browse', level: 'HSK 1', question: 'starting_point' },
    catalogue: null,
    reply: '建议先从 HSK 1 开始。\n\n暂无可核实班次。',
  });

  const legacyFormatted = formatConsultationHistory([
    {
      role: 'assistant',
      content: 'Published courses\n\n- HSK 1 · 23 sessions',
      metadata: { replyLang: 'en', catalogueSelection: { courses: ['HSK 1'], detail: 'price' } },
    },
    { role: 'assistant', content: 'Which start date works for you?', metadata: { replyLanguage: 'en' } },
  ]);
  assert.equal(legacyFormatted.length, 2);
  assert.deepEqual(JSON.parse(legacyFormatted[0].content), {
    replyLanguage: 'en',
    catalogue: { courses: ['HSK 1'], detail: 'price' },
    reply: '',
  });
  assert.deepEqual(JSON.parse(legacyFormatted[1].content), {
    replyLanguage: 'en',
    catalogue: null,
    reply: 'Which start date works for you?',
  });
});

test('isRecoverableConsultationError distinguishes schema/blank failures from transport and truncation errors', () => {
  for (const err of [
    new SyntaxError('Unexpected end of JSON input'),
    Error('Empty provider response'),
    Error('Invalid consultation response'),
    Error('Empty consultation reply'),
    Error('Invalid catalogue selection'),
    Error('Invalid catalogue courses'),
  ]) {
    assert.equal(isRecoverableConsultationError(err), true);
  }

  for (const err of [
    Error('Provider HTTP 500'),
    Error('Provider stream error'),
    Error('Answer truncated'),
    Error('Incomplete answer'),
    new TypeError('fetch failed'),
    'string error',
  ]) {
    assert.equal(isRecoverableConsultationError(err), false);
  }
});

test('enrollment-managed JSON instruction puts structured keys before reply and excludes Enrollment Mandarin from legacy catalogue', async () => {
  const instruction = courseCatalogueInstruction(managedBook, true);
  assert.match(instruction, /"replyLanguage", "enrollment", "catalogue"/);
  assert.match(instruction, /"replyLanguage":"zh","enrollment":null,"catalogue":null/);
  assert.match(instruction, /"replyLanguage":"id","enrollment":\{"kind":"quote","question":"group_overview"/);
  assert.doesNotMatch(instruction, /新概念汉语/);
  assert.match(instruction, /Winter Study Tour Beijing/);
  assert.deepEqual(managedEnrollmentCatalogueSelection({ courses: ['HSK 1'], detail: 'price' }, managedBook), {
    kind: 'quote',
    levels: ['HSK 1'],
  });
  assert.match(chatConsultationCore, /from Enrollment/);
  assert.match(enrollmentConsultationPolicy, /Enrollment policy facts/);

  const settings = {
    MYSQL_TRIAL_URL: 'mysql://unused:unused@127.0.0.1/uper_trial_unit',
    TRIAL_DATASET: 'synthetic',
    PORTAL_ENV: 'dev',
    PORTAL_DEPLOYMENT: '',
  };
  const original = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  try {
    const { chatEnrollmentInstruction } = await import('../server/portal/chatEnrollment.ts');
    assert.match(chatEnrollmentInstruction, /"enrollment"/);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
