import { CrmPageIdentity } from "../components/crm/CrmPageIdentity";
import { CrmPageAction } from "../components/crm/CrmPageAction";
import {leadDetailTab,leadDetailUrl} from "../utils/crmDetailNavigation";
import {CrmDetailHeader,CrmDetailTabs,CrmSaveFeedback,CrmDiscardDialog} from "../components/crm/CrmDetailWorkspace";
import {CrmFollowupContext} from "../components/crm/CrmFollowupContext";
import { CrmDisclosure } from "../components/crm/CrmDisclosure";
import {CrmTrustPanel,CrmStageEditor} from "../components/crm/CrmTrustPanel";
import {PageMetadata} from '../components/PageMetadata';
import {AccessHandoverPanel} from "../components/AccessSafetyPanel";
import {eligibleOwner,permittedRecord,canClaimRecord} from '../utils/accessControl';
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
import { policySaveResponseError } from "../utils/crmPolicyValidation";
import { CrmLeadFilters } from "../components/crm/CrmLeadFilters";
import {
  defaultLeadFilters,
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
import { formatCrmOperatingTime } from "../utils/crmOperatingTime";
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
  ListChecks, UserRound, ClipboardCheck, MessagesSquare,
  Users,
  Phone,
  MessageCircle,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Download,
  Filter,
  Search,
  RefreshCw,
  Calendar,
  Award,
  ExternalLink,
  ArrowRight,
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
import "../components/crm/crm-assessment.css";
import "../components/crm/crm-followup.css";
import "../components/crm/crm-process.css";
import {
  CrmPolicySettings,
  PolicyActionControls,
} from "../components/crm/CrmPolicySettings";
import { CrmUserGuide } from "../components/crm/CrmUserGuide";
import { CrmCampaignHub } from "../components/crm/CrmCampaignHub";
// Proven Objection Handling Playbook for EdTech Advisory
export const OBJECTION_HANDLING_ITEMS = [
{tag:"学费价格",tagEn:"Tuition & Price",question:"学费及优惠如何确认？",questionEn:"How can we confirm fees and offers?",answer:"先确认所选课程，再核实当前价格、付款方式和优惠条件。未核实前不承诺金额或优惠。",answerEn:"Confirm the course, then verify current fees, payment options and offer conditions before quoting."},
{tag:"模式效果",tagEn:"Online vs Offline",question:"授课方式是否合适？",questionEn:"Which learning format fits?",answer:"了解客户设备、学习环境与偏好，再核实课程的授课方式和支持安排。",answerEn:"Check the customer's equipment, learning environment and preferences, then verify the course format and support."},
{tag:"时间安排",tagEn:"Busy Schedule",question:"客户何时可以上课？",questionEn:"When can the customer attend?",answer:"记录可上课时间，查询实际课表，并核实缺课、补课和回放政策。",answerEn:"Record availability, check the actual timetable and verify absence, catch-up and replay policies."},
{tag:"决策商量",tagEn:"Need to Consult",question:"还需要与谁商量？",questionEn:"Who else needs to be consulted?",answer:"确认需要的资料和参与决策的人，征得同意后安排下次联系。",answerEn:"Confirm the information and decision-makers involved, then agree on a follow-up time."},
];
// Unified Global Stage Master Dictionary
export const STAGE_OPTIONS: {
  value: StageType;
  labelEn: string;
  labelZh: string;
}[] = [
  { value: "New", labelEn: "New", labelZh: "待初访" },
  { value: "Contacted", labelEn: "Contacted", labelZh: "已建联" },
  {
    value: "Assessment Booked",
    labelEn: "Assessment Booked",
    labelZh: "已约测评",
  },
  { value: "Assessment Done", labelEn: "Assessment Done", labelZh: "测评完成" },
  { value: "Trial Booked", labelEn: "Trial Booked", labelZh: "已约试听" },
  { value: "Trial Attended", labelEn: "Trial Attended", labelZh: "试听出席" },
  { value: "Enrolled", labelEn: "Enrolled", labelZh: "已报名签约" },
  { value: "Lost", labelEn: "Lost", labelZh: "已流失" },
];
export default function CrmWorkbench() {
  return (
    <CrmAccess>
      {(employee, lang, setLang) => employee.permissions.includes("crm.read") ? (
        <CrmWorkspace
          key={employee.id}
          employee={employee}
          lang={lang}
          setLang={setLang}
        />
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
  const [contactScripts,setContactScripts]=useState<any>(undefined);
  const [filters, setFilters] = useState<LeadFilters>(() => {try {return JSON.parse(localStorage.getItem('crm_filters_v2_'+employee.id)||'null')||defaultLeadFilters(employee.roles.includes('crm_leader')?'all':employee.scope);}catch{return defaultLeadFilters(employee.scope);}});
  useEffect(()=>{localStorage.setItem('crm_filters_v2_'+employee.id,JSON.stringify(filters));},[filters,employee.id]);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [filterTimezone, setFilterTimezone] = useState("Asia/Jakarta");
  const [showOverview, setShowOverview] = useState(employee.permissions.includes("crm.leader"));
  const [processOverview,setProcessOverview]=useState<ProcessMetrics|null>(null);
  const requestVersion = useRef(0);
  const queryKey = filterQuery({ ...filters, search: appliedSearch });
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
  const [copiedObjectionIdx, setCopiedObjectionIdx] = useState<number | null>(
    null,
  );
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
  const [trustReset,setTrustReset]=useState(0);
  const [followupCommand,setFollowupCommand]=useState<any>();
  const [attendanceDirty,setAttendanceDirty]=useState(false);
  const [attendanceReset,setAttendanceReset]=useState(0);
  const [profileSave,setProfileSave]=useState("");
  const [signalFocus,setSignalFocus]=useState<{id:string;token:number}|undefined>();
  const [workflowNotice,setWorkflowNotice]=useState<any>(null);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const listScroll = useRef(0);
  const leadRouteVersion=useRef(0),lastWorkspaceUrl=useRef(typeof window==='undefined'?'':window.location.href);
  const writeLeadRoute=(id?:string,tab:CustomerTab="activities",replace=false)=>{
    const url=leadDetailUrl(window.location.href,id,leadDetailTab(tab));
    if(url!==window.location.href)window.history[replace?"replaceState":"pushState"]({},"",url);
    lastWorkspaceUrl.current=url;
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

  const hasDraft = contactPreviewDirty||trustDirty||(isAddLogOpen && workflowDirty)||Boolean(selectedLead&&attendanceDirty);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const clearDraft = () => {
    if(selectedLead){delete draftCache.current[selectedLead.id];delete attendanceCache.current[selectedLead.id];}
    setAttendanceDirty(false);setAttendanceReset(n=>n+1);
    setWorkflowDirty(false);setTrustDirty(false);setTrustReset(v=>v+1);
    setIsAddLogOpen(false);setFollowupCommand(undefined);setContactPreview(false);setContactPreviewDirty(false);
  };
  const resumeDraft=()=>{setPendingNavigation(null);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>(contactPreviewDirty?'.crm-contact-preview textarea':attendanceDirty?'.crm-attendance-editor textarea':'.crm-followup-processing textarea, .crm-workflow-form textarea')?.focus());};
  const discardDraft = (proceed: () => void = () => {}) => {
    if (isSubmittingLog || profileSave==="saving") return false;
    if (hasDraft) {
      setPendingNavigation(() => proceed);
      return false;
    }
    clearDraft();
    return true;
  };
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
    const finish = () => {leadRouteVersion.current++;const url=new URL(window.location.href);url.searchParams.set("tab",module);if(module!=="leads"){url.searchParams.delete("lead");url.searchParams.delete("leadView");}if(module!=="campaigns"){url.searchParams.delete("campaign");url.searchParams.delete("campaignView");}url.hash="";window.history.pushState({},"",url);lastWorkspaceUrl.current=url.href;setCrmModule(module);};
    const proceed=()=>{if(discardDraft(finish))finish();};
    if(crmModule==="campaigns"&&module!==crmModule&&!window.dispatchEvent(new CustomEvent("crm-campaign-before-leave",{cancelable:true,detail:{proceed}})))return;
    proceed();
  };
  useEffect(()=>{
    const pop=()=>{
      const target=window.location.href,params=new URL(target).searchParams;
      const module=params.get("tab");
      if(module==="campaigns"&&crmModule==="campaigns")return; // Campaign owns its intra-object history.
      const apply=async()=>{
        window.history.replaceState({},"",target);lastWorkspaceUrl.current=target;
        const version=++leadRouteVersion.current;
        if(module==="campaigns"){setCrmModule("campaigns");return;}
        if(module==="docs"||(module==="policy"&&canManage)){setCrmModule(module);return;}
        setCrmModule("leads");
        const id=params.get("lead");
        if(!id){setSelectedLead(null);setIsDrawerOpen(false);setLeadActionError("");requestAnimationFrame(()=>window.scrollTo({top:listScroll.current}));return;}
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
  // Fetch leads from backend
  const fetchLeads = async (quiet = false) => {
    const version = ++requestVersion.current;
    if (!quiet) setIsLoading(true);
    try {
      const res = await fetch(`/api/crm/leads?${queryKey}`);
      if (version !== requestVersion.current) return;
      if (!res.ok) {
        if([401,403].includes(res.status)){setLeads([]);setOwnerOptions([]);}
        const error = await res.json();
        throw Error(error.error || String(res.status));
      }
      if (res.ok) {
        const data = await res.json();
        if (version !== requestVersion.current) return;
        setLeadActionError("");
        setOwnerOptions(data.ownerOptions || []);
        setFilterTimezone(data.timezone || "Asia/Jakarta");
        setLeads(data.leads || []);
        if (data.dataScope) setDataScope(data.dataScope);
        setProcessOverview(data.processMetrics || null);
        // Update selected lead if drawer is open
        setSelectedLead((current) => {
          if (!current) return current;
          const updated = (data.leads || []).find(
            (l: CrmLeadRecord) => l.id === current.id,
          );
          return updated ? { ...current, ...updated } : current;
        });
      }
    } catch (err) {
      if (version !== requestVersion.current) return;
      console.error("Failed to load CRM leads:", err);
      setLeadActionError((err as Error).message);
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  };
  const fetchLeadsRef = useRef(fetchLeads);
  useEffect(() => {
    fetchLeadsRef.current = fetchLeads;
  });
  useEffect(() => {
    fetchLeads();
    const timer = setInterval(() => fetchLeadsRef.current(true), 5000);
    const accessChanged=()=>void fetchLeadsRef.current(true);
    window.addEventListener('uper-access-changed',accessChanged);
    return () => {
      window.removeEventListener('uper-access-changed',accessChanged);
      clearInterval(timer);
      requestVersion.current++;
    };
  }, [queryKey, selectedLead?.id]);
  useEffect(() => {
    if (!isDrawerOpen || !selectedLead?.id) return;
    const id = selectedLead.id;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/crm/leads/${encodeURIComponent(id)}`,
        );
        const data = await response.json();
        if (!active) return;
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
        setSelectedLead((current) =>
          current?.id === id
            ? {
                ...current,
                ...(data.lead || data),
                attention: {
                  ...(current.attention || {
                    unreadCount: 0,
                    observedAt: "",
                    isMine: false,
                  }),
                  tasks: projectPendingTasks(data.tasks||[],data.lead?.currentStage||current.currentStage),
                },
              }
            : current,
        );
      } catch (e) {
        if (active) setLeadActionError((e as Error).message);
      }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
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
  const handleSavePolicy = async (
    updated: CrmPolicyConfig,
  ): Promise<boolean> => {
    const res = await fetch("/api/crm/policy-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.success !== true) throw policySaveResponseError(res.status, data);
    await fetchPolicyConfig();
    fetchLeads();
    return true;
  };
  const handleResetPolicy = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/crm/policy-config/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          await fetchPolicyConfig();
          fetchLeads();
          return true;
        }
      }
    } catch (e) {
      console.error("Failed to reset policy config:", e);
    }
    return false;
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
    if (lead.attention?.unreadCount) {
      fetch(`/api/crm/leads/${lead.id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readThrough: lead.attention.observedAt }),
      })
        .then(async (r) => {
          if (!r.ok) throw Error((await r.json()).error);
          setLeadActionError("");
          fetchLeads(true);
        })
        .catch((e) => setLeadActionError(e.message));
    }
  };
  const processFromList=(lead:CrmLeadRecord,discarded=false)=>{
    if(!canEditLead(lead,'crm.followup'))return;
    if(!discarded&&!discardDraft(()=>processFromList(lead,true)))return;
    handleOpenLeadDrawer(lead,"activities",true);
    const next=pendingFollowUps(lead.attention?.tasks||[],lead.currentStage)[0];
    if(next)openTaskWorkflow(next,lead,true);else {setAdministrative(false);setWorkflowTask(undefined);setWorkflowSource(undefined);setIsAddLogOpen(true);}
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
  const canEditLead = (lead:CrmLeadRecord,permission='crm.write') => permittedRecord(employee,lead,permission);
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
  // Generate customized WhatsApp Link & text
  const getWhatsAppAction = (lead: CrmLeadRecord) => {
    const cleanPhone = (lead.whatsapp || "")
      .replace(/\D/g, "")
      .replace(/^0/, "62");
    const studentName = lead.fullName || "Kak";
    const advisor=employee.displayName||employee.id;
    const customGreeting = selectedLead?.communicationLanguage ? (selectedLead.communicationLanguage==='zh'?`您好，${studentName}！我是 UPER Education 的 ${advisor}。` : selectedLead.communicationLanguage==='id'?`Halo ${studentName}! Saya ${advisor} dari UPER Education.`:`Hello ${studentName}! I'm ${advisor} from UPER Education.`) : t('Choose the customer language in contact preview','请在联系预览中选择客户语言');
    return {
      url: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(customGreeting)}`,
      greetingText: customGreeting,
    };
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
    formatCrmOperatingTime(isoString, policyConfig.businessHours.timezone);
  // Dynamic, lead-tailored Objection Handling Playbook generator (Fully Personalized per Lead)
  const getPersonalizedObjections = (lead: CrmLeadRecord | null) => {
    return OBJECTION_HANDLING_ITEMS.map(item=>({...item,answer:lang==="id"?crmId(item.answerEn):lang==="zh"?item.answer:item.answerEn}));
  };
  const ownershipControls = (lead: CrmLeadRecord) => (
    <div className="crm-customer-edit-fields">
      <label>
        {t("Customer owner", "客户负责人")}
        {canAssign && permittedRecord(employee,lead,"crm.assign") ? (
          <CrmSingleSelect
            label={t("Assign customer owner", "分配客户负责人")}
            value={lead.owner || ""}
            onChange={(owner) => handleUpdateLeadField(lead.id, { owner })}
            lang={lang} isLight={isLight} searchable
            options={[
              { value: "", label: t("Unassigned", "未分配") },
              ...(lead.owner && !salesEmployees.some((e) => e.id === lead.owner)
                ? [{ value: lead.owner, label: lead.owner + t(" (historical owner)", "（历史归属）") }] : []),
              ...salesEmployees.map((e) => ({ value: e.id, label: employeeLabel(e) })),
            ]}
          />
        ) : (
          <span>
            {employees.find((e) => e.id === lead.owner)?.displayName ||
              lead.owner ||
              t("Unassigned", "未分配")}
          </span>
        )}
      </label>
      <div className="crm-customer-edit-field">
        <span className="crm-customer-field-label">{t("Sales stage", "销售阶段")}</span>
        <CrmStageEditor key={trustReset} onDirty={setTrustDirty} onBusy={setIsSubmittingLog} lead={lead} lang={lang} isLight={isLight} disabled={!canEditLead(lead)} onSaved={(updated:any)=>{setSelectedLead((v:any)=>v?.id===lead.id?({...v,...updated}):v);fetchLeads();}}/>
      </div>
    </div>
  );
  const openTaskList=(taskId?:string,message?:any)=>{
    const finish=()=>{if(message)setConversationReturn({conversationId:message.conversation_id,messageId:message.id,requestId:message.request_id,taskId,source:message.role==="user"?message:undefined});setTaskFocus({id:taskId||"",token:Date.now()});setActiveDrawerTab("activities");requestAnimationFrame(()=>{if(!taskId){const node=document.getElementById("crm-followup-tasks");node?.scrollIntoView({block:"start"});node?.focus({preventScroll:true});}});};
    if(discardDraft(finish))finish();
  };
  const requestFollowupEdit=(command:any)=>{const finish=()=>{setWorkflowNotice(null);setFollowupCommand({...command,token:Date.now()});};if(discardDraft(finish))finish();};
  const openContactPreview=(scripts?:any)=>{if(contactPreview){document.querySelector<HTMLElement>(".crm-contact-preview h3")?.focus();return;}const finish=()=>{setContactScripts(scripts);setContactPreview(true);setActiveDrawerTab("activities");};if(activeDrawerTab==="activities"||discardDraft(finish))finish();};
  const startContactRecord=(admin=false)=>{const finish=()=>{setWorkflowNotice(null);setAdministrative(admin);setWorkflowTask(undefined);setWorkflowSource(undefined);setIsAddLogOpen(true);setActiveDrawerTab("activities");requestAnimationFrame(()=>document.getElementById("crm-followup-processing")?.scrollIntoView({block:"start"}));};if(discardDraft(finish))finish();};
  const viewTaskSource=(task:any)=>{
    const finish=()=>{const message=selectedLead?.chatTranscript?.find((m:any)=>m.role==="user"&&m.conversation_id===task.details.sourceConversationId&&(m.id===task.details.sourceMessageId||m.request_id===task.details.sourceMessageId));setConversationReturn({conversationId:task.details.sourceConversationId,messageId:message?.id,requestId:(message as any)?.request_id||task.details.sourceMessageId,taskId:task.id});setActiveDrawerTab("chat");};if(discardDraft(finish))finish();
  };
  const openTaskWorkflow=(task:any,lead=selectedLead,discarded=false)=>{
    if(!lead||!canEditLead(lead,"crm.followup")||taskOpening)return;
    const finish=async()=>{setWorkflowNotice(null);setTaskOpening(true);setIsSubmittingLog(true);setLeadActionError("");try{
      const response=await fetch(`/api/crm/leads/${encodeURIComponent(lead.id)}`);const data=await response.json();if(!response.ok)throw Error(data.error);
      const current=data.tasks?.find((value:any)=>value.id===task.id);if(!current||!["open","overdue"].includes(current.status))throw Error(t("Task changed; refresh and review","任务已变化，请刷新后核实"));
      const refreshed={...lead,...data.lead,attention:{...lead.attention,tasks:projectPendingTasks(data.tasks||[],data.lead?.currentStage||lead.currentStage)}};
      if(!canEditLead(refreshed,"crm.followup"))throw Error("Permission denied");
      setSelectedLead((current:any)=>current?.id===lead.id?refreshed:current);
      const original=(data.chatTranscript||[]).find((message:any)=>message.role==="user"&&message.conversation_id===current.details?.sourceConversationId&&(message.request_id===current.details?.sourceMessageId||message.id===current.details?.sourceMessageId));
      setWorkflowSource(conversationReturn?.taskId===task.id&&conversationReturn.source?conversationReturn.source:original);setAdministrative(current.kind==="contact_review");setWorkflowTask(task.id);setIsAddLogOpen(true);setActiveDrawerTab("activities");requestAnimationFrame(()=>document.querySelector<HTMLFormElement>(".crm-workflow-form")?.scrollIntoView({block:"start"}));
    }catch(error){setLeadActionError((error as Error).message);}finally{setTaskOpening(false);setIsSubmittingLog(false);}};
    if(discarded||discardDraft(()=>void finish()))void finish();
  };
  const changeCustomerTab=(tab:typeof activeDrawerTab,keyboard=false)=>{
    if (tab === activeDrawerTab) return;
    const finish=()=>{
      tabViewport.current = {pageY:window.scrollY, keyboard, tab};
      setTaskFocus(undefined);
      setConversationReturn(null);
      setActiveDrawerTab(tab);
      if(selectedLead)writeLeadRoute(selectedLead.id,tab);
    };
    if(!discardDraft(finish))return;
    finish();
  };
  const leadPanel =
    isDrawerOpen && selectedLead ? (
      <section
        id="crm-customer-panel"
        className="crm-customer-panel crm-detail-panel"
        aria-label={t("Customer workspace", "客户处理面板")}
      >
        <CrmDetailHeader title={selectedLead.fullName} meta={<span>
              {leadDisplayNumber(selectedLead)} · {t("Owner: ", "负责人：")}
              {employees.find((e) => e.id === selectedLead.owner)
                ?.displayName ||
                selectedLead.owner ||
                t("Unassigned", "未分配")}
            </span>} actions={<>

            {canClaimRecord(employee,selectedLead) && !permittedRecord(employee,selectedLead,"crm.assign") && (
                <button
                  type="button"
                  className="crm-work-button"
                  data-primary="true"
                  disabled={claiming === selectedLead.id}
                  onClick={() => claimLead(selectedLead.id)}
                >
                  {claiming === selectedLead.id
                    ? t("Claiming…", "认领中…")
                    : t("Claim for myself", "认领给自己")}
                </button>
              )}
            {selectedLead.whatsapp && (
              <button type="button" disabled={selectedLead.contactArrangement?.state==='stopped'} onClick={()=>{openContactPreview();}} className="crm-work-button">
                <MessageCircle size={15} /> WhatsApp
              </button>
            )}
            {[-1,1].map(offset=>{const index=filteredLeads.findIndex((l:any)=>l.id===selectedLead.id)+offset;return <button key={offset} className="crm-work-button" disabled={filteredLeads.findIndex(l=>l.id===selectedLead.id)<0||!filteredLeads[index]} onClick={()=>filteredLeads[index]&&handleOpenLeadDrawer(filteredLeads[index])}>{offset<0?t("Previous customer","上一位客户"):t("Next customer","下一位客户")}</button>;})}
            <button
              type="button"
              className="crm-work-button"
              onClick={closeCustomer}
              disabled={isSubmittingLog||profileSave==="saving"}
            >
              {t("Customer list", "客户列表")}
            </button>
          </>}/>
        {(hasDraft||isSubmittingLog)&&<CrmSaveFeedback state={isSubmittingLog?"saving":"dirty"}/>}
        <div className="crm-panel-next"><CrmNextTaskSummary lead={selectedLead} lang={lang} timezone={filterTimezone} onOpen={()=>openTaskList()}/></div>
        <CrmDetailTabs id="crm-customer" contentId="crm-customer-content" label={t("Customer details","客户详情")} value={activeDrawerTab==="playbook"?"activities":activeDrawerTab} onChange={(tab,keyboard)=>changeCustomerTab(tab as CustomerTab,keyboard)} tabs={[
          {id:"activities",label:t("Follow-up","跟进"),icon:ListChecks},
          {id:"profile",label:t("Profile","客户资料"),icon:UserRound},
          {id:"assessment",label:t("Assessment","测评"),icon:ClipboardCheck},
          {id:"chat",label:t("Conversations","对话"),icon:MessagesSquare},
        ]}/>
        <div
          key={selectedLead.id}
          id="crm-customer-content"
          className="crm-customer-panel-body crm-detail-body"
          role="tabpanel"
          aria-labelledby={`crm-customer-tab-${activeDrawerTab === "playbook" ? "activities" : activeDrawerTab}`}
        >
          {leadActionError && (
            <p role="alert" className="text-rose-500">
              {crmError(leadActionError, lang)}
            </p>
          )}
          {profileSave&&activeDrawerTab==="profile"&&<CrmSaveFeedback state={profileSave==="saving"?"saving":"saved"}>{profileSave==="saving"?t("Saving customer details…","正在保存客户资料…"):t("Customer details saved.","客户资料已保存。")}</CrmSaveFeedback>}
          {activeDrawerTab === "profile" && (
            <>
            <CrmCustomerProfile
              signalFocus={signalFocus}
              onSignalSource={e=>viewTaskSource({id:e.taskId,details:{sourceConversationId:e.conversationId,sourceMessageId:e.messageId}})}
              onSignalTask={id=>openTaskList(id)}
              lead={selectedLead}
              lang={lang}
              timezone={filterTimezone}
              ownership={ownershipControls(selectedLead)}
              identity={<CrmTrustPanel key={selectedLead.id+trustReset+"identity"} mode="identity" modalSuspended={Boolean(pendingNavigation)} lead={selectedLead} lang={lang} isLight={isLight} timezone={filterTimezone} disabled={!canEditLead(selectedLead,"crm.followup")} onDirty={setTrustDirty} onBusy={setIsSubmittingLog} onRefresh={()=>fetchLeads(true)} command={followupCommand} onRequestEdit={requestFollowupEdit}/> }
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
            <CrmCustomerConversations
              isLight={isLight}
              onOpenTask={(taskId:string,message:any)=>openTaskList(taskId,message)}
              conversationContext={conversationReturn}
              lead={selectedLead}
              lang={lang}
              timezone={filterTimezone}
            />
          )}
          {activeDrawerTab === "activities" && <div className="crm-followup-sections">
            {!canEditLead(selectedLead,"crm.followup")&&<p className="crm-work-muted">{t("Claim this unassigned lead before updating it or recording follow-up.","请先认领此未分配客户，再修改资料或记录跟进。")}</p>}
            {conversationReturn&&<button type="button" className="crm-work-link" onClick={()=>changeCustomerTab("chat")}>{t("Return to conversation","返回对话")}</button>}
            {taskOpening&&<p role="status">{t("Loading task context…","正在加载任务依据…")}</p>}
            <CrmTrustPanel key={selectedLead.id+trustReset} onDirty={setTrustDirty} onBusy={setIsSubmittingLog} lead={selectedLead} lang={lang} isLight={isLight} timezone={filterTimezone} disabled={!canEditLead(selectedLead,"crm.followup")||taskOpening} onRefresh={()=>{setDetailRefreshVersion(v=>v+1);void fetchLeads(true);}} focusTask={taskFocus} onProcess={(task:any)=>openTaskWorkflow(task)} onSource={(task:any)=>viewTaskSource(task)}
              command={followupCommand} onRequestEdit={requestFollowupEdit} workflowOpen={isAddLogOpen} modalSuspended={Boolean(pendingNavigation)} workflowTask={workflowTask} onRecord={()=>startContactRecord()} onArrange={()=>startContactRecord(true)} onIdentity={()=>changeCustomerTab("profile")} journey={journeyTimelineEvents}
              context={({data,error}:any)=><CrmFollowupContext lead={selectedLead} lang={lang} timezone={filterTimezone} onSource={viewTaskSource} tasks={data?.tasks} facts={data?.facts} taskError={error} onTask={openTaskList}/>}
            >
              {workflowNotice&&<CrmSaveFeedback state="saved">{t("Result saved","处理结果已保存")} · {t("Completed tasks","已完成任务")} {workflowNotice.completed}{workflowNotice.completedNames?` · ${workflowNotice.completedNames}`:""} · {workflowNotice.recordOnly||workflowNotice.kept?(lang==='zh'?'已保留原安排':lang==='id'?'Pengaturan awal dipertahankan':'Existing arrangements preserved'):workflowNotice.created?t("Next task scheduled","已安排下一步任务"):t("Next arrangement recorded","已记录后续安排")}</CrmSaveFeedback>}
              {isAddLogOpen && <CrmWorkflowForm key={selectedLead.id+String(workflowTask)+String(administrative)} lead={selectedLead} employee={employee} lang={lang} isLight={isLight} timezone={filterTimezone} initialDraft={draftCache.current[selectedLead.id]} onDraft={(draft:any)=>{draftCache.current[selectedLead.id]=draft;}} administrative={administrative} workCalendar={policyConfig.businessHours} selectedTask={workflowTask} sourceMessage={workflowSource} onDirty={()=>setWorkflowDirty(true)} onBusy={setIsSubmittingLog} onCancel={()=>discardDraft()} onSaved={async(data:any,next:boolean)=>{delete draftCache.current[selectedLead.id];if(retainedDraft?.id===selectedLead.id)setRetainedDraft(null);const candidates=filteredLeads.slice(filteredLeads.findIndex((l:any)=>l.id===selectedLead.id)+1);setWorkflowDirty(false);setWorkflowTask(undefined);setWorkflowSource(undefined);setSelectedLead((current:any)=>current?.id===selectedLead.id?({...current,...data.lead,attention:{...current.attention,tasks:(current.attention?.tasks||[]).filter((task:any)=>!data.completedTaskIds.includes(task.id))}}):current);setDetailRefreshVersion(v=>v+1);setIsAddLogOpen(false);setWorkflowNotice({completed:data.completedTaskIds.length,completedNames:data.completedTaskIds.map((id:string)=>{const task=(selectedLead.attention?.tasks||[]).find((task:any)=>task.id===id);return task?describeFollowUpTask(task,lang,filterTimezone).action:id;}).join("；"),kept:data.lead?.followUpDisposition?.kind==="keep",created:Boolean(data.createdTaskId),recordOnly:data.recordOnly});fetchLeads(true);if(next){for(const candidate of candidates){const access=await fetch(`/api/crm/leads/${candidate.id}/tasks`);if([403,404].includes(access.status))continue;if(!access.ok){setLeadActionError(lang==='zh'?'记录已保存，下一位暂不可加载':lang==='id'?'Catatan disimpan; pelanggan berikutnya belum tersedia':'Record saved; next customer unavailable');return;}handleOpenLeadDrawer(candidate,'activities',true);return;}setIsDrawerOpen(false);setSelectedLead(null);writeLeadRoute();setQueueComplete(true);}}}/>}

              {!isAddLogOpen&&<CrmDisclosure heading={t("Sales playbook","销售话术参考")}>
            <div className="space-y-4">
              {/* Strategy Guidance */}
              <div
                className={`p-4 rounded-xl border ${isLight ? "bg-indigo-50/80 border-indigo-200/90 text-indigo-950" : "bg-indigo-950/40 border-indigo-800/60"}`}
              >
                <span
                  className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? "text-indigo-900" : "text-indigo-300"}`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>
                    {t("Sales guidance", "销售指导")}{" "}
                    {crmValue(selectedLead.tier, lang)}
                  </span>
                </span>
                <p
                  className={`text-[11px] mt-1.5 leading-relaxed ${isLight ? "text-indigo-800" : "text-indigo-200/80"}`}
                >
                  {t("Start with the current task and latest recorded request. Review saved assessment evidence and verify timetable and fees before proposing a course.","先查看当前任务和最近诉求，核对已有测评依据，并确认实际课表和费用后再提出课程建议。")}
                </p>
              </div>

              {/* Recommended WhatsApp Icebreaker Pitch */}
              <div
                className={`p-4 rounded-xl border space-y-3 ${isLight ? "bg-slate-50 border-slate-200/90" : "bg-slate-950 border-slate-800"}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? "text-slate-800" : "text-slate-300"}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {t(
                        "Recommended WhatsApp Pitch:",
                        "推荐 WhatsApp 破冰话术:",
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      openContactPreview();

                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg cursor-pointer transition-all ${
                      isLight
                        ? "bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{t("Preview message", "预览话术")}</span>
                  </button>
                </div>

                <p
                  className={`text-xs leading-relaxed p-3 rounded-lg border select-all font-sans ${
                    isLight
                      ? "bg-white border-slate-200 text-slate-800 shadow-2xs"
                      : "bg-slate-900 border-slate-800 text-slate-200"
                  }`}
                >
                  {getWhatsAppAction(selectedLead).greetingText}
                </p>

                <button type="button" disabled={selectedLead.contactArrangement?.state==='stopped'} onClick={()=>{openContactPreview();}}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>
                    {t("Open WhatsApp Directly", "立即唤起 WhatsApp 发起对话")}
                  </span>
                </button>
              </div>

              {/* Battle-Tested Objection Handling Playbook */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between pb-1">
                  <span
                    className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? "text-slate-800" : "text-slate-200"}`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {t("Conversation checklist", "沟通核实清单")}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] ${isLight ? "text-slate-400" : "text-slate-500"}`}
                  >
                    {t("4 Common Scenarios", "4 大经典场景")}
                  </span>
                </div>

                {/* Smart Personalization Banner */}
                <div
                  className={`p-3 rounded-xl border text-[11px] flex items-start gap-2 mb-2.5 ${isLight ? "bg-indigo-50/70 border-indigo-200 text-indigo-900" : "bg-indigo-950/40 border-indigo-800 text-indigo-200"}`}
                >
                  <Sparkles className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">
                      {t(
                        "Verify facts before advising the customer",
                        "向客户提出建议前，先核实事实",
                      )}
                    </span>
                    <span>
                      {t("Use recorded customer requests as evidence. Check current course availability; do not promise unverified fees, seats or outcomes.","依据客户已记录的诉求沟通，核查实际课程安排；不承诺未经核实的费用、席位或效果。")}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {getPersonalizedObjections(selectedLead).map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border space-y-2 transition-all ${isLight ? "bg-white border-slate-200/90 shadow-2xs" : "bg-slate-900 border-slate-800"}`}
                    >
                      <div className="flex items-center justify-between text-[11px] gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold text-[10px] border ${isLight ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-amber-950 text-amber-300 border-amber-800"}`}
                        >
                          {lang === "id"
                            ? crmId(item.tagEn)
                            : lang === "zh"
                              ? item.tag
                              : item.tagEn}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const text =
                              lang === "id"
                                ? crmId(item.answerEn)
                                : lang === "zh"
                                  ? item.answer
                                  : item.answerEn;
                            openContactPreview({en:item.answerEn,id:crmId(item.answerEn),zh:item.answer});
                            setCopiedObjectionIdx(idx);
                            setTimeout(() => setCopiedObjectionIdx(null), 2000);
                          }}
                          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-lg border transition-all cursor-pointer ${
                            isLight
                              ? "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                          }`}
                        >
                          {copiedObjectionIdx === idx ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>
                            {copiedObjectionIdx === idx
                              ? t("Copied!", "已复制")
                              : t("Copy Answer", "复制应答")}
                          </span>
                        </button>
                      </div>

                      <div
                        className={`font-semibold text-xs ${isLight ? "text-slate-800" : "text-slate-200"}`}
                      >
                        ❓{" "}
                        {lang === "id"
                          ? crmId(item.questionEn)
                          : lang === "zh"
                            ? item.question
                            : item.questionEn}
                      </div>

                      <p
                        className={`text-[11px] leading-relaxed p-2.5 rounded-lg border font-sans select-all ${isLight ? "bg-slate-50/80 border-slate-100 text-slate-700" : "bg-slate-950/60 border-slate-800 text-slate-300"}`}
                      >
                        💡{" "}
                        {lang === "id"
                          ? crmId(item.answerEn)
                          : lang === "zh"
                            ? item.answer
                            : item.answerEn}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
              </CrmDisclosure>}
            </CrmTrustPanel>
            {contactPreview&&<CrmContactPreview key={"contact-preview-"+selectedLead.id} lead={selectedLead} employee={employee} lang={lang} isLight={isLight} scripts={contactScripts} onDirty={setContactPreviewDirty} onClose={()=>{setContactPreview(false);setContactPreviewDirty(false);}} onUpdated={(lead:any)=>setSelectedLead(lead)}/>}
          </div>}

        </div>
      </section>
    ) : null;
  const leadFilterControls = (
            <CrmLeadFilters
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
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 select-text ${isLight ? "bg-[#f5f5f7] text-[#1d1d1f]" : "bg-slate-950 text-slate-100"}`}
    >
      <PageMetadata lang={lang} options={{module:crmModule}}/>
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
        {crmModule !== "campaigns" && <div className={`admin-page-toolbar${crmModule === "leads" ? " crm-home-page-heading" : ""}`} data-theme={isLight ? "light" : "dark"}>
          {crmModule === "leads" ? (
            <CrmPageIdentity
              title={adminText(lang, "Customer follow-up", "Tindak lanjut pelanggan", "客户跟进")}
              subtitle={t("Prioritize customers, record outcomes and plan the next step.", "明确优先客户，记录沟通结果，安排下一步。")}
            />
          ) : <div><h1>{crmModule === "policy" ? t("Sales Operations Settings", "销售运营设置") : adminText(lang, "CRM documentation", "Dokumentasi CRM", "CRM 系统文档")}</h1></div>}
          <div className={`admin-page-actions${crmModule === "leads" ? " crm-home-page-actions" : ""}`}>            {/* Contextual Actions in Leads: Refresh & Export */}
            {crmModule === "leads" && (
              <>
                {employee.permissions.includes("crm.export") && (
                  <CrmPageAction
                    href={"/api/crm/export?" + queryKey}
                    icon={Download}
                    label={t("Export current results (.JSON)", "导出当前结果 (.JSON)")}
                  />
                )}
                <CrmPageAction
                  label={t("Refresh", "刷新数据")}
                  icon={RefreshCw}
                  iconOnly
                  loading={isLoading}
                  onClick={() => void fetchLeads()}
                />
              </>
            )}

            {/* Contextual Actions in Policy: Reset Defaults & Save Changes */}
            {crmModule === "policy" && employee.permissions.includes("crm.operations.manage") && (
              <>
                {policyControls?.isDirty && (
                  <button
                    type="button"
                    onClick={policyControls.discard}
                    disabled={policyControls.isSaving}
                    className={`flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isLight
                        ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 shadow-2xs"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    }`}
                    title={t("Discard current modifications", "放弃本次修改")}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {t("Discard", "放弃修改")}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => policyControls?.reset()}
                  disabled={
                    !policyControls ||
                    policyControls.isResetting ||
                    policyControls.isSaving
                  }
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isLight
                      ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 shadow-2xs"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  }`}
                  title={t(
                    "Reset all policies to factory default recommendations",
                    "恢复系统默认配置",
                  )}
                >
                  <RotateCcw
                    className={`w-3.5 h-3.5 ${policyControls?.isResetting ? "animate-spin" : ""}`}
                  />
                  <span>{t("Reset Defaults", "恢复默认设置")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => policyControls?.save()}
                  disabled={
                    !policyControls ||
                    policyControls.isSaving ||
                    policyControls.isResetting
                  }
                  className={`flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                    policyControls?.isDirty
                      ? "bg-primary-700 hover:bg-primary-800 active:scale-95 text-white shadow-primary-900/20 ring-2 ring-primary-400/30"
                      : isLight
                        ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/90 shadow-2xs"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  }`}
                >
                  <Save
                    className={`w-3.5 h-3.5 ${policyControls?.isSaving ? "animate-spin" : ""}`}
                  />
                  <span>
                    {policyControls?.isSaving
                      ? t("Saving...", "保存中...")
                      : policyControls?.isDirty
                        ? t(
                            `Save Policies (${policyControls.modifiedCount})`,
                            `保存策略 (${policyControls.modifiedCount})`,
                          )
                        : t("Save Policies", "保存策略")}
                  </span>
                </button>
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
                if(!target){const r=await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`);const data=await r.json();if(!r.ok)throw Error(data.error||'Lead not found');target={...data.lead,attention:{tasks:projectPendingTasks(data.tasks||[],data.lead?.currentStage),unreadCount:0,isMine:false}};}
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
              onActionControlsChange={setPolicyControls}
            />}
            {employee.permissions.includes("notifications.read") && <NotificationCenter
              isLight={isLight}
              lang={lang}
              navigationRequest={notificationNavigationRequest}
              canEdit={employee.permissions.includes("notifications.manage")}
            />}
          </>
        ) : crmModule === "docs" ? (
          <CrmUserGuide
            isLight={isLight}
            lang={lang}
            onNavigateTab={(tab) => changeModule(tab)}
          />
        ) : (
          <>
            <button
              type="button"
              aria-expanded={showOverview}
              onClick={() => setShowOverview(!showOverview)}
              className="crm-process-toggle" data-theme={isLight?"light":"dark"}
            >
              {t(
                "Sales process · current results",
                "销售过程 · 当前筛选结果",
              )}{" "}
              {showOverview ? "−" : "+"}
            </button>
            {showOverview && <CrmProcessOverview metrics={processOverview} error={Boolean(leadActionError)} lang={lang} isLight={isLight} timezone={filterTimezone} leader={canAssign} employees={employees}/>}
            {retainedDraft&&<section className="crm-workflow-form" role="region" aria-label={lang==='zh'?'保留的未保存草稿':lang==='id'?'Draf belum tersimpan':'Retained unsaved draft'}><p role="alert">{lang==='zh'?'客户访问权限已变化，未保存草稿已保留；重新获得权限后打开客户可继续。':lang==='id'?'Akses pelanggan berubah. Draf disimpan di halaman ini; buka pelanggan setelah akses dipulihkan.':'Customer access changed. Your draft is retained on this page; reopen after access is restored.'}</p><textarea readOnly aria-label={lang==='zh'?'草稿内容':lang==='id'?'Isi draf':'Draft content'} value={[retainedDraft.summary,retainedDraft.action,retainedDraft.purpose,retainedDraft.date,retainedDraft.arrangementReason,retainedDraft.reviewDate].filter(Boolean).join('\n')}/><button type="button" className="crm-work-button" onClick={()=>{delete draftCache.current[retainedDraft.id];delete attendanceCache.current[retainedDraft.id];setRetainedDraft(null);}}>{lang==='zh'?'丢弃草稿':lang==='id'?'Buang draf':'Discard draft'}</button></section>}
            {queueComplete&&<p role="status">{lang==='zh'?'已到当前列表末尾，请核对剩余待办':lang==='id'?'Akhir daftar tercapai; periksa tugas yang masih terbuka':'End of current list; review remaining tasks'}</p>}
            {leadActionError && (
              <p role="alert" className="text-xs text-rose-500">
                {crmError(leadActionError, lang)}
              </p>
            )}
            {canAssign&&<CrmOperationalIssues lang={lang} isLight={isLight}/>}
            {!leadPanel&&leadFilterControls}

            <CrmLeadWorkspace
              leads={filteredLeads}
              selectedId={isDrawerOpen ? selectedLead?.id : undefined}
              view={viewMode}
              lang={lang}
              isLight={isLight}
              timezone={filterTimezone}
              loading={isLoading}
              employeeId={employee.id}
              employees={employees}
              onClaim={employee.permissions.includes("crm.claim")?(lead)=>claimLead(lead.id):undefined}
              canClaim={lead=>canClaimRecord(employee,lead)&&!permittedRecord(employee,lead,"crm.assign")}
              onSignal={(lead,id)=>{const finish=()=>{handleOpenLeadDrawer(lead,"profile",true);setSignalFocus({id,token:Date.now()});};if(discardDraft(finish))finish();}}
              onOpen={handleOpenLeadDrawer}
              onProcess={processFromList}
              canProcess={lead=>canEditLead(lead,"crm.followup")}
              sidebarFilters={leadPanel?leadFilterControls:undefined}
              search={filters.search} onSearch={value=>setFilters(current=>({...current,search:value}))}
              onReset={() => setFilters(defaultLeadFilters(employee.scope))}
            >
              {leadPanel}
            </CrmLeadWorkspace>
          </>
        )}
      </main>
    </div>
  );
}
