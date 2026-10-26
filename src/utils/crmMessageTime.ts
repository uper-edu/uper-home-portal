import {crmInstant} from './crmOperatingTime';
import { crmId } from "./crmIndonesian";
/** Legacy storage dates can be placeholders. Only original evidence establishes time. */
export interface CrmMessageTimeInput {
  timestamp?: unknown;
  created_at?: unknown;
  timestampKnown?: boolean;
  status?: string;
  source?: string;
  error?: unknown;
  originalTimestamp?: unknown;
}
function valid(value: unknown): string | null {
  const text =
    value instanceof Date
      ? Number.isFinite(value.getTime())
        ? value.toISOString()
        : null
      : typeof value === "string"
        ? value
        : null;
  return text&&Number.isFinite(Date.parse(text))?(/(Z|[+-]\d\d:\d\d)$/i.test(text)?text:crmInstant(text)?.toISOString()||null):null;
}
export function legacyTimeMetadata(
  message: CrmMessageTimeInput,
): Record<string, unknown> | null {
  if (typeof message.error !== "string") return null;
  try {
    const data = JSON.parse(message.error);
    return data && typeof data === "object" && !Array.isArray(data)
      ? data
      : null;
  } catch {
    return null;
  }
}
export function crmMessageTimestamp(
  message: CrmMessageTimeInput,
): string | null {
  if (message.timestampKnown === false) return null;
  const historical =
    message.status === "legacy" || message.source === "legacy_unknown";
  if (historical) {
    const metadata = legacyTimeMetadata(message);
    if (metadata?.timestampKnown === false) return null;
    if (metadata && Object.hasOwn(metadata, "originalTimestamp"))
      return valid(metadata.originalTimestamp);
    if (Object.hasOwn(message, "originalTimestamp"))
      return valid(message.originalTimestamp);
    // A legacy row without original evidence must not inherit ingestion or storage time.
    return message.timestampKnown === true ? valid(message.timestamp) : null;
  }
  return valid(message.timestamp ?? message.created_at);
}
export function normalizeCrmMessage<T extends CrmMessageTimeInput>(message: T) {
  const timestamp = crmMessageTimestamp(message),
    metadata = legacyTimeMetadata(message);
  return {
    ...message,
    timestamp: timestamp || "",
    timestampKnown: timestamp !== null,
    ...(metadata && Object.hasOwn(metadata, "originalTimestamp")
      ? { originalTimestamp: metadata.originalTimestamp }
      : {}),
  };
}
export function crmMessageTimeLabel(
  message: CrmMessageTimeInput,
  lang: "zh" | "en" | "id",
  format: (timestamp: string) => string,
) {
  const timestamp = crmMessageTimestamp(message);
  return timestamp
    ? format(timestamp)
    : lang === "id"
      ? crmId("Unknown time")
      : lang === "zh"
        ? "未知时间"
        : "Unknown time";
}
export function compareCrmEventTimes(
  a: {
    timestamp: string;
  },
  b: {
    timestamp: string;
  },
) {
  const first = Date.parse(a.timestamp),
    second = Date.parse(b.timestamp);
  if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
  if (!Number.isFinite(second)) return -1;
  return second - first;
}
