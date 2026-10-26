import React, { useState, useEffect } from "react";
import {
  ArrowDown,
  Bot,
  MessageCircle,
  Workflow,
  ArrowUpRight,
} from "lucide-react";
import type { CrmLeadRecord } from "../../types/crmLead";
import { crmId } from "../../utils/crmIndonesian";
import { crmLocale, crmValue, type CrmLanguage } from "../../utils/crmLanguage";
import {
  crmMessageTimestamp,
  crmMessageTimeLabel,
} from "../../utils/crmMessageTime";
import { formatCrmOperatingTime,viewerTimeZone,crmInstant } from "../../utils/crmOperatingTime";

import {
  conversationGroups,
  conversationRole,
  conversationRequestOperation,
  conversationRequestSource,
  type ConversationMessage,
  type ConversationRecord,
  type ConversationTask,
} from "../../utils/crmConversations";
import { CrmSingleSelect } from "./CrmSingleSelect";
import { CrmDisclosure } from "./CrmDisclosure";
import { presentFollowUpTask } from "../../utils/crmTaskPresentation";

export function CrmConversationTimeline({
  lead,
  messages,
  conversations,
  tasks,
  lang,
  timezone,
  isLight,
  onOpenTask,
  conversationContext,
}: {
  lead: CrmLeadRecord;
  messages: ConversationMessage[];
  conversations: ConversationRecord[];
  tasks: ConversationTask[];
  lang: CrmLanguage;
  timezone: string;
  isLight: boolean;
  onOpenTask: (taskId: string, message: ConversationMessage) => void;
  conversationContext?: {
    conversationId?: string;
    messageId?: string;
    requestId?: string;
  };
}) {
  timezone=viewerTimeZone();
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const groups = conversationGroups(messages, conversations);
  const [selected, setSelected] = useState(
    conversationContext?.conversationId || "",
  );
  useEffect(() => {
    if (conversationContext?.conversationId)
      setSelected(conversationContext.conversationId);
  }, [conversationContext]);
  const activeGroup =
    groups.find((value) => value.id === selected) || groups[0];
  useEffect(() => {
    if (!activeGroup || !conversationContext) return;
    const message = activeGroup.messages.find((value) =>
      conversationContext.messageId
        ? value.id === conversationContext.messageId
        : value.role === "user" &&
          value.request_id === conversationContext.requestId,
    );
    if (!message) return;
    const frame = requestAnimationFrame(() => {
      const node = document.getElementById("crm-message-" + message.id);
      node?.scrollIntoView({ block: "center" });
      node?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeGroup?.id, conversationContext]);
  const group = groups.find((value) => value.id === selected) || groups[0];
  if (!group)
    return (
      <p className="crm-work-muted">
        {t("No conversations recorded", "暂无对话记录")}
      </p>
    );
  const fullTime = (message: ConversationMessage) =>
    crmMessageTimeLabel(message, lang, (value) =>
      formatCrmOperatingTime(value, timezone),
    );
  const day = (message: ConversationMessage) => {
    const timestamp = crmMessageTimestamp(message);
    return timestamp
      ? formatCrmOperatingTime(timestamp, timezone).slice(0, 10)
      : "unknown";
  };
  const dayLabel = (message: ConversationMessage) => {
    const timestamp = crmMessageTimestamp(message);
    return timestamp
      ? new Intl.DateTimeFormat(crmLocale(lang), {
          timeZone: timezone,
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(crmInstant(timestamp)!)
      : t("Unknown time", "未知时间");
  };
  const latestUser = group.messages
    .filter(
      (message) => message.role === "user" && crmMessageTimestamp(message),
    )
    .reduce<ConversationMessage | undefined>(
      (latest, message) =>
        !latest ||
        Date.parse(crmMessageTimestamp(message)!) >=
          Date.parse(crmMessageTimestamp(latest)!)
          ? message
          : latest,
      undefined,
    );
  const failed = (message: ConversationMessage) =>
    ["failed", "interrupted"].includes(message.status || "");
  const statusLabel = (message: ConversationMessage) =>
    message.status === "failed"
      ? t("Reply failed", "回复失败")
      : message.status === "interrupted"
        ? t("Reply interrupted", "回复已中断")
        : t("Reply pending", "等待回复");
  const roleLabel = (message: ConversationMessage) =>
    conversationRole(message) === "user"
      ? t("Customer", "客户")
      : conversationRole(message) === "system"
        ? t("UPER system", "UPER 系统")
        : t("UPER AI advisor", "UPER AI 顾问");
  const eventLabel = (message: ConversationMessage) => {
    switch (message.metadata?.followupAction) {
      case "handoff":
        return t("Advisor contact request recorded", "顾问联系请求已记录");
      case "booking":
        return t("Booking request recorded", "预约请求已记录");
      case "enrollment":
        return t("Enrollment interest recorded", "报名意向已记录");
      default:
        return t("Follow-up request recorded", "跟进请求已记录");
    }
  };
  const operationLabel = (
    message: ConversationMessage,
    task?: ConversationTask,
  ) => {
    const operation = conversationRequestOperation(message, task);
    return operation === "created"
      ? t("Follow-up task created", "已创建跟进任务")
      : operation === "supplemented"
        ? t("Added to existing task", "已补充到现有任务")
        : t("Linked follow-up task", "关联跟进任务");
  };
  const renderRequest = (message: ConversationMessage) => {
    const task = tasks.find((value) => value.id === message.metadata?.taskId);
    const view = task && presentFollowUpTask(task, lang, timezone);
    return (
      <>
        <p className="crm-conversation-event-label">
          {task ? operationLabel(message, task) : eventLabel(message)}
        </p>
        {task && view ? (
          <button
            type="button"
            className="crm-conversation-task-reference"
            onClick={() =>
              onOpenTask(
                task.id,
                conversationRequestSource(message, messages) || message,
              )
            }
          >
            <ArrowUpRight size={15} aria-hidden="true" />
            <span>
              {view.action} · {view.status}
            </span>
          </button>
        ) : (
          <p className="crm-conversation-task-unavailable">
            {t(
              "Linked task unavailable; no deadline or completion can be confirmed.",
              "关联任务暂不可用，无法确认截止时间或完成状态。",
            )}
          </p>
        )}
      </>
    );
  };

  return (
    <div className="crm-customer-conversations">
      <header className="crm-conversation-header">
        <div className="crm-conversation-heading">
          <MessageCircle size={18} aria-hidden="true" />
          <div>
            <h3>{crmValue(group.source, lang)}</h3>
            <p className="crm-work-muted">
              {group.latest
                ? formatCrmOperatingTime(
                    new Date(group.latest).toISOString(),
                    timezone,
                  )
                : t("Unknown time", "未知时间")}
              <span aria-hidden="true"> · </span>
              {group.messages.length}{" "}
              {t(
                group.messages.length === 1 ? "message" : "messages",
                "条消息",
              )}
              <span aria-hidden="true"> · </span>
              {timezone}
            </p>
          </div>
        </div>
        {groups.length > 1 && (
          <CrmSingleSelect
            label={t("Conversation history", "历史对话")}
            displayValue={`${t("Conversation history", "历史对话")} (${groups.length})`}
            value={group.id}
            onChange={setSelected}
            lang={lang}
            isLight={isLight}
            options={groups.map((value) => ({
              value: value.id,
              label: `${value.latest ? formatCrmOperatingTime(new Date(value.latest).toISOString(), timezone) : t("Unknown time", "未知时间")} · ${crmValue(value.source, lang)} · ${value.messages.length} ${t(value.messages.length === 1 ? "message" : "messages", "条消息")}`,
            }))}
          />
        )}
        {latestUser && (
          <button
            type="button"
            className="crm-conversation-jump"
            onClick={() => {
              const target = document.getElementById(
                "crm-message-" + latestUser.id,
              );
              target?.scrollIntoView({ block: "center" });
              target?.focus({ preventScroll: true });
            }}
          >
            <ArrowDown size={15} aria-hidden="true" />
            {t("Latest customer message", "最新客户消息")}
          </button>
        )}
      </header>

      <ol
        className="crm-conversation-stream"
        aria-label={t("Message history", "消息记录")}
      >
        {group.messages.map((message, index) => {
          const role = conversationRole(message),
            timestamp = crmMessageTimestamp(message);
          const Icon =
            role === "assistant"
              ? Bot
              : role === "system"
                ? Workflow
                : MessageCircle;
          return (
            <React.Fragment key={message.id || index}>
              {(index === 0 ||
                day(message) !== day(group.messages[index - 1])) && (
                <li className="crm-conversation-date">
                  <span>{dayLabel(message)}</span>
                </li>
              )}
              <li className="crm-conversation-item" data-role={role}>
                <article
                  id={"crm-message-" + message.id}
                  tabIndex={-1}
                  className="crm-conversation-message"
                  data-role={role}
                  aria-label={`${roleLabel(message)} · ${fullTime(message)}`}
                >
                  <div className="crm-conversation-meta">
                    <span className="crm-conversation-role">
                      <Icon size={14} aria-hidden="true" />
                      {roleLabel(message)}
                    </span>
                    <time
                      dateTime={timestamp || undefined}
                      title={fullTime(message)}
                      aria-label={fullTime(message)}
                    >
                      {timestamp
                        ? formatCrmOperatingTime(timestamp, timezone).slice(
                            11,
                            19,
                          )
                        : t("Unknown time", "未知时间")}
                    </time>
                  </div>
                  {role === "system" && message.metadata?.followupAction ? (
                    renderRequest(message)
                  ) : message.content ? (
                    <p className="crm-conversation-original">
                      {message.content}
                    </p>
                  ) : null}
                  {["failed", "interrupted", "pending", "generating"].includes(
                    message.status || "",
                  ) && (
                    <div
                      className="crm-conversation-reply-status"
                      data-tone={
                        message.status === "failed"
                          ? "failure"
                          : message.status === "interrupted"
                            ? "review"
                            : "normal"
                      }
                      role={failed(message) ? "status" : undefined}
                    >
                      {statusLabel(message)}
                    </div>
                  )}
                </article>
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      {group.messages.some(
        (message) => message.metadata?.followupAction && message.content,
      ) && (
        <CrmDisclosure
          className="crm-conversation-receipt"
          heading={t("Original request confirmations", "请求确认原文")}
        >
          <p className="crm-work-muted">
            {t(
              "Historical acknowledgements only. Current task status and processing deadlines are available in Follow-up.",
              "此处仅保留当时的确认消息；当前状态与处理截止时间请在跟进页查看。",
            )}
          </p>
          <ol className="crm-conversation-confirmation-history">
            {group.messages
              .filter(
                (message) =>
                  message.metadata?.followupAction && message.content,
              )
              .map((message) => (
                <li key={message.id}>
                  <p className="crm-work-muted">
                    {fullTime(message)} · {eventLabel(message)}
                  </p>
                  <p className="crm-conversation-original">{message.content}</p>
                </li>
              ))}
          </ol>
        </CrmDisclosure>
      )}

      <CrmDisclosure
        className="crm-conversation-reference"
        heading={t("Conversation details", "会话详情")}
      >
        <dl className="crm-customer-facts">
          <dt>{t("Conversation reference", "会话标识")}</dt>
          <dd>
            <code>{group.id}</code>
          </dd>
          <dt>{t("Time zone", "时区")}</dt>
          <dd>{timezone}</dd>
        </dl>
      </CrmDisclosure>
    </div>
  );
}
