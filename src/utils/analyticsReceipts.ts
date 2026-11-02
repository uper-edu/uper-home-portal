/** Analytics observes confirmed operations. Identifiers are local deduplication keys, never event parameters. */
export type AnalyticsReceipt = {
  event: string;
  key: string;
  params: Record<string, unknown>;
};
export function registrationAnalyticsReceipt(
  data: any,
  source: "standalone_chat" | "homepage_widget",
): AnalyticsReceipt | null {
  if (
    data?.saved !== true ||
    typeof data.submissionId !== "string" ||
    !data.submissionId ||
    typeof data.lead?.id !== "string" ||
    !data.lead.id
  )
    return null;
  return {
    event:
      source === "standalone_chat"
        ? "questionnaire_complete"
        : "lead_form_complete",
    key: data.submissionId,
    params: {
      entry_point: source,
      method: source === "standalone_chat" ? "questionnaire" : "form",
    },
  };
}
export function assessmentAnalyticsReceipt(
  result: any,
  expectedAttempt: string,
): AnalyticsReceipt | null {
  if (
    result?.saveStatus !== "saved" ||
    !expectedAttempt ||
    result.attempt?.attemptId !== expectedAttempt ||
    !result.attempt?.completedAt
  )
    return null;
  return {
    event: "assessment_complete",
    key: expectedAttempt,
    params: { assessment_mode: result.attempt.mode },
  };
}
export function progressAnalyticsReceipt(
  data: any,
  leadId: string,
): AnalyticsReceipt | null {
  if (
    !leadId ||
    data?.lead?.id !== leadId ||
    !data.logId ||
    !Array.isArray(data.lead.followUpLogs) ||
    !data.lead.followUpLogs.some((row: any) => row?.id === data.logId)
  )
    return null;
  return {
    event: "crm_progress_saved",
    key: data.logId,
    params: { operation: "progress" },
  };
}
export function advisorAnalyticsReceipt(
  result: any,
  message: any,
): AnalyticsReceipt | null {
  if (
    result?.saved !== true ||
    result.status !== "awaiting_advisor" ||
    !["recorded", "review_required"].includes(result.taskOperation) ||
    message?.action !== "handoff" ||
    !message.id
  )
    return null;
  return {
    event: "advisor_request",
    key: message.id,
    params: { method: "explicit_request", action: "handoff" },
  };
}

/** Registration can confirm a previously anonymous explicit request in the same transaction. */
export function registrationAdvisorAnalyticsReceipts(data:any):AnalyticsReceipt[] {
  if(!registrationAnalyticsReceipt(data,'homepage_widget')||!Array.isArray(data.advisorRequests))return [];
  return data.advisorRequests.flatMap((request:any)=>{
    if(request?.leadId!==data.lead.id||typeof request.messageId!=='string'||!request.messageId)return [];
    const receipt=advisorAnalyticsReceipt({saved:true,status:request.status,taskOperation:request.taskOperation},{id:request.messageId,action:request.action});
    return receipt?[receipt]:[];
  });
}

export function profileAnalyticsReceipt(
  data: any,
  leadId: string,
  requestId: string,
  scope: string,
): AnalyticsReceipt | null {
  if (
    !requestId ||
    data?.lead?.id !== leadId ||
    !Array.isArray(data.profileFieldResults) ||
    !data.profileFieldResults.some((row: any) => row?.status === "applied")
  )
    return null;
  return {
    event: "crm_profile_saved",
    key: requestId,
    params: {
      operation: "profile",
      profile_scope: scope === "basic" ? "basic" : "needs",
    },
  };
}
