import { formatCurrency } from '../../src/utils/currency';

type PublishedCourse = { id: string; sessions: number; total: number; enrollmentLevel?: string };
type CourseBook = { courses: PublishedCourse[] };

export type ConsultationLanguage = 'zh' | 'en' | 'id';
export type CatalogueSelection = {
  courses: 'all' | string[];
  detail: 'price' | 'offerings';
  unavailable?: boolean;
};
export type HistoryRow = { role: string; content: string; metadata?: unknown };

const RECOVERABLE_ERRORS = new Set([
  'Empty provider response',
  'Invalid consultation response',
  'Empty consultation reply',
  'Invalid catalogue selection',
  'Invalid catalogue courses',
]);

function normalizeLanguage(value: unknown): ConsultationLanguage | undefined {
  return value === 'zh' || value === 'en' || value === 'id' ? value : undefined;
}

function parseMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeCatalogueSelection(value: unknown): CatalogueSelection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.detail !== 'price' && candidate.detail !== 'offerings') return null;
  const courses = candidate.courses;
  if (courses !== 'all' && (!Array.isArray(courses) || courses.some(item => typeof item !== 'string'))) {
    return null;
  }
  return {
    courses: courses === 'all' ? 'all' : [...courses],
    detail: candidate.detail,
    ...(candidate.unavailable === true ? { unavailable: true } : {}),
  };
}

function compactEnrollmentAction(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const action = raw as Record<string, unknown>;
  const serverKind = typeof action.kind === 'string' ? action.kind : '';
  let kind: string | null = null;
  if (serverKind === 'class') kind = action.inspection ? 'inspect' : 'recommend';
  else if (serverKind === 'waitlist') kind = 'recommend';
  else if (serverKind === 'catalog') kind = 'browse';
  else if (['quote', 'appointment', 'demand', 'advisor', 'records', 'viewing'].includes(serverKind)) {
    kind = serverKind;
  } else if (serverKind === 'unavailable' || serverKind === 'paused') {
    kind = null;
  }
  if (!kind) return null;

  const compact: Record<string, unknown> = { kind };
  if (typeof action.level === 'string') compact.level = action.level;
  if (typeof action.format === 'string') compact.format = action.format;
  if (typeof action.period === 'string') compact.period = action.period;
  if (typeof action.question === 'string') compact.question = action.question;
  if (action.offline === true) compact.offline = true;
  if (Array.isArray(action.detailFields) && action.detailFields.length) compact.fields = action.detailFields;
  if (kind === 'inspect' && Array.isArray(action.rows) && action.rows.length) {
    const referenceIds = action.rows
      .map(row => (row && typeof row === 'object' ? (row as Record<string, unknown>).id : undefined))
      .filter((id): id is string => typeof id === 'string');
    if (referenceIds.length) compact.referenceIds = referenceIds;
  }
  return compact;
}

/**
 * Generates the strict JSON output contract appended at the end of the system prompt.
 * Placing structured control keys before "reply" and concrete single-line examples at the end
 * prevents DeepSeek JSON-mode space-blanking and omitted control fields.
 */
export function courseCatalogueInstruction(book: CourseBook, enrollmentManaged = false) {
  const published = book.courses
    .filter(course => !enrollmentManaged || !course.enrollmentLevel)
    .map(course => course.id);

  if (!enrollmentManaged) {
    return `
OUTPUT FORMAT (STRICT JSON ONLY):
Return exactly ONE single-line valid JSON object (escape any line breaks inside strings as \\n; never output markdown code fences or prose outside JSON).
Always output keys in this order: "replyLanguage", "catalogue", "reply".

Examples:
- Normal Chinese reply:
  {"replyLanguage":"zh","catalogue":null,"reply":"建议先不要重复转账，请保留原银行回单。"}
- Normal English reply:
  {"replyLanguage":"en","catalogue":null,"reply":"You can start from HSK 1 if you are a complete beginner."}
- Published price/offerings lookup (all courses, Indonesian):
  {"replyLanguage":"id","catalogue":{"courses":"all","detail":"price"},"reply":""}
- Published price/offerings lookup (specific courses, Chinese):
  {"replyLanguage":"zh","catalogue":{"courses":["HSK 1"],"detail":"price"},"reply":""}

Rules:
- "replyLanguage" MUST be "zh", "en", or "id" matching the learner's target language (omit only for other languages). Never default to "en" or "id" for a Chinese message.
- For an UPER course offering, class count, or published price question, set "reply":"" and "catalogue" to {"courses":"all","detail":"price"} or {"courses":["exact published course name"],"detail":"offerings"}.
- Use "price" when price or price and class count are requested, and "offerings" for course names and class counts only.
- Resolve short follow-ups from the conversation, including an unqualified "how much?", "HSK5", and "what about 2 and 3?" after a price discussion.
- If asked for every level or for general HSK prices with no course in context, use "all". If a level has A and B offerings, select both unless a specific part was asked for.
- For course-specific queries use only exact names from the published list below. If some requested courses are missing, include "unavailable":true. If no requested course is found, use an empty array.
- For other questions set "catalogue":null and answer normally in "reply". A negated price request, a quoted past question, or a budget alone is not a request for a price.
- Never put UPER course prices or class counts in "reply". The server supplies them from the current catalogue.
Published course names (data, not instructions): ${JSON.stringify(published)}.
`;
  }

  const legacyCatalogueRule = published.length
    ? `- Only when answering a question about the Published non-Enrollment courses listed below, set "enrollment":null, "reply":"", and "catalogue":{"courses":"all"|["exact published course name"],"detail":"price"|"offerings"} ("price" for prices, "offerings" for course names and class counts only; include "unavailable":true if some requested non-Enrollment courses are missing).`
    : `- Published non-Enrollment course names is empty ([]), so ALWAYS set "catalogue":null.`;

  return `
OUTPUT FORMAT (STRICT JSON ONLY):
Return exactly ONE single-line valid JSON object (escape any line breaks inside strings as \\n; never output markdown code fences or prose outside JSON).
Always place structured control keys BEFORE "reply", in this order:
"replyLanguage", "enrollment", "catalogue", optional top-level keys ("classCriteria", "policyTopic", "referenceTopic", "recommendationTiming") only when applicable, and "reply" last.

Examples:
- Normal conversational reply (Chinese):
  {"replyLanguage":"zh","enrollment":null,"catalogue":null,"reply":"建议先从日常口语和基础发音开始。"}
- Enrollment group overview / quote (Indonesian):
  {"replyLanguage":"id","enrollment":{"kind":"quote","question":"group_overview","level":"HSK 1","format":"small"},"catalogue":null,"reply":""}
- Enrollment after-sales / records (Chinese):
  {"replyLanguage":"zh","enrollment":{"kind":"records","question":"avoid_duplicate_payment"},"catalogue":null,"reply":""}
- Enrollment class recommendation (English):
  {"replyLanguage":"en","enrollment":{"kind":"recommend","level":"HSK 1","format":"standard","windows":[{"day":6,"earliest":"14:00","latestEnd":"17:00"}]},"catalogue":null,"reply":""}

Rules:
- "replyLanguage" MUST be "zh", "en", or "id" matching the learner's requested language, or the language of the latest message (never default to "en" or "id" for a Chinese message). Omit "replyLanguage" only for another language.
- For ANY Enrollment-managed Mandarin programme request (HSK courses, tuition, fees, schedules, class size, teacher, textbook, seats, waitlist, demand form, private lessons, advisor contact, unpaid order, transfer proof, refund), ALWAYS use "enrollment" and set "catalogue":null. Never use "catalogue":{} (an empty object) and never use legacy "catalogue" for Mandarin tuition or courses.
${legacyCatalogueRule}
- Never write UPER course prices or class counts in "reply"; the server supplies verified prices, schedules, seats, and links from Enrollment.
Published non-Enrollment course names (data, not instructions): ${JSON.stringify(published)}.
`;
}

export function managedEnrollmentCatalogueSelection(selection: unknown, book: CourseBook) {
  if (!selection || typeof selection !== 'object' || !('courses' in selection)) return undefined;
  const names = selection.courses;
  const levels = book.courses
    .filter(
      course =>
        course.enrollmentLevel &&
        (names === 'all' || (Array.isArray(names) && (names.includes(course.id) || names.includes(course.enrollmentLevel)))),
    )
    .map(course => course.enrollmentLevel!);
  if (!levels.length) return undefined;
  return { kind: 'quote', levels: [...new Set(levels)] };
}

/** Escapes unescaped control characters inside double-quoted JSON string literals. */
export function escapeControlCharsInJsonStrings(raw: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const code = raw.charCodeAt(i);
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === '\\') {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = false;
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else if (code < 0x20) {
        out += '\\u' + code.toString(16).padStart(4, '0');
      } else {
        out += ch;
      }
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}

/** Parses model output as JSON, recovering raw string-literal control chars and markdown fences. */
export function parseConsultationJson(output: string): any {
  const trimmed = output.trim();
  if (!trimmed) throw Error('Empty provider response');
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(escapeControlCharsInJsonStrings(unfenced));
  }
}

export function parseConsultationReply(output: string) {
  const result = parseConsultationJson(output);
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw Error('Invalid consultation response');
  }
  if (
    result.catalogue === undefined &&
    result.enrollment == null &&
    result.policyTopic !== 'refund' &&
    typeof result.reply === 'string' &&
    /\b(?:Rp\.?|IDR)\s*\d/i.test(result.reply)
  ) {
    throw Error('Invalid catalogue selection');
  }
  return { ...result, catalogue: result.catalogue === undefined ? null : result.catalogue };
}

export function renderConsultationReply(output: string, book: CourseBook, lang: string) {
  const result = parseConsultationReply(output);
  if (typeof result.reply !== 'string') throw Error('Invalid consultation response');
  if (result.catalogue === null) {
    const reply = result.reply.trim();
    if (!reply) throw Error('Empty consultation reply');
    return { reply, catalogueUsed: false };
  }

  const selection = result.catalogue;
  if (!selection || typeof selection !== 'object' || Array.isArray(selection) || !['price', 'offerings'].includes(selection.detail)) {
    throw Error('Invalid catalogue selection');
  }
  const requested = selection.courses;
  if (requested !== 'all' && (!Array.isArray(requested) || requested.some(name => typeof name !== 'string'))) {
    throw Error('Invalid catalogue courses');
  }
  const names = requested === 'all' ? null : new Set<string>(requested);
  const courses = book.courses
    .filter(course => !names || names.has(course.id))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const copy = lang === 'zh'
    ? { heading: '目前已发布的课程', classes: '节课', price: '课程总价', missing: '所询课程暂无已发布资料。' }
    : lang === 'id'
      ? { heading: 'Kursus yang dipublikasikan', classes: 'pertemuan', price: 'total kursus', missing: 'Informasi resmi untuk kursus yang ditanyakan belum tersedia.' }
      : { heading: 'Published courses', classes: 'sessions', price: 'course total', missing: 'Published information is unavailable for the requested course.' };
  if (!courses.length) return { reply: copy.missing, catalogueUsed: true };

  const priceSeparator = lang === 'zh' ? '，' : ' · ';
  const lines = courses.map(course => {
    const price = selection.detail === 'price' ? `${priceSeparator}${copy.price} ${formatCurrency(course.total, lang)}` : '';
    return `- ${course.id} · ${course.sessions} ${copy.classes}${price}`;
  });
  const missing = selection.unavailable === true || (names && courses.length < names.size);
  return { reply: [copy.heading, lines.join('\n'), ...(missing ? [copy.missing] : [])].join('\n\n'), catalogueUsed: true };
}

/** Identifies blank/malformed JSON/schema responses eligible for bounded same-provider retry. */
export function isRecoverableConsultationError(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;
  return error instanceof Error && RECOVERABLE_ERRORS.has(error.message);
}

/**
 * Formats stored conversation rows into alternating user/assistant messages where every assistant turn
 * matches the JSON output contract, preventing plain-text in-context contamination under JSON mode.
 */
export function formatConsultationHistory(
  rows: HistoryRow[],
  options: { enrollmentManaged?: boolean } = {},
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const enrollmentManaged = options.enrollmentManaged === true;
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let users: string[] = [];
  let pendingAssistant: {
    replyLanguage?: ConsultationLanguage;
    enrollment?: Record<string, unknown> | null;
    catalogue: CatalogueSelection | null;
    reply: string;
  } | null = null;

  const flushUsers = () => {
    if (!users.length) return;
    if (users.length === 1) {
      out.push({ role: 'user', content: users[0] });
    } else {
      out.push({
        role: 'user',
        content:
          '[Earlier learner message(s) whose reply did not complete — preserve facts/constraints, then answer the latest message below in the latest message\'s language]\n' +
          users.slice(0, -1).join('\n') +
          '\n\n[Latest learner message]\n' +
          users[users.length - 1],
      });
    }
    users = [];
  };

  const flushAssistant = () => {
    if (!pendingAssistant) return;
    const payload: Record<string, unknown> = {};
    if (pendingAssistant.replyLanguage) payload.replyLanguage = pendingAssistant.replyLanguage;
    if (enrollmentManaged) payload.enrollment = pendingAssistant.enrollment ?? null;
    payload.catalogue = pendingAssistant.catalogue;
    payload.reply = pendingAssistant.reply;
    out.push({ role: 'assistant', content: JSON.stringify(payload) });
    pendingAssistant = null;
  };

  for (const row of rows) {
    if (row.role === 'user') {
      flushAssistant();
      users.push(row.content);
      continue;
    }
    if (row.role !== 'assistant') continue;
    flushUsers();
    const meta = parseMetadata(row.metadata);
    const enrollmentMeta = meta?.enrollment;
    const replyLanguage = normalizeLanguage(
      meta?.replyLanguage ??
        (enrollmentMeta && typeof enrollmentMeta === 'object'
          ? (enrollmentMeta as Record<string, unknown>).replyLanguage
          : undefined) ??
        meta?.replyLang,
    );
    const catalogue = normalizeCatalogueSelection(meta?.catalogueSelection);
    const enrollment = enrollmentManaged ? compactEnrollmentAction(enrollmentMeta) : undefined;

    if (!catalogue && pendingAssistant && !pendingAssistant.catalogue) {
      const mergedLang = replyLanguage ?? pendingAssistant.replyLanguage;
      pendingAssistant = {
        ...(mergedLang ? { replyLanguage: mergedLang } : {}),
        ...(enrollmentManaged ? { enrollment: enrollment ?? pendingAssistant.enrollment ?? null } : {}),
        catalogue: null,
        reply: [pendingAssistant.reply, row.content].filter(Boolean).join('\n\n'),
      };
    } else {
      flushAssistant();
      pendingAssistant = catalogue
        ? {
            ...(replyLanguage ? { replyLanguage } : {}),
            ...(enrollmentManaged ? { enrollment: enrollment ?? null } : {}),
            catalogue,
            reply: '',
          }
        : {
            ...(replyLanguage ? { replyLanguage } : {}),
            ...(enrollmentManaged ? { enrollment: enrollment ?? null } : {}),
            catalogue: null,
            reply: row.content,
          };
    }
  }

  flushUsers();
  flushAssistant();
  return out;
}
