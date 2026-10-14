export type AccessScope = "own" | "team" | "all";
export type AccessWords = [string, string, string];
export type RoleConfig = {
  names: AccessWords;
  description: AccessWords;
  grants: Record<string, AccessScope>;
};
const p = (
  key: string,
  module: string,
  en: string,
  id: string,
  zh: string,
  scoped = false,
) => ({ key, module, names: [en, id, zh] as AccessWords, scoped });
export const permissionCatalog = [
  p("crm.read", "crm", "View customers", "Lihat pelanggan", "查看客户", true),
  p(
    "crm.write",
    "crm",
    "Edit customer profile",
    "Edit profil pelanggan",
    "编辑客户资料",
    true,
  ),
  p(
    "crm.followup",
    "crm",
    "Record follow-up and process tasks",
    "Catat tindak lanjut dan tangani tugas",
    "记录跟进及处理任务",
    true,
  ),
  p(
    "crm.attendance",
    "crm",
    "Confirm attendance",
    "Konfirmasi kehadiran",
    "确认到场",
    true,
  ),
  p(
    "crm.assign",
    "crm",
    "Assign customer owners",
    "Tetapkan penanggung jawab",
    "分配客户负责人",
    true,
  ),
  p(
    "crm.claim",
    "crm",
    "View and claim eligible unassigned customers",
    "Lihat dan ambil pelanggan tanpa penanggung jawab",
    "查看并认领符合范围的未分配客户",
    true,
  ),
  p(
    "crm.own",
    "crm",
    "Eligible customer owner",
    "Dapat menjadi penanggung jawab pelanggan",
    "可担任客户负责人",
  ),
  p(
    "crm.export",
    "crm",
    "Export customers",
    "Ekspor pelanggan",
    "导出客户",
    true,
  ),
  p(
    "crm.leader",
    "crm",
    "Receive manager fallback alerts",
    "Terima peringatan untuk manajer",
    "接收管理者兜底通知",
  ),
  p(
    "campaigns.manage",
    "operations",
    "Manage campaigns",
    "Kelola kampanye",
    "管理营销活动",
  ),
  p(
    "crm.operations.manage",
    "operations",
    "Manage sales calendar and policies",
    "Kelola kalender dan kebijakan penjualan",
    "管理销售日历及跟进策略",
  ),
  p(
    "notifications.read",
    "operations",
    "View notification configuration and audit",
    "Lihat konfigurasi dan audit notifikasi",
    "查看通知配置及发送审计",
  ),
  p(
    "notifications.manage",
    "operations",
    "Manage notification rules and channels",
    "Kelola aturan dan kanal notifikasi",
    "管理通知策略及渠道",
  ),
  p(
    "cms.manage",
    "cms",
    "Manage website content and media",
    "Kelola konten dan media situs",
    "管理网站内容及媒体",
  ),
  p(
    "applications.read",
    "hr",
    "Read recruitment submissions",
    "Lihat lamaran kerja",
    "查看招聘申请",
  ),
  p(
    "access.read",
    "system",
    "View users and effective access",
    "Lihat pengguna dan akses efektif",
    "查看用户及最终权限",
  ),
  p(
    "access.users",
    "system",
    "Manage users and role assignments",
    "Kelola pengguna dan penetapan peran",
    "管理用户及角色分配",
  ),
  p(
    "access.roles",
    "system",
    "Manage role definitions",
    "Kelola definisi peran",
    "管理角色定义",
  ),
  p(
    "access.sessions",
    "system",
    "Revoke sessions and reset credentials",
    "Cabut sesi dan atur ulang kredensial",
    "撤销会话及重置凭据",
  ),
  p(
    "access.audit",
    "system",
    "View access change audit",
    "Lihat audit perubahan akses",
    "查看权限变更审计",
  ),
];
const grants = (
  keys: string[],
  scope: AccessScope,
): Record<string, AccessScope> =>
  Object.fromEntries(keys.map((key) => [key, scope]));
export const builtInRoles: Record<string, RoleConfig> = {
  crm_leader: {
    names: ["CRM Manager", "Manajer CRM", "CRM 管理者"],
    description: [
      "Manage sales across all customers",
      "Kelola penjualan seluruh pelanggan",
      "管理全部客户的销售业务",
    ],
    grants: grants(
      [
        "crm.read",
        "crm.write",
        "crm.followup",
        "crm.attendance",
        "crm.assign",
        "crm.export",
        "crm.leader",
        "campaigns.manage",
        "crm.operations.manage",
        "notifications.read",
        "notifications.manage",
      ],
      "all",
    ),
  },
  sales: {
    names: ["Sales", "Staf penjualan", "销售"],
    description: [
      "Handle own customers and claim eligible unassigned customers",
      "Tangani pelanggan sendiri dan ambil pelanggan tanpa penanggung jawab",
      "处理本人客户并认领符合范围的未分配客户",
    ],
    grants: {
      ...grants(
        ["crm.read", "crm.write", "crm.followup", "crm.attendance", "crm.own"],
        "own",
      ),
      "crm.claim": "all",
    },
  },
  cms_admin: {
    names: ["CMS Operator", "Operator CMS", "CMS 操作员"],
    description: [
      "Manage website content",
      "Kelola konten situs",
      "管理网站内容",
    ],
    grants: grants(["cms.manage"], "all"),
  },
  hr_reader: {
    names: ["Recruitment reader", "Pembaca lamaran", "招聘查看员"],
    description: [
      "Read recruitment submissions only",
      "Hanya melihat lamaran kerja",
      "仅查看招聘申请",
    ],
    grants: grants(["applications.read"], "all"),
  },
  access_admin: {
    names: ["Access Administrator", "Administrator akses", "权限管理员"],
    description: [
      "Manage staff access; business data requires separate roles",
      "Kelola akses staf; data bisnis memerlukan peran lain",
      "管理员工权限；业务数据须另行授予角色",
    ],
    grants: grants(
      [
        "access.read",
        "access.users",
        "access.roles",
        "access.sessions",
        "access.audit",
      ],
      "all",
    ),
  },
};
export type AccessEmployee = {
  id: string;
  teams: string[];
  permissions: string[];
  scope: string;
  roles?: string[];
  active?: boolean;
  grants?: Record<string, AccessScope[]>;
  roleLabels?: Record<string, AccessWords>;
  rolePermissions?: Record<string, string[]>;
};
export function retireTeamGrants(config: RoleConfig): RoleConfig {
  const next = structuredClone(config);
  for (const [key, scope] of Object.entries(next.grants))
    if (scope === "team") {
      if (key === "crm.claim") next.grants[key] = "all";
      else delete next.grants[key];
    }
  if (!next.grants["crm.read"])
    for (const key of Object.keys(next.grants))
      if (
        key.startsWith("crm.") ||
        key.startsWith("notifications.") ||
        key === "campaigns.manage"
      )
        delete next.grants[key];
  if (!next.grants["crm.followup"]) {
    delete next.grants["crm.own"];
    delete next.grants["crm.claim"];
  }
  return next;
}
export function projectEmployee(
  row: any,
  roles: Array<{ id: string; config: RoleConfig; enabled: boolean }>,
): AccessEmployee & { displayName: string; scope: AccessScope } {
  const effective: Record<string, AccessScope[]> = {},
    labels: Record<string, AccessWords> = {},
    rolePermissions: Record<string, string[]> = {};
  for (const id of row.roles) {
    const role = roles.find((r) => r.id === id && r.enabled);
    if (!role) continue;
    labels[id] = role.config.names;
    rolePermissions[id] = Object.keys(retireTeamGrants(role.config).grants);
    for (const [key, scope] of Object.entries(
      retireTeamGrants(role.config).grants,
    )) {
      const currentScope = scope;
      effective[key] = [...new Set([...(effective[key] || []), currentScope])];
    }
  }
  const scopes = effective["crm.read"] || [];
  return {
    id: row.id,
    displayName: row.display_name,
    roles: row.roles,
    teams: row.teams,
    active: !!row.active,
    permissions: Object.keys(effective),
    grants: effective,
    roleLabels: labels,
    rolePermissions,
    scope: scopes.includes("all") ? "all" : "own",
  };
}
export function permittedRecord(
  e: AccessEmployee,
  profile: any,
  permission = "crm.read",
) {
  if (e.active === false || !e.permissions.includes(permission)) return false;
  const scopes = e.grants?.[permission] || [e.scope];
  return scopes.some(
    (scope) => scope === "all" || (scope === "own" && profile.owner === e.id),
  );
}
export function eligibleOwner(
  e: Pick<AccessEmployee, "permissions" | "active" | "roles">,
) {
  return (
    e.active === true &&
    (!("grants" in e) || e.permissions.includes("crm.followup")) &&
    (e.permissions.includes("crm.own") ||
      (!("grants" in e) && e.roles?.includes("sales")))
  );
}
export function canClaimRecord(e: AccessEmployee, profile: any) {
  if (profile.owner || !eligibleOwner(e)) return false;
  const scopes =
    e.grants?.["crm.claim"] ||
    (!e.grants && e.roles?.includes("sales") ? [e.scope] : []);
  const assigned = { ...profile, owner: e.id };
  return (
    scopes.some((scope) => scope === "all") &&
    (!e.grants ||
      (permittedRecord(e, assigned, "crm.read") &&
        permittedRecord(e, assigned, "crm.followup")))
  );
}
export function canDelegate(
  e: AccessEmployee,
  grants: Record<string, AccessScope>,
) {
  if (
    [
      "access.read",
      "access.users",
      "access.roles",
      "access.sessions",
      "access.audit",
    ].every((p) => e.permissions.includes(p))
  )
    return true;
  const rank: Record<string, number> = { own: 1, team: 2, all: 3 };
  return Object.entries(grants).every(
    ([permission, scope]) =>
      e.permissions.includes(permission) &&
      (e.grants?.[permission] || [e.scope]).some(
        (held) => rank[held] >= rank[scope],
      ),
  );
}
export function validateRole(config: RoleConfig) {
  if (
    !config ||
    Object.keys(config).some(
      (key) => !["names", "description", "grants"].includes(key),
    )
  )
    throw Error("access_invalid_role");
  for (const field of ["names", "description"] as const)
    if (
      !Array.isArray(config?.[field]) ||
      config[field].length !== 3 ||
      config[field].some(
        (v) =>
          typeof v !== "string" ||
          v.length > 400 ||
          (field === "names" && !v.trim()),
      )
    )
      throw Error("access_invalid_role");
  if (
    !config.grants ||
    Array.isArray(config.grants) ||
    typeof config.grants !== "object"
  )
    throw Error("access_invalid_role");
  for (const [key, scope] of Object.entries(config.grants)) {
    const entry = permissionCatalog.find((p) => p.key === key);
    if (
      !entry ||
      !["own", "all"].includes(scope) ||
      (key === "crm.own" ? scope !== "own" : !entry.scoped && scope !== "all")
    )
      throw Error("access_invalid_permission");
  }
  for (const key of [
    "crm.write",
    "crm.followup",
    "crm.attendance",
    "crm.assign",
    "crm.export",
    "crm.claim",
    "crm.own",
    "campaigns.manage",
    "crm.operations.manage",
    "notifications.read",
    "notifications.manage",
  ])
    if (config.grants[key] && !config.grants["crm.read"])
      throw Error("access_requires_read");
  for (const key of [
    "access.users",
    "access.roles",
    "access.sessions",
    "access.audit",
  ])
    if (config.grants[key] && !config.grants["access.read"])
      throw Error("access_requires_access_read");
  if (config.grants["crm.claim"] && config.grants["crm.claim"] !== "all")
    throw Error("access_invalid_permission");
  if (config.grants["crm.claim"] && !config.grants["crm.own"])
    throw Error("access_claim_requires_owner");
  if (config.grants["crm.own"] && !config.grants["crm.followup"])
    throw Error("access_owner_requires_followup");
  if (
    config.grants["notifications.manage"] &&
    !config.grants["notifications.read"]
  )
    throw Error("access_requires_notification_read");
}
