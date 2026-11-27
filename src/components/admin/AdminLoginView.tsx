import {AdminField,AdminForm,AdminRequiredNote} from '../AdminForm';
import {PageMetadata} from '../PageMetadata';
import {CrmLanguageSelect} from '../crm/CrmLanguageSelect';
import {cmsText} from '../../utils/cmsLanguage';
import {crmId} from '../../utils/crmIndonesian';
import {crmError,type CrmLanguage} from '../../utils/crmLanguage';
import type {AdminWorkspace} from '../../utils/adminWorkspace';
import {ArrowRight,LockKeyhole,Users,ListChecks,Bell} from 'lucide-react';

export function AdminLoginView({
  workspace,lang,setLang,loginId,password,error,busy,connectionProblem,
  onLoginIdChange,onPasswordChange,onLogin,onRetry,
}: {
  workspace: AdminWorkspace;
  lang: CrmLanguage;
  setLang: (value: CrmLanguage) => void;
  loginId: string;
  password: string;
  error: string;
  busy: boolean;
  connectionProblem: boolean;
  onLoginIdChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => Promise<void>;
  onRetry: () => void;
}) {
  const isCms=workspace==='cms',isSystem=workspace==='system',isAcademic=workspace==='academics',isFinance=workspace==='finance';
  const t=(en:string,zh:string)=>lang==='id'?crmId(en):lang==='zh'?zh:en;
  const st=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
  return (
      <main className="crm-sign-in"><PageMetadata lang={lang} options={{state:"login"}}/>
        <header className="crm-sign-in-header">
          <a href="/" className="crm-sign-in-brand" aria-label="UPER">
            <img src="/uper-logo-mark.svg" alt="" />
            <span>UPER</span>
          </a>
          <div className="crm-sign-in-language"><CrmLanguageSelect lang={lang} onChange={setLang} /></div>
        </header>
        <div className="crm-sign-in-layout">
          {isAcademic||isFinance?<section className="crm-sign-in-intro" aria-labelledby="crm-sign-in-intro-title">
            <h2 id="crm-sign-in-intro-title">{isFinance?st('Finance management','Manajemen keuangan','财务管理'):st('Academic management','Manajemen akademik','教务管理')}</h2>
            <p>{isFinance?st('Verify payments and manage the enrollment bank account.','Verifikasi pembayaran dan kelola rekening pendaftaran.','核验收款，维护报名收款账户。'):st('Manage courses, class templates, class schedules and faculty.','Kelola kursus, templat kelas, jadwal, dan pengajar.','维护课程、班型模板、班次和教师档案。')}</p>
          </section>:<section className="crm-sign-in-intro" aria-labelledby="crm-sign-in-intro-title">
            <span className="crm-sign-in-eyebrow">{isSystem ? st("System workspace","Ruang sistem","系统工作区") : isCms ? cmsText("Content workspace", "内容工作区", lang) : t("Sales workspace", "销售工作区")}</span>
            <h2 id="crm-sign-in-intro-title">{isSystem ? st("Clear responsibilities. Controlled access.","Tanggung jawab jelas. Akses terkendali.","职责清晰，授权有据。") : isCms ? cmsText("Keep website content clear and current.", "让网站内容清晰、及时。", lang) : t("Every customer. A clear next step.", "每一位客户，都有清晰的下一步。")}</h2>
            <p>{isSystem ? st("Manage users, roles and access audit in one workspace.","Kelola pengguna, peran, dan audit akses dalam satu ruang.","在同一个工作区管理用户、角色与权限审计。") : isCms ? cmsText("Manage website content and images in one workspace.", "在同一个工作区管理网站内容与图片。", lang) : t("Keep customer conversations, ownership and follow-up in one place.", "在同一个工作区管理客户对话、负责人和跟进安排。")}</p>
            <ul className="crm-sign-in-features">
              <li><Users size={20} aria-hidden="true" /><span>{isSystem ? st("Staff accounts","Akun staf","员工账号") : isCms ? cmsText("Content collections", "内容集合", lang) : t("Customer records & conversations", "客户资料与对话")}</span></li>
              <li><ListChecks size={20} aria-hidden="true" /><span>{isSystem ? st("Roles and data scopes","Peran dan cakupan data","角色及数据范围") : isCms ? cmsText("Images and media", "图片与素材", lang) : t("Ownership & follow-up", "客户归属与跟进")}</span></li>
              <li><Bell size={20} aria-hidden="true" /><span>{isSystem ? st("Access change audit","Audit perubahan akses","权限变更审计") : isCms ? cmsText("Website content updates", "网站内容更新", lang) : t("Reminders & sales operations", "提醒与销售运营")}</span></li>
            </ul>
          </section>}
        <AdminForm lang={lang}
          className="crm-sign-in-card"
          onSubmit={event=>{event.preventDefault();void onLogin();}}
        >
          <div className="crm-sign-in-lock"><LockKeyhole size={22} aria-hidden="true" /></div>
          <h1><span>{isFinance ? st('Finance management sign in','Login manajemen keuangan','财务管理登录') : isAcademic ? st('Academic management sign in','Login manajemen akademik','教务管理登录') : isSystem ? st("System sign in","Login sistem","系统登录") : isCms ? cmsText("CMS sign in", "CMS 登录", lang) : t("CRM sign in", "CRM 登录")}</span><AdminRequiredNote lang={lang} inline/></h1>
          <p className="crm-sign-in-subtitle">{t("Use your staff account", "请使用员工账号登录")}</p>
          {connectionProblem&&<p role="status" className="crm-sign-in-error">
            {st('Could not check your sign-in status.','Status login belum dapat diperiksa.','暂时无法确认登录状态。')}{' '}
            <button type="button" disabled={busy} className="underline" onClick={()=>onRetry()}>{st('Retry check','Periksa lagi','重新检查')}</button>
          </p>}
          <AdminField className="crm-sign-in-label">
            {st("Login ID or email", "ID login atau email", "登录ID或邮箱")}
            <input
              className="crm-sign-in-input"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              value={loginId}
              onChange={(e) => onLoginIdChange(e.target.value)}
              required
            />
          </AdminField>
          <AdminField className="crm-sign-in-label">
            {t("Password", "密码")}
            <input
              className="crm-sign-in-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              required
            />
          </AdminField>
          {error && (
            <p role="alert" className="crm-sign-in-error">
              {error==='password_policy_required'?st('Check the password rules and make sure both new passwords match.','Periksa aturan kata sandi dan pastikan keduanya sama.','请按规则设置密码，并确保两次输入一致。'):crmError(error, lang)}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="crm-sign-in-submit"
            aria-busy={busy}
          >
            {busy ? t("Signing in…", "正在登录…") : t("Sign in", "登录")}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <p className="crm-sign-in-footnote">{t("Staff access only. Your role determines what you can view and manage.", "仅供员工访问。可查看的数据与操作权限由账号角色决定。")}</p>
        </AdminForm>
        </div>
        <footer className="crm-sign-in-footer">UPER · {isAcademic ? st('Academic management','Manajemen akademik','教务管理') : isSystem ? st("System management","Manajemen sistem","系统管理") : isCms ? cmsText("Content management", "内容管理", lang) : t("Customer relationship management", "客户关系管理")}</footer>
      </main>
    );
}
