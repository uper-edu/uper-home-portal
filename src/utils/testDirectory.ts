import type { CrmLanguage } from "./crmLanguage";
const adminText=(lang:CrmLanguage,en:string,id:string,zh:string)=>lang==="zh"?zh:lang==="id"?id:en;
export type TestDirectory = {
  origin: string;
  generatedAt: string;
  users: {
    id: string;
    loginId: string;
    displayName: string;
    active: boolean;
    roles: { id: string; names: string[]; enabled: boolean }[];
    initialPassword: string | null;
    passwordState: string;
  }[];
};
export function testDirectoryText(data: TestDirectory, lang: CrmLanguage) {
  const t = (en: string, id: string, zh: string) => adminText(lang, en, id, zh),
    col = lang === "zh" ? 2 : lang === "id" ? 1 : 0;
  const links = [
    [t("Homepage", "Beranda situs", "网站首页"), "/"],
    [
      t(
        "Questionnaire, assessment and AI consultation",
        "Kuesioner, asesmen dan konsultasi AI",
        "客户问卷、测评、AI咨询",
      ),
      "/chat",
    ],
    [
      t(
        "Campaign attribution (replace campaignID with an actual campaign ID)",
        "Atribusi kampanye (ganti campaignID dengan ID kampanye yang sebenarnya)",
        "Campaign归因（将campaignID替换为实际活动ID）",
      ),
      "/chat?c=campaignID",
    ],
    [
      t("CRM sales management", "Manajemen penjualan CRM", "CRM销售管理"),
      "/crm",
    ],
    [
      t("CMS content management", "Manajemen konten CMS", "CMS内容管理"),
      "/cms",
    ],
    [
      t(
        "Users and access management",
        "Manajemen pengguna dan akses",
        "用户与权限管理",
      ),
      "/system",
    ],
    [
      t("CRM online documentation", "Dokumentasi daring CRM", "CRM在线文档"),
      "/crm?tab=docs",
    ],
  ];
  return [
    t(
      "UPER Homepage / CRM / CMS company test environment",
      "Lingkungan uji perusahaan UPER Homepage / CRM / CMS",
      "UPER HomePage／CRM／CMS公司长期测试环境",
    ) + ":",
    ...links.map(([label, path]) => label + ": " + data.origin + path),
    "",
    t(
      "Preset test accounts only. Roles reflect current configuration.",
      "Hanya akun uji bawaan. Peran mengikuti konfigurasi saat ini.",
      "仅列出系统预置测试账号，角色以当前配置为准。",
    ),
    ...data.users.map(
      (u) =>
        `${u.loginId}${u.displayName !== u.loginId ? " (" + u.displayName + ")" : ""}，${t("Initial password", "Kata sandi awal", "初始密码")}：${u.initialPassword || t("Changed or unavailable; ask an administrator", "Sudah diubah atau tidak tersedia; hubungi administrator", "已修改或不可用，请联系管理员")}，${t("Roles", "Peran", "角色")}：${u.roles.map((r) => r.names[col] + (!r.enabled ? " (" + t("disabled", "dinonaktifkan", "已停用") + ")" : "")).join("、")}${u.active ? "" : "，" + t("Account disabled", "Akun dinonaktifkan", "账号已停用")}`,
    ),
    "",
    t(
      "Synthetic data only. Share with the authorized test team. Initial passwords do not override changed passwords.",
      "Hanya data simulasi. Bagikan kepada tim penguji yang berwenang. Kata sandi awal tidak mengganti kata sandi yang telah diubah.",
      "仅使用模拟数据，限授权测试团队传阅。初始密码不会覆盖用户已修改的密码。",
    ),
  ].join("\n");
}
