import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  courseCatalogueInstruction,
  escapeControlCharsInJsonStrings,
  formatConsultationHistory,
  isRecoverableConsultationError,
  parseConsultationJson,
  renderConsultationReply,
  resolveConsultationReply,
} from '../server/portal/coursePrices.ts';
import { consultationFocus } from '../server/portal/consultationGuidance.ts';
import { getSystemInstruction } from '../src/data/knowledgeBase.ts';

const book = {
  courses: [
    { id: 'HSK 1', sessions: 23, total: 1150000 },
    { id: 'HSK 2', sessions: 24, total: 1200000 },
    { id: 'HSK 5A', sessions: 55, total: 2750000 },
    { id: 'HSK 5B', sessions: 55, total: 2750000 },
  ],
};

test('escapeControlCharsInJsonStrings and parseConsultationJson recover raw control chars and fences while rejecting blanks', () => {
  const withRawNewlines = '{"lang":"zh","catalogue":null,"reply":"第一行\n第二行\t制表\r回车\b退格"}';
  const escaped = escapeControlCharsInJsonStrings(withRawNewlines);
  assert.deepEqual(JSON.parse(escaped), {
    lang: 'zh',
    catalogue: null,
    reply: '第一行\n第二行\t制表\r回车\b退格',
  });

  const fenced = '```json\n{"lang":"en",\n"catalogue":null,"reply":"Line 1\nLine 2 \\"quoted\\""}\n```';
  assert.deepEqual(parseConsultationJson(fenced), {
    lang: 'en',
    catalogue: null,
    reply: 'Line 1\nLine 2 "quoted"',
  });

  for (const empty of ['', '   ', ' \n\t  ']) {
    assert.throws(() => parseConsultationJson(empty), /Empty provider response/);
  }
  assert.throws(() => parseConsultationJson('not json at all'), SyntaxError);
});

test('resolveConsultationReply and renderConsultationReply enforce catalogue schema and support lang override', () => {
  assert.throws(() => renderConsultationReply('{"reply":"Rp 99,999"}', book, 'zh'), /Invalid catalogue selection/);
  assert.throws(() => resolveConsultationReply('{"lang":"zh","reply":"Rp 99,999"}', book, 'zh'), /Invalid catalogue selection/);

  const rendered = renderConsultationReply(
    JSON.stringify({ lang: 'en', catalogue: { courses: ['HSK 1'], detail: 'price' }, reply: '' }),
    book,
    'zh',
  );
  assert.deepEqual(Object.keys(rendered).sort(), ['catalogueUsed', 'reply']);
  assert.equal(rendered.catalogueUsed, true);
  assert.match(rendered.reply, /Published courses[\s\S]*HSK 1 · 23 sessions · course total Rp 1,150,000/);

  const idOverride = resolveConsultationReply(
    JSON.stringify({ lang: 'id', catalogue: { courses: ['HSK 1', 'HSK 9'], detail: 'price', unavailable: true }, reply: '' }),
    book,
    'en',
  );
  assert.equal(idOverride.lang, 'id');
  assert.equal(idOverride.catalogueUsed, true);
  assert.deepEqual(idOverride.catalogue, { courses: ['HSK 1', 'HSK 9'], detail: 'price', unavailable: true });
  assert.match(idOverride.reply, /Kursus yang dipublikasikan[\s\S]*Rp 1\.150\.000[\s\S]*Informasi resmi untuk kursus yang ditanyakan belum tersedia/);

  const fallbackLang = resolveConsultationReply(
    JSON.stringify({ lang: 'fr', catalogue: null, reply: 'Silakan cek jadwal terlebih dahulu.' }),
    book,
    'id',
  );
  assert.equal(fallbackLang.lang, 'id');
  assert.equal(fallbackLang.catalogue, null);
  assert.equal(fallbackLang.catalogueUsed, false);
});

test('formatConsultationHistory emits valid JSON assistant turns and merges consecutive user or non-catalogue assistant turns', () => {
  const formatted = formatConsultationHistory([
    { role: 'user', content: 'HSK 1 多少钱？' },
    {
      role: 'assistant',
      content: '目前已发布的课程\n\n- HSK 1 · 23 节课，课程总价 Rp 1,150,000',
      metadata: { replyLang: 'zh', catalogueSelection: { courses: ['HSK 1'], detail: 'price' } },
    },
    { role: 'user', content: '如果班次取消，我已经转账了怎么办？' },
    {
      role: 'assistant',
      content: '请保留原转账凭证。',
      metadata: JSON.stringify({ replyLang: 'zh' }),
    },
    { role: 'user', content: '我要不要给另一个账号再付？' },
    { role: 'user', content: '我怎么证明我已付？' },
  ]);

  assert.equal(formatted.length, 5);
  assert.deepEqual(formatted[0], { role: 'user', content: 'HSK 1 多少钱？' });
  assert.equal(formatted[1].role, 'assistant');
  assert.deepEqual(JSON.parse(formatted[1].content), {
    lang: 'zh',
    catalogue: { courses: ['HSK 1'], detail: 'price' },
    reply: '',
  });
  assert.equal(formatted[3].role, 'assistant');
  assert.deepEqual(JSON.parse(formatted[3].content), {
    lang: 'zh',
    catalogue: null,
    reply: '请保留原转账凭证。',
  });
  assert.equal(formatted[4].role, 'user');
  assert.match(formatted[4].content, /Earlier learner message\(s\) whose reply did not complete/);
  assert.match(formatted[4].content, /我要不要给另一个账号再付？/);
  assert.match(formatted[4].content, /\[Latest learner message\]\n我怎么证明我已付？/);

  const mergedAssistants = formatConsultationHistory([
    { role: 'assistant', content: '建议从 HSK 1 开始。', metadata: { replyLang: 'zh' } },
    { role: 'assistant', content: '请问您更偏向周末还是工作日晚间上课？', metadata: { replyLang: 'zh' } },
    { role: 'user', content: '周末可以。' },
  ]);
  assert.equal(mergedAssistants.length, 2);
  assert.equal(mergedAssistants[0].role, 'assistant');
  assert.deepEqual(JSON.parse(mergedAssistants[0].content), {
    lang: 'zh',
    catalogue: null,
    reply: '建议从 HSK 1 开始。\n\n请问您更偏向周末还是工作日晚间上课？',
  });

  const catalogueThenPlain = formatConsultationHistory([
    {
      role: 'assistant',
      content: 'Published courses\n\n- HSK 1 · 23 sessions · course total Rp 1,150,000',
      metadata: { replyLang: 'en', catalogueSelection: { courses: ['HSK 1'], detail: 'price' } },
    },
    { role: 'assistant', content: 'Which start date works for you?', metadata: { replyLang: 'en' } },
  ]);
  assert.equal(catalogueThenPlain.length, 2);
  assert.deepEqual(JSON.parse(catalogueThenPlain[0].content), {
    lang: 'en',
    catalogue: { courses: ['HSK 1'], detail: 'price' },
    reply: '',
  });
  assert.deepEqual(JSON.parse(catalogueThenPlain[1].content), {
    lang: 'en',
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

test('prompt alignment removes conflicting directives and keeps JSON schema contract clear', () => {
  const sys = getSystemInstruction(false);
  assert.doesNotMatch(sys, /suggestedPrompts/);
  assert.match(sys, /explicitly requests a target language/i);

  const focus = consultationFocus({ buyingSignals: ['Asked price'] });
  assert.equal(focus.topic, 'fees');
  assert.doesNotMatch(focus.instruction, /Your FIRST sentence must address the requested course fees/);
  assert.match(focus.instruction, /"catalogue":null/);

  const cat = courseCatalogueInstruction(book);
  assert.match(cat, /Always output all three keys in this exact order: "lang", "catalogue", "reply"/);
  assert.match(cat, /\{"lang":"zh","catalogue":null,/);
  assert.match(cat, /\{"lang":"id","catalogue":\{"courses":"all","detail":"price"\},"reply":""\}/);
  assert.match(cat, /"HSK 5A"/);
});
