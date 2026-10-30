import {CrmEnrollmentCorrectionAccess,CrmEnrollmentCorrectionForm} from '../components/crm/CrmEnrollmentCorrection';
import {CrmRecordAmendmentForm} from '../components/crm/CrmRecordAmendmentForm';
import {canAmendSalesRecord,amendmentSaveNotice} from '../utils/crmRecordAmendments';
import {CrmCurrentSalesState} from '../components/crm/CrmCurrentSalesState';
import {CrmCustomer360Button} from '../components/crm/CrmCustomer360Button';
import {crmUiText} from '../utils/crmUiText';
import {CrmHistoryAccess} from '../components/crm/CrmHistoryAccess';
import {CrmCustomerHistoryWindow} from '../components/crm/CrmCustomerHistoryWindow';
import {progressSaveSummary} from '../utils/crmProgressRecord';
import {CrmIdentityAction} from '../components/crm/CrmIdentityAction';
import {CrmOwnerEditor} from '../components/crm/CrmOwnerEditor';
import {CrmUiProvider} from '../components/crm/CrmUiLanguage';
import {salesProgressStages} from '../utils/crmSalesProgress';
import '../components/crm/crm-operation-layer.css';
import {profileSaveSummary} from '../utils/crmProfileSaveResult';
import {CrmProfileEditor} from '../components/crm/CrmProfileFields';
import {savePolicyTopic} from '../utils/crmPolicyTopicClient';
import type {PolicyTopicRequest} from '../utils/crmPolicyTopics';
import {NotificationWorkspace,NotificationTopicPanels,type Tab as NotificationTab} from "../components/NotificationCenter";
import "../components/admin-workspace.css";
import {progressActionState} from "../utils/crmProgressAction";
import {CrmProgressAction} from "../components/crm/CrmProgressAction";
import "../components/crm/crm-operations-workspace.css";
import {CrmIdentityComparison} from '../components/crm/CrmIdentityComparison';
import {CrmOperationLayer} from '../components/crm/CrmOperationLayer';
import {identityRoute,identityUrl} from '../utils/crmIdentityNavigation';
import {outreachText,canClaimForContact,isCrmManager} from '../utils/crmOutreach';
import {CrmPolling,crmJson,CrmRefreshError,stableCrmOrder} from "../utils/crmPolling";
import { CrmPageIdentity } from "../components/crm/CrmPageIdentity";
import { CrmPageAction } from "../components/crm/CrmPageAction";
import {leadDetailTab,leadDetailUrl} from "../utils/crmDetailNavigation";
import {CrmDetailHeader,CrmDetailTabs,CrmSaveFeedback,CrmDiscardDialog} from "../components/crm/CrmDetailWorkspace";
import {CrmFollowupContext} from "../components/crm/CrmFollowupContext";
import { CrmDisclosure } from "../components/crm/CrmDisclosure";
import {CrmTrustPanel,CrmStageEditor} from "../components/crm/CrmTrustPanel";
import {PageMetadata} from '../components/PageMetadata';
import {AccessHandoverPanel} from "../components/AccessSafetyPanel";
import {eligibleOwner,permittedRecord} from '../utils/accessControl';
import '../components/crm/crm-documentation.css';
import { adminRoleLabel } from "../utils/adminWorkspace";
import { AdminHeader, adminText } from "../components/AdminHeader";
import { useAdminTheme } from "../utils/adminPreferences";
import {CrmAttendanceEditor} from "../components/crm/CrmAttendanceEditor";
import {CrmProcessOverview} from "../components/crm/CrmProcessOverview";
import type {ProcessMetrics} from "../utils/crmProcessMetrics";
import {draftsFor} from "../utils/crmDrafts";
import {CrmOperationalIssues} from "../components/crm/CrmOperationalIssues";
import {CrmContactPreview} from "../components/crm/CrmContactPreview";
import {contactStatistics} from "../utils/crmContact";
import {CrmWorkflowForm} from "../components/crm/CrmWorkflowForm";
import { CrmSingleSelect } from "../components/crm/CrmSingleSelect";
import { crmId } from "../utils/crmIndonesian";
import { PolicySaveError } from "../utils/crmPolicyValidation";
import { restorePolicyDefaults } from "../utils/crmPolicyReset";
import { CrmLeadFilters } from "../components/crm/CrmLeadFilters";
import {
  defaultLeadFilters,restoreLeadFilterPreferences,
  restoreLeadFilters,
  filterQuery,
  type LeadFilters,
} from "../utils/crmLeadFilters";
import {
  crmValue,
  crmError,
  crmLocale,
  type CrmLanguage,
} from "../utils/crmLanguage";
import { leadDisplayNumber } from "../utils/leadNumber";
import { formatCrmOperatingTime,formatCrmEventTime,viewerTimeZone } from "../utils/crmOperatingTime";
import { describeFollowUpTask, confirmedTaskDeadline, pendingFollowUps } from "../utils/crmFollowUp";
import CrmAccess, {
  CrmAccountControls,
  type CrmEmployee,
} from "../components/CrmAccess";
import {
  crmMessageTimestamp,
  crmMessageTimeLabel,
  compareCrmEventTimes,
} from "../utils/crmMessageTime";
import { LeadActivity } from "../components/LeadAttention";
import { projectPendingTasks } from "../utils/crmTaskPresentation";
import { CrmNextTaskSummary } from "../components/crm/CrmNextTaskSummary";
import NotificationCenter from "../components/NotificationCenter";
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { safeStorage } from "../utils/safeStorage";
import {
  BarChart3,
  ListChecks, UserRound, ClipboardCheck, MessagesSquare,
  Users,
  Phone,
  MessageCircle,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight, ChevronLeft,
  Download,
  Filter,
  Search,
  RefreshCw,
  Calendar,
  Award,
  ExternalLink,
  ArrowRight, ArrowLeft,
  ArrowRightLeft,
  BookOpen,
  Building,
  Check,
  Sparkles,
  Send,
  X,
  Copy,
  TrendingUp,
  MapPin,
  Mail,
  UserCheck,
  Sun,
  Moon,
  LayoutList,
  Table as TableIcon,
  Globe,
  Settings,
  ChevronDown,
  Printer,
  Save,
  RotateCcw,
  Undo2,
  History,
  PlusCircle,
  Flame,
  FileText,
  Lightbulb,
  HelpCircle,
  Activity,
  Target,
} from "lucide-react";
import {
  CrmLeadRecord,
  FollowUpLog,
  StageType,
  ConnectStatusType,
  OutcomeType,
} from "../types/crmLead";
import { TierType } from "../types/leadSystem";
import type { CrmPolicyConfig } from "../types/crmPolicyConfig";
import { DEFAULT_CRM_POLICY_CONFIG } from "../types/crmPolicyConfig";
import { CrmLeadWorkspace } from "../components/crm/CrmLeadWorkspace";
import {
  CrmCustomerProfile,
  CrmCustomerAssessment,
  CrmCustomerConversations,
} from "../components/crm/CrmCustomerDetails";
import type { CustomerView, CustomerTab } from "../utils/crmWorkspace";
import { customerCity } from "../utils/crmWorkspace";
import { crmAssessmentSummary } from "../utils/crmAssessment";
import "../components/crm/crm-customer-workspace.css";
import "../components/crm/crm-followup-focus.css";
import "../components/crm/crm-assessment.css";
import "../components/crm/crm-followup.css";
import "../components/crm/crm-process.css";
import {
  CrmPolicySettings,
  PolicyActionControls,
} from "../components/crm/CrmPolicySettings";
import { CrmUserGuide } from "../components/crm/CrmUserGuide";
import { CrmCampaignHub } from "../components/crm/CrmCampaignHub";
// Unified Global Stage Master Dictionary
export const STAGE_OPTIONS=salesProgressStages.map(([value,labelZh,labelEn])=>({value,labelZh,labelEn}));
export default function CrmWorkbench() {
  return (
    <CrmAccess>
      {(employee, lang, setLang) => employee.permissions.includes("crm.read") ? (
        <CrmUiProvider lang={lang}><CrmWorkspace
          key={employee.id}
          employee={employee}
          lang={lang}
          setLang={setLang}
        /></CrmUiProvider>
      ) : <main className="p-8"><PageMetadata lang={lang} options={{state:"denied"}}/><CrmAccountControls lang={lang} isLight={true}/><h1>{lang === "zh" ? "无 CRM 访问权限" : lang === "id" ? "Tidak memiliki akses CRM" : "CRM access denied"}</h1>{employee.permissions.includes("cms.manage") && <a href="/cms">{adminText(lang,"Content management","Manajemen konten","内容管理")}</a>}</main>}
    </CrmAccess>
  );
}
function CrmWorkspace({
  employee,
  lang,
  setLang,
}: {
  employee: CrmEmployee;
  lang: CrmLanguage;
  setLang: (lang: CrmLanguage) => void;
}) {
  const canManage = employee.permissions.includes("notifications.manage") || employee.permissions.includes("crm.operations.manage") || employee.permissions.includes("notifications.read");
  const canAssign = employee.permissions.includes("crm.assign");
  const [crmModule, setCrmModule] = useState<
    "leads" | "campaigns" | "policy" | "docs"
  >(() => {
    try {
      if (/^#(?:crm-guide-|chapter-)/.test(window.location.hash)) return "docs";
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (
        tab === "docs" ||
        (tab === "policy" && canManage) ||
        tab === "leads" ||
        tab === "campaigns"
      ) {
        return tab;
      }
    } catch {}
    return "leads";
  });

  const [policyConfig, setPolicyConfig] = useState<CrmPolicyConfig>(
    DEFAULT_CRM_POLICY_CONFIG,
  );
  const [notificationNavigationRequest, setNotificationNavigationRequest] =
    useState(0);
  const [policyControls, setPolicyControls] =
    useState<PolicyActionControls | null>(null);
  const [leads, setLeads] = useState<CrmLeadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataScope, setDataScope] = useState<"own" | "team" | "all">("all");
  const [leadActionError, setLeadActionError] = useState("");
  const draftCache=useRef<Record<string,any>>(draftsFor(employee.id));
  const attendanceCache=useRef<Record<string,any>>(draftsFor(employee.id,'attendance'));
  const [retainedDraft,setRetainedDraft]=useState<any>(null);
  const [queueComplete,setQueueComplete]=useState(false);
  const [administrative,setAdministrative]=useState(false);
  const [contactPreview,setContactPreview]=useState(false);
  const [contactPreviewDirty,setContactPreviewDirty]=useState(false);
  const [filters, setFilters] = useState<LeadFilters>(() => {try {
    const current=JSON.parse(localStorage.getItem('crm_filters_v3_'+employee.id)||'null');
    const legacy=JSON.parse(localStorage.getItem('crm_filters_v2_'+employee.id)||'null');
    return restoreLeadFilterPreferences(current,legacy,employee.roles.includes('crm_leader')?'all':employee.scope);
  }catch{return defaultLeadFilters(employee.scope);}});
  useEffect(()=>{localStorage.setItem('crm_filters_v3_'+employee.id,JSON.stringify({version:3,filters}));},[filters,employee.id]);
  const [accessibleLeadCount,setAccessibleLeadCount]=useState<number|null>(null);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const filterTimezone = viewerTimeZone();
  const [leadAnalysis, setLeadAnalysis] = useState(() => new URLSearchParams(window.location.search).get("leadArea") === "analysis");
  const analysisListScroll = useRef(0);
  const [processOverview,setProcessOverview]=useState<ProcessMetrics|null>(null);
  const poller = useRef<CrmPolling|null>(null);
  const [refreshProblem,setRefreshProblem]=useState("");
  const [lastListRefresh,setLastListRefresh]=useState("");
  const [pendingListOrder,setPendingListOrder]=useState(false);
  const [newActivity,setNewActivity]=useState<number|null>(null);
  const cursorRef=useRef("");
  const queryKey = filterQuery({ ...filters, search: appliedSearch }) + "&viewerTimezone=" + encodeURIComponent(filterTimezone);
  useEffect(() => {
    const timer = setTimeout(
      () => setAppliedSearch(filters.search),
      filters.search ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [filters.search]);
  const [selectedLead, setSelectedLead] = useState<CrmLeadRecord | null>(null);
  const [detailRefreshVersion, setDetailRefreshVersion] = useState(0);
  const responseTask = pendingFollowUps(
    selectedLead?.attention?.tasks || [], selectedLead?.currentStage,
  )[0];
  const responseDeadline =
    responseTask && confirmedTaskDeadline(responseTask) !== null
      ? responseTask.dueAt
      : undefined;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] =
    useState<CustomerTab>("activities");
  const [isAddLogOpen, setIsAddLogOpen] = useState(false);
  const toggleLang = () =>
    setLang(lang === "id" ? crmId("zh") : lang === "en" ? "zh" : "en");
  // Translation helper
  const t = (enText: string, zhText: string) =>
    lang === "id" ? crmId(enText) : lang === "zh" ? zhText : enText;
  const { isLight, toggleTheme } = useAdminTheme();
  // Presentation preference only; it never changes the server-side filter query.
  const [viewMode, setViewMode] = useState<CustomerView>(() => {
    try {
      const saved = safeStorage.getItem(
        `uper_crm_customer_view_${employee.id}`,
      );
      if (saved === "worklist" || saved === "table") return saved;
    } catch {
      // fallback
    }
    return "worklist";
  });
  const filteredLeads = leads;
  const hasActiveFilters =
    filterQuery(filters) !== filterQuery(defaultLeadFilters("all"));
  const handleResetAllFilters = () => setFilters(defaultLeadFilters("all"));
  const handleSetViewMode = (mode: CustomerView) => {
    setViewMode(mode);
    try {
      safeStorage.setItem(`uper_crm_customer_view_${employee.id}`, mode);
    } catch {
      // fallback
    }
  };
  // Follow-up form state
  const [employees, setEmployees] = useState<
    Array<{
      id: string;
      displayName?: string;
      roles?: string[];
      active?: boolean;
      permissions?: string[];
      roleLabels?: Record<string,[string,string,string]>;
    }>
  >([]);
  useEffect(() => {
    fetch("/api/portal/employees")
      .then((r) => r.json())
      .then(d=>setEmployees(d.filter((person:any)=>person.permissions?.includes('crm.read'))))
      .catch(() => {});
  }, []);
  const salesEmployees = employees.filter(
    (e) => eligibleOwner(e as any),
  );
  const employeeLabel = (e: (typeof employees)[number]) =>
    `${e.displayName || e.id} · ${e.roles?.map((role) => (e.roleLabels?.[role]?.[lang === "zh"?2:lang === "id"?1:0]||adminRoleLabel(role, lang))).join(" + ") || ""}`;
  useEffect(() => {
    if (!canManage && crmModule === "policy") setCrmModule("leads");
  }, [canManage, crmModule]);
  const [taskFocus,setTaskFocus]=useState<{id:string;token:number}>();
  const [conversationReturn,setConversationReturn]=useState<any>();
  const [taskOpening,setTaskOpening]=useState(false);
  const [workflowSource,setWorkflowSource]=useState<any>();
  const [workflowTask,setWorkflowTask]=useState<string|undefined>();
  const [workflowDirty,setWorkflowDirty]=useState(false);
  const [trustDirty,setTrustDirty]=useState(false);
  const [ownerOpen,setOwnerOpen]=useState(false),[ownerDirty,setOwnerDirty]=useState(false);
  const [stageOpen,setStageOpen]=useState(false),[stageDirty,setStageDirty]=useState(false),[stageBasis,setStageBasis]=useState<string|undefined>(),[stageNotice,setStageNotice]=useState<any>(null);
  const [profileContactTarget,setProfileContactTarget]=useState<HTMLDivElement|null>(null);
  const [profileActionTarget,setProfileActionTarget]=useState<HTMLDivElement|null>(null);
  const [profileFieldsDirty,setProfileFieldsDirty]=useState(false);
  const [profileNeedsFocus,setProfileNeedsFocus]=useState<string|null>(null);
  const profileNeedsPageY=useRef(0);
  const [trustReset,setTrustReset]=useState(0);
  const [followupCommand,setFollowupCommand]=useState<any>();
  const [attendanceDirty,setAttendanceDirty]=useState(false);
  const [attendanceReset,setAttendanceReset]=useState(0);
  const [profileSave,setProfileSave]=useState("");
  const [insightSourceFocus,setInsightSourceFocus]=useState<any>();
  const [historyRequest,setHistoryRequest]=useState<any>(null);
  const [enrollmentTarget,setEnrollmentTarget]=useState<string|null>(null),[enrollmentDirty,setEnrollmentDirty]=useState(false);
  const [historyAmendTarget,setHistoryAmendTarget]=useState<any>(null),[historyAmendDirty,setHistoryAmendDirty]=useState(false),[historyAmendNotice,setHistoryAmendNotice]=useState<string>('');
  const [historyConversationBack,setHistoryConversationBack]=useState<any>(null);
  const openCustomerHistory=(request:any={})=>{if(selectedLead)setHistoryRequest((current:any)=>({...request,previous:request.returnId&&current?{...current,id:request.returnId,search:request.returnSearch,filter:request.returnFilter,fields:undefined,quote:undefined}:current?.leadId===selectedLead.id&&current.id!==request.id?current:current?.previous,leadId:selectedLead.id,token:Date.now()}));};
  useEffect(()=>{setHistoryRequest(null);setHistoryConversationBack(null);setEnrollmentTarget(null);setEnrollmentDirty(false);setHistoryAmendTarget(null);setHistoryAmendDirty(false);setHistoryAmendNotice('');},[selectedLead?.id]);
  useEffect(()=>{setInsightSourceFocus(undefined)},[selectedLead?.id]);
  const [signalFocus,setSignalFocus]=useState<{id:string;token:number}|undefined>();
  const [workflowNotice,setWorkflowNotice]=useState<any>(null);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [identitySelection,setIdentitySelection]=useState(()=>identityRoute(window.location.href));
  const [identityDirty,setIdentityDirty]=useState(false);
  const listScroll = useRef(0);
  const leadRouteVersion=useRef(0),lastWorkspaceUrl=useRef(typeof window==='undefined'?'':window.location.href);
  const writeLeadRoute=(id?:string,tab:CustomerTab="activities",replace=false)=>{
    const url=leadDetailUrl(window.location.href,id,leadDetailTab(tab));
    if(url!==window.location.href)window.history[replace?"replaceState":"pushState"]({},"",url);
    lastWorkspaceUrl.current=url;
  };
  const navigateLeadAnalysis = (analysis: boolean) => {
    if (analysis) analysisListScroll.current = window.scrollY;
    const url = new URL(window.location.href);
    if (analysis) url.searchParams.set("leadArea", "analysis");
    else url.searchParams.delete("leadArea");
    url.searchParams.set("tab", "leads");
    url.searchParams.delete("lead"); url.searchParams.delete("leadView");
    window.history.pushState({}, "", url);
    lastWorkspaceUrl.current = url.href;
    setLeadAnalysis(analysis);
    requestAnimationFrame(() => {
      document.getElementById("crm-main")?.focus({preventScroll:true});
      window.scrollTo({top:analysis ? 0 : analysisListScroll.current});
    });
  };
  const customerViewport = useRef(false);
  const tabViewport = useRef<{pageY:number; keyboard:boolean; tab:string} | null>(null);
  useLayoutEffect(() => {
    if (customerViewport.current) {
      customerViewport.current = false;
      tabViewport.current = null;
      const content = document.getElementById("crm-customer-content");
      if (content) content.scrollTop = 0;
      const panel = document.getElementById("crm-customer-panel");
      panel?.scrollIntoView({ block: "start", behavior: "instant" });
      panel?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      return;
    }
    const pending = tabViewport.current;
    if (!pending) return;
    tabViewport.current = null;
    // Ordinary tab changes keep the shell anchored. Task/message links own explicit scrolling.
    const content = document.getElementById("crm-customer-content");
    if (content) content.scrollTop = 0;
    window.scrollTo({top:pending.pageY, behavior:"instant"});
    if (pending.keyboard) document.getElementById(`crm-customer-tab-${pending.tab}`)?.focus({preventScroll:true});
  }, [activeDrawerTab, selectedLead?.id]);

  useLayoutEffect(()=>{
    if(!profileNeedsFocus||activeDrawerTab!=='profile'||selectedLead?.id!==profileNeedsFocus)return;
    const frame=requestAnimationFrame(()=>{
      const heading=document.getElementById('crm-profile-learning-needs'),pane=document.getElementById('crm-customer-content');
      if(heading&&pane){
        const section=heading.closest<HTMLElement>('.crm-current-needs')||heading;
        if(getComputedStyle(pane).overflowY==='auto'){pane.scrollTop+=section.getBoundingClientRect().top-pane.getBoundingClientRect().top-16;window.scrollTo({top:profileNeedsPageY.current,behavior:'instant'});}
        else{const offset=document.querySelector<HTMLElement>('.admin-header')?.getBoundingClientRect().height||0;window.scrollBy({top:section.getBoundingClientRect().top-offset-16,behavior:'instant'});}
        heading.focus({preventScroll:true});
      }
      setProfileNeedsFocus(null);
    });return()=>cancelAnimationFrame(frame);
  },[profileNeedsFocus,activeDrawerTab,selectedLead?.id]);

  const hasDraft = enrollmentDirty||historyAmendDirty||ownerDirty||stageDirty||identityDirty||contactPreviewDirty||trustDirty||profileFieldsDirty||(isAddLogOpen && workflowDirty)||Boolean(selectedLead&&attendanceDirty);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const clearDraft = () => {
    setEnrollmentTarget(null);setEnrollmentDirty(false);setHistoryAmendTarget(null);setHistoryAmendDirty(false);
    if(selectedLead){delete draftCache.current[selectedLead.id];delete attendanceCache.current[selectedLead.id];}
    setIdentityDirty(false);setAttendanceDirty(false);setAttendanceReset(n=>n+1);
    setWorkflowDirty(false);setProfileFieldsDirty(false);setTrustDirty(false);setTrustReset(v=>v+1);
    setOwnerOpen(false);setOwnerDirty(false);setIsAddLogOpen(false);setFollowupCommand(undefined);setContactPreview(false);setContactPreviewDirty(false);setStageOpen(false);setStageDirty(false);
  };
  const resumeDraft=()=>{setPendingNavigation(null);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>(ownerOpen?'.crm-owner-editor textarea':stageOpen?'#crm-sales-stage-editor textarea':identityDirty?'.crm-identity-decision textarea':contactPreviewDirty?'.crm-contact-preview textarea':attendanceDirty?'.crm-attendance-editor textarea':'.crm-followup-processing textarea, .crm-workflow-form textarea, .crm-simple-form textarea, textarea[aria-label="补充／修正内容"]')?.focus());};
  const discardDraft = (proceed: () => void = () => {}) => {
    if (isSubmittingLog || profileSave==="saving") return false;
    if (hasDraft) {
      setPendingNavigation(() => proceed);
      return false;
    }
    clearDraft();
    return true;
  };
  const openIdentityReview=(leadId:string,candidateId?:string)=>{
    const finish=()=>{const selection={leadId,candidateId};setIdentitySelection(selection);const url=identityUrl(window.location.href,selection);window.history.pushState({},"",url);lastWorkspaceUrl.current=url;};
    if(discardDraft(finish))finish();
  };
  const closeIdentityReview=()=>{const finish=()=>{setIdentitySelection(null);const url=identityUrl(window.location.href,null);window.history.replaceState({},"",url);lastWorkspaceUrl.current=url;};if(discardDraft(finish))finish();};
  const closeCustomer = () => {
    const finish = () => {
      // Returning to the list invalidates pending detail-history loads as well.
      leadRouteVersion.current++;
      customerViewport.current=false;tabViewport.current=null;
      setIsDrawerOpen(false);
      setSelectedLead(null);
      writeLeadRoute();
      requestAnimationFrame(() => {
        const opener =
          selectedLead &&
          document.querySelector<HTMLButtonElement>(
            `[data-lead-id="${CSS.escape(selectedLead.id)}"] .crm-customer-open`,
          );
        (opener||document.getElementById('crm-main'))?.focus({ preventScroll: true });
        window.scrollTo({ top: listScroll.current });
      });
    };
    if (discardDraft(finish)) finish();
  };
  const changeModule = (module: typeof crmModule) => {
    const finish = () => {leadRouteVersion.current++;const url=new URL(window.location.href);url.searchParams.set("tab",module);url.searchParams.delete("leadArea");setLeadAnalysis(false);if(module!=="leads"){url.searchParams.delete("lead");url.searchParams.delete("leadView");}if(module!=="campaigns"){url.searchParams.delete("campaign");url.searchParams.delete("campaignView");}url.hash="";window.history.pushState({},"",url);lastWorkspaceUrl.current=url.href;setCrmModule(module);};
    const proceed=()=>{if(discardDraft(finish))finish();};
    if(crmModule==="campaigns"&&module!==crmModule&&!window.dispatchEvent(new CustomEvent("crm-campaign-before-leave",{cancelable:true,detail:{proceed}})))return;
    proceed();
  };
  useEffect(()=>{
    const pop=()=>{
      const target=window.location.href,params=new URL(target).searchParams;
      const nextIdentity=identityRoute(target);
      if(identitySelection||nextIdentity){
        const apply=()=>{setIdentitySelection(nextIdentity);window.history.replaceState({},"",target);lastWorkspaceUrl.current=target;};
        if(hasDraft||isSubmittingLog){window.history.pushState({},"",lastWorkspaceUrl.current);if(discardDraft(apply))apply();}else apply();
        return;
      }
      const module=params.get("tab");
      if(module==="campaigns"&&crmModule==="campaigns")return; // Campaign owns its intra-object history.
      const apply=async()=>{
        window.history.replaceState({},"",target);lastWorkspaceUrl.current=target;
        const version=++leadRouteVersion.current;
        if(module==="campaigns"){setCrmModule("campaigns");return;}
        if(module==="docs"||(module==="policy"&&canManage)){setCrmModule(module);return;}
        setCrmModule("leads");
        setLeadAnalysis(params.get("leadArea") === "analysis");
        const id=params.get("lead");
        if(!id){setSelectedLead(null);setIsDrawerOpen(false);setLeadActionError("");requestAnimationFrame(()=>window.scrollTo({top:params.get("leadArea") === "analysis" ? 0 : leadAnalysis ? analysisListScroll.current : listScroll.current}));return;}
        try{
          const r=await fetch(`/api/crm/leads/${encodeURIComponent(id)}`);const data=await r.json();
          if(version!==leadRouteVersion.current)return;
          if(!r.ok)throw Error(data.error||"Customer unavailable");
          handleOpenLeadDrawer(data.lead||data,leadDetailTab(params.get("leadView")),true,true);
        }catch(error){if(version!==leadRouteVersion.current)return;setSelectedLead(null);setIsDrawerOpen(false);setLeadActionError((error as Error).message);}
      };
      if(crmModule==="campaigns"){
        const event=new CustomEvent("crm-campaign-before-leave",{cancelable:true,detail:{proceed:apply,history:true}});
        if(!window.dispatchEvent(event))return;
      }
      if(hasDraft||isSubmittingLog||profileSave==="saving"){
        window.history.pushState({},"",lastWorkspaceUrl.current);if(discardDraft(()=>void apply()))void apply();
      }else void apply();
    };
    window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop);
  });
  useEffect(() => {
    if (!hasDraft && !policyControls?.isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDraft, policyControls?.isDirty]);
  // A query generation owns its channels; changing query/access cancels older results.
  const refreshContext=useRef({hasDraft,isSubmittingLog});
  refreshContext.current={hasDraft,isSubmittingLog};
  const fetchLeads = (quiet=false) => poller.current?.refresh(quiet?'mutation':'manual') || Promise.resolve();
  useEffect(() => {
    if(crmModule!=="leads") return;
    let disposed=false;
    // Keep the last authorized result and refresh stamp while a new query is pending.
    // Clearing them collapses the page under the open filter popup. Access loss
    // still clears customer data below; obsolete query responses stay aborted.
    cursorRef.current="";setPendingListOrder(false);setNewActivity(null);setRefreshProblem("");
    const current=new CrmPolling({
      list:async(signal,reason)=>{
        const data=await crmJson(`/api/crm/leads?${queryKey}`,signal);
        if(signal.aborted||disposed)return;
        cursorRef.current=data.changeCursor||"";
        setRefreshProblem("");setLastListRefresh(new Date().toISOString());
        setAccessibleLeadCount(Number.isInteger(data.accessibleCount)?data.accessibleCount:null);setOwnerOptions(data.ownerOptions||[]);
        setLeads(previous=>{
          if(reason==='manual'||reason==='initial'||!previous.length){setPendingListOrder(false);return data.leads||[];}
          const stable=stableCrmOrder(previous,data.leads||[]);
          setPendingListOrder(stable.map(row=>row.id).join('|')!==(data.leads||[]).map((row:any)=>row.id).join('|'));
          return stable;
        });
        if(data.dataScope)setDataScope(data.dataScope);
        setProcessOverview(data.processMetrics||null);
        if(!refreshContext.current.hasDraft&&!refreshContext.current.isSubmittingLog){
          setSelectedLead(current=>{if(!current)return current;const updated=(data.leads||[]).find((row:any)=>row.id===current.id);return updated?{...current,...updated}:current;});
          setDetailRefreshVersion(value=>value+1);
        }
      },
      changes:async(signal)=>{
        const data=await crmJson('/api/crm/lead-changes',signal);
        if(signal.aborted||disposed)return;
        setRefreshProblem(value=>value==="changes-timeout"||value==="changes-unavailable"?"":value);
        const previous=cursorRef.current;
        if(previous&&previous!==data.cursor){
          setNewActivity(null);void current.refresh('automatic');
        }
      },
      busy:setIsLoading,
      error:(error,channel)=>{
        const code=error instanceof CrmRefreshError?error.code:'unavailable';setRefreshProblem(code==='unauthorized'?code:channel==='changes'?'changes-'+code:code);
        if(code==='unauthorized'){
          setLeads([]);setAccessibleLeadCount(null);setOwnerOptions([]);setProcessOverview(null);setNewActivity(null);
          // Preserve unsaved text, but remove customer data after access is revoked.
          const draft=Object.entries(draftCache.current).find(([,draft]:any)=>draft.summary||draft.action||draft.arrangementReason);
          if(draft)setRetainedDraft({id:draft[0],...draft[1]});
          setSelectedLead(null);setIsDrawerOpen(false);
          current.setVisible(false);
        }
      },
    });
    poller.current=current;
    const visibility=()=>current.setVisible(document.visibilityState==='visible');
    const accessChanged=()=>{setLeads([]);setAccessibleLeadCount(null);setOwnerOptions([]);setProcessOverview(null);cursorRef.current="";void current.refresh('access');};
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('uper-access-changed',accessChanged);
    visibility();
    return()=>{disposed=true;current.setVisible(false);if(poller.current===current)poller.current=null;document.removeEventListener('visibilitychange',visibility);window.removeEventListener('uper-access-changed',accessChanged);};
  },[queryKey,employee.id,crmModule]);
  useEffect(() => {
    if (!isDrawerOpen || !selectedLead?.id) return;
    const id = selectedLead.id;
    let active = true;
    let timer:ReturnType<typeof setTimeout>;let controller:AbortController|null=null;
    let failures=0;
    const refresh = async () => {
      if(!active||document.visibilityState!=="visible"||refreshContext.current.hasDraft||refreshContext.current.isSubmittingLog)return;
      controller=new AbortController();const signal=controller.signal;
      const timeout=setTimeout(()=>controller?.abort(),20000);
      try {
        const response = await fetch(`/api/crm/leads/${encodeURIComponent(id)}`,{signal});
        const data = await response.json();
        if (!active||signal.aborted) return;
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) {
            const draft=draftCache.current[id] || (attendanceCache.current[id]&&{...attendanceCache.current[id],summary:attendanceCache.current[id].reason});
            if(draft && (draft.summary||draft.action||draft.arrangementReason))setRetainedDraft({id,...draft});
            setIsAddLogOpen(false);setWorkflowDirty(false);
            setSelectedLead(null);
            setIsDrawerOpen(false);
          }
          throw Error(data.error || "Lead not found");
        }
        failures=0;
        if(refreshContext.current.hasDraft||refreshContext.current.isSubmittingLog)return;
        setSelectedLead((current) =>
          current?.id === id
            ? {
                ...current,
                ...(data.lead || data),
                attention: {
                  ...(current.attention || {
                    isMine: false,
                  }),
                  tasks: projectPendingTasks(data.tasks||[],data.lead?.currentStage||current.currentStage),
                },
              }
            : current,
        );
      } catch (e) {
        if (active&&!signal.aborted) {failures++;setLeadActionError((e as Error).message);}
      } finally {clearTimeout(timeout);if(active&&document.visibilityState==="visible")timer=setTimeout(refresh,Math.min(120000,30000*2**failures));}
    };
    const visibility=()=>{clearTimeout(timer);controller?.abort();if(document.visibilityState==="visible")void refresh();};
    document.addEventListener("visibilitychange",visibility);
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);controller?.abort();document.removeEventListener("visibilitychange",visibility);
    };
  }, [isDrawerOpen, selectedLead?.id, detailRefreshVersion]);
  // Load SLA & Cadence Policy Configuration
  const fetchPolicyConfig = async () => {
    try {
      const res = await fetch("/api/crm/policy-config");
      if (res.ok) {
        const data = await res.json();
        setPolicyConfig(data);
      }
    } catch (e) {
      console.error("Failed to load policy config:", e);
    }
  };
  useEffect(() => {
    fetchPolicyConfig();
  }, []);
  const handleSavePolicy = async(updated:CrmPolicyConfig,context?:PolicyTopicRequest):Promise<CrmPolicyConfig|boolean>=>{
    if(!context)throw new PolicySaveError('policy_save_rejected');
    const saved=await savePolicyTopic(context);setPolicyConfig(saved);void fetchLeads();return saved;
  };
  const handleResetPolicy = async (): Promise<boolean> => {
    setPolicyConfig(await restorePolicyDefaults());
    fetchLeads();
    return true;
  };
  // Handle Search submit / debounce
  // Open drawer for a lead
  const handleOpenLeadDrawer = (
    lead: CrmLeadRecord,
    tab?: CustomerTab,
    discarded = false,
    fromHistory = false,
  ) => {
    const nextTab = tab ?? (isDrawerOpen ? activeDrawerTab : "activities");
    const sameCustomer = isDrawerOpen && selectedLead?.id === lead.id;
    // Selecting the current customer is a no-op, including its draft and reading position.
    if (sameCustomer && nextTab === activeDrawerTab) return;
    if (!discarded && !discardDraft(() => handleOpenLeadDrawer(lead, nextTab, true))) return;
    leadRouteVersion.current++;
    writeLeadRoute(lead.id,nextTab,fromHistory);
    if (sameCustomer) {
      tabViewport.current = {pageY:window.scrollY, keyboard:false, tab:nextTab};
      setTaskFocus(undefined);setConversationReturn(undefined);setSignalFocus(undefined);
      setActiveDrawerTab(nextTab);
      return;
    }
    if(retainedDraft?.id===lead.id)setRetainedDraft(null);
    if (!isDrawerOpen) listScroll.current = window.scrollY;
    setTaskFocus(undefined);setConversationReturn(undefined);setSignalFocus(undefined);setQueueComplete(false);setWorkflowDirty(false);setWorkflowTask(undefined);setWorkflowSource(undefined);setWorkflowNotice("");setProfileSave("");setLeadActionError("");setTaskOpening(false);
    setIsAddLogOpen(false);
    customerViewport.current = true;
    setSelectedLead(lead);
    setActiveDrawerTab(nextTab);
    setIsDrawerOpen(true);

  };
  const processFromList=(lead:CrmLeadRecord,discarded=false)=>{
    if(!canEditLead(lead,'crm.followup'))return;
    if(!discarded&&!discardDraft(()=>processFromList(lead,true)))return;
    handleOpenLeadDrawer(lead,"activities",true);
    setAdministrative(false);setTaskOperation('progress');setWorkflowTask(undefined);setWorkflowSource(undefined);setIsAddLogOpen(true);
  };
  // Deep links from notifications fetch only the lead authorized by the server.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("lead");
    if (!id) return;
    let active = true;
    fetch(`/api/crm/leads/${encodeURIComponent(id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Lead unavailable");
        if (active) {
          setCrmModule("leads");
          handleOpenLeadDrawer(data.lead || data, leadDetailTab(new URLSearchParams(window.location.search).get("leadView")),false,true);
        }
      })
      .catch((error) => {
        if (active) setLeadActionError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(()=>{if(crmModule==="leads"&&isDrawerOpen&&selectedLead)writeLeadRoute(selectedLead.id,activeDrawerTab,true);},[crmModule,isDrawerOpen,selectedLead?.id,activeDrawerTab]);
  // Generate unified Customer Journey & Touch Timeline events
  const journeyTimelineEvents = useMemo(() => {
    if (!selectedLead) return [];
    const events: {
      id: string;
      timestamp: string;
      category: "engagement" | "follow_up" | "milestone";
      actorType: "client" | "consultant" | "system" | "record";
      actorName?: string;
      icon: string;
      badgeText: string;
      badgeStyle: string;
      title: string;
      subtitle?: string;
      content?: string;
      staffName?: string;
      channel?: string;
      connectStatus?: string;
      buyingSignalDetected?: string;
      stageTransition?: string;
      nextAction?: string;
      nextFollowUpAt?: string;
      taskEvidence?: any;
    }[] = [];
    // 1. Initial Intake / Ingestion Event (Client Form Submission)
    if (selectedLead.submittedAt) {
      events.push({
        id: `intake-${selectedLead.id}`,
        timestamp: selectedLead.submittedAt,
        category: "engagement",
        actorType: "client",
        actorName: selectedLead.fullName,
        icon: "📥",
        badgeText: t("Lead Ingestion", "留资进线"),
        badgeStyle: isLight
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : "bg-blue-950/60 text-blue-300 border-blue-800",
        title: t(
          `Student submitted inquiry: ${crmValue(selectedLead.goal, lang)}`,
          `学员提交留资需求：${crmValue(selectedLead.goal, lang)}`,
        ),
        subtitle: `${t("Source:", "场景:")} ${crmValue(selectedLead.entryPoint, lang)} · ${t("Campaign:", "活动:")} ${selectedLead.campaign || t("Direct", "官网直访")} · ${t("Mode:", "意向模式:")} ${crmValue(selectedLead.mode, lang)}`,
        content: `${t("Self-reported:", "自报基础:")} ${crmValue(selectedLead.reportedLevel, lang)} · ${t("City:", "意向城市:")} ${customerCity(selectedLead.city, lang)} · ${t("Status:", "身份:")} ${crmValue(selectedLead.currentStatus, lang)} · ${t("Hook:", "引流钩子:")} ${crmValue(selectedLead.hookType, lang)} (${crmValue(selectedLead.hookContext, lang)})`,
      });
    }
    // 2. Client Live Inquiries from Intake Chat (Real Customer Dialogue Engagements)
    if (selectedLead.chatTranscript && selectedLead.chatTranscript.length > 0) {
      selectedLead.chatTranscript
        .filter(
          (msg) =>
            msg.role === "user" && msg.content && !msg.content.includes("---"),
        )
        .forEach((msg, idx) => {
          events.push({
            id: `chat-inquiry-${msg.id || idx}`,
            timestamp: crmMessageTimestamp(msg) || "",
            category: "engagement",
            actorType: "client",
            actorName: selectedLead.fullName,
            icon: "💬",
            badgeText: t("Live Inquiry", "学员在线咨询"),
            badgeStyle: isLight
              ? "bg-sky-50 text-sky-700 border-sky-200"
              : "bg-sky-950/60 text-sky-300 border-sky-800",
            title: t(
              `Student asked: "${msg.content.slice(0, 45)}${msg.content.length > 45 ? "..." : ""}"`,
              `学员咨询提问："${msg.content.slice(0, 45)}${msg.content.length > 45 ? "..." : ""}"`,
            ),
            subtitle: t(
              "Live conversation turn from landing page AI consultation",
              "落地页智能问答留痕",
            ),
            content: msg.content,
          });
        });
    }
    // 3. Placement Diagnostic Quiz Event
    if (typeof selectedLead.quizScore === "number") {
      const breakdownText = selectedLead.quizBreakdown
        ? `HSK 1: ${selectedLead.quizBreakdown.hsk1Correct}/${selectedLead.quizBreakdown.hsk1Total} · HSK 2: ${selectedLead.quizBreakdown.hsk2Correct}/${selectedLead.quizBreakdown.hsk2Total} · HSK 3: ${selectedLead.quizBreakdown.hsk3Correct}/${selectedLead.quizBreakdown.hsk3Total}`
        : undefined;
      events.push({
        id: `quiz-${selectedLead.id}`,
        timestamp: selectedLead.latestAssessment?.attempt?.completedAt || "",
        category: "engagement",
        actorType: "client",
        actorName: selectedLead.fullName,
        icon: "📊",
        badgeText: t("Placement Test", "定级测评"),
        badgeStyle: isLight
          ? "bg-purple-50 text-purple-700 border-purple-200"
          : "bg-purple-950/60 text-purple-300 border-purple-800",
        title: crmAssessmentSummary(selectedLead, lang).detail,
        subtitle: breakdownText,
        content: crmAssessmentSummary(selectedLead, lang).conclusion,
      });
    }
    // Buying signals belong to their saved questionnaire/contact evidence.
    // Current profile values are not independent historical events.
    // 5. Follow-up Logs by Consultants
    if (selectedLead.followUpLogs && selectedLead.followUpLogs.length > 0) {
      selectedLead.followUpLogs.forEach((log) => {
        const isConnected = log.connectStatus === "Connected";
        events.push({
          id: `log-${log.id}`,
          timestamp: log.timestamp,
          category: "follow_up",
          actorType: "consultant",
          staffName: log.staffName,
          icon:
            log.channel === "WhatsApp"
              ? "💬"
              : log.channel === "Phone Call"
                ? "📞"
                : log.channel === "Campus Visit"
                  ? "🏫"
                  : "📋",
          badgeText: log.recordKind === "closure" ? t("Administrative record", "非联系处理记录") : `${t("Consultant Touch", "顾问跟进")} · ${crmValue(log.channel, lang)}`,
          badgeStyle: isConnected
            ? isLight
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-emerald-950/60 text-emerald-300 border-emerald-800"
            : isLight
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-amber-950/60 text-amber-300 border-amber-800",
          title: log.recordKind === "closure" ? `${log.staffName} · ${t("Administrative record", "非联系处理记录")}` : `${log.staffName} · ${crmValue(log.channel, lang)} (${crmValue(log.connectStatus, lang)})`,
          subtitle: log.newStage && log.previousStage!==log.newStage ? `${t("Stage:", "阶段推进:")} ${crmValue(log.previousStage, lang)} ➔ ${crmValue(log.newStage, lang)}` : undefined,
          content: log.summary,
          taskEvidence: log,
          connectStatus: log.connectStatus,
          buyingSignalDetected: log.buyingSignalDetected,
          stageTransition: log.newStage && log.previousStage!==log.newStage ? `${crmValue(log.previousStage, lang)} ➔ ${crmValue(log.newStage, lang)}` : undefined,
          nextAction: log.nextAction,
          nextFollowUpAt: log.nextFollowUpAt,
        });
      });
    }
    // 6. Trial Session Event (if trial booked or attended)
    if (
      ["Trial Booked", "Trial Attended"].includes(selectedLead.currentStage)
    ) {
      events.push({
        id: `trial-${selectedLead.id}`,
        timestamp: selectedLead.stageUpdatedAt || "",
        category:
          selectedLead.currentStage === "Trial Attended"
            ? "milestone"
            : "engagement",
        actorType: "record",
        icon: "🏫",
        badgeText:
          selectedLead.currentStage === "Trial Attended"
            ? t("Trial Attended", "试听出席")
            : t("Trial Booked", "已约试听"),
        badgeStyle: isLight
          ? "bg-amber-50 text-amber-700 border-amber-300"
          : "bg-amber-950/60 text-amber-300 border-amber-700",
        title: `${t("Recorded trial stage:", "已记录试听阶段：")} ${crmValue(selectedLead.currentStage, lang)}`,
        content: t("A trial stage is not a campaign check-in, campus visit or class confirmation.", "试听阶段不等于活动签到、到访校区或班级确认。"),
      });
    }
    // 7. Recorded enrollment status; never infer a signed contract or class.
    if (
      selectedLead.currentStage === "Enrolled"
    ) {
      events.push({
        id: `milestone-${selectedLead.id}`,
        timestamp: selectedLead.stageUpdatedAt || "",
        category: "milestone",
        actorType: "record",
        icon: "🎓",
        badgeText: t("Enrollment status recorded", "报名状态已记录"),
        badgeStyle: isLight
          ? "bg-slate-50 text-slate-700 border-slate-300"
          : "bg-slate-800 text-slate-200 border-slate-600",
        title: selectedLead.enrolledClass
          ? `${t("Recorded class:", "登记班级：")} ${selectedLead.enrolledClass}`
          : t("Class not recorded; enrollment status only.", "未登记班级；仅有报名状态。"),
        subtitle: selectedLead.revenue
          ? `${t("Recorded amount:", "登记金额:")} Rp ${selectedLead.revenue.toLocaleString(crmLocale(lang))} · ${t("Mode:", "模式:")} ${crmValue(selectedLead.mode, lang)}`
          : `${t("Mode:", "模式:")} ${crmValue(selectedLead.mode, lang)} · ${t("City:", "城市:")} ${selectedLead.city}`,
        content: t(
          "Enrollment record; payment and attendance are recorded separately.",
          "报名记录；付款与出席情况分别记录。",
        ),
      });
    }
    // Sort all events by timestamp descending (newest at top), with logical secondary weight sorting when timestamps match
    return events.sort((a, b) => {
      const timeDiff = compareCrmEventTimes(a, b);
      if (
        !Number.isFinite(Date.parse(a.timestamp)) &&
        !Number.isFinite(Date.parse(b.timestamp))
      )
        return 0;
      if (timeDiff !== 0) return timeDiff;
      const getWeight = (id: string) => {
        if (id.startsWith("intake-")) return 1;
        if (id.startsWith("chat-inquiry-")) return 2;
        if (id.startsWith("quiz-")) return 3;
        if (id.startsWith("trial-")) return 5;
        if (id.startsWith("log-")) return 6;
        if (id.startsWith("milestone-")) return 7;
        return 5;
      };
      return getWeight(a.id) - getWeight(b.id);
    });
  }, [selectedLead, isLight, lang]);
  const canEditLead = (lead:CrmLeadRecord,permission='crm.write') => !lead.identityReview?.pending && permittedRecord(employee,lead,permission);
  const [claiming, setClaiming] = useState<string | null>(null);
  const claimLead = async (leadId: string) => {
    if (!discardDraft()) return;
    setClaiming(leadId);
    setLeadActionError("");
    try {
      const r = await fetch(`/api/crm/leads/${leadId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (selectedLead?.id === leadId)
        setSelectedLead((current) =>
          current ? { ...current, ...d.lead } : current,
        );
      await fetchLeads(true);
    } catch (e) {
      setLeadActionError((e as Error).message);
      await fetchLeads(true);
    } finally {
      setClaiming(null);
    }
  };
  // Quick update owner or confirmed tier
  const handleUpdateLeadField = async (
    leadId: string,
    updates: Partial<CrmLeadRecord>,
  ) => {
    if (!discardDraft()) return;
    setProfileSave("saving");
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || String(res.status));
      if (data.lead) {
        setLeadActionError("");setProfileSave("saved");
        if (selectedLead && selectedLead.id === leadId)
          setSelectedLead((current) =>
            current?.id===leadId ? { ...current, ...data.lead } : current,
          );
        fetchLeads();
      }
    } catch (err) {
      setProfileSave("");setLeadActionError((err as Error).message);
    }
  };
  // Tier Badge Color
  const getTierBadge = (tier: TierType) => {
    return isLight ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-slate-800 text-slate-300 border-slate-700";
  };
  // Format Touches and Connect Status with bilingual support
  const formatTouchesDisplay = (lead: CrmLeadRecord) => {
    const count = lead.touchCount || 0;
    let statusText = t("Not Contacted", "未建联");
    let statusColor = "text-slate-400";
    if (lead.connectStatus === "Connected") {
      statusText = t("Replied", "已回复");
      statusColor = "text-emerald-500 font-semibold";
    } else if (lead.connectStatus === "No Response") {
      statusText =
        count >= 3
          ? t("No answer (3 follow-ups)", "未接(已跟进3次)")
          : t("No response", "未接通");
      statusColor = isLight ? "text-slate-600" : "text-slate-300";
    } else if (lead.connectStatus === "Wrong Number") {
      statusText = t("Invalid number", "空号错号");
      statusColor = "text-rose-400";
    } else if (lead.connectStatus === "Interested") {
      statusText = t("High interest", "意向强烈");
      statusColor = "text-primary-500 font-bold";
    }
    const countLabel =
      lang === "id"
        ? crmId(`${count} ${count === 1 ? "Follow-up" : "Follow-ups"}`)
        : lang === "zh"
          ? `跟进 ${count} 次`
          : `${count} ${count === 1 ? "Follow-up" : "Follow-ups"}`;
    return { count, countLabel, statusText, statusColor };
  };
  const formatCrmDateTime = (isoString?: string) =>
    formatCrmEventTime(isoString);
  const openStageEditor=(basisId?:string)=>{if(!selectedLead||!canEditLead(selectedLead))return;const finish=()=>{setStageBasis(typeof basisId==='string'?basisId:undefined);setStageOpen(true);setStageNotice('');};if(discardDraft(finish))finish();};

  const openLearningNeeds=()=>{
    if(!selectedLead)return;
    const finish=()=>{profileNeedsPageY.current=window.scrollY;tabViewport.current={pageY:window.scrollY,keyboard:false,tab:'profile'};setActiveDrawerTab('profile');writeLeadRoute(selectedLead.id,'profile');setProfileNeedsFocus(selectedLead.id);};
    if(discardDraft(finish))finish();
  };
  const closeStageEditor=()=>{const finish=()=>{setStageOpen(false);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[data-crm-stage-trigger]')?.focus({preventScroll:true}));};if(discardDraft(finish))finish();};
  const openTaskList=(taskId?:string,message?:any)=>{
    const finish=()=>{if(message)setConversationReturn({conversationId:message.conversation_id,messageId:message.id,requestId:message.request_id,taskId,source:message.role==="user"?message:undefined});setTaskFocus({id:taskId||"",token:Date.now()});setActiveDrawerTab("activities");requestAnimationFrame(()=>{if(!taskId){const node=document.getElementById("crm-followup-tasks");node?.scrollIntoView({block:"start"});node?.focus({preventScroll:true});}});};
    if(discardDraft(finish))finish();
  };
  const requestFollowupEdit=(command:any)=>{const finish=()=>{setWorkflowNotice(null);setFollowupCommand({...command,token:Date.now()});};if(discardDraft(finish))finish();};
  const openContactPreview=()=>{if(contactPreview){document.querySelector<HTMLElement>(".crm-contact-preview")?.focus({preventScroll:true});return;}const finish=()=>{setContactPreview(true);};if(discardDraft(finish))finish();};
  const [taskOperation,setTaskOperation]=useState<'progress'|'close'>('progress');
  const startContactRecord=()=>{if(!selectedLead||!canEditLead(selectedLead,'crm.followup'))return;const finish=()=>{setWorkflowNotice(null);setAdministrative(false);setTaskOperation('progress');setWorkflowTask(undefined);setWorkflowSource(undefined);setIsAddLogOpen(true);};if(discardDraft(finish))finish();};
  const viewHistoryConversation=(source:any)=>{
    if(!selectedLead)return;
    const finish=()=>{
      const details=source.details||{},message=selectedLead.chatTranscript?.find((m:any)=>m.conversation_id===details.sourceConversationId&&(m.id===details.sourceMessageId||m.request_id===details.sourceMessageId));
      setHistoryConversationBack({leadId:selectedLead.id,tab:activeDrawerTab,request:{...historyRequest,id:source.returnId,search:source.returnSearch,filter:source.returnFilter}});
      setHistoryRequest(null);
      setConversationReturn({conversationId:details.sourceConversationId,messageId:message?.id||details.sourceMessageId,requestId:(message as any)?.request_id||details.sourceMessageId});
      setActiveDrawerTab("chat");writeLeadRoute(selectedLead.id,"chat");
    };if(discardDraft(finish))finish();
  };
  const viewTaskSource=(task:any)=>{
    if(selectedLead&&task.details?.sourceMessageId){openCustomerHistory({id:task.details.sourceMessageId});return;}
    const finish=()=>{const message=selectedLead?.chatTranscript?.find((m:any)=>m.role==="user"&&m.conversation_id===task.details.sourceConversationId&&(m.id===task.details.sourceMessageId||m.request_id===task.details.sourceMessageId));setConversationReturn({conversationId:task.details.sourceConversationId,messageId:message?.id,requestId:(message as any)?.request_id||task.details.sourceMessageId,taskId:task.id});setActiveDrawerTab("chat");};if(discardDraft(finish))finish();
  };
  const openTaskWorkflow=(task:any,lead=selectedLead,discarded=false,operation:'progress'|'close'='progress')=>{
    if(!lead||!canEditLead(lead,"crm.followup")||taskOpening)return;
    const finish=async()=>{setWorkflowNotice(null);setTaskOpening(true);setIsSubmittingLog(true);setLeadActionError("");try{
      const response=await fetch(`/api/crm/leads/${encodeURIComponent(lead.id)}`);const data=await response.json();if(!response.ok)throw Error(data.error);
      const current=data.tasks?.find((value:any)=>value.id===task.id);if(!current||!["open","overdue"].includes(current.status))throw Error(t("Task changed; refresh and review","任务已变化，请刷新后核实"));
      const refreshed={...lead,...data.lead,attention:{...lead.attention,tasks:projectPendingTasks(data.tasks||[],data.lead?.currentStage||lead.currentStage)}};
      if(!canEditLead(refreshed,"crm.followup"))throw Error("Permission denied");
      setSelectedLead((current:any)=>current?.id===lead.id?refreshed:current);
      const original=(data.chatTranscript||[]).find((message:any)=>message.role==="user"&&message.conversation_id===current.details?.sourceConversationId&&(message.request_id===current.details?.sourceMessageId||message.id===current.details?.sourceMessageId));
      setWorkflowSource(conversationReturn?.taskId===task.id&&conversationReturn.source?conversationReturn.source:original);setAdministrative(false);setTaskOperation(operation);setWorkflowTask(task.id);setIsAddLogOpen(true);
    }catch(error){setLeadActionError((error as Error).message);}finally{setTaskOpening(false);setIsSubmittingLog(false);}};
    if(discarded||discardDraft(()=>void finish()))void finish();
  };
  const changeCustomerTab=(tab:typeof activeDrawerTab,keyboard=false)=>{
    if (tab === activeDrawerTab) return;
    const finish=()=>{
      tabViewport.current = {pageY:window.scrollY, keyboard, tab};
      setTaskFocus(undefined);
      setInsightSourceFocus(undefined);
      setConversationReturn(null);
      setActiveDrawerTab(tab);
      if(selectedLead)writeLeadRoute(selectedLead.id,tab);
    };
    if(!discardDraft(finish))return;
    finish();
  };
  const canAssignSelectedOwner=Boolean(selectedLead&&!selectedLead.identityReview?.pending&&canAssign&&permittedRecord(employee,selectedLead,"crm.assign")&&(!selectedLead.identityReview?.ownerAssignmentManagerOnly||isCrmManager(employee)));
  const openOwnerEditor=()=>{const open=()=>setOwnerOpen(true);if(discardDraft(open))open();};
  const leadPanel =
    isDrawerOpen && selectedLead ? (
      <section
        id="crm-customer-panel"
        className="crm-customer-panel crm-detail-panel"
        aria-label={t("Customer workspace", "客户处理面板")}
      >
        <CrmDetailHeader identityNavigation={{
          label:t("Customer navigation","客户浏览"),
          back:<button type="button" className="crm-detail-nav-button" title={t("Back to customer list","返回客户列表")} aria-label={t("Back to customer list","返回客户列表")} onClick={closeCustomer} disabled={isSubmittingLog||profileSave==="saving"}><ArrowLeft size={18} aria-hidden="true"/></button>,
          adjacent:<>{[-1,1].map(offset=>{const position=filteredLeads.findIndex((l:any)=>l.id===selectedLead.id),target=filteredLeads[position+offset],label=offset<0?t("Previous customer","上一位客户"):t("Next customer","下一位客户");return <button type="button" key={offset} className="crm-detail-nav-button" title={label} aria-label={label} disabled={position<0||!target} onClick={()=>target&&handleOpenLeadDrawer(target)}>{offset<0?<ChevronLeft size={18} aria-hidden="true"/>:<ChevronRight size={18} aria-hidden="true"/>}</button>;})}</>
        }} title={selectedLead.fullName} status={<CrmCurrentSalesState lead={selectedLead} lang={lang} explainIdentity/>} meta={<span>
              {selectedLead.owner&&canAssignSelectedOwner?<button type="button" className="crm-work-link crm-owner-trigger" aria-label={selectedLead.owner?(lang==='zh'?'转交负责人':lang==='id'?'Alihkan penanggung jawab':'Transfer owner'):(lang==='zh'?'分配负责人':lang==='id'?'Tetapkan penanggung jawab':'Assign owner')} disabled={Boolean(selectedLead.identityReview?.pending)||isSubmittingLog} onClick={openOwnerEditor}>{employees.find(e=>e.id===selectedLead.owner)?.displayName||selectedLead.owner||t("Unassigned","未分配")} · {selectedLead.owner?(lang==='zh'?'转交':lang==='id'?'Alihkan':'Transfer'):(lang==='zh'?'分配':lang==='id'?'Tetapkan':'Assign')}</button>:employees.find(e=>e.id===selectedLead.owner)?.displayName||selectedLead.owner||t("Unassigned","未分配")}{' · '}{leadDisplayNumber(selectedLead)}
            </span>} actions={<>

            <div className="crm-detail-contact-actions" role="group" aria-label={t("Customer actions","客户操作")}>
            <CrmCustomer360Button lang={lang} onClick={()=>openCustomerHistory({})}/>
            {!selectedLead.owner&&canAssignSelectedOwner&&<button type="button" className="crm-work-button crm-owner-trigger" aria-label={lang==='zh'?'分配负责人':lang==='id'?'Tetapkan penanggung jawab':'Assign owner'} disabled={isSubmittingLog} onClick={openOwnerEditor}><UserCheck size={15} aria-hidden="true"/>{lang==='zh'?'分配':lang==='id'?'Tetapkan':'Assign'}</button>}
            {canClaimForContact(employee,selectedLead) && (
                <button
                  type="button"
                  className="crm-work-button"
                  data-primary={!canEditLead(selectedLead,"crm.followup")&&!selectedLead.identityReview?.pending}
                  disabled={claiming === selectedLead.id}
                  onClick={() => claimLead(selectedLead.id)}
                >
                  <UserCheck size={15} aria-hidden="true" />{claiming === selectedLead.id
                    ? t("Claiming…", "认领中…")
                    : t("Claim for myself", "自己认领")}
                </button>
              )}
            {!selectedLead.identityReview?.pending&&<button type="button" disabled={!selectedLead.whatsapp?.trim() || selectedLead.contactArrangement?.state==='stopped'} title={!selectedLead.whatsapp?.trim()?t("No contact number recorded","尚未记录联系号码"):selectedLead.contactArrangement?.state==='stopped'?outreachText('CONTACT_STOPPED',lang):undefined} onClick={openContactPreview} className="crm-work-button">
              <MessageCircle size={15} aria-hidden="true" /> {t("Prepare contact","准备联系")}
            </button>}
            <CrmProgressAction state={progressActionState(employee,selectedLead)} busy={isSubmittingLog} lang={lang} primary={!selectedLead.identityReview?.pending} icon={<PlusCircle size={15} aria-hidden="true"/>} onClick={startContactRecord}/>
            {canEditLead(selectedLead)&&<button type="button" className="crm-work-button" data-crm-stage-trigger disabled={isSubmittingLog||profileSave==='saving'} onClick={()=>openStageEditor()}><ArrowRightLeft size={15} aria-hidden="true" />{lang==='zh'?'更新阶段':lang==='id'?'Perbarui tahap':'Update stage'}</button>}
            </div>
            {selectedLead.identityReview?.pending&&selectedLead.identityReview?.canReview&&<CrmIdentityAction lang={lang} onClick={()=>openIdentityReview(selectedLead.id)}/>}


          </>}/>
        {!ownerOpen&&(hasDraft||isSubmittingLog)&&<CrmSaveFeedback lang={lang} state={isSubmittingLog?"saving":"dirty"}/>}
        <div className="crm-panel-next"><CrmNextTaskSummary hideFirstContact hideContactNotice lead={selectedLead} lang={lang} timezone={filterTimezone} onOpen={()=>openTaskList()}/></div>
        <CrmDetailTabs id="crm-customer" contentId="crm-customer-content" label={t("Customer details","客户详情")} value={activeDrawerTab==="playbook"?"activities":activeDrawerTab} onChange={(tab,keyboard)=>changeCustomerTab(tab as CustomerTab,keyboard)} tabs={[
          {id:"activities",label:t("Follow-up","跟进"),icon:ListChecks},
          {id:"profile",label:t("Profile","客户资料"),icon:UserRound},
          {id:"assessment",label:t("Assessment","测评"),icon:ClipboardCheck},
          {id:"chat",label:t("Conversations","对话"),icon:MessagesSquare},
        ]}/>
        <div
          key={selectedLead.id}
          id="crm-customer-content"
          data-admin-scroll="detail"
          tabIndex={0}
          className="crm-customer-panel-body crm-detail-body"
          role="tabpanel"
          aria-labelledby={`crm-customer-tab-${activeDrawerTab === "playbook" ? "activities" : activeDrawerTab}`}
        >
          {leadActionError && (
            <p role="alert" className="text-rose-500">
              {crmError(leadActionError, lang)}
            </p>
          )}
          {stageNotice?.leadId===selectedLead.id&&<CrmSaveFeedback lang={lang} state="saved">{stageNotice.text}</CrmSaveFeedback>}
          {profileSave&&activeDrawerTab==="profile"&&<CrmSaveFeedback lang={lang} state={profileSave==="saving"?"saving":"saved"}>{profileSave==="saving"?t("Saving customer details…","正在保存客户资料…"):t("Customer details saved.","客户资料已保存。")}</CrmSaveFeedback>}
          {activeDrawerTab === "profile" && (
            <>

            <CrmCustomerProfile
              onInsightsRefresh={()=>void fetchLeads(true)}
              onInsightSource={e=>openCustomerHistory({id:e.root?.id||e.sourceId,quote:e.quote})}
              signalFocus={signalFocus}
              onSignalSource={e=>viewTaskSource({id:e.taskId,details:{sourceConversationId:e.conversationId,sourceMessageId:e.messageId}})}
              onSignalTask={id=>openTaskList(id)}
              lead={selectedLead}
              lang={lang}
              timezone={filterTimezone}
              basicActions={setProfileActionTarget}
              contactFields={setProfileContactTarget}
              dynamicProfile={<CrmProfileEditor basicTarget={profileActionTarget} contactTarget={profileContactTarget} key={selectedLead.id+trustReset} lead={selectedLead} disabled={!canEditLead(selectedLead)} timezone={filterTimezone} isLight={isLight} onDirty={setProfileFieldsDirty} onBusy={setIsSubmittingLog} onSaved={(lead:any)=>{if(lead)setSelectedLead(current=>current?.id===lead.id?{...current,...lead}:current);fetchLeads(true);}}/>}
              communication={<CrmSingleSelect label={lang==='zh'?'首选沟通语言':lang==='id'?'Bahasa komunikasi pilihan':'Preferred communication language'} value={selectedLead.communicationLanguage||'unknown'} options={[{value:'unknown',label:lang==='zh'?'未确认':lang==='id'?'Belum dikonfirmasi':'Unconfirmed'},{value:'en',label:'English'},{value:'id',label:'Bahasa Indonesia'},{value:'zh',label:'中文'}]} lang={lang} isLight={isLight} disabled={!canEditLead(selectedLead)} onChange={v=>handleUpdateLeadField(selectedLead.id,{communicationLanguage:v as any})}/>}
              participation={canEditLead(selectedLead,"crm.attendance")&&<CrmAttendanceEditor key={`${selectedLead.id}:${attendanceReset}`} lead={selectedLead} staffId={employee.id} onDirty={setAttendanceDirty} onBusy={setIsSubmittingLog} lang={lang} isLight={isLight} timezone={filterTimezone} onUpdated={lead=>{setSelectedLead(current=>current?.id===lead.id?{...current,...lead}:current);fetchLeads(true);}}/>}
            />

            </>
          )}
          {activeDrawerTab === "assessment" && (
            <CrmCustomerAssessment
              lead={selectedLead}
              lang={lang}
              timezone={filterTimezone}
            />
          )}
          {activeDrawerTab === "chat" && (
            <>{historyConversationBack?.leadId===selectedLead.id&&<button type="button" className="crm-work-link" onClick={()=>{const back=historyConversationBack;setActiveDrawerTab(back.tab);writeLeadRoute(selectedLead.id,back.tab);setHistoryRequest({...back.request,leadId:selectedLead.id,token:Date.now()});setHistoryConversationBack(null);}}>{crmUiText("返回客户全景",lang)}</button>}<CrmCustomerConversations
              isLight={isLight}
              onOpenTask={(taskId:string,message:any)=>openTaskList(taskId,message)}
              conversationContext={conversationReturn}
              lead={selectedLead}
              lang={lang}
              timezone={filterTimezone}
            /></>
          )}
          {activeDrawerTab === "activities" && <div className="crm-followup-sections">
            {!selectedLead.identityReview?.pending&&!canEditLead(selectedLead,"crm.followup")&&<p className="crm-work-muted">{t("Claim this unassigned lead before updating it or recording follow-up.","请先认领此未分配客户，再修改资料或记录跟进。")}</p>}
            {conversationReturn&&<button type="button" className="crm-work-link" onClick={()=>changeCustomerTab("chat")}>{t("Return to conversation","返回对话")}</button>}
            {taskOpening&&<p role="status">{t("Loading task context…","正在加载任务依据…")}</p>}
            <CrmTrustPanel feedback={<>{workflowNotice?.taskChange&&<CrmSaveFeedback lang={lang} state="saved">{({create:lang==='zh'?'已新增独立任务':lang==='id'?'Tugas terpisah dibuat':'Separate task created',supplement:lang==='zh'?'已补充原任务，期限不变':lang==='id'?'Informasi tugas ditambahkan; tenggat tetap':'Task information added; deadline unchanged',reschedule:lang==='zh'?'已更新执行时间，原期限及历史保留':lang==='id'?'Waktu pelaksanaan diperbarui; tenggat dan riwayat awal tetap':'Execution time updated; original deadline and history retained',replace:lang==='zh'?'已取消选定原任务并建立替代任务，其他任务保留':lang==='id'?'Tugas lama terpilih dibatalkan dan diganti; tugas lain tetap':'Selected task cancelled and replaced; other tasks retained'}as any)[workflowNotice.taskChange]}</CrmSaveFeedback>}
              {workflowNotice?.leadId===selectedLead.id&&<CrmSaveFeedback lang={lang} state="saved">{typeof workflowNotice.contactRecorded==='boolean' ? progressSaveSummary(workflowNotice,lang) : workflowNotice.cancelled ? (lang==='zh'?'任务已终止':lang==='id'?'Tugas dihentikan':'Task terminated') : workflowNotice.completed ? (lang==='zh'?'首次跟进要求已处理':lang==='id'?'Tindak lanjut pertama diproses':'First follow-up processed') : workflowNotice.contactPlanChange ? ({review_cancelled:lang==='zh'?'复查安排已更新':lang==='id'?'Pengaturan tinjauan diperbarui':'Review arrangement updated',review_scheduled:lang==='zh'?'已安排复查任务':lang==='id'?'Tugas tinjauan dijadwalkan':'Review task scheduled',stopped:lang==='zh'?'已停止主动联系':lang==='id'?'Kontak proaktif dihentikan':'Proactive contact stopped',restored:lang==='zh'?'联系限制已更新':lang==='id'?'Pembatasan kontak diperbarui':'Contact restriction updated'} as any)[workflowNotice.contactPlanChange] : (lang==='zh'?'进展已保存':lang==='id'?'Progres disimpan':'Progress saved')}</CrmSaveFeedback>}{lang==='zh'&&workflowNotice?.profileFieldResults?.length>0&&<p role="status">{profileSaveSummary(workflowNotice.profileFieldResults)}完整结果见最新跟进记录。</p>}</>} onViewStage={openStageEditor}  onViewProfile={openLearningNeeds} onViewAssessment={()=>{setActiveDrawerTab("assessment");writeLeadRoute(selectedLead.id,"assessment");}} sourceFocus={insightSourceFocus?.leadId===selectedLead.id?insightSourceFocus:undefined} recentSourceId={workflowNotice?.leadId===selectedLead.id?workflowNotice.logId:undefined} key={selectedLead.id+trustReset} canEditProfile={canEditLead(selectedLead)} onDirty={setTrustDirty} onBusy={setIsSubmittingLog} lead={selectedLead} lang={lang} isLight={isLight} timezone={filterTimezone} disabled={!canEditLead(selectedLead,"crm.followup")||taskOpening} onRefresh={()=>{setDetailRefreshVersion(v=>v+1);void fetchLeads(true);}} focusTask={taskFocus} onProcess={(task:any,operation:any)=>openTaskWorkflow(task,selectedLead,false,operation)} onSource={(task:any)=>viewTaskSource(task)}
              command={followupCommand} onRequestEdit={requestFollowupEdit} workflowOpen={false} modalSuspended={Boolean(pendingNavigation)} workflowTask={workflowTask} onIdentity={()=>openIdentityReview(selectedLead.id)} journey={journeyTimelineEvents}
              context={({data,error}:any)=><CrmFollowupContext lead={selectedLead} lang={lang} timezone={filterTimezone} onSource={viewTaskSource} tasks={data?.tasks} facts={data?.facts} requests={data?.requests} taskError={error} onTask={openTaskList}/>}
            >

            </CrmTrustPanel>

          </div>}

        </div>
        {isAddLogOpen && <CrmOperationLayer progress context={`${selectedLead.fullName} · ${leadDisplayNumber(selectedLead)}`} title={lang==='zh'?'记录进展':lang==='id'?'Catat perkembangan':'Record progress'} lang={lang} isLight={isLight} busy={isSubmittingLog} onClose={()=>discardDraft()}><CrmWorkflowForm key={selectedLead.id+String(workflowTask)+String(administrative)+taskOperation} canUpdateStage={canEditLead(selectedLead)} operation={taskOperation} lead={selectedLead} employee={employee} lang={lang} isLight={isLight} timezone={filterTimezone} initialDraft={draftCache.current[selectedLead.id]} onDraft={(draft:any)=>{draftCache.current[selectedLead.id]=draft;}} administrative={administrative} workCalendar={policyConfig.businessHours} selectedTask={workflowTask} sourceMessage={workflowSource} onDirty={setWorkflowDirty} onBusy={setIsSubmittingLog} onCancel={()=>discardDraft()} onSaved={async(data:any,next:boolean)=>{setStageNotice(null);delete draftCache.current[selectedLead.id];if(retainedDraft?.id===selectedLead.id)setRetainedDraft(null);const candidates=filteredLeads.slice(filteredLeads.findIndex((l:any)=>l.id===selectedLead.id)+1);setWorkflowDirty(false);setWorkflowTask(undefined);setWorkflowSource(undefined);setSelectedLead((current:any)=>current?.id===selectedLead.id?({...current,...data.lead,attention:{...current.attention,tasks:(current.attention?.tasks||[]).filter((task:any)=>!data.completedTaskIds.includes(task.id)&&!(data.cancelledTaskIds||[]).includes(task.id))}}):current);setDetailRefreshVersion(v=>v+1);setIsAddLogOpen(false);setActiveDrawerTab("activities");writeLeadRoute(selectedLead.id,"activities",true);setWorkflowNotice({leadId:selectedLead.id,logId:data.logId,profileFieldResults:data.profileFieldResults,cancelled:data.cancelledTaskIds?.length||0,completed:data.completedTaskIds.length,completedNames:data.completedTaskIds.map((id:string)=>{const task=(selectedLead.attention?.tasks||[]).find((task:any)=>task.id===id);return task?describeFollowUpTask(task,lang,filterTimezone).action:id;}).join("；"),contactPlanChange:data.contactPlanChange,contactRecorded:data.contactRecorded,agreementChange:data.agreementChange,stageUpdated:data.stageUpdated,stageUpdatePending:data.stageUpdatePending,kept:data.lead?.followUpDisposition?.kind==="keep",created:Boolean(data.createdTaskId),recordOnly:data.recordOnly,requestCount:data.handledRequestIds?.length||0,taskChange:data.taskChange?.command});fetchLeads(true);if(next){for(const candidate of candidates){const access=await fetch(`/api/crm/leads/${candidate.id}/tasks`);if([403,404].includes(access.status))continue;if(!access.ok){setLeadActionError(lang==='zh'?'记录已保存，下一位暂不可加载':lang==='id'?'Catatan disimpan; pelanggan berikutnya belum tersedia':'Record saved; next customer unavailable');return;}handleOpenLeadDrawer(candidate,'activities',true);return;}setIsDrawerOpen(false);setSelectedLead(null);writeLeadRoute();setQueueComplete(true);}}}/></CrmOperationLayer>}
        {ownerOpen&&<CrmOperationLayer compose title={selectedLead.owner?(lang==='zh'?'转交负责人':lang==='id'?'Alihkan penanggung jawab':'Transfer owner'):(lang==='zh'?'分配负责人':lang==='id'?'Tetapkan penanggung jawab':'Assign owner')} context={selectedLead.fullName} lang={lang} isLight={isLight} busy={isSubmittingLog} onClose={()=>{const close=()=>{setOwnerOpen(false);setOwnerDirty(false);};if(discardDraft(close))close();}}><CrmOwnerEditor lead={selectedLead} directory={salesEmployees} lang={lang} isLight={isLight} onDirty={setOwnerDirty} onBusy={setIsSubmittingLog} onSaved={(lead:any)=>{setOwnerDirty(false);setOwnerOpen(false);setSelectedLead((v:any)=>v?.id===lead.id?{...v,...lead}:v);setDetailRefreshVersion(v=>v+1);void fetchLeads(true);}}/></CrmOperationLayer>}
        {stageOpen&&<CrmOperationLayer compose context={`${selectedLead.fullName} · ${leadDisplayNumber(selectedLead)}`} title={lang==='zh'?'更新销售阶段':lang==='id'?'Perbarui tahap penjualan':'Update sales stage'} lang={lang} isLight={isLight} busy={isSubmittingLog} onClose={closeStageEditor}><CrmStageEditor inDrawer initialBasisId={stageBasis} key={selectedLead.id+trustReset} onClose={closeStageEditor} onDirty={setStageDirty} onBusy={setIsSubmittingLog} lead={selectedLead} lang={lang} isLight={isLight} disabled={!canEditLead(selectedLead)} onSaved={(updated:any)=>{setStageDirty(false);setStageOpen(false);setStageNotice({leadId:updated.id,text:t('Sales stage updated to ','销售阶段已更新为')+crmValue(updated.currentStage,lang)});setDetailRefreshVersion(v=>v+1);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[data-crm-stage-trigger]')?.focus({preventScroll:true}));setSelectedLead((v:any)=>v?.id===updated.id?{...v,...updated}:v);void fetchLeads(true);}}/></CrmOperationLayer>}
        {contactPreview&&<CrmOperationLayer compose context={`${selectedLead.fullName} · ${leadDisplayNumber(selectedLead)}`} title={lang==='zh'?'准备联系':lang==='id'?'Siapkan kontak':'Prepare contact'} lang={lang} isLight={isLight} busy={isSubmittingLog} onClose={()=>discardDraft()}><CrmContactPreview inLayer onRequestClose={()=>discardDraft()} onBusy={setIsSubmittingLog} key={"contact-preview-"+selectedLead.id} lead={selectedLead} employee={employee} lang={lang} isLight={isLight} onDirty={setContactPreviewDirty} onClose={()=>{setContactPreview(false);setContactPreviewDirty(false);}} onUpdated={(lead:any)=>{setSelectedLead(lead);void fetchLeads(true);}}/></CrmOperationLayer>}
      </section>
    ) : null;
  const leadFilterControls = (
            <CrmLeadFilters
              analysis={leadAnalysis}
              compact={Boolean(leadPanel)}
              isLight={isLight}
              value={filters}
              onChange={setFilters}
              lang={lang}
              scope={employee.scope}
              owners={Array.from(
                new Set([
                  ...employees
                    .filter((e) => e.active !== false)
                    .map((e) => e.id),
                  ...ownerOptions,
                ]),
              ).map((id) => ({
                id,
                label: employees.find((e) => e.id === id)?.displayName || id,
              }))}
              count={filteredLeads.length}
              loading={isLoading || appliedSearch !== filters.search}
              timezone={filterTimezone}
              viewMode={viewMode}
              onViewMode={handleSetViewMode}
            />
  );
  return (
    <CrmEnrollmentCorrectionAccess.Provider value={{open:selectedLead&&canEditLead(selectedLead)?(id:string)=>{setHistoryAmendNotice('');setEnrollmentTarget(id)}:undefined}}><CrmHistoryAccess.Provider value={openCustomerHistory}><div
      data-admin-workspace="crm" data-theme={isLight ? "light" : "dark"}
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 select-text ${isLight ? "bg-[#f5f5f7] text-[#1d1d1f]" : "bg-slate-950 text-slate-100"}`}
    >
      <PageMetadata lang={lang} options={{module:crmModule === "leads" && leadAnalysis ? "analysis" : crmModule}}/>
      {identitySelection&&<CrmIdentityComparison key={identitySelection.leadId} {...identitySelection} employee={employee} employees={employees} lang={lang} isLight={isLight} timezone={filterTimezone} onClose={closeIdentityReview} onDirty={setIdentityDirty} onBusy={setIsSubmittingLog} onCandidate={(candidateId:string)=>{const selection={...identitySelection,candidateId};setIdentitySelection(selection);const url=identityUrl(window.location.href,selection);window.history.replaceState({},"",url);lastWorkspaceUrl.current=url;}} onChanged={async()=>{setDetailRefreshVersion(v=>v+1);void fetchLeads(true);if(selectedLead){const r=await fetch(`/api/crm/leads/${encodeURIComponent(selectedLead.id)}`);if(r.ok){const d=await r.json();setSelectedLead((v:any)=>v?.id===selectedLead.id?{...v,...d.lead}:v);}}}}/>}
      {pendingNavigation&&<CrmDiscardDialog isLight={isLight} title={t("Unsaved changes","修改尚未保存")} description={t("Keep editing, or discard your unsaved changes and continue. Saved records stay unchanged.","可以继续编辑，或放弃未保存的修改后继续；已保存记录保持不变。")} keepLabel={t("Keep editing","继续编辑")} discardLabel={t("Discard and continue","放弃并继续")} onKeep={resumeDraft} onDiscard={()=>{const action=pendingNavigation;setPendingNavigation(null);clearDraft();action();}}/>}
      {/* Top Apple-Style / Dark Navigation Bar - Stable 2-Row Architecture */}
      <a className="admin-skip-link" href="#crm-main">{lang==='zh'?'跳到工作区':lang==='id'?'Lewati ke ruang kerja':'Skip to workspace'}</a>
      <AdminHeader workspace="crm" employee={employee} lang={lang} setLang={setLang} isLight={isLight} toggleTheme={toggleTheme}
        navigation={<>
          <button type="button" aria-current={crmModule === "campaigns" ? "page" : undefined} onClick={() => changeModule("campaigns")}><Target size={16}/>{t("Marketing Campaigns", "营销活动中心")}</button>
          <button type="button" aria-current={crmModule === "leads" ? "page" : undefined} onClick={() => changeModule("leads")}><Users size={16}/>{t("Leads CRM", "销售线索")}</button>
          {canManage && <button type="button" aria-current={crmModule === "policy" ? "page" : undefined} onClick={() => changeModule("policy")}><Settings size={16}/>{t("Sales Operations", "销售运营")}</button>}
          <button type="button" aria-current={crmModule === "docs" ? "page" : undefined} onClick={() => changeModule("docs")}><BookOpen size={16}/>{lang==='zh'?'系统文档':lang==='id'?'Dokumentasi':'Documentation'}</button>
        </>}/>

      {/* Main Workspace Body */}
      <main id="crm-main" tabIndex={-1} className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1560px] w-full mx-auto space-y-5">
        {employee.permissions.includes("crm.assign")&&<AccessHandoverPanel actor={employee} lang={lang} isLight={isLight}/>}
        {crmModule !== "campaigns" && !leadPanel && <div className={`admin-page-toolbar${crmModule === "leads" ? " crm-home-page-heading" : ""}`} data-theme={isLight ? "light" : "dark"}>
          {crmModule === "leads" ? (
            <CrmPageIdentity
              title={leadAnalysis ? adminText(lang,"Customer statistics and analysis","Statistik dan analisis pelanggan","客户统计与分析") : adminText(lang, "Customer follow-up", "Tindak lanjut pelanggan", "客户跟进")}
              subtitle={leadAnalysis ? adminText(lang,"Analyse the current filtered customer cohort.","Analisis pelanggan sesuai filter saat ini.","查看当前筛选范围内的客户与联系情况，点击数据返回客户列表。") : t("Prioritize customers, record outcomes and plan the next step.", "明确优先客户，记录沟通结果，安排下一步。")}
            />
          ) : <div><h1>{crmModule === "policy" ? t("Sales Operations Settings", "销售运营设置") : adminText(lang, "CRM documentation", "Dokumentasi CRM", "CRM 系统文档")}</h1></div>}
          <div className={`admin-page-actions${crmModule === "leads" ? " crm-home-page-actions" : ""}`}>            {/* Contextual Actions in Leads: Refresh & Export */}
            {crmModule === "leads" && (
              <>
                <CrmPageAction label={leadAnalysis ? adminText(lang,"Back to customer list","Kembali ke daftar pelanggan","返回客户列表") : adminText(lang,"Statistics and analysis","Statistik dan analisis","统计与分析")} icon={leadAnalysis ? ArrowLeft : BarChart3} onClick={()=>navigateLeadAnalysis(!leadAnalysis)}/>
                {employee.permissions.includes("crm.export") && (
                  <CrmPageAction
                    href={"/api/crm/export?" + queryKey}
                    icon={Download}
                    label={t("Export current results (.JSON)", "导出当前结果 (.JSON)")}
                  />
                )}
                <CrmPageAction
                  label={t("Refresh", "刷新数据")}
                  description={lastListRefresh?`${t("Last refreshed","上次刷新")} ${formatCrmEventTime(lastListRefresh)}`:t("No successful refresh yet","尚无成功刷新记录")}
                  icon={RefreshCw}
                  iconOnly
                  loading={isLoading}
                  onClick={() => void fetchLeads()}
                />
              </>
            )}

            {/* Contextual Actions in Docs: Print / PDF */}
            {crmModule === "docs" && (
              <button
                type="button"
                onClick={() => window.print()}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isLight
                    ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 shadow-2xs"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                }`}
                title={t(
                  "Print or Export PDF Handbook",
                  "打印或导出 PDF 知识库",
                )}
              >
                <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                <span>{t("Print / PDF", "打印/PDF")}</span>
              </button>
            )}</div>
        </div>}
        {crmModule === "campaigns" ? (
          <CrmCampaignHub
            canManageCampaigns={employee.permissions.includes("campaigns.manage")}
            isLight={isLight}
            lang={lang}
            leads={leads}
            onSelectLeadInCrm={async(leadId) => {
              try{
                let target=leads.find(l=>l.id===leadId);
                if(!target){const r=await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`);const data=await r.json();if(!r.ok)throw Error(data.error||'Lead not found');target={...data.lead,attention:{tasks:projectPendingTasks(data.tasks||[],data.lead?.currentStage),isMine:false}};}
                setCrmModule("leads");handleOpenLeadDrawer(target);
              }catch(e){setLeadActionError((e as Error).message);}
            }}
            onNavigateTab={(tab) => changeModule(tab)}
          />
        ) : crmModule === "policy" && canManage ? (
          <>
            {employee.permissions.includes("crm.operations.manage") && <CrmPolicySettings
              isLight={isLight}
              lang={lang}
              policyConfig={policyConfig}
              onSavePolicy={handleSavePolicy}
              onResetPolicy={handleResetPolicy}
              onNavigateTab={(tab) => changeModule(tab)}
              onNavigateNotifications={() =>
                setNotificationNavigationRequest((value) => value + 1)
              }
              notificationContent={employee.permissions.includes("notifications.read") ? (topic:string,active:boolean)=><NotificationTopicPanels enabled={active} topic={topic as NotificationTab} isLight={isLight} lang={lang} canEdit={employee.permissions.includes("notifications.manage")}/> : null}
              onActionControlsChange={setPolicyControls}
            />}
            {!employee.permissions.includes("crm.operations.manage") && employee.permissions.includes("notifications.read") && <NotificationWorkspace isLight={isLight} lang={lang} canEdit={employee.permissions.includes("notifications.manage")}/>}
          </>
        ) : crmModule === "docs" ? (
          <CrmUserGuide
            isLight={isLight}
            lang={lang}
            onNavigateTab={(tab) => changeModule(tab)}
          />
        ) : (
          <>
            {leadAnalysis && !leadPanel && leadFilterControls}
            {!leadPanel && <CrmProcessOverview mode={leadAnalysis ? "analysis" : "summary"} metrics={processOverview} error={Boolean(refreshProblem&&!processOverview)} lang={lang} isLight={isLight} timezone={filterTimezone} leader={canAssign} employees={employees} selectedMetrics={filters.overview||[]} selectedStages={filters.stage} onMetric={key=>{setFilters(f=>({...f,overview:key?(f.overview?.includes(key)?f.overview.filter(v=>v!==key):[...(f.overview||[]),key]):undefined}));if(leadAnalysis)navigateLeadAnalysis(false);}} onStage={key=>{setFilters(f=>({...f,stage:key?(f.stage.includes(key)?f.stage.filter(v=>v!==key):[key]):[]}));if(leadAnalysis)navigateLeadAnalysis(false);}}/>}
            {retainedDraft&&<section className="crm-workflow-form" role="region" aria-label={lang==='zh'?'保留的未保存草稿':lang==='id'?'Draf belum tersimpan':'Retained unsaved draft'}><p role="alert">{lang==='zh'?'客户访问权限已变化，未保存草稿已保留；重新获得权限后打开客户可继续。':lang==='id'?'Akses pelanggan berubah. Draf disimpan di halaman ini; buka pelanggan setelah akses dipulihkan.':'Customer access changed. Your draft is retained on this page; reopen after access is restored.'}</p><textarea readOnly aria-label={lang==='zh'?'草稿内容':lang==='id'?'Isi draf':'Draft content'} value={[retainedDraft.summary,retainedDraft.action,retainedDraft.purpose,retainedDraft.date,retainedDraft.arrangementReason,retainedDraft.reviewDate].filter(Boolean).join('\n')}/><button type="button" className="crm-work-button" onClick={()=>{delete draftCache.current[retainedDraft.id];delete attendanceCache.current[retainedDraft.id];setRetainedDraft(null);}}>{lang==='zh'?'丢弃草稿':lang==='id'?'Buang draf':'Discard draft'}</button></section>}
            {queueComplete&&<p role="status">{lang==='zh'?'已到当前列表末尾，请核对剩余待办':lang==='id'?'Akhir daftar tercapai; periksa tugas yang masih terbuka':'End of current list; review remaining tasks'}</p>}
            {(pendingListOrder||refreshProblem)&&<div className="crm-refresh-status" role="status" aria-live="polite">
              {pendingListOrder&&<button className="crm-work-button" onClick={()=>void fetchLeads()}>{adminText(lang,'Update order','Perbarui urutan','更新排序')}</button>}
              {refreshProblem&&<><span> · {refreshProblem==='timeout'||refreshProblem==='changes-timeout'?adminText(lang,'Refresh timed out. Displayed data may be outdated.','Pembaruan melewati batas waktu. Data yang ditampilkan mungkin belum terbaru.','刷新超时，已显示数据可能不是最新。'):refreshProblem==='unauthorized'?adminText(lang,'Access changed. Sign in again.','Akses berubah. Silakan masuk kembali.','访问权限已变化，请重新登录。'):adminText(lang,'Refresh unavailable. Displayed data may be outdated.','Pembaruan gagal. Data yang ditampilkan mungkin belum terbaru.','刷新失败，当前显示上次成功加载的数据。')}</span><button disabled={isLoading||refreshProblem==='unauthorized'} className="crm-work-button" onClick={()=>void fetchLeads()}>{adminText(lang,'Retry','Coba lagi','重试')}</button></>}
            </div>}
            {leadActionError && (
              <p role="alert" className="text-xs text-rose-500">
                {crmError(leadActionError, lang)}
              </p>
            )}
            {canAssign&&<CrmOperationalIssues lang={lang} isLight={isLight}/>}
            {!leadPanel&&!leadAnalysis&&leadFilterControls}

          {!leadAnalysis && <CrmLeadWorkspace
              leads={filteredLeads}
              accessibleCount={accessibleLeadCount}
              selectedId={isDrawerOpen ? selectedLead?.id : undefined}
              view={viewMode}
              lang={lang}
              isLight={isLight}
              timezone={filterTimezone}
              loading={isLoading}
              loadUnavailable={Boolean(refreshProblem&&!lastListRefresh)||refreshProblem==='unauthorized'}
              employeeId={employee.id}
              employees={employees}
              onClaim={employee.permissions.includes("crm.claim")?(lead)=>claimLead(lead.id):undefined}
              canClaim={lead=>canClaimForContact(employee,lead)}
              onSignal={(lead,id)=>{const finish=()=>{handleOpenLeadDrawer(lead,"profile",true);setSignalFocus({id,token:Date.now()});};if(discardDraft(finish))finish();}}
              onIdentity={lead=>openIdentityReview(lead.id)}
              onOpen={handleOpenLeadDrawer}
              onProcess={processFromList}
              progressAction={lead=>progressActionState(employee,lead)}
              sidebarFilters={leadPanel?leadFilterControls:undefined}
              search={filters.search} onSearch={value=>setFilters(current=>({...current,search:value}))}
              onReset={() => setFilters(defaultLeadFilters(employee.scope))}
            >
              {leadPanel}
            </CrmLeadWorkspace>}
          </>
        )}
      </main>
    </div>{historyRequest&&selectedLead&&historyRequest.leadId===selectedLead.id&&<CrmCustomerHistoryWindow lead={selectedLead} ownerName={selectedLead.owner?(employees.find(e=>e.id===selectedLead.owner)?.displayName||crmUiText('负责人姓名未记录',lang)):crmUiText('未分配',lang)} request={historyRequest} {...{lang,isLight}} timezone={filterTimezone} onClose={()=>setHistoryRequest(null)} onBack={historyRequest.previous?()=>setHistoryRequest({...historyRequest.previous,token:Date.now()}):undefined} onOpen={openCustomerHistory} onConversation={viewHistoryConversation} amendmentNotice={historyAmendNotice} suspended={Boolean(historyAmendTarget||enrollmentTarget)} onAmendSalesRecord={canEditLead(selectedLead,"crm.followup")?(record:any)=>{if(canAmendSalesRecord(record,canEditLead(selectedLead,"crm.followup"))){setHistoryAmendNotice('');setHistoryAmendTarget(record);}}:undefined}/>} {historyAmendTarget&&selectedLead&&<CrmRecordAmendmentForm key={selectedLead.id+historyAmendTarget.eventId} target={historyAmendTarget} lead={selectedLead} timezone={filterTimezone} isLight={isLight} suspended={!canEditLead(selectedLead,"crm.followup")} onDirty={setHistoryAmendDirty} onBusy={setIsSubmittingLog} onCancel={()=>{setHistoryAmendTarget(null);setHistoryAmendDirty(false);}} onSaved={(result:any)=>{setHistoryAmendTarget(null);setHistoryAmendDirty(false);setHistoryAmendNotice(amendmentSaveNotice(result,lang));setSelectedLead(current=>current?.id===result.lead.id?{...current,...result.lead}:current);setDetailRefreshVersion(v=>v+1);void fetchLeads(true);}}/>}{enrollmentTarget&&selectedLead&&<CrmEnrollmentCorrectionForm key={selectedLead.id+enrollmentTarget} lead={selectedLead} factId={enrollmentTarget} {...{lang,isLight}} suspended={!canEditLead(selectedLead)} onDirty={setEnrollmentDirty} onBusy={setIsSubmittingLog} onCancel={()=>{setEnrollmentTarget(null);setEnrollmentDirty(false)}} onSaved={(result:any)=>{setEnrollmentTarget(null);setEnrollmentDirty(false);setStageNotice({leadId:result.lead.id,text:crmUiText(result.stageChanged?'报名误记已作废，销售阶段已同步更新。':'报名误记已作废，当前阶段保持不变。',lang)});setHistoryAmendNotice(crmUiText(result.stageChanged?'报名误记已作废，销售阶段已同步更新。':'报名误记已作废，当前阶段保持不变。',lang));setSelectedLead(current=>current?.id===result.lead.id?{...current,...result.lead}:current);setDetailRefreshVersion(v=>v+1);void fetchLeads(true);}}/>}</CrmHistoryAccess.Provider></CrmEnrollmentCorrectionAccess.Provider>
  );
}
