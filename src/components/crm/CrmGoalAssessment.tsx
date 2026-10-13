import React from "react";
import type { CrmLeadRecord } from "../../types/crmLead";
import { crmAssessmentSummary } from "../../utils/crmAssessment";
export function CrmGoalAssessment({
  lead,
  lang,
  isLight,
  showGoal = true,
}: {
  lead: CrmLeadRecord;
  lang: "en" | "zh" | "id";
  isLight: boolean;
  showGoal?: boolean;
}) {
  const summary = crmAssessmentSummary(lead, lang);
  return (
    <div
      className="crm-goal-assessment"
      data-theme={isLight ? "light" : "dark"}
      data-source={summary.kind}
    >
      {showGoal && (
        <div className="crm-assessment-goal" title={summary.goal}>
          {summary.goal}
        </div>
      )}
      <div className="crm-assessment-conclusion">{summary.conclusion}</div>
      <div className="crm-assessment-detail">{summary.detail}</div>
    </div>
  );
}
