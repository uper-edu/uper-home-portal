import { CrmBuyingEvidence } from "./CrmBuyingEvidence";
import { CrmDisclosure } from "./CrmDisclosure";
import { crmId } from "../../utils/crmIndonesian";
import React, { useEffect, useState } from "react";
import type { CrmLeadRecord } from "../../types/crmLead";
import {
  crmValue,
  crmError,
  crmLocale,
  type CrmLanguage,
} from "../../utils/crmLanguage";
import { CrmConversationTimeline } from "./CrmConversationTimeline";
import type {
  ConversationMessage,
  ConversationRecord,
  ConversationTask,
} from "../../utils/crmConversations";
import { formatCrmOperatingTime } from "../../utils/crmOperatingTime";
import {
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
  communication,
  participation, identity, signalFocus, onSignalSource, onSignalTask,
}: DetailProps & {
  ownership: React.ReactNode;
  communication?: React.ReactNode;
  participation?: React.ReactNode;
  identity?: React.ReactNode;
  signalFocus?: {id:string;token:number};
  onSignalSource?: (e:any)=>void;
  onSignalTask?: (id:string)=>void;
}) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const tierSources: Record<string, [string, string]> = {
    predicted: ["Rule-based", "规则判断"],
    sales_confirmed: ["Sales confirmed", "销售确认"],
    behaviour_override: ["Customer activity", "客户行为"],
    buying_signal: ["Buying signal", "购买信号"],
  };
  const hasValue = (value: unknown) =>
    typeof value === "string" && Boolean(value.trim());
  const sourceItems: Array<[string, React.ReactNode]> = [
    ...(hasValue(lead.entryPoint)
      ? [
          [
            t("Acquisition entry", "获客入口"),
            crmValue(lead.entryPoint, lang),
          ] as [string, React.ReactNode],
        ]
      : []),
    ...(hasValue(lead.campaign)
      ? [
          [t("Campaign", "营销活动"), lead.campaign] as [
            string,
            React.ReactNode,
          ],
        ]
      : hasValue(lead.campaignId)
        ? [
            [
              t("Campaign", "营销活动"),
              t("Campaign name not recorded", "活动名称未记录"),
            ] as [string, React.ReactNode],
          ]
        : []),
  ];
  if (hasValue(lead.submittedAt))
    sourceItems.push([
      t("Registered", "登记时间"),
      knownDate(lead.submittedAt, timezone, lang),
    ]);
  const outcomeItems: Array<[string, React.ReactNode]> = [
    ...(hasValue(lead.outcome)
      ? [
          [t("Outcome", "结果"), customerOutcome(lead.outcome, lang)] as [
            string,
            React.ReactNode,
          ],
        ]
      : []),
    ...(hasValue(lead.enrolledClass)
      ? [
          [t("Enrolled class", "报名班级"), lead.enrolledClass] as [
            string,
            React.ReactNode,
          ],
        ]
      : []),
    ...(typeof lead.revenue === "number" && Number.isFinite(lead.revenue)
      ? [
          [
            t("Recorded amount", "登记金额"),
            `Rp ${lead.revenue.toLocaleString(crmLocale(lang))}`,
          ] as [string, React.ReactNode],
        ]
      : []),
  ];
  const trackingItems: Array<[string, React.ReactNode]> = [
    ...(hasValue(lead.campaignId)
      ? [
          [t("Campaign ID", "活动标识"), lead.campaignId] as [
            string,
            React.ReactNode,
          ],
        ]
      : []),
    ...(hasValue(lead.placement)
      ? [
          [
            t("Link placement", "链接投放位置"),
            crmValue(lead.placement, lang),
          ] as [string, React.ReactNode],
        ]
      : []),
    ...(hasValue(lead.hookType)
      ? [
          [
            t("Acquisition content", "获客引导内容"),
            crmValue(lead.hookType, lang),
          ] as [string, React.ReactNode],
        ]
      : []),
    ...(hasValue(lead.hookContext)
      ? [
          [
            t("Acquisition context", "获客场景"),
            crmValue(lead.hookContext, lang),
          ] as [string, React.ReactNode],
        ]
      : []),
  ];
  const activityRecords = (lead.attendanceRecords || []).filter(
    (record) => record && typeof record === "object",
  );
  return (
    <div className="crm-customer-sections crm-customer-profile">
      <section>
        <h3>{t("Customer and contact details", "客户与联系方式")}</h3>
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
              t("Preferred communication language", "首选沟通语言"),
              communication || t("Not recorded", "未记录"),
            ],
          ]}
        />
        {identity}
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
        <h3>{t("Sales progress", "销售进展")}</h3>
        {ownership}

        {outcomeItems.length > 0 && (
          <section className="crm-profile-outcome">
            <h4>{t("Recorded outcome", "已登记业务结果")}</h4>
            <Facts items={outcomeItems} />
          </section>
        )}
      </section>
      <section className="crm-profile-group">
        <h3 className="crm-profile-group-heading">
          {t("Customer group", "客户分组")}
        </h3>
        <Facts
          items={[
            [
              t("Current group", "当前分组"),
              hasValue(lead.tier)
                ? crmValue(lead.tier, lang)
                : t("Not recorded", "未记录"),
            ],
            [
              t("Classification source", "分组来源"),
              (lang === "id"
                ? crmId(tierSources[lead.tierSource]?.[0])
                : tierSources[lead.tierSource]?.[lang === "zh" ? 1 : 0]) ||
                t("Not recorded", "未记录"),
            ],
            ...(hasValue(lead.tierConfirmed)
              ? [
                  [
                    t("Sales-confirmed group", "人工确认分组"),
                    crmValue(lead.tierConfirmed, lang),
                  ] as [string, React.ReactNode],
                ]
              : []),
            ...(hasValue(lead.tierPredicted)
              ? [
                  [
                    t("Rule-calculated group", "规则计算分组"),
                    crmValue(lead.tierPredicted, lang),
                  ] as [string, React.ReactNode],
                ]
              : []),
            [
              t("Group updated", "分组更新时间"),
              knownDate(lead.tierUpdatedAt, timezone, lang),
            ],
          ]}
        />
        <CrmBuyingEvidence lead={lead} lang={lang} timezone={timezone} focus={signalFocus} onSource={onSignalSource} onTask={onSignalTask}/>
      </section>
      <section>
        <CrmDisclosure
          heading={
            <>{t("Acquisition and activity records", "获客来源与活动记录")}</>
          }
          className="crm-acquisition-records"
        >
          <div className="crm-acquisition-body">
            {sourceItems.length > 0 ? (
              <div>
                <h4>{t("Acquisition source", "获客来源")}</h4>
                <Facts items={sourceItems} />
              </div>
            ) : (
              <p className="crm-work-muted">
                {t("Acquisition source not recorded", "获客来源未记录")}
              </p>
            )}
            {trackingItems.length > 0 && (
              <section className="crm-detail-subsection ">
                <h4>{t("Source tracking details", "来源追踪详情")}</h4>
                <Facts items={trackingItems} />
              </section>
            )}
            {(activityRecords.length > 0 ||
              lead.attendanceConfirmed !== undefined) && (
              <section className="crm-detail-subsection crm-participation-history">
                <h4>{t("Saved activity records", "已保存活动记录")}</h4>
                {activityRecords.map((record, index) => (
                  <article key={record.campaignId || index}>
                    <Facts
                      items={[
                        [t("Campaign ID", "活动标识"), record.campaignId],
                        [
                          t("Participation status", "参与记录状态"),
                          record.confirmed === true
                            ? t("Confirmed", "已确认")
                            : record.confirmed === false
                              ? t("Withdrawn", "已撤销")
                              : t("Not recorded", "未记录"),
                        ],
                        [
                          t("Participation mode", "参与方式"),
                          record.mode === "onsite"
                            ? t("Onsite", "现场")
                            : record.mode === "online"
                              ? t("Online", "线上")
                              : t("Not recorded", "未记录"),
                        ],
                        [t("Recorded by", "记录人"), record.actor],
                        [
                          t("Recorded", "记录时间"),
                          knownDate(record.recordedAt, timezone, lang),
                        ],
                        [
                          t("Evidence / reason", "确认依据／原因"),
                          <span className="crm-participation-note">
                            {record.reason}
                          </span>,
                        ],
                      ]}
                    />
                  </article>
                ))}
                {lead.attendanceConfirmed !== undefined && (
                  <Facts
                    items={[
                      [
                        t(
                          "Legacy attendance flag (unscoped)",
                          "历史出席标记（未关联活动）",
                        ),
                        lead.attendanceConfirmed
                          ? t("Yes", "是")
                          : t("No", "否"),
                      ],
                    ]}
                  />
                )}
              </section>
            )}
          </div>
        </CrmDisclosure>
        {participation}
      </section>
    </div>
  );
}
export { CrmCustomerAssessment } from "./CrmAssessmentDetails";
export function CrmCustomerConversations({
  lead,
  lang,
  timezone,
  onOpenTask,
  conversationContext,
  isLight,
}: DetailProps & {
  isLight: boolean;
  onOpenTask: (taskId: string, message: ConversationMessage) => void;
  conversationContext?: {
    conversationId?: string;
    messageId?: string;
    requestId?: string;
  };
}) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const [data, setData] = useState<{
    leadId: string;
    messages: ConversationMessage[];
    conversations: ConversationRecord[];
    tasks: ConversationTask[];
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
      read(`/api/crm/leads/${encodeURIComponent(lead.id)}/tasks`),
    ])
      .then(([detail, conversations, tasks]) => {
        if (!controller.signal.aborted)
          setData({
            leadId: lead.id,
            messages:
              detail.chatTranscript || detail.lead?.chatTranscript || [],
            conversations,
            tasks,
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
  if (!data || data.leadId !== lead.id)
    return <p role="status">{t("Loading conversations…", "正在加载对话…")}</p>;
  return (
    <CrmConversationTimeline
      key={lead.id}
      lead={lead}
      lang={lang}
      timezone={timezone}
      isLight={isLight}
      messages={data.messages}
      conversations={data.conversations}
      tasks={data.tasks}
      onOpenTask={onOpenTask}
      conversationContext={conversationContext}
    />
  );
}
