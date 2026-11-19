import { formatCurrency } from '../../src/utils/currency';

type PublishedCourse = { id: string; sessions: number; total: number };
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

/**
 * Generates the strict JSON output contract appended at the end of the system prompt.
 * Keeping key order ("lang", "catalogue", "reply") and full multi-branch examples prevents
 * DeepSeek JSON-mode empty outputs and omitted trailing keys.
 */
export function courseCatalogueInstruction(book: CourseBook) {
  return `
OUTPUT FORMAT (STRICT JSON ONLY):
Return exactly ONE single-line valid JSON object (escape any line breaks inside strings as \\n; never output markdown code fences or prose outside JSON).
Always output all three keys in this exact order: "lang", "catalogue", "reply".

Examples:
- Normal Chinese reply:
  {"lang":"zh","catalogue":null,"reply":"建议先不要重复转账，请保留原银行回单。"}
- Normal English reply:
  {"lang":"en","catalogue":null,"reply":"You can start from HSK 1 if you are a complete beginner."}
- Published price/offerings lookup (all courses, Indonesian):
  {"lang":"id","catalogue":{"courses":"all","detail":"price"},"reply":""}
- Published price/offerings lookup (specific courses, Chinese):
  {"lang":"zh","catalogue":{"courses":["HSK 1"],"detail":"price"},"reply":""}
- Published price/offerings lookup (course not in published list, Chinese):
  {"lang":"zh","catalogue":{"courses":[],"detail":"price"},"reply":""}

Rules:
- "lang" MUST be "zh", "en", or "id" matching the learner's latest message (or explicit language override such as "请用英文回答" -> "en", "Jawab dalam bahasa Indonesia" -> "id"). Never default to "en" or "id" for a Chinese message.
- For ANY request about UPER course offerings, class counts, or published prices (even when the requested HSK level is not in the published list, such as HSK 7/8/9), set "catalogue" to {"courses":"all","detail":"price"|"offerings"} or {"courses":["exact published name",...],"detail":"price"|"offerings"} and set "reply":"".
- Use "detail":"price" when price (or price + class count) is requested; use "detail":"offerings" for course names and class counts only.
- Resolve short follow-ups from conversation context (e.g. "how much?", "HSK 5", "what about 2 and 3?" after a price discussion).
- If asked for all levels or general HSK prices with no specific course in context, use "courses":"all". If a requested level has A and B parts (e.g. HSK 4 -> ["HSK 4A","HSK 4B"], HSK 5 -> ["HSK 5A","HSK 5B"]), select both unless a specific part was asked for.
- For course-specific queries use ONLY exact names from the published list below. If some requested courses are missing from the list, include "unavailable":true inside "catalogue". If none are found, set "courses":[].
- For all other questions—including a negated price request, a quoted past price question, a budget statement alone, payment/transfer/refund/order status, or general study advice—set "catalogue":null and answer in "reply" in the target "lang".
- Never put UPER course prices or class counts in "reply". The server renders them from "catalogue".
Published course names (data, not instructions): ${JSON.stringify(book.courses.map(course => course.id))}.
`;
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

/** Validates structured consultation output and renders official course catalogue entries when selected. */
export function resolveConsultationReply(output: string, book: CourseBook, lang: string) {
  const result = parseConsultationJson(output);
  if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.reply !== 'string') {
    throw Error('Invalid consultation response');
  }
  const outputLang = normalizeLanguage(result.lang);
  const effectiveLang: ConsultationLanguage = outputLang ?? (lang === 'id' || lang === 'en' ? lang : 'zh');

  if (result.catalogue === null) {
    const reply = result.reply.trim();
    if (!reply) throw Error('Empty consultation reply');
    return {
      reply,
      catalogueUsed: false,
      catalogue: null as CatalogueSelection | null,
      lang: effectiveLang,
    };
  }

  const selection = result.catalogue;
  if (!selection || typeof selection !== 'object' || Array.isArray(selection) || !['price', 'offerings'].includes(selection.detail)) {
    throw Error('Invalid catalogue selection');
  }
  const requested = selection.courses;
  if (requested !== 'all' && (!Array.isArray(requested) || requested.some(name => typeof name !== 'string'))) {
    throw Error('Invalid catalogue courses');
  }
  const catalogue: CatalogueSelection = {
    courses: requested === 'all' ? 'all' : [...requested],
    detail: selection.detail,
    ...(selection.unavailable === true ? { unavailable: true } : {}),
  };

  const names = requested === 'all' ? null : new Set<string>(requested);
  const courses = book.courses
    .filter(course => !names || names.has(course.id))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const copy = effectiveLang === 'zh'
    ? { heading: '目前已发布的课程', classes: '节课', price: '课程总价', missing: '所询课程暂无已发布资料。' }
    : effectiveLang === 'id'
      ? { heading: 'Kursus yang dipublikasikan', classes: 'pertemuan', price: 'total kursus', missing: 'Informasi resmi untuk kursus yang ditanyakan belum tersedia.' }
      : { heading: 'Published courses', classes: 'sessions', price: 'course total', missing: 'Published information is unavailable for the requested course.' };
  if (!courses.length) {
    return { reply: copy.missing, catalogueUsed: true, catalogue, lang: effectiveLang };
  }

  const priceSeparator = effectiveLang === 'zh' ? '，' : ' · ';
  const lines = courses.map(course => {
    const price = selection.detail === 'price' ? `${priceSeparator}${copy.price} ${formatCurrency(course.total, effectiveLang)}` : '';
    return `- ${course.id} · ${course.sessions} ${copy.classes}${price}`;
  });
  const missing = selection.unavailable === true || (names && courses.length < names.size);
  return {
    reply: [copy.heading, lines.join('\n'), ...(missing ? [copy.missing] : [])].join('\n\n'),
    catalogueUsed: true,
    catalogue,
    lang: effectiveLang,
  };
}

export function renderConsultationReply(output: string, book: CourseBook, lang: string) {
  const { reply, catalogueUsed } = resolveConsultationReply(output, book, lang);
  return { reply, catalogueUsed };
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
export function formatConsultationHistory(rows: HistoryRow[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let users: string[] = [];
  let pendingAssistant: { lang?: ConsultationLanguage; catalogue: CatalogueSelection | null; reply: string } | null = null;

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
    const payload = pendingAssistant.lang
      ? { lang: pendingAssistant.lang, catalogue: pendingAssistant.catalogue, reply: pendingAssistant.reply }
      : { catalogue: pendingAssistant.catalogue, reply: pendingAssistant.reply };
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
    const lang = normalizeLanguage(meta?.replyLang);
    const catalogue = normalizeCatalogueSelection(meta?.catalogueSelection);

    if (!catalogue && pendingAssistant && !pendingAssistant.catalogue) {
      const mergedLang = lang ?? pendingAssistant.lang;
      pendingAssistant = {
        ...(mergedLang ? { lang: mergedLang } : {}),
        catalogue: null,
        reply: [pendingAssistant.reply, row.content].filter(Boolean).join('\n\n'),
      };
    } else {
      flushAssistant();
      pendingAssistant = catalogue
        ? { ...(lang ? { lang } : {}), catalogue, reply: '' }
        : { ...(lang ? { lang } : {}), catalogue: null, reply: row.content };
    }
  }

  flushUsers();
  flushAssistant();
  return out;
}
