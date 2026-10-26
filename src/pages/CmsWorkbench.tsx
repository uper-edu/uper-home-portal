import "../components/admin-workspace.css";
import {PageMetadata} from "../components/PageMetadata";
import CrmAccess, {
  CrmAccountControls,
  type CrmEmployee,
} from "../components/CrmAccess";
import { AdminHeader, adminText } from "../components/AdminHeader";
import ContentManagementPanel from "../components/crm/ContentManagementPanel";
import { useAdminTheme } from "../utils/adminPreferences";
import type { CrmLanguage } from "../utils/crmLanguage";
function CmsWorkspace({
  employee,
  lang,
  setLang,
}: {
  employee: CrmEmployee;
  lang: CrmLanguage;
  setLang: (lang: CrmLanguage) => void;
}) {
  const { isLight, toggleTheme } = useAdminTheme();
  return (
    <div
      className={`min-h-screen flex flex-col font-sans ${isLight ? "bg-[#f5f5f7] text-slate-900" : "bg-slate-950 text-slate-100"}`}
    >

      <a className="admin-skip-link" href="#cms-main">
        {adminText(
          lang,
          "Skip to workspace",
          "Lewati ke ruang kerja",
          "跳到工作区",
        )}
      </a>
      <AdminHeader
        workspace="cms"
        employee={employee}
        lang={lang}
        setLang={setLang}
        isLight={isLight}
        toggleTheme={toggleTheme}
      />
      <main
        id="cms-main"
        tabIndex={-1}
        className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1560px] w-full mx-auto space-y-5"
      >
        <ContentManagementPanel isLight={isLight} lang={lang} />
      </main>
    </div>
  );
}
export default function CmsWorkbench() {
  return (
    <CrmAccess workspace="cms">
      {(employee, lang, setLang) =>
        employee.permissions.includes("cms.manage") ? (
          <CmsWorkspace employee={employee} lang={lang} setLang={setLang} />
        ) : (
          <main className="p-8"><PageMetadata lang={lang} options={{state:"denied"}}/>
            <CrmAccountControls lang={lang} isLight={true} />
            <h1>
              {adminText(
                lang,
                "CMS management access denied",
                "Tidak memiliki izin pengelolaan CMS",
                "无 CMS 管理权限",
              )}
            </h1>
            {employee.permissions.includes("crm.read") && (
              <a href="/crm">
                {adminText(
                  lang,
                  "Sales management",
                  "Manajemen penjualan",
                  "销售管理",
                )}
              </a>
            )}
          </main>
        )
      }
    </CrmAccess>
  );
}
