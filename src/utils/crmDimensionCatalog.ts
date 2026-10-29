import { crmUiText } from "./crmUiText";
import {CLASS_EQUIPMENT_KEY,classEquipmentWords,classEquipmentDefinition,classEquipmentLabels,validateClassEquipment} from './crmClassEquipment';

export const CRM_DIMENSION_CATALOG_VERSION = "crm-dimensions-v1";
export type DimensionWords = { en: string; id: string; zh: string };
export type DimensionType =
  "text" | "number" | "text_list" | "enum" | "enum_list" | "business";
export type DimensionDefinition = {
  key: string;
  origin: "system" | "ai";
  category: "profile" | "insight" | "protected";
  labels: DimensionWords;
  definition: DimensionWords;
  valueType: DimensionType;
  constraints: {
    nullable?: boolean;
    maxLength?: number;
    maxItems?: number;
    itemMaxLength?: number;
    min?: number;
    max?: number;
    options?: readonly string[];
  };
  protection: {
    aiWrite: "profile" | "insight" | "evidence_only";
    definitionLocked: true;
    businessBindingLocked: true;
  };
  storage: { kind: "profile_field" | "insight" | "business"; key: string };
  version: 1|2;
  optionLabels?:Record<string,DimensionWords>;
};
/** The persisted AI definition remains unchanged. Additional policy is supplied by trusted code. */
export type AiDimensionRecord = {
  key: string;
  labels: DimensionWords;
  definition: DimensionWords;
  createdBy: "ai";
};
const words = (zh: string): DimensionWords => ({
  zh,
  en: crmUiText(zh, "en"),
  id: crmUiText(zh, "id"),
});
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) freeze(v);
    Object.freeze(value);
  }
  return value;
}
const profile = (
  key: string,
  label: string,
  valueType: DimensionType,
  definition: DimensionWords,
  constraints: Partial<DimensionDefinition["constraints"]> = {},
): DimensionDefinition =>
  freeze({
    key,
    origin: "system",
    category: "profile",
    labels: words(label),
    definition,
    valueType,
    constraints: {
      nullable: true,
      ...(valueType === "text" || valueType === "enum"
        ? { maxLength: 500 }
        : {}),
      ...constraints,
    },
    protection: {
      aiWrite: "profile",
      definitionLocked: true,
      businessBindingLocked: true,
    },
    storage: { kind: "profile_field", key },
    version: 1,
  });
const meaning = (en: string, id: string, zh: string) => ({ en, id, zh });
export const systemProfileDimensions: readonly DimensionDefinition[] = freeze([
  profile(
    "goal",
    "主要学习目标",
    "text",
    meaning(
      "Primary current learning goal.",
      "Tujuan utama belajar saat ini.",
      "当前主要学习目标。",
    ),
  ),
  profile(
    "goals",
    "其他学习目标",
    "text_list",
    meaning(
      "Additional learning goals; explicit list operations retain their sources.",
      "Tujuan belajar tambahan dengan sumber dan perubahan daftar yang jelas.",
      "其他学习目标；按明确列表操作及来源维护。",
    ),
    { maxItems: 8, itemMaxLength: 300 },
  ),
  profile(
    "targetHskLevel",
    "目标HSK等级",
    "text",
    meaning(
      "Desired HSK level, separate from real assessment scores.",
      "Target tingkat HSK, terpisah dari hasil tes nyata.",
      "希望达到的HSK等级，不是真实测评成绩。",
    ),
  ),
  profile(
    "hskExamPlan",
    "考试计划",
    "text",
    meaning(
      "Reported exam plans without invented booking times.",
      "Rencana ujian yang disampaikan tanpa membuat waktu pemesanan.",
      "客户表达的考试计划，不补造确定预约时间。",
    ),
  ),
  profile(
    "preferredStart",
    "希望开始时间",
    "text",
    meaning(
      "Stated course-start preference, not a confirmed appointment.",
      "Preferensi mulai kursus, bukan janji yang dikonfirmasi.",
      "希望开始课程的时间偏好，不等于已确认预约。",
    ),
  ),
  profile(
    "city",
    "城市",
    "text",
    meaning(
      "Current residence city supported by source evidence.",
      "Kota domisili saat ini berdasarkan sumber.",
      "有原文依据的当前居住城市。",
    ),
  ),
  profile(
    "mode",
    "授课方式",
    "enum",
    meaning(
      "Preferred class delivery mode.",
      "Preferensi metode kelas.",
      "授课方式偏好。",
    ),
    { options: ["Online", "Offline", "Not sure"] },
  ),
  profile(
    "availability",
    "可上课时段",
    "text",
    meaning(
      "Stated learning availability, preserving original conditions.",
      "Waktu belajar yang tersedia beserta syarat aslinya.",
      "可学习时段，保留原文条件。",
    ),
  ),
  profile(
    "budgetAmount",
    "课程总预算",
    "number",
    meaning(
      "One nonnegative whole-course budget amount in IDR; existing scope checks still apply.",
      "Satu anggaran total kursus dalam IDR; pemeriksaan cakupan tetap berlaku.",
      "以IDR表示的单一课程总预算金额；既有预算口径校验继续执行。",
    ),
    { min: 0, max: 1e12 },
  ),
  profile(
    "concerns",
    "主要顾虑",
    "text_list",
    meaning(
      "Stated concerns; omission alone does not withdraw a concern.",
      "Kendala yang disampaikan; tidak disebut ulang bukan berarti ditarik.",
      "明确表达的顾虑；未再次提及不等于撤回。",
    ),
    { maxItems: 12, itemMaxLength: 300 },
  ),
  profile(
    "communicationLanguage",
    "首选沟通语言",
    "enum",
    meaning(
      "Preferred communication language.",
      "Bahasa komunikasi yang dipilih.",
      "沟通语言偏好。",
    ),
    { options: ["en", "id", "zh", "unknown"] },
  ),
  profile(
    "preferredChannel",
    "首选联系渠道",
    "text",
    meaning(
      "Preferred contact channel; never a contact number or permission.",
      "Saluran kontak pilihan, bukan nomor atau izin menghubungi.",
      "联系渠道偏好，不是联系号码或联系授权。",
    ),
  ),
]);
const protectedLabels: Record<string, string> = {
  fullName: "姓名",
  phone: "电话",
  whatsapp: "WhatsApp",
  email: "电子邮件",
  parentContact: "家长联系方式",
  currentStatus: "客户身份",
  identity: "身份归并",
  owner: "客户负责人",
  permissions: "权限",
  currentStage: "销售阶段",
  taskStatus: "任务状态",
  taskDueAt: "任务期限",
  contactState: "主动联系安排",
  commitments: "客户约定",
  assessmentResult: "真实测评成绩",
  payment: "付款记录",
  originalRecords: "原始记录",
  audit: "审计记录",
  campaignAttribution: "原始活动归因",
  tier: "客户分组",
};
export const protectedDimensions: readonly DimensionDefinition[] = freeze(
  Object.entries(protectedLabels).map(([key, label]) => ({
    key,
    origin: "system",
    category: "protected",
    labels: words(label),
    definition: meaning(
      "Protected business information. AI may retain evidence but cannot write this value.",
      "Informasi bisnis dilindungi. AI dapat menyimpan bukti tetapi tidak mengubah nilainya.",
      "受保护业务信息；AI可保留陈述依据，不能直接写入当前值。",
    ),
    valueType: "business",
    // This is a protection declaration, not a replacement schema for the owning business module.
    constraints: {},
    protection: {
      aiWrite: "evidence_only",
      definitionLocked: true,
      businessBindingLocked: true,
    },
    storage: { kind: "business", key },
    version: 1,
  })),
);
export const systemDimensions: readonly DimensionDefinition[] = freeze([
  ...systemProfileDimensions,
  ...protectedDimensions,
]);
export const insightValueConstraints = freeze({
  nullable: false,
  maxLength: 2000,
});
const systemByKey = new Map(systemDimensions.map((d) => [d.key, d]));
const reserved = new Set(
  [
    "constructor",
    "prototype",
    "__proto__",
    ...systemDimensions.flatMap((d) => [d.key, ...Object.values(d.labels)]),
  ].map((s) => s.trim().toLowerCase()),
);
export const systemDimension = (key: string) => systemByKey.get(key);
export const dimensionFieldLabels = (
  category: "profile" | "protected",
): Record<string, string> =>
  Object.fromEntries(
    systemDimensions
      .filter((d) => d.category === category)
      .map((d) => [d.key, d.labels.zh]),
  );
const fail = (message: string): never => {
  throw Object.assign(Error(message), { status: 400 });
};
export function assertAiProfileDimension(key: string) {
  const d = systemDimension(key);
  if (!d || d.category !== "profile" || d.protection.aiWrite !== "profile")
    fail("AI不能自动修改此资料字段：" + key);
  return d;
}
export function assertAiInsightKey(key: unknown): asserts key is string {
  if (
    typeof key !== "string" ||
    !/^[a-z][a-z_]{1,63}$/.test(key) ||
    reserved.has(key.toLowerCase())
  )
    fail("洞察不能使用核心或受保护字段");
}
const validWords = (v: any, max: number) =>
  v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).length === 3 &&
  ["en", "id", "zh"].every(
    (k) => typeof v[k] === "string" && !!v[k].trim() && v[k].length <= max,
  );
export function validateAiDimensionRecord(
  raw: any,
  key: string,
): AiDimensionRecord {
  assertAiInsightKey(key);
  if (
    !raw ||
    Object.keys(raw).some(
      (k) => !["labels", "definition", "key", "createdBy"].includes(k),
    ) ||
    !validWords(raw.labels, 80) ||
    !validWords(raw.definition, 400)
  )
    fail("洞察维度必须包含三语名称和定义");
  if (
    Object.values(raw.labels).some((s: any) =>
      reserved.has(s.trim().toLowerCase()),
    )
  )
    fail("已有资料维度不能另建为客户洞察");
  return {
    key,
    labels: { ...raw.labels },
    definition: { ...raw.definition },
    createdBy: "ai",
  };
}
export function aiInsightDefinition(
  raw: AiDimensionRecord,
): DimensionDefinition {
  const d = validateAiDimensionRecord(raw, raw.key);
  return freeze({
    key: d.key,
    origin: "ai",
    category: "insight",
    labels: d.key===CLASS_EQUIPMENT_KEY?classEquipmentWords:d.labels,
    definition: d.key===CLASS_EQUIPMENT_KEY?classEquipmentDefinition:d.definition,
    valueType: d.key===CLASS_EQUIPMENT_KEY?'enum_list':"text",
    constraints: d.key===CLASS_EQUIPMENT_KEY?{nullable:false,options:Object.keys(classEquipmentLabels),maxItems:6}:insightValueConstraints,
    protection: {
      aiWrite: "insight",
      definitionLocked: true,
      businessBindingLocked: true,
    },
    storage: { kind: "insight", key: d.key },
    version: d.key===CLASS_EQUIPMENT_KEY?2:1,
    ...(d.key===CLASS_EQUIPMENT_KEY?{optionLabels:classEquipmentLabels}:{}),
  });
}
/** Read-only metadata, never customer values. System policy cannot be overridden by persisted AI metadata. */
export function buildDimensionCatalog(
  records: readonly AiDimensionRecord[] = [],
): readonly DimensionDefinition[] {
  const dimensions = [...systemDimensions],
    seen = new Set(dimensions.map((d) => d.key));
  for (const raw of records) {
    const d = aiInsightDefinition(raw);
    if (seen.has(d.key)) continue;
    seen.add(d.key);
    dimensions.push(d);
  }
  return freeze(dimensions);
}
/** Compact model view of the same trusted definitions; no customer values or storage internals. */
export function extractionDimensionCatalog(
  dimensions: readonly DimensionDefinition[],
) {
  return dimensions.map((d) => ({
    key: d.key,
    category: d.category,
    origin: d.origin,
    label: d.labels.en,
    definition: d.definition.en,
    valueType: d.valueType,
    constraints: d.constraints,
    aiWrite: d.protection.aiWrite,
  }));
}
export function validateAiInsightValue(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > insightValueConstraints.maxLength
  )
    fail("所选字段为空或过长");
  return value;
}
/** Type/shape checks only; business semantics and adoption rules stay in their existing handlers. */
export function validateDimensionValue(
  d: DimensionDefinition,
  value: unknown,
): any {
  if (d.category === "protected" || d.valueType === "business")
    fail("受保护业务字段不能通过维度资料入口修改");
  if (value === null) {
    if (d.constraints.nullable) return null;
    fail("所选字段为空或过长");
  }
  if(d.valueType==='enum_list')return validateClassEquipment(value);
  if (d.valueType === "text_list") {
    if (
      !Array.isArray(value) ||
      value.length > (d.constraints.maxItems ?? Infinity) ||
      value.some(
        (v) =>
          typeof v !== "string" ||
          !v.trim() ||
          v.length > (d.constraints.itemMaxLength ?? Infinity),
      )
    )
      fail("资料列表格式不正确");
    return [...new Set((value as string[]).map((v) => v.trim()))];
  }
  if (d.valueType === "number") {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < (d.constraints.min ?? -Infinity) ||
      value > (d.constraints.max ?? Infinity)
    )
      fail("预算必须是有效非负数");
    return value;
  }
  if (d.category === "insight") return validateAiInsightValue(value);
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > (d.constraints.maxLength ?? Infinity)
  )
    fail("所选字段为空或过长");
  const text = (value as string).trim();
  if (d.valueType === "enum" && !d.constraints.options?.includes(text))
    fail(
      d.key === "communicationLanguage" ? "沟通语言不正确" : "授课方式不正确",
    );
  // Existing insight values preserve the original whitespace; profile fields retain their existing trimming.
  return text;
}
