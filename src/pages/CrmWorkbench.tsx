import '../components/crm/crm-documentation.css';
import {CrmAttendanceEditor} from "../components/crm/CrmAttendanceEditor";
import {CrmProcessOverview} from "../components/crm/CrmProcessOverview";
import type {ProcessMetrics} from "../utils/crmProcessMetrics";
import {draftsFor} from "../utils/crmDrafts";
import {CrmOperationalIssues} from "../components/crm/CrmOperationalIssues";
import {CrmContactPreview} from "../components/crm/CrmContactPreview";
import {contactStatistics} from "../utils/crmContact";
import {CrmWorkflowForm} from "../components/crm/CrmWorkflowForm";
import { CrmSingleSelect } from "../components/crm/CrmSingleSelect";
import { CrmLanguageSelect } from "../components/crm/CrmLanguageSelect";
import { crmId } from "../utils/crmIndonesian";
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
import { confirmedTaskDeadline, pendingFollowUps } from "../utils/crmFollowUp";
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
import LeadTaskActions from "../components/LeadTaskActions";
import NotificationCenter from "../components/NotificationCenter";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { safeStorage } from "../utils/safeStorage";
import {
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
import { TierType, BuyingSignalType } from "../types/leadSystem";
import type { CrmPolicyConfig } from "../types/crmPolicyConfig";
import { DEFAULT_CRM_POLICY_CONFIG } from "../types/crmPolicyConfig";
import { CrmFollowUp } from "../components/crm/CrmFollowUp";
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
      {(employee, lang, setLang) => (
        <CrmWorkspace
          key={employee.id}
          employee={employee}
          lang={lang}
          setLang={setLang}
        />
      )}
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
  const canManage = employee.permissions.includes("notifications.manage");
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
  useEffect(() => {
    const titles =
      lang === "zh"
        ? {
            leads: "销售线索",
            campaigns: "营销活动中心",
            policy: "销售运营设置",
            docs: "CRM 系统文档",
          }
        : {
            leads: "Leads CRM",
            campaigns: "Marketing Campaigns",
            policy: "Sales Operations Settings",
            docs: lang === "id" ? "Dokumentasi CRM" : "CRM documentation",
          };
    document.title =
      (lang === "id" ? crmId(titles[crmModule]) : titles[crmModule]) +
      " | UPER";
  }, [crmModule, lang]);
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
  const [contactScripts,setContactScripts]=useState<any>(undefined);
  const [filters, setFilters] = useState<LeadFilters>(() => {try {return JSON.parse(localStorage.getItem('crm_filters_v2_'+employee.id)||'null')||defaultLeadFilters(employee.roles.includes('crm_leader')?'all':employee.scope);}catch{return defaultLeadFilters(employee.scope);}});
  useEffect(()=>{localStorage.setItem('crm_filters_v2_'+employee.id,JSON.stringify(filters));},[filters,employee.id]);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [filterTimezone, setFilterTimezone] = useState("Asia/Jakarta");
  const [showOverview, setShowOverview] = useState(employee.roles.includes("crm_leader"));
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
  const responseTask = pendingFollowUps(
    selectedLead?.attention?.tasks || [],
  )[0];
  const responseDeadline =
    responseTask && confirmedTaskDeadline(responseTask) !== null
      ? responseTask.dueAt
      : undefined;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] =
    useState<CustomerTab>("activities");
  const [isAddLogOpen, setIsAddLogOpen] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<
    "all" | "logs" | "engagement" | "milestone"
  >("all");
  const [copiedObjectionIdx, setCopiedObjectionIdx] = useState<number | null>(
    null,
  );
  const toggleLang = () =>
    setLang(lang === "id" ? crmId("zh") : lang === "en" ? "zh" : "en");
  // Translation helper
  const t = (enText: string, zhText: string) =>
    lang === "id" ? crmId(enText) : lang === "zh" ? zhText : enText;
  // Theme State: 'light' (Apple Style) vs 'dark'
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const saved = safeStorage.getItem("uper_crm_theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch {
      // fallback
    }
    return "light"; // Default to Apple Light theme
  });
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      safeStorage.setItem("uper_crm_theme", next);
    } catch {
      // fallback
    }
  };
  const isLight = theme === "light";
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
    }>
  >([]);
  useEffect(() => {
    fetch("/api/portal/employees")
      .then((r) => r.json())
      .then(setEmployees)
      .catch(() => {});
  }, []);
  const salesEmployees = employees.filter(
    (e) => e.active === true && e.roles?.includes("sales"),
  );
  const employeeLabel = (e: (typeof employees)[number]) =>
    `${e.displayName || e.id} · ${e.roles?.map((r) => (r === "crm_leader" ? t("CRM Leader", "CRM 管理者") : t("Sales", "销售"))).join(" + ") || ""}`;
  useEffect(() => {
    if (!canManage && crmModule === "policy") setCrmModule("leads");
  }, [canManage, crmModule]);
  const [workflowSource,setWorkflowSource]=useState<any>();
  const [workflowTask,setWorkflowTask]=useState<string|undefined>();
  const [workflowDirty,setWorkflowDirty]=useState(false);
  const [attendanceDirty,setAttendanceDirty]=useState(false);
  const [attendanceReset,setAttendanceReset]=useState(0);
  const [profileSave,setProfileSave]=useState("");
  const [workflowNotice,setWorkflowNotice]=useState<any>(null);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const listScroll = useRef(0);
  const hasDraft = (isAddLogOpen && workflowDirty)||Boolean(selectedLead&&attendanceDirty);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const clearDraft = () => {
    if(selectedLead){delete draftCache.current[selectedLead.id];delete attendanceCache.current[selectedLead.id];}
    setAttendanceDirty(false);setAttendanceReset(n=>n+1);
    setWorkflowDirty(false);
    setIsAddLogOpen(false);
  };
  const resumeDraft=()=>{setPendingNavigation(null);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>(attendanceDirty?'.crm-attendance-editor textarea':'.crm-workflow-form textarea')?.focus());};
  const discardDraft = (proceed: () => void = () => {}) => {
    if (isSubmittingLog) return false;
    if (hasDraft) {
      setPendingNavigation(() => proceed);
      return false;
    }
    clearDraft();
    return true;
  };
  const closeCustomer = () => {
    const finish = () => {
      setIsDrawerOpen(false);
      setSelectedLead(null);
      requestAnimationFrame(() => {
        const opener =
          selectedLead &&
          document.querySelector<HTMLButtonElement>(
            `[data-lead-id="${CSS.escape(selectedLead.id)}"] .crm-customer-open`,
          );
        opener?.focus({ preventScroll: true });
        window.scrollTo({ top: listScroll.current });
      });
    };
    if (discardDraft(finish)) finish();
  };
  const changeModule = (module: typeof crmModule) => {
    const finish = () => setCrmModule(module);
    if (discardDraft(finish)) finish();
  };
  useEffect(() => {
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDraft]);
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
    return () => {
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
                  tasks: (data.tasks || []).map((task: any) => ({
                    id: task.id,
                    kind: task.kind,
                    details: task.details,
                    ownerId: task.owner_id,
                    status: task.status,
                    dueAt: task.due_at,
                  })),
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
  }, [isDrawerOpen, selectedLead?.id]);
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
    try {
      const res = await fetch("/api/crm/policy-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
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
      console.error("Failed to save policy config:", e);
    }
    return false;
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
    tab: CustomerTab = "activities",
    discarded = false,
  ) => {
    if (
      !discarded &&
      selectedLead?.id !== lead.id &&
      !discardDraft(() => handleOpenLeadDrawer(lead, tab, true))
    )
      return;
    if(retainedDraft?.id===lead.id)setRetainedDraft(null);
    if (!isDrawerOpen) listScroll.current = window.scrollY;
    if (selectedLead?.id === lead.id && isDrawerOpen) {
      setActiveDrawerTab(tab);
      return;
    }
    setQueueComplete(false);setWorkflowDirty(false);setWorkflowTask(undefined);setWorkflowSource(undefined);setWorkflowNotice("");setProfileSave("");setLeadActionError("");
    setIsAddLogOpen(false);
    setSelectedLead(lead);
    setActiveDrawerTab(tab);
    setIsDrawerOpen(true);
    requestAnimationFrame(() => {
      const panel = document.getElementById("crm-customer-panel");
      panel?.scrollIntoView({ block: "start" });
      panel?.querySelector("h2")?.focus({ preventScroll: true });
    });
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
    if(!canEditLead(lead))return;
    if(!discarded&&!discardDraft(()=>processFromList(lead,true)))return;
    handleOpenLeadDrawer(lead,"activities",true);
    setAdministrative(false);setWorkflowSource(undefined);
    setWorkflowTask(pendingFollowUps(lead.attention?.tasks||[])[0]?.id);
    setIsAddLogOpen(true);
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
          handleOpenLeadDrawer(data.lead || data, "activities");
        }
      })
      .catch((error) => {
        if (active) setLeadActionError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  // Helper for translating buying signal (hoisted function)
  function translateBuyingSignal(signal?: BuyingSignalType): string {
    if (!signal || signal === "None yet") return t("No signal", "无信号");
    if (signal === "Asked price") return t("Asked tuition", "问学费");
    if (signal === "Asked schedule") return t("Asked schedule", "问排期");
    if (signal === "Asked payment") return t("Asked installments", "问分期");
    if (signal === "Ready to enroll" || signal === "Ready to enrol")
      return t("Ready to enroll", "准备报名");
    return signal;
  }
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
      stageTransition?: string;
      nextAction?: string;
      nextFollowUpAt?: string;
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
    // 4. Buying Signals Events (Multi-Signal Accumulation & Intent Evolution)
    const signalsList =
      selectedLead.buyingSignals && selectedLead.buyingSignals.length > 0
        ? selectedLead.buyingSignals.filter((s) => s !== "None yet")
        : selectedLead.buyingSignal && selectedLead.buyingSignal !== "None yet"
          ? [selectedLead.buyingSignal]
          : [];
    signalsList.forEach((sig, sIdx) => {
      const sourceLog=[...(selectedLead.followUpLogs || [])].reverse().find(log=>log.buyingSignalDetected===sig);
      events.push({
        id: `signal-${selectedLead.id}-${sIdx}`,
        timestamp:
          sourceLog?.timestamp || selectedLead.submittedAt,
        category: "engagement",
        actorType: sourceLog ? "consultant" : "client",
        staffName: sourceLog?.staffName,
        icon: "💡",
        badgeText: t("Buying Signal", "购买信号"),
        badgeStyle: isLight
          ? "bg-slate-50 text-slate-700 border-slate-200"
          : "bg-slate-800 text-slate-300 border-slate-700",
        title: t("Buying Signal", "购买信号") + ": " + translateBuyingSignal(sig),
        subtitle: t(
          "Recorded buying signal; follow the task deadline.",
          "已记录购买信号，跟进时限以任务截止时间为准。",
        ),
      });
    });
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
          connectStatus: log.connectStatus,
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
        if (id.startsWith("signal-")) return 4;
        if (id.startsWith("trial-")) return 5;
        if (id.startsWith("log-")) return 6;
        if (id.startsWith("milestone-")) return 7;
        return 5;
      };
      return getWeight(a.id) - getWeight(b.id);
    });
  }, [selectedLead, isLight, lang]);
  // Dynamic counts for timeline filter pills
  const timelineCounts = useMemo(() => {
    return {
      all: journeyTimelineEvents.length,
      logs: journeyTimelineEvents.filter((e) => e.category === "follow_up")
        .length,
      engagement: journeyTimelineEvents.filter(
        (e) => e.category === "engagement",
      ).length,
      milestone: journeyTimelineEvents.filter((e) => e.category === "milestone")
        .length,
    };
  }, [journeyTimelineEvents]);
  const canEditLead = (lead: CrmLeadRecord) =>
    employee.scope !== "own" || lead.owner === employee.id;
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
            current ? { ...current, ...data.lead } : current,
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
        {canAssign ? (
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
      <label>
        {t("Sales stage", "销售阶段")}
        <CrmSingleSelect
          label={t("Update sales stage", "修改销售阶段")}
          disabled={!canEditLead(lead)} value={lead.currentStage || "New"}
          onChange={(currentStage) => handleUpdateLeadField(lead.id, { currentStage: currentStage as StageType })}
          lang={lang} isLight={isLight}
          options={STAGE_OPTIONS.map((stage) => ({ value: stage.value, label: t(stage.labelEn, stage.labelZh) }))}
        />
      </label>
    </div>
  );
  const changeCustomerTab=(tab:typeof activeDrawerTab,keyboard=false)=>{
    const finish=()=>{
      setActiveDrawerTab(tab);
      requestAnimationFrame(()=>{
        document.getElementById("crm-customer-panel")?.scrollIntoView({block:"start"});
        if(keyboard)document.getElementById(`crm-customer-tab-${tab}`)?.focus({preventScroll:true});
      });
    };
    if(!discardDraft(finish))return;
    finish();
  };
  const leadPanel =
    isDrawerOpen && selectedLead ? (
      <section
        id="crm-customer-panel"
        className="crm-customer-panel"
        aria-label={t("Customer workspace", "客户处理面板")}
      >
        <header className="crm-customer-panel-header">
          <div>
            <h2 tabIndex={-1}>{selectedLead.fullName}</h2>
            <p className="crm-work-muted">
              {leadDisplayNumber(selectedLead)} · {t("Owner: ", "负责人：")}
              {employees.find((e) => e.id === selectedLead.owner)
                ?.displayName ||
                selectedLead.owner ||
                t("Unassigned", "未分配")}
            </p>
          </div>
          <div className="crm-customer-panel-actions">
            {!canAssign &&
              !selectedLead.owner &&
              employee.roles.includes("sales") && (
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
              <button type="button" disabled={selectedLead.contactArrangement?.state==='stopped'} onClick={()=>{setContactScripts(undefined);setContactPreview(true);}} className="crm-work-button">
                <MessageCircle size={15} /> WhatsApp
              </button>
            )}
            {[-1,1].map(offset=>{const index=filteredLeads.findIndex((l:any)=>l.id===selectedLead.id)+offset;return <button key={offset} className="crm-work-button" disabled={filteredLeads.findIndex(l=>l.id===selectedLead.id)<0||!filteredLeads[index]} onClick={()=>filteredLeads[index]&&handleOpenLeadDrawer(filteredLeads[index],activeDrawerTab === "playbook" ? "activities" : activeDrawerTab)}>{offset<0?t("Previous customer","上一位客户"):t("Next customer","下一位客户")}</button>;})}
            <button
              type="button"
              className="crm-work-button"
              onClick={closeCustomer}
            >
              {t("Back to list", "返回列表")}
            </button>
          </div>
        </header>
        <div className="crm-panel-next"><CrmFollowUp lead={selectedLead} lang={lang} timezone={filterTimezone} isLight={isLight} employees={employees} onOpen={()=>setActiveDrawerTab("activities")} compact /></div>
        <div
          className="crm-customer-tabs"
          role="tablist"
          aria-label={t("Customer details", "客户详情")}
        >
          {(
            [
              ["activities", "Follow-up", "跟进"],
              ["chat", "Conversations", "对话"],
              ["profile", "Profile", "客户资料"],
              ["assessment", "Assessment", "测评"],
            ] as const
          ).map(([id, en, zh]) => (
            <button
              type="button"
              role="tab"
              key={id}
              id={`crm-customer-tab-${id}`}
              aria-controls="crm-customer-content"
              aria-selected={
                activeDrawerTab === id ||
                (id === "activities" && activeDrawerTab === "playbook")
              }
              tabIndex={activeDrawerTab === id || (id === "activities" && activeDrawerTab === "playbook") ? 0 : -1}
              onClick={() => changeCustomerTab(id)}
              onKeyDown={e=>{
                const ids=["activities","chat","profile","assessment"] as const;
                const index=ids.indexOf(id);
                const next=e.key==="ArrowRight"?ids[(index+1)%ids.length]:e.key==="ArrowLeft"?ids[(index+ids.length-1)%ids.length]:e.key==="Home"?ids[0]:e.key==="End"?ids[ids.length-1]:undefined;
                if(next){e.preventDefault();changeCustomerTab(next,true);}
              }}
            >
              {t(en, zh)}
            </button>
          ))}
        </div>
        <div
          id="crm-customer-content"
          className="crm-customer-panel-body"
          role="tabpanel"
          aria-labelledby={`crm-customer-tab-${activeDrawerTab === "playbook" ? "activities" : activeDrawerTab}`}
        >
          {leadActionError && (
            <p role="alert" className="text-rose-500">
              {crmError(leadActionError, lang)}
            </p>
          )}
          {profileSave&&activeDrawerTab==="profile"&&<p role="status">{profileSave==="saving"?t("Saving...","保存中..."):t("Saved","已保存")}</p>}
          {activeDrawerTab === "profile" && (
            <>
            <CrmCustomerProfile
              lead={selectedLead}
              lang={lang}
              timezone={filterTimezone}
              ownership={<>{ownershipControls(selectedLead)}<CrmSingleSelect label={lang==='zh'?'客户沟通语言':lang==='id'?'Bahasa komunikasi pelanggan':'Customer communication language'} value={selectedLead.communicationLanguage||'unknown'} options={[{value:'unknown',label:lang==='zh'?'未确认':lang==='id'?'Belum dikonfirmasi':'Unconfirmed'},{value:'en',label:'English'},{value:'id',label:'Bahasa Indonesia'},{value:'zh',label:'中文'}]} lang={lang} isLight={isLight} disabled={!canEditLead(selectedLead)} onChange={v=>handleUpdateLeadField(selectedLead.id,{communicationLanguage:v as any})}/></>}
            />
            {canEditLead(selectedLead)&&<CrmAttendanceEditor key={`${selectedLead.id}:${attendanceReset}`} lead={selectedLead} staffId={employee.id} onDirty={setAttendanceDirty} onBusy={setIsSubmittingLog} lang={lang} isLight={isLight} timezone={filterTimezone} onUpdated={lead=>{setSelectedLead(current=>current?.id===lead.id?{...current,...lead}:current);fetchLeads(true);}}/>}
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
              onAssociate={canEditLead(selectedLead)?(message:any)=>{if(!discardDraft())return;setWorkflowSource(message);setWorkflowTask(undefined);setIsAddLogOpen(true);setActiveDrawerTab("activities");}:undefined}
              lead={selectedLead}
              lang={lang}
              timezone={filterTimezone}
            />
          )}
          {activeDrawerTab === "playbook" && (
            <button
              type="button"
              className="crm-work-link crm-customer-playbook"
              onClick={() => setActiveDrawerTab("activities")}
            >
              {t("Back to follow-up", "返回跟进")}
            </button>
          )}
          {activeDrawerTab === "activities" && (
            <div className="space-y-4">
              {!canEditLead(selectedLead) && (
                <p className="text-xs text-slate-500">
                  {t(
                    "Claim this unassigned lead before updating it or recording follow-up.",
                    "请先认领此未分配客户，再修改资料或记录跟进。",
                  )}
                </p>
              )}
              <LeadTaskActions lead={selectedLead}
                onProcess={(taskId:string)=>{if(!discardDraft())return;setWorkflowSource(undefined);setAdministrative(false);setWorkflowTask(taskId);setIsAddLogOpen(true);}}
                timezone={policyConfig.businessHours.timezone}
                readOnly={!canEditLead(selectedLead)}
                key={selectedLead.id}
                refreshKey={JSON.stringify(
                  selectedLead.attention?.tasks
                    .map((task) => [
                      task.id,
                      task.kind,
                      task.status,
                      task.dueAt,
                      task.ownerId,
                    ])
                    .sort(),
                )}
                leadId={selectedLead.id}
                isLight={isLight}
                lang={lang}
                onChange={() => fetchLeads(true)}
              />
              {contactPreview&&<CrmContactPreview key={"contact-preview-"+selectedLead.id} lead={selectedLead} employee={employee} lang={lang} isLight={isLight} scripts={contactScripts} onClose={()=>setContactPreview(false)} onUpdated={(lead:any)=>setSelectedLead(lead)}/>}
              <div className="crm-customer-context">
                <div>
                  {(()=>{const stats=contactStatistics(selectedLead);const render=(log:any,label:string)=><div><h3>{label}</h3>{log?<><p>{crmValue(log.connectStatus,lang)} · {log.channel} · {log.staffName} · {formatCrmOperatingTime(log.timestamp||log.at,filterTimezone)}</p><details><summary>{log.summary?.slice(0,150)}</summary><p className="whitespace-pre-wrap">{log.summary}</p></details>{log.sourceMessageId&&<button className="crm-work-link" onClick={()=>setActiveDrawerTab('chat')}>{t('Linked customer message','关联客户消息')}</button>}</>:<p>{t('No contact recorded','尚无联系记录')}</p>}</div>;return <>{render(stats.lastAttempt,t('Latest contact attempt','最近联系尝试'))}<p>{t('Attempts','尝试次数')}：{stats.attemptCount} · {t('Connected or replied','接通或回复次数')}：{stats.connectedCount}</p>{stats.lastConnected&&stats.lastConnected.id!==stats.lastAttempt?.id&&render(stats.lastConnected,t('Latest connected or replied','最近接通或回复'))}</>;})()}
                  {selectedLead.contactArrangement&&<p>{t('Contact arrangement','联系安排')}：{t(({active:"Active follow-up",waiting:"Waiting for review",nurture:"Nurture review",stopped:"Proactive contact stopped"})[selectedLead.contactArrangement.state],({active:"正常跟进",waiting:"等待复查",nurture:"培育复查",stopped:"停止主动联系"})[selectedLead.contactArrangement.state])} · {selectedLead.contactArrangement.reason}</p>}
                </div>
                {selectedLead.nextAction && (
                  <div>
                    <h3>{t("Manual note", "人工备注")}</h3>
                    <p>{selectedLead.nextAction}</p>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="crm-work-link crm-customer-playbook"
                onClick={() => setActiveDrawerTab("playbook")}
              >
                {t("Sales playbook", "销售话术参考")}
              </button>
              <button className="crm-work-button" disabled={!canEditLead(selectedLead)} onClick={()=>{if(!discardDraft())return;setAdministrative(true);setWorkflowTask(undefined);setIsAddLogOpen(true);}}>{t('Update contact arrangement','更新联系安排')}</button>
              {/* Top Action Bar: Add Follow-up Toggle + Timeline Filter */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={!canEditLead(selectedLead)}
                  onClick={() => {
                    if (isAddLogOpen) {
                      discardDraft();
                    } else {
                      setAdministrative(false);setWorkflowTask(undefined);setWorkflowSource(undefined);
                      setIsAddLogOpen(true);
                    }
                  }}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isAddLogOpen
                      ? isLight
                        ? "bg-primary-50 text-primary-700 border-primary-300 shadow-2xs"
                        : "bg-primary-950/60 text-primary-300 border-primary-700"
                      : isLight
                        ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 shadow-2xs"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  }`}
                >
                  <PlusCircle
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isAddLogOpen ? "rotate-45 text-primary-600" : "text-primary-500"}`}
                  />
                  <span>
                    {isAddLogOpen
                      ? t("Close Follow-up Form", "收起跟进表单")
                      : t("Log New Follow-up", "记录本次跟进")}
                  </span>
                </button>

                {/* Timeline Category Filter */}
                <div
                  className={`flex items-center p-0.5 rounded-xl border text-[11px] ${isLight ? "bg-slate-100 border-slate-200/90" : "bg-slate-800 border-slate-700"}`}
                >
                  <button
                    type="button"
                    onClick={() => setTimelineFilter("all")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      timelineFilter === "all"
                        ? isLight
                          ? "bg-white text-slate-900 shadow-2xs font-bold"
                          : "bg-slate-900 text-white shadow-xs font-bold"
                        : isLight
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t("All Activities", "全景动态")} ({timelineCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineFilter("logs")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      timelineFilter === "logs"
                        ? isLight
                          ? "bg-white text-slate-900 shadow-2xs font-bold"
                          : "bg-slate-900 text-white shadow-xs font-bold"
                        : isLight
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t("Follow-ups", "顾问跟进")} ({timelineCounts.logs})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineFilter("engagement")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      timelineFilter === "engagement"
                        ? isLight
                          ? "bg-white text-slate-900 shadow-2xs font-bold"
                          : "bg-slate-900 text-white shadow-xs font-bold"
                        : isLight
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t("Student Inquiries", "学员互动")} (
                    {timelineCounts.engagement})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineFilter("milestone")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      timelineFilter === "milestone"
                        ? isLight
                          ? "bg-white text-slate-900 shadow-2xs font-bold"
                          : "bg-slate-900 text-white shadow-xs font-bold"
                        : isLight
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t("Milestones", "关键里程碑")} ({timelineCounts.milestone})
                  </button>
                </div>
              </div>

              {workflowNotice&&<p role="status">{t("Result saved","处理结果已保存")} · {t("Completed tasks","已完成任务")} {workflowNotice.completed} · {workflowNotice.created?t("Next task scheduled","已安排下一步任务"):t("Next arrangement recorded","已记录后续安排")}</p>}
              {isAddLogOpen && <CrmWorkflowForm key={selectedLead.id+String(workflowTask)+String(administrative)} lead={selectedLead} employee={employee} lang={lang} isLight={isLight} timezone={filterTimezone} initialDraft={draftCache.current[selectedLead.id]} onDraft={(draft:any)=>{draftCache.current[selectedLead.id]=draft;}} administrative={administrative} workCalendar={policyConfig.businessHours} selectedTask={workflowTask} sourceMessage={workflowSource} onDirty={()=>setWorkflowDirty(true)} onBusy={setIsSubmittingLog} onCancel={()=>discardDraft()} onSaved={async(data:any,next:boolean)=>{delete draftCache.current[selectedLead.id];if(retainedDraft?.id===selectedLead.id)setRetainedDraft(null);const candidates=filteredLeads.slice(filteredLeads.findIndex((l:any)=>l.id===selectedLead.id)+1);setWorkflowDirty(false);setWorkflowTask(undefined);setWorkflowSource(undefined);setSelectedLead((current:any)=>({...current,...data.lead}));setIsAddLogOpen(false);setWorkflowNotice({completed:data.completedTaskIds.length,created:Boolean(data.createdTaskId)});fetchLeads(true);if(next){for(const candidate of candidates){const access=await fetch(`/api/crm/leads/${candidate.id}/tasks`);if([403,404].includes(access.status))continue;if(!access.ok){setLeadActionError(lang==='zh'?'记录已保存，下一位暂不可加载':lang==='id'?'Catatan disimpan; pelanggan berikutnya belum tersedia':'Record saved; next customer unavailable');return;}handleOpenLeadDrawer(candidate,'activities',true);return;}setIsDrawerOpen(false);setSelectedLead(null);setQueueComplete(true);}}}/>}

              {/* Unified Customer Journey Timeline */}
              <div className="pt-1">
                {journeyTimelineEvents.length === 0 ? (
                  <div
                    className={`py-12 text-center rounded-2xl border border-dashed ${isLight ? "bg-slate-50/50 border-slate-200 text-slate-400" : "bg-slate-950/50 border-slate-800 text-slate-500"}`}
                  >
                    <History className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                    <p>
                      {t(
                        "No timeline events recorded yet.",
                        "暂无旅程动态事件。",
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="relative pl-7 sm:pl-9 space-y-4 before:absolute before:left-3.5 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {journeyTimelineEvents
                      .filter((e) => {
                        if (timelineFilter === "logs")
                          return e.category === "follow_up";
                        if (timelineFilter === "engagement")
                          return e.category === "engagement";
                        if (timelineFilter === "milestone")
                          return e.category === "milestone";
                        return true;
                      })
                      .map((ev) => (
                        <div key={ev.id} className="relative group">
                          {/* Left Node Icon */}
                          <div
                            className={`absolute -left-7 sm:-left-9 top-2 w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-xs border-2 z-10 transition-transform group-hover:scale-110 ${
                              ev.category === "follow_up"
                                ? isLight
                                  ? "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-emerald-500/10"
                                  : "bg-emerald-950 border-emerald-600 text-emerald-300"
                                : ev.category === "milestone"
                                  ? isLight
                                    ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-indigo-500/10"
                                    : "bg-indigo-950 border-indigo-600 text-indigo-300"
                                  : isLight
                                    ? "bg-sky-50 border-sky-400 text-sky-700 shadow-sky-500/10"
                                    : "bg-sky-950 border-sky-600 text-sky-300"
                            }`}
                          >
                            <span className="text-xs select-none">
                              {ev.icon}
                            </span>
                          </div>

                          {/* Event Card */}
                          <div
                            className={`p-3.5 rounded-xl border space-y-2 transition-all shadow-2xs ${
                              isLight
                                ? "bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs"
                                : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Action Initiator Tag */}
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                    ev.actorType === "client"
                                      ? isLight
                                        ? "bg-sky-50 text-sky-700 border-sky-200"
                                        : "bg-sky-950/60 text-sky-300 border-sky-800"
                                      : ev.actorType === "consultant"
                                        ? isLight
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                                        : ev.actorType === "record"
                                          ? isLight
                                            ? "bg-slate-50 text-slate-700 border-slate-200"
                                            : "bg-slate-800 text-slate-200 border-slate-600"
                                        : isLight
                                          ? "bg-purple-50 text-purple-700 border-purple-200"
                                          : "bg-purple-950/60 text-purple-300 border-purple-800"
                                  }`}
                                >
                                  {ev.actorType === "client"
                                    ? `👤 ${t("Client Action", "客户自主")}`
                                    : ev.actorType === "consultant"
                                      ? `👨‍💼 ${t("Consultant Touch", "顾问跟进")}`
                                      : ev.actorType === "record"
                                        ? `📋 ${t("Recorded status", "记录状态")}`
                                        : `🤖 ${t("System Intelligence", "智能判定")}`}
                                </span>

                                {/* Event Category Badge */}
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ev.badgeStyle}`}
                                >
                                  {ev.badgeText}
                                </span>

                                {ev.staffName && (
                                  <span
                                    className={`font-bold text-xs ${isLight ? "text-slate-800" : "text-slate-200"}`}
                                  >
                                    {ev.staffName}
                                  </span>
                                )}
                              </div>

                              <span
                                className={`font-mono text-[10.5px] flex items-center gap-1 ${isLight ? "text-slate-400" : "text-slate-500"}`}
                              >
                                <Clock className="w-3 h-3" />
                                {ev.timestamp &&
                                Number.isFinite(Date.parse(ev.timestamp))
                                  ? formatCrmDateTime(ev.timestamp)
                                  : t("Unknown time", "未知时间")}
                              </span>
                            </div>

                            <div
                              className={`font-semibold text-xs leading-snug ${isLight ? "text-slate-900" : "text-slate-100"}`}
                            >
                              {ev.title}
                            </div>

                            {ev.subtitle && (
                              <div
                                className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}
                              >
                                {ev.subtitle}
                              </div>
                            )}

                            {ev.content && (
                              <details><summary>{t("View original record","查看原始记录")}</summary><p className="whitespace-pre-wrap">{ev.content}</p></details>
                            )}

                            {(ev.nextAction || ev.stageTransition) && (
                              <div
                                className={`flex items-center justify-between pt-2 border-t text-[10px] gap-2 flex-wrap ${isLight ? "border-slate-100 text-slate-500" : "border-slate-800 text-slate-400"}`}
                              >
                                {ev.stageTransition && !ev.subtitle?.includes(ev.stageTransition) && (
                                  <span className="flex items-center gap-1">
                                    {t("Stage:", "阶段推进:")}{" "}
                                    <b className="text-primary-600 font-medium">
                                      {ev.stageTransition}
                                    </b>
                                  </span>
                                )}
                                {ev.nextAction && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-primary-500" />
                                    {t("Next:", "下一步:")}{" "}
                                    <span
                                      className={
                                        isLight
                                          ? "text-slate-800 font-semibold"
                                          : "text-slate-200 font-semibold"
                                      }
                                    >
                                      {ev.nextAction}
                                    </span>
                                    {ev.nextFollowUpAt && (
                                      <span className="text-slate-400 font-mono">
                                        (
                                        {formatCrmOperatingTime(ev.nextFollowUpAt,filterTimezone).slice(0,16)}
                                        )
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: 🎯 转化攻坚 (Sales Playbook & Objection Handling) */}
          {activeDrawerTab === "playbook" && (
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
                      setContactScripts(undefined);setContactPreview(true);setActiveDrawerTab('activities');
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 2000);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg cursor-pointer transition-all ${
                      isLight
                        ? "bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    {copiedScript ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedScript
                        ? t("Copied!", "已复制!")
                        : t("Copy Text", "复制话术")}
                    </span>
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

                <button type="button" disabled={selectedLead.contactArrangement?.state==='stopped'} onClick={()=>{setContactScripts(undefined);setContactPreview(true);setActiveDrawerTab('activities');}}
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
                            setContactScripts({en:item.answerEn,id:crmId(item.answerEn),zh:item.answer});setContactPreview(true);setActiveDrawerTab("activities");
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
          )}
        </div>
      </section>
    ) : null;
  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 select-text ${isLight ? "bg-[#f5f5f7] text-[#1d1d1f]" : "bg-slate-950 text-slate-100"}`}
    >
      {pendingNavigation && (
        <div
          className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") resumeDraft();
            if (e.key === "Tab") {
              const buttons =
                e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
              if (e.shiftKey && document.activeElement === buttons[0]) {
                e.preventDefault();
                buttons[1].focus();
              } else if (!e.shiftKey && document.activeElement === buttons[1]) {
                e.preventDefault();
                buttons[0].focus();
              }
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="crm-draft-title"
            aria-describedby="crm-draft-description"
            className={`max-w-sm w-full rounded-2xl p-6 shadow-xl ${isLight ? "bg-white text-slate-900" : "bg-slate-900 text-slate-100"}`}
          >
            <h2 id="crm-draft-title" className="font-semibold mb-2">
              {t("Unsaved changes", "修改尚未保存")}
            </h2>
            <p id="crm-draft-description" className="text-sm mb-5">
              {t(
                "Keep editing, or discard this draft and continue.",
                "可以继续编辑，或放弃草稿后继续。",
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                autoFocus
                className="border rounded-lg px-3 py-2 text-sm"
                onClick={resumeDraft}
              >
                {t("Keep editing", "继续编辑")}
              </button>
              <button
                type="button"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                onClick={() => {
                  const action = pendingNavigation;
                  setPendingNavigation(null);
                  clearDraft();
                  action();
                }}
              >
                {t("Discard draft", "放弃草稿")}
              </button>
            </div>
          </section>
        </div>
      )}
      {/* Top Apple-Style / Dark Navigation Bar - Stable 2-Row Architecture */}
      <a className="crm-skip-link" href="#crm-main">{lang==='zh'?'跳到工作区':lang==='id'?'Lewati ke ruang kerja':'Skip to workspace'}</a>
      <header
        data-crm-header
        className={`sticky top-0 z-30 transition-colors duration-200 border-b shadow-2xs ${
          isLight
            ? "bg-white/90 backdrop-blur-md border-slate-200/90"
            : "bg-slate-900/95 backdrop-blur-md border-slate-800 shadow-md"
        }`}
      >
        {/* ROW 1: Brand & Module Context Title */}
        <div className="px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="flex items-center gap-2 shrink-0 group hover:opacity-95 transition-opacity"
              title={t("Back to UPER Homepage", "返回 UPER 官网首页")}
            >
              <img
                src="/uper-logo-mark.svg"
                alt={t("UPER logo", "UPER 标志")}
                width="34"
                height="34"
                className="h-[32px] w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              />
              <span
                className={`font-extrabold text-[20px] tracking-[0.03em] leading-none font-sans ${isLight ? "text-slate-900 font-extrabold" : "text-white"}`}
              >
                UPER
              </span>
            </Link>

            <div
              className={`h-5 w-px ${isLight ? "bg-slate-200" : "bg-slate-800"} hidden sm:block mx-0.5 shrink-0`}
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className={`text-sm sm:text-base font-bold tracking-tight truncate ${isLight ? "text-slate-900 font-extrabold" : "text-white"}`}
                >
                  {crmModule === "campaigns"
                    ? t(
                        "Marketing Campaign & Tracking Hub",
                        "营销活动中心与渠道追溯看板",
                      )
                    : crmModule === "leads"
                      ? t(
                          "Telemarketing & Advisory CRM",
                          "电销跟进与学术顾问 CRM",
                        )
                      : crmModule === "policy"
                        ? t("Sales Operations Settings", "销售运营设置")
                        : (lang === "zh" ? "CRM 系统文档" : lang === "id" ? "Dokumentasi CRM" : "CRM documentation")}
                </h1>
                <span className="text-slate-300 dark:text-slate-600 select-none hidden md:inline">
                  ·
                </span>
                <span
                  className={`text-[11px] font-mono hidden md:inline ${isLight ? "text-slate-500" : "text-slate-400"}`}
                >
                  {crmModule === "campaigns"
                    ? t("Campaign Hub v2.5", "营销活动 v2.5")
                    : crmModule === "leads"
                      ? t("2026 Enterprise", "2026 企业版")
                      : crmModule === "policy"
                        ? t("Policy v2.0", "策略 v2.0")
                        : t("Handbook v2.0", "手册 v2.0")}
                </span>
              </div>
              <p
                className={`text-[11px] truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}
              >
                {crmModule === "campaigns"
                  ? t(
                      "Plan campaigns and track registrations, participation and enrollment.",
                      "规划活动，追踪登记、参与及报名。",
                    )
                  : crmModule === "leads"
                    ? t(
                        "Prioritize customers, record outcomes and plan the next step.",
                        "明确优先客户，记录沟通结果，安排下一步。",
                      )
                    : crmModule === "policy"
                      ? t(
                          "Configure working hours, response deadlines, follow-up rules and notifications.",
                          "配置工作时间、响应时限、跟进规则与通知。",
                        )
                      : t(
                          "Workflows for accounts, customer follow-up, assessments and notifications.",
                          "账号权限、客户跟进、测评与通知的操作说明。",
                        )}
              </p>
            </div>
          </div>

          <CrmAccountControls lang={lang} isLight={isLight} />
        </div>

        {/* ROW 2: Fixed, Always-on-Second-Row Navigation Pills & Actions */}
        <div className="px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Cluster of Row 2: Module Switcher Pills + Preferences Group (Language & Theme) */}
          <div className="flex flex-wrap items-center gap-2.5 min-w-0 max-w-full">
            {/* 1. Module Switcher Pills (左侧功能页区) */}
            <div
              className={`crm-header-module-tabs flex items-center p-1 rounded-xl border shrink-0 max-w-full overflow-x-auto no-scrollbar ${isLight ? "bg-slate-100 border-slate-200" : "bg-slate-800 border-slate-700"}`}
            >
              {/* 1. Marketing Campaigns (Placed first for campaign-first workflow) */}
              <button
                type="button"
                onClick={() => changeModule("campaigns")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  crmModule === "campaigns"
                    ? isLight
                      ? "bg-white text-primary-700 shadow-2xs font-bold"
                      : "bg-primary-800 text-white shadow-sm"
                    : isLight
                      ? "text-slate-600 hover:text-slate-900"
                      : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>{t("Marketing Campaigns", "营销活动中心")}</span>
              </button>

              {/* 2. Leads CRM */}
              <button
                type="button"
                onClick={() => changeModule("leads")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  crmModule === "leads"
                    ? isLight
                      ? "bg-white text-primary-700 shadow-2xs font-bold"
                      : "bg-primary-800 text-white shadow-sm"
                    : isLight
                      ? "text-slate-600 hover:text-slate-900"
                      : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{t("Leads CRM", "销售线索")}</span>
              </button>

              {/* 3. SLA & Sales Policy */}
              {canManage && (
                <button
                  type="button"
                  onClick={() => changeModule("policy")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    crmModule === "policy"
                      ? isLight
                        ? "bg-white text-primary-700 shadow-2xs font-bold"
                        : "bg-primary-800 text-white shadow-sm"
                      : isLight
                        ? "text-slate-600 hover:text-slate-900"
                        : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{t("Sales Operations", "销售运营")}</span>
                </button>
              )}

              {/* 4. User Guide & Handbook */}
              <button
                type="button"
                onClick={() => changeModule("docs")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  crmModule === "docs"
                    ? isLight
                      ? "bg-white text-primary-700 shadow-2xs font-bold"
                      : "bg-primary-800 text-white shadow-sm"
                    : isLight
                      ? "text-slate-600 hover:text-slate-900"
                      : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{(lang === "zh" ? "系统文档" : lang === "id" ? "Dokumentasi" : "Documentation")}</span>
              </button>
            </div>

            {/* 2. Unified Preferences Group: Language & Theme Switcher (常驻在左侧三个功能页区的右侧) */}
            <div
              className={`crm-header-preferences flex items-center p-1 rounded-xl border shrink-0 ${isLight ? "bg-slate-100 border-slate-200" : "bg-slate-800 border-slate-700"}`}
            >
              {/* Language Switcher */}
              <CrmLanguageSelect lang={lang} onChange={setLang} isLight={isLight} />

              <div
                className={`h-4 w-px mx-0.5 ${isLight ? "bg-slate-200" : "bg-slate-700"}`}
              />

              {/* Theme Switcher */}
              <button
                type="button"
                onClick={toggleTheme}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isLight
                    ? "hover:bg-white/90 text-slate-700 hover:shadow-2xs"
                    : "hover:bg-slate-700/90 text-slate-200"
                }`}
                title={
                  isLight
                    ? t("Switch to Dark Mode", "切换至深色模式")
                    : t("Switch to Apple Light Mode", "切换至浅色模式")
                }
              >
                {isLight ? (
                  <>
                    <Moon className="w-3.5 h-3.5" />
                    <span>{t("Dark", "深色")}</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t("Light", "浅色")}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right of Row 2: Contextual Business Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Contextual Actions in Leads: Refresh & Export */}
            {crmModule === "leads" && (
              <>
                <button
                  type="button"
                  onClick={() => fetchLeads()}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isLight
                      ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 shadow-2xs"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  }`}
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-primary-500" : ""}`}
                  />
                  <span>{t("Refresh", "刷新数据")}</span>
                </button>

                {employee.permissions.includes("crm.export") && (
                  <a
                    href={"/api/crm/export?"+queryKey}
                    className="flex items-center gap-1.5 h-8 px-3.5 bg-primary-700 hover:bg-primary-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-primary-900/20 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {t("Export current results (.JSON)", "导出当前结果 (.JSON)")}
                    </span>
                  </a>
                )}
              </>
            )}

            {/* Contextual Actions in Policy: Reset Defaults & Save Changes */}
            {crmModule === "policy" && (
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
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main id="crm-main" tabIndex={-1} className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1560px] w-full mx-auto space-y-5">
        {crmModule === "campaigns" ? (
          <CrmCampaignHub
            canManageCampaigns={canManage}
            isLight={isLight}
            lang={lang}
            leads={leads}
            onSelectLeadInCrm={async(leadId) => {
              try{
                let target=leads.find(l=>l.id===leadId);
                if(!target){const r=await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`);const data=await r.json();if(!r.ok)throw Error(data.error||'Lead not found');target={...data.lead,attention:{tasks:(data.tasks||[]).map((t:any)=>({id:t.id,kind:t.kind,status:t.status,dueAt:t.due_at,ownerId:t.owner_id,details:t.details})),unreadCount:0,isMine:false}};}
                setCrmModule("leads");handleOpenLeadDrawer(target);
              }catch(e){setLeadActionError((e as Error).message);}
            }}
            onNavigateTab={(tab) => changeModule(tab)}
          />
        ) : crmModule === "policy" && canManage ? (
          <>
            <CrmPolicySettings
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
            />
            <NotificationCenter
              isLight={isLight}
              lang={lang}
              navigationRequest={notificationNavigationRequest}
            />
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
            <details className="crm-detail-filter-disclosure" open={!isDrawerOpen} key={String(isDrawerOpen)}>
              <summary hidden={!isDrawerOpen}>{t("Adjust customer filters","调整客户筛选")} · {filteredLeads.length}</summary>
            <CrmLeadFilters
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
            /></details>

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
              onClaim={!canAssign&&employee.roles.includes("sales")?(lead)=>claimLead(lead.id):undefined}
              onOpen={handleOpenLeadDrawer}
              onProcess={processFromList}
              canProcess={canEditLead}
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
