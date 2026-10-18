import { contactStatistics } from "./crmContact";
import { crmMessageTimestamp } from "./crmMessageTime";
import { formatCrmOperatingTime } from "./crmOperatingTime";

/** Presentation only. Unknown timestamps never establish that an inquiry is newer. */
export function followupOverview(lead: any) {
  const stats = contactStatistics(lead);
  const connectedAt = Date.parse(
    stats.lastConnected?.timestamp || stats.lastConnected?.at,
  );
  const customerMessages = (lead.chatTranscript || [])
    .filter(
      (message: any) =>
        message.role === "user" &&
        !message.metadata?.followupAction &&
        crmMessageTimestamp(message),
    )
    .slice()
    .sort(
      (a: any, b: any) =>
        Date.parse(crmMessageTimestamp(b)!) -
        Date.parse(crmMessageTimestamp(a)!),
    );
  const latest = customerMessages[0];
  const newer = Boolean(
    latest &&
    Number.isFinite(connectedAt) &&
    Date.parse(crmMessageTimestamp(latest)!) > connectedAt,
  );
  return {
    ...stats,
    message: newer || !stats.lastConnected ? latest : null,
    newer,
  };
}

/** Group on the operating calendar, not the browser's local day. */
export function followupHistoryDay(at: string | undefined, timezone: string) {
  return at && Number.isFinite(Date.parse(at))
    ? formatCrmOperatingTime(at, timezone).slice(0, 10)
    : "";
}

/** Saved message/conversation identifiers only. Similar text, reading, or a later
 * contact record cannot establish a task relationship or resolve a message. */
export function messageTaskLinks(message: any, messages: any[], tasks: any[], facts: any[] = []) {
  if (!message?.conversation_id || (!message.id && !message.request_id)) return [];
  const ids = new Set([message.id, message.request_id].filter(Boolean));
  const matches = (conversation: any, id: any) =>
    conversation === message.conversation_id && !!id && ids.has(id);
  const linked = new Set<string>();
  for (const task of tasks)
    if (matches(task.details?.sourceConversationId, task.details?.sourceMessageId)) linked.add(task.id);
  for (const receipt of messages)
    if (receipt.metadata?.followupAction && receipt.metadata.taskId && matches(receipt.conversation_id, receipt.request_id))
      linked.add(receipt.metadata.taskId);
  for (const fact of facts) {
    const d = fact.data || {};
    if (fact.kind === 'task.request_evidence' && d.taskId && matches(d.conversationId, d.messageId)) linked.add(d.taskId);
    if (fact.kind === 'followup.recorded' && d.processingTaskId && matches(d.sourceConversationId, d.sourceMessageId)) linked.add(d.processingTaskId);
  }
  return [...linked].sort().map(id => ({id, task: tasks.find(task => task.id === id)}));
}
