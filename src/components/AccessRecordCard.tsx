import type { ReactNode } from "react";
import { adminText } from "./AdminHeader";
import type { CrmLanguage } from "../utils/crmLanguage";

type Common = {
  name: string;
  active: boolean;
  lang: CrmLanguage;
  onEdit?: () => void;
};

function RecordHeader({
  name,
  active,
  lang,
  current = false,
}: Common & { current?: boolean }) {
  const t = (en: string, id: string, zh: string) => adminText(lang, en, id, zh);
  return (
    <header className="access-record-heading">
      <div className="access-record-identity">
        <h2>{name}</h2>
        {current && (
          <span
            className="access-current-user"
            aria-label={t(
              "Signed-in user",
              "Pengguna yang sedang login",
              "当前登录用户",
            )}
          >
            {t("You", "Anda", "当前用户")}
          </span>
        )}
      </div>
      <span className="access-record-status" data-active={active}>
        {active
          ? t("Active", "Aktif", "已启用")
          : t("Disabled", "Nonaktif", "已停用")}
      </span>
    </header>
  );
}

function RecordField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <dl className="access-record-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </dl>
  );
}

function RecordAction({
  name,
  onEdit,
  label,
}: {
  name: string;
  onEdit?: () => void;
  label: string;
}) {
  return (
    <footer className="access-record-action">
      {onEdit && (
        <button aria-label={`${label}: ${name}`} onClick={onEdit}>
          {label}
        </button>
      )}
    </footer>
  );
}

export function AccessUserCard({
  name,
  active,
  lang,
  onEdit,
  current,
  loginId,
  email,
  roles,
}: Common & {
  current: boolean;
  loginId: string;
  email?: string | null;
  roles: { id: string; label: string }[];
}) {
  const t = (en: string, id: string, zh: string) => adminText(lang, en, id, zh);
  const chip = (role: { id: string; label: string }) => (
    <span className="access-role-chip" key={role.id}>
      {role.label}
    </span>
  );
  return (
    <section className="access-card access-user-card">
      <RecordHeader name={name} active={active} lang={lang} current={current} />
      <RecordField label={t("Login ID", "ID login", "登录ID")}>
        {loginId}
      </RecordField>
      <RecordField label={t("Login email", "Email login", "登录邮箱")}>
        {email || (
          <span className="access-record-empty">
            {t("Not set", "Belum diisi", "未设置")}
          </span>
        )}
      </RecordField>
      <RecordField label={t("Roles", "Peran", "角色")}>
        {roles.length ? (
          <div className="access-role-list">{roles.slice(0, 2).map(chip)}</div>
        ) : (
          <span className="access-record-empty">
            {t("No roles", "Tanpa peran", "未授予角色")}
          </span>
        )}
        {roles.length > 2 && (
          <details className="access-role-overflow">
            <summary>
              {t(
                `+${roles.length - 2} more`,
                `+${roles.length - 2} lainnya`,
                `另外${roles.length - 2}个角色`,
              )}
            </summary>
            <div className="access-role-list">{roles.slice(2).map(chip)}</div>
          </details>
        )}
      </RecordField>
      <RecordAction
        name={name}
        onEdit={onEdit}
        label={t("Edit user", "Edit pengguna", "编辑用户")}
      />
    </section>
  );
}

export function AccessRoleCard({
  name,
  active,
  lang,
  onEdit,
  description,
  permissionCount,
}: Common & {
  description: string;
  permissionCount: number;
}) {
  const t = (en: string, id: string, zh: string) => adminText(lang, en, id, zh);
  return (
    <section className="access-card access-role-card">
      <RecordHeader name={name} active={active} lang={lang} />
      <RecordField label={t("Purpose", "Kegunaan", "职责说明")}>
        {description || (
          <span className="access-record-empty">
            {t("Not set", "Belum diisi", "未设置")}
          </span>
        )}
      </RecordField>
      <RecordField label={t("Permissions", "Izin", "权限项数")}>
        {permissionCount}
      </RecordField>
      <RecordAction
        name={name}
        onEdit={onEdit}
        label={t("Edit role", "Edit peran", "编辑角色")}
      />
    </section>
  );
}
