import { crmId } from "../../utils/crmIndonesian";
import React, { useEffect, useState } from "react";
import type { CrmLeadRecord, ChatTranscriptMessage } from "../../types/crmLead";
import { crmValue, crmError, crmLocale, type CrmLanguage } from "../../utils/crmLanguage";
import { crmAssessmentSummary } from "../../utils/crmAssessment";
import { crmMessageTimeLabel } from "../../utils/crmMessageTime";
import { formatCrmOperatingTime } from "../../utils/crmOperatingTime";
import {
  buyingSignals,
  customerCity,
  customerOutcome,
} from "../../utils/crmWorkspace";
type DetailProps = {
  lead: CrmLeadRecord;
  lang: CrmLanguage;
  timezone: string;
};
const knownDate = (
  date: string | undefined,
  timezone: string,
  lang: CrmLanguage,
) =>
  date && Date.parse(date) > 0
    ? formatCrmOperatingTime(date, timezone)
    : lang === "id"
      ? crmId("Unknown time")
      : lang === "zh"
        ? "未知时间"
        : "Unknown time";
function Facts({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="crm-customer-facts">
      {items.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value === "" || value == null ? "—" : value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
export function CrmCustomerProfile({
  lead,
  lang,
  timezone,
  ownership,
}: DetailProps & {
  ownership: React.ReactNode;
}) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const tierSources: Record<string, [string, string]> = {
    predicted: ["Rule-based", "规则判断"],
    sales_confirmed: ["Sales confirmed", "销售确认"],
    behaviour_override: ["Customer activity", "客户行为"],
    buying_signal: ["Buying signal", "购买信号"],
  };
  return (
    <div className="crm-customer-sections">
      <section>
        <h3>{t("Contact and identity", "联系方式与客户身份")}</h3>
        <Facts
          items={[
            [t("Name", "姓名"), lead.fullName],
            ["WhatsApp", lead.whatsapp],
            [t("Email", "电子邮件"), lead.email],
            [
              t("Customer identity", "客户身份"),
              crmValue(lead.currentStatus, lang),
            ],
            ...(lead.parentContact
              ? [
                  [t("Parent contact", "家长联系方式"), lead.parentContact] as [
                    string,
                    React.ReactNode,
                  ],
                ]
              : []),
            [
              t("Registered", "登记时间"),
              knownDate(lead.submittedAt, timezone, lang),
            ],
          ]}
        />
      </section>
      <section>
        <h3>{t("Ownership and sales progress", "客户归属与销售进展")}</h3>
        {ownership}
        <Facts
          items={[
            [t("Customer group", "客户分组"), crmValue(lead.tier, lang)],
            [
              t("Classification source", "分组来源"),
              (lang === "id"
                ? crmId(tierSources[lead.tierSource]?.[0])
                : tierSources[lead.tierSource]?.[lang === "zh" ? 1 : 0]) ||
                t("Not recorded", "未记录"),
            ],
            [
              t("Sales-confirmed group", "人工确认分组"),
              crmValue(lead.tierConfirmed, lang),
            ],
            [
              t("Predicted group", "规则预测分组"),
              crmValue(lead.tierPredicted, lang),
            ],
            [
              t("Group updated", "分组更新时间"),
              knownDate(lead.tierUpdatedAt, timezone, lang),
            ],
            [
              t("Buying signals", "购买信号"),
              buyingSignals(lead)
                .map((s) => crmValue(s, lang))
                .join(
                  lang === "id" ? crmId(", ") : lang === "zh" ? "、" : ", ",
                ) || t("None recorded", "尚未记录"),
            ],
          ]}
        />
      </section>
      <section>
        <h3>{t("Learning needs", "学习需求")}</h3>
        <Facts
          items={[
            [
              t("Learning goals", "学习目标"),
              [...new Set([lead.goal, ...(lead.goals || [])].filter(Boolean))]
                .map((g) => crmValue(g, lang))
                .join(
                  lang === "id" ? crmId("; ") : lang === "zh" ? "；" : "; ",
                ),
            ],
            [t("City", "城市"), customerCity(lead.city, lang)],
            [t("Learning format", "授课方式"), crmValue(lead.mode, lang)],
            [
              t("Self-reported level", "自报水平"),
              crmValue(lead.reportedLevel, lang),
            ],
          ]}
        />
      </section>
      <section>
        <h3>{t("Attribution", "来源归因")}</h3>
        <Facts
          items={[
            [t("First source", "首次来源"), crmValue(lead.entryPoint, lang)],
            [t("Campaign", "营销活动"), lead.campaign],
            [t("Placement", "投放位置"), crmValue(lead.placement, lang)],
            [t("Entry offer", "引导内容"), crmValue(lead.hookType, lang)],
            [t("Entry context", "入口场景"), crmValue(lead.hookContext, lang)],
          ]}
        />
      </section>
      <section>
        <h3>{t("Recorded outcome", "已登记业务结果")}</h3>
        <Facts
          items={[
            [t("Outcome", "结果"), customerOutcome(lead.outcome, lang)],
            [t("Enrolled class", "报名班级"), lead.enrolledClass],
            [
              t("Recorded amount", "登记金额"),
              typeof lead.revenue === "number"
                ? `Rp ${lead.revenue.toLocaleString(crmLocale(lang))}`
                : "—",
            ],
            [
              t("Attendance confirmed", "已确认出席"),
              lead.attendanceConfirmed === undefined
                ? t("Not recorded", "未记录")
                : lead.attendanceConfirmed
                  ? t("Yes", "是")
                  : t("No", "否"),
            ],
          ]}
        />
      </section>
    </div>
  );
}
export function CrmCustomerAssessment({ lead, lang, timezone }: DetailProps) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const summary = crmAssessmentSummary(lead, lang);
  const result =
    lead.latestAssessment &&
    typeof lead.latestAssessment === "object" &&
    !Array.isArray(lead.latestAssessment)
      ? lead.latestAssessment
      : undefined;
  const paper =
    lead.levelSource === "trial" && result
      ? crmAssessmentSummary(
          { ...lead, levelSource: "assessment", levelConfirmed: undefined },
          lang,
        )
      : summary;
  const sections =
    result?.sections && typeof result.sections === "object"
      ? Object.entries(result.sections)
      : [];
  return (
    <div className="crm-customer-sections">
      <section>
        <h3>{t("Current placement evidence", "当前定级依据")}</h3>
        <p>{summary.conclusion}</p>
        <p className="crm-work-muted">{summary.detail}</p>
        {summary.kind === "assessment" && (
          <p className="crm-work-muted">
            {t(
              "Internal assessment reference; not an official HSK certificate.",
              "内部测评参考，不代表官方 HSK 证书。",
            )}
          </p>
        )}
      </section>
      <section>
        <h3>{t("Self-reported level", "客户自报水平")}</h3>
        <p>{crmValue(lead.reportedLevel, lang)}</p>
      </section>
      {result && (
        <section>
          <h3>{t("Latest assessment record", "最近一次测评记录")}</h3>
          {summary.kind === "teacher" && (
            <>
              <p>{paper.conclusion}</p>
              <p className="crm-work-muted">{paper.detail}</p>
            </>
          )}
          <Facts
            items={[
              [
                t("Completed", "完成时间"),
                knownDate(result.attempt?.completedAt, timezone, lang),
              ],
              [t("Exam version", "试卷版本"), result.attempt?.examVersion],
              [
                t("Scoring version", "评分版本"),
                result.attempt?.scoringVersion,
              ],
              [t("Questions", "题目数量"), result.questionCount ?? "—"],
              [t("Correct answers", "正确题数"), result.correctCount ?? "—"],
              [t("Skipped", "跳过题数"), result.skippedCount ?? "—"],
              [t("Unanswered", "未作答题数"), result.unansweredCount ?? "—"],
            ]}
          />
          {sections.length > 0 && (
            <table className="crm-assessment-sections">
              <caption>{t("Section results", "分项结果")}</caption>
              <thead>
                <tr>
                  <th>{t("Section", "项目")}</th>
                  <th>{t("Correct / Total", "正确／总题数")}</th>
                </tr>
              </thead>
              <tbody>
                {sections.map(([key, value]) => (
                  <tr key={key}>
                    <td>
                      {{
                        listening: t("Listening", "听力"),
                        reading: t("Reading", "阅读"),
                        writing: t("Writing", "书写"),
                      }[key] || key}
                    </td>
                    <td>
                      {value?.correct ?? "—"} / {value?.total ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {!result && summary.kind === "assessment" && (
        <section>
          <p className="crm-work-muted">
            {t(
              "Historical record: structured attempt details are unavailable.",
              "历史测评缺少完整的结构化作答记录。",
            )}
          </p>
        </section>
      )}
      {!result && lead.quizBreakdown && (
        <section>
          <h3>{t("Historical section counts", "历史分项题数")}</h3>
          <Facts
            items={([1, 2, 3] as const).map((n) => [
              `HSK ${n}`,
              `${lead.quizBreakdown?.[`hsk${n}Correct`] ?? "—"} / ${lead.quizBreakdown?.[`hsk${n}Total`] ?? "—"}`,
            ])}
          />
        </section>
      )}
      {lead.quizResultSummary && (
        <details className="crm-customer-original">
          <summary>{t("Original saved notes", "已保存的原始说明")}</summary>
          <p>{lead.quizResultSummary}</p>
        </details>
      )}
    </div>
  );
}
type Conversation = {
  id: string;
  source: string;
  started_at?: string;
  created_at?: string;
};
type ConversationMessage = ChatTranscriptMessage & {
  conversation_id?: string;
};
export function CrmCustomerConversations({
  lead,
  lang,
  timezone,
}: DetailProps) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const [data, setData] = useState<{
    messages: ConversationMessage[];
    conversations: Conversation[];
  } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    const read = async (url: string) => {
      const r = await fetch(url, { signal: controller.signal });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || String(r.status));
      return d;
    };
    Promise.all([
      read(`/api/crm/leads/${encodeURIComponent(lead.id)}`),
      read(`/api/crm/leads/${encodeURIComponent(lead.id)}/conversations`),
    ])
      .then(([detail, conversations]) => {
        if (!controller.signal.aborted)
          setData({
            messages:
              detail.chatTranscript || detail.lead?.chatTranscript || [],
            conversations,
          });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [lead.id, lead.attention?.latest?.at, lead.updatedAt, retry]);
  if (error)
    return (
      <div role="alert">
        {crmError(error, lang)}{" "}
        <button
          type="button"
          className="crm-work-link"
          onClick={() => setRetry((v) => v + 1)}
        >
          {t("Retry", "重试")}
        </button>
      </div>
    );
  if (!data)
    return <p role="status">{t("Loading conversations…", "正在加载对话…")}</p>;
  const ids = [
    ...new Set([
      ...data.conversations.map((c) => c.id),
      ...data.messages.map((m) => m.conversation_id || "legacy"),
    ]),
  ];
  if (!data.messages.length)
    return (
      <p className="crm-work-muted">
        {t("No conversations recorded", "暂无对话记录")}
      </p>
    );
  return (
    <div className="crm-customer-conversations">
      {ids.map((id) => {
        const conversation = data.conversations.find((c) => c.id === id),
          messages = data.messages.filter(
            (m) => (m.conversation_id || "legacy") === id,
          );
        if (!messages.length) return null;
        return (
          <section key={id} className="crm-conversation">
            <h3>
              {crmValue(
                conversation?.source || messages[0]?.source || "legacy_unknown",
                lang,
              )}
            </h3>
            <div className="crm-work-muted">
              {t("Conversation", "会话")} ·{" "}
              {id === "legacy"
                ? t("Historical record", "历史记录")
                : id.slice(0, 12)}{" "}
              · {messages.length}{" "}
              {t(messages.length === 1 ? "message" : "messages", "条消息")}
            </div>
            {messages.map((m, i) => (
              <article
                key={m.id || i}
                className="crm-conversation-message"
                data-role={m.role}
              >
                <div className="crm-work-muted">
                  {m.role === "user"
                    ? lead.fullName
                    : m.role === "system" || m.metadata?.followupAction
                      ? t("UPER system", "UPER 系统")
                      : t("UPER AI advisor", "UPER AI 顾问")}{" "}
                  ·{" "}
                  {crmMessageTimeLabel(m, lang, (value) =>
                    formatCrmOperatingTime(value, timezone),
                  )}
                </div>
                <p>{m.content}</p>
                {["failed", "interrupted", "pending", "generating"].includes(
                  m.status || "",
                ) && (
                  <p className="crm-work-muted">
                    {m.status === "failed"
                      ? t("Reply failed", "回复失败")
                      : m.status === "interrupted"
                        ? t("Reply interrupted", "回复已中断")
                        : t("Reply pending", "等待回复")}
                  </p>
                )}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
