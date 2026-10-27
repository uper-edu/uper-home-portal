import { useCrmUiText } from "./CrmUiLanguage";
import { CrmSalesStage, CrmStopContact } from "./CrmSalesStage";
import { CrmEvidenceAction } from "./CrmEvidenceAction";
import { crmValue } from "../../utils/crmLanguage";
import { crmSourcePresentation } from "../../utils/crmSourcePresentation";
import { CrmAiIndicator } from "./CrmAiIndicator";
import { ArrowUpRight } from "lucide-react";
/** A read-only view of existing values, never a sales conclusion or write. */
export function profileDisplay(value: any, lang: any = "zh"): string {
  if (value == null || value === "" || (Array.isArray(value) && !value.length))
    return "未记录";
  if (lang === "zh" && value === "course") return "整门课程";
  if (lang === "zh" && value === "month") return "每月";
  if (lang === "zh" && value === "hour") return "每小时";
  if (lang === "zh" && value === "IDR") return "印尼盾（IDR）";
  if (lang === "zh" && value === "Within 6 months") return "6个月内";
  return Array.isArray(value)
    ? value.map((v) => crmValue(String(v), lang)).join("、")
    : crmValue(String(value), lang);
}
export const goalEvidenceIds = (lead: any, events: any[] = []): string[] => {
  const ids = (lead.profileFieldMeta?.goal?.sourceFactIds || []).filter(
    (id: any) => typeof id === "string" && !!id,
  );
  return [
    ...new Set<string>(
      ids.map((id: string) => {
        const e = events.find(
          (e) => e.eventId === id && (!e.leadId || e.leadId === lead.id),
        );
        // Only an explicit AI-field -> extraction record edge identifies shared original evidence.
        // Manual edits and later corrections retain their independent record identity.
        if (
          e?.eventType === "profile.fields_updated" &&
          e.payload?.sourceType?.startsWith("ai_") &&
          e.payload.basisFactIds?.length === 1
        ) {
          const parent = events.find(
            (p) =>
              p.eventId === e.payload.basisFactIds[0] &&
              p.eventType === "information.extracted" &&
              (!p.leadId || p.leadId === lead.id),
          );
          if (parent) return parent.eventId;
        }
        return id;
      }),
    ),
  ].sort();
};

export function CrmSalesBrief({
  lead,
  lang,
  onEvidence,
  onProfile,
  milestones,
  evidenceEvents = [],
}: any) {
  const ui = useCrmUiText(lang),
    goal = lead.goal,
    hasGoal = typeof goal === "string" && !!goal.trim();
  const source = crmSourcePresentation(lead.profileFieldMeta?.goal?.sourceType),
    ids = goalEvidenceIds(lead, evidenceEvents);
  return (
    <section
      className="crm-sales-brief crm-sales-brief-compact crm-sales-brief-goal-only"
      aria-label={ui("客户当前情况")}
    >
      <div className="crm-followup-section-heading crm-sales-brief-heading">
        <h3 className="crm-sales-stage-focus">
          <span>{ui("销售阶段")}</span>
          <CrmSalesStage stage={lead.currentStage} lang={lang} />
        </h3>
      </div>
      {milestones && <div className="crm-sales-brief-events">{milestones}</div>}
      <section className="crm-sales-goal-context" aria-label={ui("学习目标")}>
        <span className="crm-sales-goal-context-label">{ui("学习目标")}</span>
        <span
          className="crm-sales-goal-context-value"
          data-empty={!hasGoal || undefined}
          title={hasGoal ? goal : undefined}
        >
          {hasGoal ? profileDisplay(goal, lang) : ui("暂无记录")}
        </span>
        <span className="crm-sales-goal-context-sources">
          {hasGoal && source.aiDerived && <CrmAiIndicator />}
          {hasGoal &&
            onEvidence &&
            ids.map((id: string, i: number) => (
              <CrmEvidenceAction
                key={id}
                description={
                  ui("查看") + ui("主要目标") + ui("的原文依据 · ") +
                  ui(source.label) +
                  (ids.length > 1 ? " · " + (i + 1) + "/" + ids.length : "")
                }
                onClick={() => onEvidence(id)}
              />
            ))}
        </span>
        {onProfile && (
          <button
            type="button"
            className="crm-work-link crm-goal-needs-link"
            onClick={onProfile}
          >
            {ui("查看学习需求")}
            <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        )}
      </section>
      {lead.contactArrangement?.state === "stopped" && (
        <aside className="crm-followup-restriction">
          <strong>
            <CrmStopContact lead={lead} lang={lang} />
          </strong>
          <p>{lead.contactArrangement.reason}</p>
        </aside>
      )}
    </section>
  );
}
