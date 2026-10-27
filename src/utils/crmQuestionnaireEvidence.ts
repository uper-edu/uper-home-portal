/** Read-only allowlist: never turn internal identifiers or inferred profile values into questionnaire answers. */
export const questionnaireFields = [
  ["fullName", "姓名"],
  ["whatsapp", "WhatsApp"],
  ["email", "电子邮件"],
  ["city", "城市"],
  ["currentStatus", "客户身份"],
  ["goal", "主要学习目标"],
  ["goals", "其他学习目标"],
  ["reportedLevel", "自报水平"],
  ["mode", "授课方式"],
  ["buyingSignals", "问卷关注内容"],
  ["nextStepInterest", "希望了解的内容"],
  ["campaignName", "营销活动"],
  ["entryPoint", "获客入口"],
] as const;
export function questionnaireAnswers(source: any) {
  let raw =
    source.questionnaire || source.answers || source.root?.payload?.answers;
  if (!raw && typeof (source.text || source.original) === "string") {
    try {
      raw = JSON.parse(source.text || source.original);
    } catch {}
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: any = {};
  for (const [key] of questionnaireFields) {
    const v = raw[key];
    if (
      typeof v === "string" &&
      v.trim() &&
      !["null", "undefined"].includes(v.trim())
    )
      result[key] = v;
    else if (Array.isArray(v)) {
      const values = [
        ...new Set(
          v.filter(
            (x) =>
              typeof x === "string" &&
              x.trim() &&
              !["null", "undefined"].includes(x.trim()),
          ),
        ),
      ];
      if (values.length) result[key] = values;
    }
  }
  if (
    !result.fullName &&
    typeof raw.name === "string" &&
    raw.name.trim() &&
    !["null", "undefined"].includes(raw.name.trim())
  )
    result.fullName = raw.name;
  result.buyingSignals = [
    ...new Set([
      ...(result.buyingSignals || []),
      ...(typeof raw.buyingSignal === "string" &&
      raw.buyingSignal !== "None yet"
        ? [raw.buyingSignal]
        : []),
    ]),
  ].filter((v) => v !== "None yet");
  return result;
}
const instant = (v: any) =>
  typeof v === "string" &&
  /(Z|[+-]\d\d:\d\d)$/.test(v) &&
  Number.isFinite(Date.parse(v))
    ? new Date(v).toISOString()
    : null;
export function questionnaireTimes(source: any) {
  let raw =
    source.questionnaire || source.answers || source.root?.payload?.answers;
  if (!raw) {
    try {
      raw = JSON.parse(source.text || source.original || "{}");
    } catch {}
  }
  return {
    submittedAt:
      instant(source.submittedAt) ||
      instant(source.root?.payload?.submittedAt) ||
      instant(raw?.submittedAt),
    receivedAt:
      instant(source.receivedAt) ||
      instant(source.recordedAt) ||
      instant(source.root?.recordedAt),
  };
}
export function isQuestionnaireSource(s: any) {
  return (
    s.category === "questionnaire" ||
    s.label === "客户问卷" ||
    s.sourceKind === "questionnaire" ||
    !!s.questionnaire
  );
}
