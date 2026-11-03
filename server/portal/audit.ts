import { log } from "../logger.ts";
/**
 * Console mirror of a portal_audit database write. The SQL stays untouched at
 * each call site; this only emits the info log line with identity fields
 * (actor/action/leadId/id/requestId). Full business data never enters container logs.
 * Known limit: the line is emitted inside the caller's transaction; if that
 * transaction later rolls back, the log says "attempted" while portal_audit has
 * no row — confirm the outcome via the http.request line with the same traceId.
 */
export function auditLog(actor: string, action: string, data: any = {}) {
  log.info(action, {
    actor,
    ...(typeof data?.leadId === "string" ? { leadId: data.leadId } : {}),
    // Neutral id: only data.leadId means a customer; data.id is whatever the caller's SQL row uses.
    ...(typeof data?.id === "string" ? { id: data.id } : {}),
    ...(typeof data?.requestId === "string" ? { requestId: data.requestId } : {}),
  });
}
