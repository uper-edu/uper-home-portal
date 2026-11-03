/**
 * Single-line JSON console logging for container collection (json-file driver, later Filebeat).
 * Zero dependencies: every record is one JSON object written to stdout (info/debug)
 * or stderr (warn/error); both streams are captured by the container log driver.
 * Callers must never pass credentials, tokens or full customer records as fields.
 */
const levels = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof levels;

function threshold(): Level {
  const value = process.env.PORTAL_LOG_LEVEL;
  // Object.hasOwn: a plain `in` check would also match inherited names like "constructor".
  return value && Object.hasOwn(levels, value) ? (value as Level) : "info";
}

// Database errors embed bound customer values in sqlMessage (e.g. Duplicate entry '...');
// log the stable driver code only — the stack's first line repeats that message, so only
// the frames below it are kept. All other errors keep their message untouched.
function serializeError(value: Error) {
  const code = (value as any).code;
  if (typeof code === "string" && /^ER_[A-Z0-9_]+$/.test(code))
    return { name: value.name, code, stack: value.stack?.split("\n").slice(1).join("\n") };
  return { name: value.name, message: value.message, stack: value.stack };
}

// Depth-limited conversion so nested Error values (e.g. {cause: e}) keep name/message/stack
// instead of serializing as {} through JSON.stringify's enumerable-only view.
function toLogValue(value: unknown, depth: number): unknown {
  if (value instanceof Error) return serializeError(value);
  if (depth <= 0) return value;
  if (Array.isArray(value)) return value.map((item) => toLogValue(item, depth - 1));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = toLogValue(item, depth - 1);
    return out;
  }
  return value;
}

function write(level: Level, event: string, fields: Record<string, unknown> = {}) {
  // Logging must never break its caller; fall back to a minimal valid single-line record.
  try {
    if (levels[level] < levels[threshold()]) return;
    const line: Record<string, unknown> = { time: new Date().toISOString(), level, event };
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      line[key] = toLogValue(value, 4);
    }
    const text = JSON.stringify(line);
    if (level === "warn" || level === "error") console.error(text);
    else console.log(text);
  } catch {
    console.error(JSON.stringify({ time: new Date().toISOString(), level, event, note: "log write failed" }));
  }
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) => write("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};
