import { CRM_BOT_CHANNEL } from "./policy.ts";

export const SYSTEM_LARK_GROUP_NAME = "Lark 群通知";
const formerNames = new Set(["CRM Bot", "CRM Lark Bot", SYSTEM_LARK_GROUP_NAME]);

type GroupConfig = { groupName?: string; systemManaged?: boolean; deleted?: boolean };
type GroupRow<T extends GroupConfig> = { id: string; config: T };

export function isSystemLarkGroup(id: string, config?: GroupConfig) {
  return id === CRM_BOT_CHANNEL || config?.systemManaged === true;
}

export async function readSystemLarkGroupIds(db: {
  query: (sql: string) => Promise<{ rows: GroupRow<GroupConfig>[] }>;
}) {
  const { rows } = await db.query("SELECT id,config FROM notification_channels");
  return new Set(rows.filter(row => isSystemLarkGroup(row.id, row.config)).map(row => row.id));
}

export function findSystemLarkGroup<T extends GroupConfig>(rows: GroupRow<T>[], dailyGroups: string[]) {
  const active = rows.filter(row => !row.config.deleted);
  const system = active.find(row => isSystemLarkGroup(row.id, row.config));
  if (system) return system;
  const legacy = active.filter(row => formerNames.has(row.config.groupName?.trim() || ""));
  if (legacy.length === 1) return legacy[0];
  const referenced = legacy.filter(row => dailyGroups.includes(row.id));
  if (referenced.length === 1) return referenced[0];
}

export function systemLarkGroupName(id: string, config: GroupConfig | undefined, requested?: string) {
  if (!isSystemLarkGroup(id, config)) return requested?.trim() || config?.groupName;
  if (requested !== undefined && requested !== SYSTEM_LARK_GROUP_NAME)
    throw Object.assign(Error("The system Lark group name cannot be changed."), { status: 409 });
  return SYSTEM_LARK_GROUP_NAME;
}
