import { useEffect, useState } from "react";
import { safeStorage } from "./safeStorage";
export type AdminTheme = "light" | "dark";
export function readAdminTheme(): AdminTheme {
  const value =
    safeStorage.getItem("uper_admin_theme") ||
    safeStorage.getItem("uper_crm_theme") ||
    safeStorage.getItem("uper_cms_theme");
  return value === "dark" ? "dark" : "light";
}
export function useAdminTheme() {
  const [theme, setTheme] = useState<AdminTheme>(readAdminTheme);
  useEffect(() => {
    const update = () => setTheme(readAdminTheme());
    window.addEventListener("storage", update);
    window.addEventListener("uper-admin-preferences", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("uper-admin-preferences", update);
    };
  }, []);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    safeStorage.setItem("uper_admin_theme", next);
    setTheme(next);
    window.dispatchEvent(new Event("uper-admin-preferences"));
  };
  return { theme, isLight: theme === "light", toggleTheme };
}
