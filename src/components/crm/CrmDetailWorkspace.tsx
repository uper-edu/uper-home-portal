import {AdminFormFeedback} from '../AdminFormLayout';
import {recordScrollMode} from '../adminScroll';
import { campaignUi, type CampaignUiLanguage } from "../../utils/campaignI18n";
import React, { useEffect, useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function CrmDetailHeader({
  title,
  meta,
  status,
  actions,
  navigation,
  identityNavigation,
  titleId,
  titleRef,
}: {
  title: ReactNode;
  meta: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  navigation?: ReactNode;
  identityNavigation?: {back: ReactNode; adjacent: ReactNode; label: string};
  titleId?: string;
  titleRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <>
    {navigation && <nav className="crm-detail-navigation">{navigation}</nav>}
    <header className={identityNavigation?"crm-detail-header has-identity-navigation":"crm-detail-header"}>
      <div className="crm-detail-identity">
        {identityNavigation?<div className="crm-detail-title-row">
          {identityNavigation.back}
          <h2 id={titleId} ref={titleRef} tabIndex={-1}>{title}</h2>
          <nav className="crm-detail-record-navigation" aria-label={identityNavigation.label}>{identityNavigation.adjacent}</nav>
        </div>:<h2 id={titleId} ref={titleRef} tabIndex={-1}>{title}</h2>}
        {status&&<div className="crm-detail-current-state">{status}</div>}
        <div className="crm-detail-meta">{meta}</div>
      </div>
      <div className="crm-detail-actions">{actions}</div>
    </header>
    </>
  );
}
export interface CrmDetailTab {
  id: string;
  label: string;
  icon: LucideIcon;
}
export function CrmDetailTabs({
  id,
  value,
  tabs,
  label,
  contentId,
  onChange,
}: {
  id: string;
  value: string;
  tabs: CrmDetailTab[];
  label: string;
  contentId: string;
  onChange: (value: string, keyboard: boolean) => void;
}) {
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (pendingFocus.current === value) {
      document
        .getElementById(`${id}-tab-${value}`)
        ?.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  }, [value, id]);
  return (
    <div className="crm-detail-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, i) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            id={`${id}-tab-${tab.id}`}
            role="tab"
            aria-selected={value === tab.id}
            aria-controls={contentId}
            tabIndex={value === tab.id ? 0 : -1}
            onClick={() => {
              pendingFocus.current = null;
              onChange(tab.id, false);
            }}
            onKeyDown={(e) => {
              const next =
                e.key === "ArrowRight"
                  ? tabs[(i + 1) % tabs.length]
                  : e.key === "ArrowLeft"
                    ? tabs[(i + tabs.length - 1) % tabs.length]
                    : e.key === "Home"
                      ? tabs[0]
                      : e.key === "End"
                        ? tabs[tabs.length - 1]
                        : undefined;
              if (next) {
                e.preventDefault();
                pendingFocus.current = next.id;
                if (next.id === value) e.currentTarget.focus();
                else onChange(next.id, true);
              }
            }}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
export function CrmSaveFeedback({
  state,
  children,
  lang = "en",
}: {
  lang?: CampaignUiLanguage;
  state: "dirty" | "saving" | "saved" | "error" | "unknown";
  children?: ReactNode;
}) {
  const text = {
    dirty: "Unsaved changes",
    saving: "Saving…",
    saved: "Changes saved.",
    error: "Save failed. Your input is retained.",
    unknown: "Save outcome unknown. Check the result before submitting again.",
  }[state];
  return <AdminFormFeedback state={state} lang={lang} className="crm-save-feedback">{children || campaignUi(lang)(text)}</AdminFormFeedback>;
}
export function CrmDiscardDialog({
  onKeep,
  onDiscard,
  isLight,
  title = "Unsaved changes",
  description = "Keep editing, or discard your unsaved changes and continue. Saved records stay unchanged.",
  keepLabel = "Keep editing",
  discardLabel = "Discard and continue",
  lang = "en",
}: {
  onKeep: () => void;
  onDiscard: () => void;
  isLight: boolean;
  lang?: CampaignUiLanguage;
  title?: string;
  description?: string;
  keepLabel?: string;
  discardLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      if (opener.current?.isConnected)
        opener.current.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      className="crm-discard-dialog"
      data-theme={isLight ? "light" : "dark"}
      ref={dialog}
      aria-labelledby="crm-unsaved-title"
      aria-describedby="crm-unsaved-description"
      onCancel={(e) => {
        e.preventDefault();
        onKeep();
      }}
    >
      <h2 id="crm-unsaved-title">{campaignUi(lang)(title)}</h2>
      <p id="crm-unsaved-description">{campaignUi(lang)(description)}</p>
      <footer>
        <button type="button" autoFocus onClick={onKeep}>
          {campaignUi(lang)(keepLabel)}
        </button>
        <button type="button" onClick={onDiscard}>
          {campaignUi(lang)(discardLabel)}
        </button>
      </footer>
    </dialog>
  );
}
export function useCrmShellHeight() {
  const [height, setHeight] = React.useState(120);
  useEffect(() => {
    const header = document.querySelector("[data-crm-header]");
    if (!header) return;
    const measure = () =>
      setHeight(Math.ceil(header.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return height;
}

export function useRecordScrollMode(header:number){
 const [mode,setMode]=React.useState<'independent'|'page'>('page');
 useEffect(()=>{const measure=()=>setMode(recordScrollMode(window.innerWidth,window.innerHeight,header));measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);},[header]);return mode;
}
