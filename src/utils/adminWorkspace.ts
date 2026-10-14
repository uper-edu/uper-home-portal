import type { CrmEmployee } from "../components/CrmAccess";
/** Navigation visibility mirrors permissions; server authorization remains mandatory. */
export function availableWorkspaces(
  employee: Pick<CrmEmployee, "permissions">,
) {
  return (["crm", "cms", "system"] as const).filter((workspace) =>
    employee.permissions.includes(
      workspace === "crm" ? "crm.read" : workspace === "cms" ? "cms.manage" : "access.read",
    ),
  );
}

/** Role display labels only; stored roles and server permissions are unchanged. */
export function adminRoleLabel(role: string, lang: 'en' | 'id' | 'zh') {
  const labels: Record<string, [string, string, string]> = {
    crm_leader: ['CRM Manager', 'Manajer CRM', 'CRM 管理者'],
    cms_admin: ['CMS Operator', 'Operator CMS', 'CMS 操作员'],
    sales: ['Sales', 'Staf penjualan', '销售'],
    access_admin: ['Access Administrator', 'Administrator akses', '权限管理员'],
  };
  return labels[role]?.[lang === 'zh' ? 2 : lang === 'id' ? 1 : 0] || role;
}
