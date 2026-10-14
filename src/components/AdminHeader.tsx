import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ExternalLink,
  Moon,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { CrmAccountControls, type CrmEmployee } from "./CrmAccess";
import { CrmLanguageSelect } from "./crm/CrmLanguageSelect";
import type { CrmLanguage } from "../utils/crmLanguage";
import "./admin-header.css";
import "./crm/crm-language-switch.css";
import { availableWorkspaces } from "../utils/adminWorkspace";
export type AdminWorkspace = "crm" | "cms" | "system";
export function adminText(
  lang: CrmLanguage,
  en: string,
  id: string,
  zh: string,
) {
  return lang === "zh" ? zh : lang === "id" ? id : en;
}
export function AdminHeader({
  employee,
  workspace,
  lang,
  setLang,
  isLight,
  toggleTheme,
  navigation,
}: {
  employee: CrmEmployee;
  workspace: AdminWorkspace;
  lang: CrmLanguage;
  setLang: (lang: CrmLanguage) => void;
  isLight: boolean;
  toggleTheme: () => void;
  navigation?: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 900px)").matches,
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const resize = () => {
      setCompact(media.matches);
      setPreferencesOpen(false);
    };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  const text = (en: string, id: string, zh: string) =>
    adminText(lang, en, id, zh);
  const workspaceLabel = (value: AdminWorkspace) =>
    value === "crm"
      ? text("Sales management", "Manajemen penjualan", "销售管理")
      : value === "cms" ? text("Content management", "Manajemen konten", "内容管理") : text("System management", "Manajemen sistem", "系统管理");
  useEffect(() => {
    const close = (event: KeyboardEvent | PointerEvent) => {
      const details = root.current?.querySelectorAll<HTMLDetailsElement>(
        'details[open]:not([data-persistent="true"])',
      );
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        details?.forEach((item) => {
          item.open = false;
          if (item.contains(document.activeElement))
            item.querySelector<HTMLElement>("summary")?.focus();
        });
      } else
        details?.forEach((item) => {
          if (!item.contains(event.target as Node)) item.open = false;
        });
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, []);
  return (
    <header
      ref={root}
      className="admin-header"
      data-theme={isLight ? "light" : "dark"}
      data-admin-header
    >
      <div className="admin-global-bar">
        <div className="admin-brand-context">
          <a
            href="/"
            className="admin-brand"
            aria-label={text("UPER homepage", "Beranda UPER", "UPER 首页")}
          >
            <img src="/uper-logo-mark.svg" alt="" width="28" height="32" />
            <span>UPER</span>
          </a>
          <span className="admin-brand-divider" aria-hidden="true" />
          <details className="admin-workspace-switch">
            <summary
              aria-label={text(
                "Switch workspace",
                "Ganti ruang kerja",
                "切换工作区",
              )}
            >
              <span>{workspaceLabel(workspace)}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <nav
              className="admin-popover"
              aria-label={text("Workspaces", "Ruang kerja", "工作区")}
            >
              {availableWorkspaces(employee).map((value) => (
                <a
                  key={value}
                  href={"/" + value}
                  onClick={(event) => {
                    if (value !== workspace) return;
                    event.preventDefault();
                    const parent = event.currentTarget.closest("details");
                    if (parent) {
                      parent.open = false;
                      parent.querySelector<HTMLElement>("summary")?.focus();
                    }
                  }}
                  aria-current={value === workspace ? "page" : undefined}
                >
                  {workspaceLabel(value)}
                </a>
              ))}
              <a
                className="admin-site-link"
                href="/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {text("View website", "Lihat situs", "查看网站")}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </nav>
          </details>
        </div>
        <div className="admin-global-controls">
          <details
            className="admin-preferences"
            data-persistent={compact ? "false" : "true"}
            open={!compact || preferencesOpen}
            onToggle={(event) => {
              if (compact) setPreferencesOpen(event.currentTarget.open);
            }}
          >
            <summary
              aria-label={text(
                "Language and appearance",
                "Bahasa dan tampilan",
                "语言与外观",
              )}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
            </summary>
            <div className="admin-preference-content">
              <CrmLanguageSelect
                lang={lang}
                onChange={setLang}
                isLight={isLight}
              />
              <span className="admin-preference-divider" aria-hidden="true" />
              <button
                type="button"
                className="admin-theme-toggle"
                onClick={toggleTheme}
                aria-label={
                  isLight
                    ? text(
                        "Switch to dark theme",
                        "Ganti ke tema gelap",
                        "切换深色主题",
                      )
                    : text(
                        "Switch to light theme",
                        "Ganti ke tema terang",
                        "切换浅色主题",
                      )
                }
              >
                {isLight ? (
                  <Moon size={16} aria-hidden="true" />
                ) : (
                  <Sun size={16} aria-hidden="true" />
                )}
                <span>
                  {isLight
                    ? text("Dark", "Gelap", "深色")
                    : text("Light", "Terang", "浅色")}
                </span>
              </button>
            </div>
          </details>
          <CrmAccountControls
            lang={lang}
            isLight={isLight}
            workspace={workspace}
          />
        </div>
      </div>
      {navigation && (
        <nav
          className="admin-module-nav"
          aria-label={workspace === "system" ? text("System modules", "Modul sistem", "系统模块") : text("Sales modules", "Modul penjualan", "销售模块")}
        >
          {navigation}
        </nav>
      )}
    </header>
  );
}
