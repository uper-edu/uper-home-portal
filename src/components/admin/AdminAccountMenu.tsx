import {PersonalLarkControls} from '../PersonalLarkControls';
import {RuntimeVersionStatus} from '../RuntimeVersionStatus';
import type {CrmEmployee} from '../CrmAccess';
import {adminRoleLabel,workspacePermissions,type AdminWorkspace} from '../../utils/adminWorkspace';
import {crmId} from '../../utils/crmIndonesian';
import type {CrmLanguage} from '../../utils/crmLanguage';

export function AdminAccountMenu({employee,lang,isLight,workspace,busy,error,onChangePassword,onLogout}: {
  employee: Pick<CrmEmployee,'id'|'displayName'|'roles'|'roleLabels'|'rolePermissions'>;
  lang: CrmLanguage;
  isLight: boolean;
  workspace?: AdminWorkspace;
  busy: boolean;
  error: string;
  onChangePassword: () => void;
  onLogout: () => Promise<void>;
}) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const roleLabel = (role: string) => employee.roleLabels?.[role]?.[lang === "zh"?2:lang === "id"?1:0] || adminRoleLabel(role, lang);
  const preferredRole = workspace === 'academics' ? 'academic_admin' : workspace === 'finance' ? 'finance' : workspace === 'system' ? 'access_admin' : workspace === 'cms' ? 'cms_admin' : employee.roles.includes('crm_leader') ? 'crm_leader' : 'sales';
  const permission=workspacePermissions[workspace??'crm'];
  const currentRole = employee.roles.includes(preferredRole) && (!employee.rolePermissions || employee.rolePermissions[preferredRole]?.includes(permission))
    ? preferredRole : employee.roles.find(role=>employee.rolePermissions?.[role]?.includes(permission))
      || (workspace==='academics'&&employee.roles.includes('finance')?'finance':employee.roles[0]) || '';
  return (
    <details
      className="relative shrink-0 ml-auto"
      aria-label={t("Account menu", "账号菜单")}
    >
      <summary
        className={workspace ? "admin-account-summary" : `list-none cursor-pointer flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-slate-800 border-slate-700 text-slate-100"}`}
      >
        <span className={workspace ? "admin-account-identity" : "flex flex-col gap-0.5"}>
          <span className="admin-account-name font-semibold">
            {employee.displayName || employee.id}
          </span>
          <span className={workspace ? "admin-account-role" : isLight ? "text-slate-500" : "text-slate-400"}>
            {workspace ? roleLabel(currentRole) : employee.roles.map(roleLabel).join(" + ")}
          </span>
        </span>
        <span aria-hidden="true">▾</span>
      </summary>
      <div
        className={workspace ? "admin-account-popover" : `absolute right-0 top-full mt-2 z-40 min-w-44 rounded-xl border shadow-lg p-1 text-xs ${isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-900 border-slate-700 text-slate-100"}`}
      >
        {workspace && <div className="admin-account-context"><strong>{employee.displayName || employee.id}</strong>{employee.roles.map(roleLabel).join(" · ")}</div>}
        <PersonalLarkControls key={employee.id} employeeId={employee.id} lang={lang} isLight={isLight}/>
        <button
          type="button"
          className="block w-full text-left rounded-lg px-3 py-2 hover:bg-primary-500/10"
          onClick={(e) => {
            e.currentTarget.closest("details")?.removeAttribute("open");
            onChangePassword();
          }}
        >
          {t("Change password", "修改密码")}
        </button>
        <button
          type="button"
          disabled={busy}
          className="block w-full text-left rounded-lg px-3 py-2 hover:bg-primary-500/10"
          onClick={() => onLogout()}
        >
          {t("Sign out", "退出登录")}
        </button>
        <RuntimeVersionStatus lang={lang} isLight={isLight}/>
        {error && (
          <p role="alert" className="text-rose-600 p-2">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
