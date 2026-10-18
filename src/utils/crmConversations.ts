import type { ChatTranscriptMessage } from "../types/crmLead";
import { crmMessageTimestamp } from "./crmMessageTime";

export type ConversationMessage = ChatTranscriptMessage & {
  conversation_id?: string;
  request_id?: string;
};
export type ConversationRecord = {
  id: string;
  source: string;
  started_at?: string;
  created_at?: string;
};
export type ConversationTask = {
  id: string;
  kind: string;
  status: string;
  owner_id?: string | null;
  due_at?: string;
  details?: {
    action?: string;
    purpose?: string;
    sourceConversationId?: string;
    sourceMessageId?: string;
  };
};

export function conversationRole(message: ConversationMessage) {
  return message.role === "system" || message.metadata?.followupAction
    ? "system"
    : message.role;
}

/** Presentation only: preserve every original message, including identical text with different IDs.
 * Unknown-time records retain source position rather than acquiring a fabricated chronology. */
export function conversationGroups(
  messages: ConversationMessage[],
  records: ConversationRecord[],
) {
  const ids = [
    ...new Set(messages.map((message) => message.conversation_id || "legacy")),
  ];
  return ids
    .map((id) => {
      const original = messages.filter(
        (message) => (message.conversation_id || "legacy") === id,
      );
      const dated = original.filter((message) => crmMessageTimestamp(message));
      dated.sort(
        (a, b) =>
          Date.parse(crmMessageTimestamp(a)!) -
          Date.parse(crmMessageTimestamp(b)!),
      );
      let index = 0;
      const ordered = original.map((message) =>
        crmMessageTimestamp(message) ? dated[index++] : message,
      );
      return {
        id,
        source:
          records.find((record) => record.id === id)?.source ||
          original[0]?.source ||
          "legacy_unknown",
        messages: ordered,
        latest: Math.max(
          0,
          ...dated.map((message) => Date.parse(crmMessageTimestamp(message)!)),
        ),
      };
    })
    .sort((a, b) => b.latest - a.latest || a.id.localeCompare(b.id));
}

/** Deduplicate task references, never the message evidence. Missing task IDs remain distinct requests. */
export function linkedConversationTasks(
  messages: ConversationMessage[],
  tasks: ConversationTask[],
) {
  const seen = new Set<string>();
  return messages
    .filter((message) => {
      if (!message.metadata?.followupAction) return false;
      const key = message.metadata.taskId || `message:${message.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((message) => ({
      message,
      task: tasks.find((task) => task.id === message.metadata?.taskId),
    }));
}

/** Historical operation needs explicit evidence; task status/time cannot prove creation. */
export function conversationRequestOperation(
  message: ConversationMessage,
  task?: ConversationTask,
) {
  const operation = message.metadata?.taskOperation;
  if (operation === "created" || operation === "supplemented") return operation;
  const source = task?.details;
  if (
    message.request_id &&
    message.conversation_id &&
    source?.sourceMessageId &&
    source.sourceConversationId
  ) {
    return source.sourceMessageId === message.request_id &&
      source.sourceConversationId === message.conversation_id
      ? "created"
      : "supplemented";
  }
  return "linked";
}

/** A source user message is identified by saved IDs, never by visual adjacency. */
export function conversationRequestSource(
  message: ConversationMessage,
  messages: ConversationMessage[],
) {
  return (
    (message.request_id &&
      messages.find(
        (candidate) =>
          candidate.role === "user" &&
          candidate.request_id === message.request_id &&
          candidate.conversation_id === message.conversation_id,
      )) ||
    undefined
  );
}
