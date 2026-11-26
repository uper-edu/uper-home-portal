import {AdminRecordHeader,type AdminBackTarget} from '../admin/AdminRecordHeader';
import {AdminFormFeedback} from '../AdminFormLayout';
import {recordScrollMode} from '../adminScroll';
import { campaignUi, type CampaignUiLanguage } from "../../utils/campaignI18n";
import React, { useEffect, type ReactNode } from "react";

export function CrmDetailHeader({
  title,
  meta,
  status,
  actions,
  navigation,
  identityNavigation,
  titleId,
  titleRef,
  back,
}: {
  title: ReactNode;
  meta: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  navigation?: ReactNode;
  identityNavigation?: {back: ReactNode; adjacent: ReactNode; label: string};
  titleId?: string;
  titleRef?: React.Ref<HTMLHeadingElement>;
  back?:AdminBackTarget;
}) {
  if(back)return <AdminRecordHeader back={back} title={<div className="crm-detail-identity">
    <h2 id={titleId} ref={titleRef} tabIndex={-1}>{title}</h2>
    {status&&<div className="crm-detail-current-state">{status}</div>}
    <div className="crm-detail-meta">{meta}</div>
  </div>} actions={<div className="crm-detail-actions">{actions}</div>}/>;
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
export function useCrmShellHeight(selector="[data-crm-header]") {
  const [height, setHeight] = React.useState(120);
  useEffect(() => {
    const header = document.querySelector(selector);
    if (!header) return;
    const measure = () =>
      setHeight(Math.ceil(header.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [selector]);
  return height;
}

export function useRecordScrollMode(header:number){
 const [mode,setMode]=React.useState<'independent'|'page'>('page');
 useEffect(()=>{const measure=()=>setMode(recordScrollMode(window.innerWidth,window.innerHeight,header));measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);},[header]);return mode;
}
