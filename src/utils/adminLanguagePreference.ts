import { safeStorage } from "./safeStorage";

export function readAdminLanguage(): "en" | "zh" | "id" {
  const stored = safeStorage.getItem("uper_admin_lang") || safeStorage.getItem("uper_crm_lang") || safeStorage.getItem("uper_cms_lang");
  return stored === "zh" || stored === "id" ? stored : "en";
}
