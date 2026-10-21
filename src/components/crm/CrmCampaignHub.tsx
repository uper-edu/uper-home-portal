import {loadCampaignWorkspace} from "../../utils/campaignWorkspaceRefresh";
import { campaignUi, campaignUiMessages } from "../../utils/campaignI18n";
import { CampaignWorkspaceHeading } from "./CampaignWorkspaceHeading";
import {
  campaignReviewUrl,
  campaignReviewReturnUrl,
  sourceReviewState,
} from "../../utils/campaignSourceNavigation";
import { campaignCollectionLabel } from "../../utils/campaignPresentation";
import {
  CrmDetailHeader,
  CrmDetailTabs,
  CrmSaveFeedback,
  CrmDiscardDialog,
  useCrmShellHeight,
} from "./CrmDetailWorkspace";
import { CampaignOverview } from "./CampaignOverview";
import {
  CampaignCards,
  CampaignSidebarSummary,
  type PromotionReviewCounts,
} from "./CampaignCards";
import { CampaignInformation } from "./CampaignInformation";
import { CampaignPromotionLinks } from "./CampaignPromotionLinks";
import { CampaignEditor } from "./CampaignEditor";
import { CampaignMaterials } from "./CampaignMaterials";
import { campaignText, campaignName } from "../../utils/campaignWorkspace";
import { CrmCampaignSources } from "./CrmCampaignSources";
import {
  isOrganicCampaign,
  organicCampaignName,
} from "../../utils/organicCampaign";
import { CrmCampaignMeasures } from "./CrmCampaignMeasures";
import { campaignChatLink, matchesCampaign } from "../../utils/crmCampaignLink";
import { CAMPAIGN_LINK_PLACEHOLDER } from "../../utils/campaignCode";
import {
  campaignBudgetFromInput,
  CAMPAIGN_BUDGET_ERROR,
} from "../../utils/campaignBudget";
import { CrmSelect } from "./CrmSelect";
import { crmId } from "../../utils/crmIndonesian";
import { crmValue, crmError, crmLocale } from "../../utils/crmLanguage";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useCampaignQr } from "./useCampaignQr";
import { CampaignQrImage } from "./CampaignQrImage";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  QrCode,
  Copy,
  ExternalLink,
  Calendar,
  MapPin,
  Users,
  Award,
  TrendingUp,
  Sparkles,
  Check,
  Eye,
  Trash2,
  Edit3,
  ArrowRight,
  Download,
  Share2,
  DollarSign,
  Target,
  MessageSquare,
  Printer,
  RefreshCw,
  X,
  ChevronRight,
  FileText,
  CheckCircle2,
  GraduationCap,
  Briefcase,
  Video,
  Flame,
  Globe,
  HelpCircle,
  Clock,
  Send,
  Building,
  BarChart3,
  SlidersHorizontal,
  ChevronDown,
  Bot,
} from "lucide-react";
import type {
  CrmCampaignRecord,
  CampaignType,
  CampaignStatus,
  CampaignLocationType,
} from "../../types/crmCampaign";
import {
  CAMPAIGN_TYPE_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
} from "../../types/crmCampaign";
import type { CrmLeadRecord } from "../../types/crmLead";
import type { HookType, HookContextType } from "../../types/leadSystem";
interface CrmCampaignHubProps {
  canManageCampaigns?: boolean;
  isLight: boolean;
  lang: "en" | "zh" | "id";
  leads: CrmLeadRecord[];
  onSelectLeadInCrm?: (leadId: string) => void;
  onNavigateTab?: (tab: "leads" | "campaigns" | "policy" | "docs") => void;
}
export function CrmCampaignHub({
  canManageCampaigns = false,
  isLight,
  lang,
  leads: initialLeads,
  onSelectLeadInCrm,
  onNavigateTab,
}: CrmCampaignHubProps) {
  const [refreshedLeads, setRefreshedLeads] = useState<CrmLeadRecord[] | null>(null);
  const leads = refreshedLeads ?? initialLeads;
  const u = campaignUi(lang);
  const t = (en: string, zh: string) =>
    campaignUiMessages[en]
      ? u(en)
      : lang === "id"
        ? crmId(en)
        : lang === "zh"
          ? zh
          : en;
  const [campaigns, setCampaigns] = useState<CrmCampaignRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [campaignError, setCampaignError] = useState(false);
  const [promotionReviews, setPromotionReviews] =
    useState<PromotionReviewCounts>({ available: false, counts: {} });
  const [reviewCountsLoading, setReviewCountsLoading] = useState(true);
  const [unknownSourcesPending, setUnknownSourcesPending] = useState<
    boolean | null
  >(null);
  const [searchQuery, setSearchQuery] = useState(
    () =>
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      ).get("campaignSearch") || "",
  );
  const [selectedType, setSelectedType] = useState<string>(
    () =>
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      ).get("campaignType") || "All",
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(
    () =>
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      ).get("campaignStatus") || "All",
  );
  // Active view: 'cards' | 'table'
  const [viewLayout, setViewLayout] = useState<"cards" | "table">("cards");
  // QR Modal State
  const [activeQrCampaign, setActiveQrCampaign] =
    useState<CrmCampaignRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  type DetailTab = "overview" | "info" | "leads" | "collaterals";
  const [pageUrl, setPageUrl] = useState(() =>
    typeof window === "undefined"
      ? "http://localhost/crm"
      : window.location.href,
  );
  const pageParams = new URL(pageUrl).searchParams;
  const requestedCampaign =
    pageParams.get("campaignArea") === "overview"
      ? null
      : pageParams.get("campaign");
  const campaignArea =
    canManageCampaigns && pageParams.get("campaignArea") === "sources"
      ? "sources"
      : "campaigns";
  const [showCampaignOverview, setShowCampaignOverview] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    if (pageParams.get("campaignArea") !== "overview") return;
    const url = new URL(pageUrl);
    url.searchParams.delete("campaignArea");
    url.searchParams.delete("campaign");
    url.searchParams.delete("campaignView");
    window.history.replaceState({}, "", url);
    setPageUrl(url.href);
    setShowCampaignOverview(true);
  }, [pageUrl]);
  const [listCollapsed, setListCollapsed] = useState(false),
    [mobileList, setMobileList] = useState(false);
  const selectedListItem = useRef<HTMLButtonElement>(null),
    listToggle = useRef<HTMLButtonElement>(null),
    listSearch = useRef<HTMLInputElement>(null);
  const activeDetailCampaign =
    campaigns.find((c) => c.id === requestedCampaign) || null;
  const requestedDetailTab: DetailTab = (
    ["overview", "info", "leads", "collaterals"].includes(
      pageParams.get("campaignView") || "",
    )
      ? pageParams.get("campaignView")
      : "overview"
  ) as DetailTab;
  const organicDetail =
    !!activeDetailCampaign && isOrganicCampaign(activeDetailCampaign);
  const detailTab: DetailTab =
    organicDetail && !["leads", "info"].includes(requestedDetailTab)
      ? "leads"
      : requestedDetailTab;
  const lastOpenedCampaign = useRef(requestedCampaign);
  const listScroll = useRef(0),
    pageHeading = useRef<HTMLHeadingElement>(null),
    workspaceHeading = useRef<HTMLHeadingElement>(null);
  const reviewReturn = useRef<{
      url: string;
      scrollY: number;
      campaignId?: string;
    } | null>(null),
    previousArea = useRef(campaignArea);
  const updateCampaign = (c: CrmCampaignRecord) =>
    setCampaigns((old) =>
      old.some((x) => x.id === c.id)
        ? old.map((x) => (x.id === c.id ? c : x))
        : [c, ...old],
    );
  const [editor, setEditor] = useState<CrmCampaignRecord | null | undefined>(
    undefined,
  );
  const [saveNotice, setSaveNotice] = useState(false);
  const [campaignActionError, setCampaignActionError] = useState("");
  const shellHeight = useCrmShellHeight();
  const w = (en: string, id: string, zh: string) =>
    campaignText(lang, en, id, zh);
  const materialState = useRef({ dirty: false, busy: false });
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null),
    [workspaceEpoch, setWorkspaceEpoch] = useState(0);
  const requestLeave = (proceed: () => void) => {
    if (materialState.current.busy) return;
    if (materialState.current.dirty) {
      setPendingLeave(() => proceed);
      return;
    }
    proceed();
  };
  const finishLeave = () => {
    const action = pendingLeave;
    setPendingLeave(null);
    materialState.current = { dirty: false, busy: false };
    setWorkspaceEpoch((n) => n + 1);
    action?.();
  };
  const navigateCampaign = (
    c: CrmCampaignRecord | null,
    tab: DetailTab = "overview",
    replace = false,
  ) => {
    const url = new URL(window.location.href);
    url.hash = "";
    url.searchParams.set("tab", "campaigns");
    url.searchParams.delete("campaignArea");
    url.searchParams.delete("lead");
    url.searchParams.delete("leadView");
    url.searchParams.delete("sourceIssue");
    url.searchParams.delete("sourceCampaign");
    for (const [key, value] of [
      ["campaignSearch", searchQuery],
      ["campaignType", selectedType],
      ["campaignStatus", selectedStatus],
    ]) {
      if (value && value !== "All") url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (c) {
      lastOpenedCampaign.current = c.id;
      url.searchParams.set("campaign", c.id);
      url.searchParams.set("campaignView", tab);
      if (!requestedCampaign) listScroll.current = window.scrollY;
    } else {
      url.searchParams.delete("campaign");
      url.searchParams.delete("campaignView");
    }
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setPageUrl(url.href);
  };
  const openCampaign = (
    c: CrmCampaignRecord,
    tab: DetailTab = activeDetailCampaign ? detailTab : "overview",
  ) => {
    if (isOrganicCampaign(c) && !["leads", "info"].includes(tab)) tab = "leads";
    if (c.id === requestedCampaign && tab === detailTab) {
      setMobileList(false);
      return;
    }
    requestLeave(() => {
      setSaveNotice(false);
      setMobileList(false);
      navigateCampaign(c, tab);
    });
  };
  const closeCampaign = () =>
    requestLeave(() => {
      setSaveNotice(false);
      setMobileList(true);
      navigateCampaign(null);
    });
  const changeDetailTab = (tab: DetailTab, keyboard = false) => {
    if (activeDetailCampaign && tab !== detailTab)
      requestLeave(() => {
        setSaveNotice(false);
        navigateCampaign(activeDetailCampaign, tab);
      });
  };
  const openSourceReview = (c?: CrmCampaignRecord) =>
    requestLeave(() => {
      const filters = {
        search: searchQuery,
        type: selectedType,
        status: selectedStatus,
      };
      reviewReturn.current = {
        url: campaignReviewReturnUrl(window.location.href, filters),
        scrollY: window.scrollY,
        campaignId: c?.id,
      };
      const url = campaignReviewUrl(window.location.href, filters, c?.id);
      window.history.pushState({}, "", url);
      setPageUrl(url);
      setSaveNotice(false);
    });
  const returnFromSourceReview = () =>
    requestLeave(() => {
      const url =
        reviewReturn.current?.url ||
        campaignReviewReturnUrl(window.location.href, {
          search: searchQuery,
          type: selectedType,
          status: selectedStatus,
        });
      window.history.pushState({}, "", url);
      setPageUrl(url);
      setSaveNotice(false);
    });
  const reviewCampaignPromotions = (c: CrmCampaignRecord) =>
    openSourceReview(c);
  const clearPromotionFilter = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("sourceCampaign");
    window.history.replaceState({}, "", url);
    setPageUrl(url.href);
  };
  const handleOpenCreateWizard = () =>
    requestLeave(() => {
      setSaveNotice(false);
      setEditor(null);
    });
  const handleOpenEditWizard = (c: CrmCampaignRecord, materials = false) => {
    if (materials) openCampaign(c, "collaterals");
    else requestLeave(() => setEditor(c));
  };
  const handleSaved = (c: CrmCampaignRecord) => {
    const created = editor === null;
    setEditor(undefined);
    updateCampaign(c);
    navigateCampaign(c, created ? "overview" : "info");
    setSaveNotice(true);
    void fetchCampaigns();
  };
  useEffect(() => {
    const pop = () => {
      const target = window.location.href;
      if (new URL(target).searchParams.get("tab") !== "campaigns") return;
      if (materialState.current.dirty || materialState.current.busy) {
        window.history.pushState({}, "", pageUrl);
        requestLeave(() => {
          window.history.replaceState({}, "", target);
          setSaveNotice(false);
          setPageUrl(target);
        });
      } else {
        setSaveNotice(false);
        setPageUrl(target);
      }
    };
    const leave = (e: Event) => {
      if (materialState.current.dirty || materialState.current.busy) {
        e.preventDefault();
        const detail = (e as CustomEvent).detail;
        if (detail?.history) window.history.pushState({}, "", pageUrl);
        const action = detail?.proceed;
        if (action) requestLeave(action);
      }
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("crm-campaign-before-leave", leave);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("crm-campaign-before-leave", leave);
    };
  }, [pageUrl, lang]);
  useEffect(() => {
    const returning =
        previousArea.current === "sources" && campaignArea !== "sources",
      entering = previousArea.current !== campaignArea;
    previousArea.current = campaignArea;
    if (campaignArea === "sources") {
      if (entering)
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0 });
          workspaceHeading.current?.focus({ preventScroll: true });
        });
      return;
    }
    requestAnimationFrame(() => {
      if (returning) {
        const context = reviewReturn.current;
        window.scrollTo({ top: context?.scrollY || 0 });
        const target = context?.campaignId
          ? document.querySelector<HTMLButtonElement>(
              `[data-campaign-review="${CSS.escape(context.campaignId)}"]`,
            )
          : document.getElementById("campaign-source-review-trigger");
        target?.focus({ preventScroll: true });
      } else if (requestedCampaign) {
        document
          .querySelector(".campaign-workpage")
          ?.scrollIntoView({ block: "start", behavior: "instant" });
        pageHeading.current?.focus({ preventScroll: true });
      } else {
        window.scrollTo({ top: listScroll.current });
        if (lastOpenedCampaign.current)
          document
            .querySelector<HTMLButtonElement>(
              `[data-campaign-card="${CSS.escape(lastOpenedCampaign.current)}"]`,
            )
            ?.focus({ preventScroll: true });
      }
    });
  }, [campaignArea, requestedCampaign, Boolean(activeDetailCampaign)]);
  useEffect(() => {
    const body = document.getElementById("crm-campaign-content");
    if (body) body.scrollTop = 0;
  }, [requestedCampaign, detailTab]);
  useEffect(() => {
    if (campaignArea === "campaigns")
      selectedListItem.current?.scrollIntoView({ block: "nearest" });
  }, [requestedCampaign, listCollapsed, campaignArea]);
  useEffect(() => {
    if (!canManageCampaigns) return;
    let active = true;
    setReviewCountsLoading(true);
    setPromotionReviews({ available: false, counts: {} });
    setUnknownSourcesPending(null);
    const read = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw Error("Review data unavailable");
      return response.json();
    };
    Promise.allSettled([
      read("/api/crm/campaigns/sources/promotions"),
      read("/api/crm/campaigns/sources"),
    ]).then(([promotions, sources]) => {
      if (!active) return;
      if (promotions.status === "fulfilled") {
        const counts: Record<string, number> = {};
        for (const row of promotions.value.reviews)
          if (["pending", "deferred"].includes(row.status))
            counts[row.campaignId] = (counts[row.campaignId] || 0) + 1;
        setPromotionReviews({ available: true, counts });
      } else setPromotionReviews({ available: false, counts: {} });
      setUnknownSourcesPending(
        sources.status === "fulfilled"
          ? sources.value.sources.some((row: any) => row.status === "pending")
          : null,
      );
      setReviewCountsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [canManageCampaigns, campaigns]);
  // Canonicalize old organic links without exposing irrelevant promotion/material tabs.
  useEffect(() => {
    if (!organicDetail || detailTab === requestedDetailTab) return;
    const url = new URL(pageUrl);
    url.searchParams.set("campaignView", detailTab);
    window.history.replaceState({}, "", url);
    setPageUrl(url.href);
  }, [organicDetail, detailTab, requestedDetailTab]);
  // Fetch campaigns
  const fetchCampaigns = async () => {
    setIsLoading(true);
    setCampaignError(false);
    try {
      const data = await loadCampaignWorkspace(fetch);
      setCampaigns(data.campaigns);
      setRefreshedLeads(data.leads);
    } catch (err) {
      setCampaignError(true);
      console.error("[CAMPAIGN HUB] Failed to fetch campaigns:", err);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchCampaigns();
  }, []);
  // Each surface owns its current saved link and independent generation lifecycle.
  const popupQr = useCampaignQr(
    activeQrCampaign ? campaignChatLink(activeQrCampaign.code) : null,
  );
  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (selectedType !== "All" && c.type !== selectedType) return false;
      if (selectedStatus !== "All" && c.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inName = c.name.toLowerCase().includes(query);
        const inCode = c.code.toLowerCase().includes(query);
        const inVenue = c.venue.toLowerCase().includes(query);
        const inCity = c.city.toLowerCase().includes(query);
        const inOrganizer = c.organizer.toLowerCase().includes(query);
        if (!inName && !inCode && !inVenue && !inCity && !inOrganizer) {
          return false;
        }
      }
      return true;
    });
  }, [campaigns, selectedType, selectedStatus, searchQuery]);
  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };
  // Delete Campaign
  const handleDeleteCampaign = async (id: string, name: string) => {
    if (
      !window.confirm(
        u('Are you sure you want to delete campaign "{name}"?', { name }),
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/crm/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const result = await res.json();
        setCampaignActionError(
          result.error || "Campaign could not be deleted.",
        );
        return;
      }
      if (res.ok) {
        setCampaignActionError("");
        if (activeDetailCampaign?.id === id) {
          navigateCampaign(null);
        }
        fetchCampaigns();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };
  const campaignLeads = leads;
  const campaignLeadError = campaignError;
  // Campaign cohort is independent of the worklist's current filters.

  const matchedLeadsForActiveCampaign = useMemo(() => {
    if (!activeDetailCampaign) return [];
    return campaignLeads.filter(
      (l) =>
        matchesCampaign(l, activeDetailCampaign) &&
        campaigns.filter((c) => matchesCampaign(l, c)).length === 1,
    );
  }, [activeDetailCampaign, campaignLeads, campaigns]);
  const getTypeIcon = (type: CampaignType | "") => {
    switch (type) {
      case "campus_seminar":
        return <GraduationCap className="w-4 h-4 crm-campaign-muted" />;
      case "enterprise_roadshow":
        return <Briefcase className="w-4 h-4 crm-campaign-muted" />;
      case "webinar_class":
        return <Video className="w-4 h-4 crm-campaign-muted" />;
      case "social_paid_ad":
        return <Flame className="w-4 h-4 crm-campaign-muted" />;
      case "community_referral":
        return <Users className="w-4 h-4 crm-campaign-muted" />;
      case "education_fair":
        return <Award className="w-4 h-4 crm-campaign-muted" />;
      default:
        return <Sparkles className="w-4 h-4 crm-campaign-muted" />;
    }
  };
  return (
    <div
      className="crm-campaigns crm-detail-root space-y-5 animate-in fade-in duration-300"
      data-theme={isLight ? "light" : "dark"}
      style={
        { "--crm-shell-height": `${shellHeight}px` } as React.CSSProperties
      }
    >
      <CampaignWorkspaceHeading
        onCreate={!requestedCampaign ? handleOpenCreateWizard : undefined}
        onRefresh={!requestedCampaign ? () => void fetchCampaigns() : undefined}
        refreshing={isLoading}
        showSubtitle={!requestedCampaign}
        lang={lang}
        title={t("Marketing Campaigns", "营销活动中心")}
        reviewing={campaignArea === "sources"}
        canManage={canManageCampaigns}
        isLight={isLight}
        state={sourceReviewState(
          unknownSourcesPending,
          promotionReviews,
          reviewCountsLoading,
        )}
        onOpen={() => openSourceReview()}
        onReturn={returnFromSourceReview}
        headingRef={workspaceHeading}
      />
      {campaignArea === "sources" && canManageCampaigns && (
        <section aria-label={u("Source review")}>
          <CrmCampaignSources
            initialIssue={pageParams.get("sourceIssue") || undefined}
            promotionCampaign={campaigns.find(
              (c) => c.id === pageParams.get("sourceCampaign"),
            )}
            onClearPromotionCampaign={clearPromotionFilter}
            key={workspaceEpoch}
            onStateChange={(state) => {
              materialState.current = state;
            }}
            lang={lang}
            isLight={isLight}
            campaigns={campaigns}
            onChanged={fetchCampaigns}
            onLead={onSelectLeadInCrm}
          />
        </section>
      )}
      {campaignArea === "campaigns" && !requestedCampaign && (
        <section className="campaign-home" aria-label={u("Campaign catalogue")}>
          <CampaignOverview
            lang={lang}
            campaigns={filteredCampaigns}
            expanded={showCampaignOverview}
            onToggle={() => setShowCampaignOverview((v) => !v)}
            loading={isLoading}
            error={campaignError}
            onRetry={() => void fetchCampaigns()}
            isLight={isLight}
          />
          <div className="campaign-home-toolbar">
            <label className="campaign-list-search">
              <Search size={16} />
              <input
                aria-label={u("Search campaigns")}
                placeholder={u("Search name or code…")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            <CrmSelect
              label={u("Campaign status filter")}
              lang={lang}
              isLight={isLight}
              value={selectedStatus}
              onChange={setSelectedStatus}
            >
              <option value="All">{u("All statuses")}</option>
              {CAMPAIGN_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {u(o.labelEn)}
                </option>
              ))}
            </CrmSelect>
            <CrmSelect
              label={u("Campaign type filter")}
              lang={lang}
              isLight={isLight}
              value={selectedType}
              onChange={setSelectedType}
            >
              <option value="All">{u("All campaign types")}</option>
              {CAMPAIGN_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {u(o.labelEn)}
                </option>
              ))}
            </CrmSelect>
          </div>
          <p className="campaign-list-count" aria-live="polite">
            {campaignCollectionLabel(filteredCampaigns, lang)}
          </p>
          <p className="campaign-catalogue-scope">
            {u(
              "Current lifetime totals · Customers within your access scope. Campaign statuses are manually maintained; saved links describe configuration, not measured traffic.",
            )}
          </p>
          {canManageCampaigns &&
            !reviewCountsLoading &&
            !promotionReviews.available && (
              <p className="campaign-hint" role="status">
                {u("Promotion review counts unavailable.")}{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void fetchCampaigns()}
                >
                  {u("Retry")}
                </button>{" "}
                {u("or open Source review to check.")}
              </p>
            )}
          {campaignError ? (
            <p role="alert">
              {u("Campaigns unavailable.")}{" "}
              <button onClick={() => void fetchCampaigns()}>
                {u("Retry")}
              </button>
            </p>
          ) : isLoading && !campaigns.length ? (
            <p role="status">{u("Loading campaigns…")}</p>
          ) : !filteredCampaigns.length ? (
            <p>
              {u("No matching campaigns.")}{" "}
              <button
                className="underline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStatus("All");
                  setSelectedType("All");
                }}
              >
                {u("Reset filters")}
              </button>
            </p>
          ) : (
            <CampaignCards
              campaigns={filteredCampaigns}
              lang={lang}
              isLight={isLight}
              reviewCounts={promotionReviews}
              onReview={
                canManageCampaigns ? reviewCampaignPromotions : undefined
              }
              onOpen={(c, tab) => openCampaign(c, tab || "overview")}
              onEdit={
                canManageCampaigns ? (c) => handleOpenEditWizard(c) : undefined
              }
            />
          )}
        </section>
      )}
      {campaignArea === "campaigns" && requestedCampaign && (
        <div
          className={`campaign-split ${listCollapsed ? "is-collapsed" : ""} ${requestedCampaign ? "has-selection" : ""} ${mobileList ? "show-mobile-list" : ""}`}
        >
          <aside className="campaign-sidebar" aria-label={u("Campaign list")}>
            <div className="campaign-sidebar-heading">
              <h2>{u("Campaigns")}</h2>
              <button
                className="campaign-list-collapse"
                aria-label={u("Collapse campaign list")}
                onClick={() => {
                  setListCollapsed(true);
                  requestAnimationFrame(() => listToggle.current?.focus());
                }}
              >
                <PanelLeftClose size={18} />
              </button>
            </div>
            <label className="campaign-list-search">
              <Search size={16} />
              <input
                ref={listSearch}
                aria-label={u("Search campaigns")}
                placeholder={u("Search name or code…")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            <CrmSelect
              label={u("Campaign status filter")}
              lang={lang}
              isLight={isLight}
              value={selectedStatus}
              onChange={setSelectedStatus}
            >
              <option value="All">{u("All statuses")}</option>
              {CAMPAIGN_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {u(o.labelEn)}
                </option>
              ))}
            </CrmSelect>
            <details className="campaign-list-extra">
              <summary>{u("More filters")}</summary>
              <CrmSelect
                label={u("Campaign type filter")}
                lang={lang}
                isLight={isLight}
                value={selectedType}
                onChange={setSelectedType}
              >
                <option value="All">{u("All campaign types")}</option>
                {CAMPAIGN_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {u(o.labelEn)}
                  </option>
                ))}
              </CrmSelect>
            </details>
            <div className="campaign-list-actions">
              {canManageCampaigns && (
                <button
                  className="campaign-workspace-action campaign-primary"
                  onClick={handleOpenCreateWizard}
                >
                  <Plus size={16} />
                  {u("Create campaign")}
                </button>
              )}
              <button
                className="campaign-workspace-action"
                aria-label={u("Refresh campaigns")}
                onClick={() => void fetchCampaigns()}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <p className="campaign-list-count" aria-live="polite">
              {campaignCollectionLabel(filteredCampaigns, lang)}
            </p>
            <div className="campaign-list-items">
              {campaignError ? (
                <p role="alert">
                  {u("Campaigns unavailable. Refresh to retry.")}
                </p>
              ) : isLoading && !campaigns.length ? (
                <p role="status">{u("Loading campaigns…")}</p>
              ) : filteredCampaigns.length === 0 ? (
                <p>
                  {u("No matching campaigns.")}{" "}
                  <button
                    className="underline"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedStatus("All");
                      setSelectedType("All");
                    }}
                  >
                    {u("Reset filters")}
                  </button>
                </p>
              ) : (
                [
                  ...filteredCampaigns.filter((c) => !isOrganicCampaign(c)),
                  ...filteredCampaigns.filter(isOrganicCampaign),
                ].map((c) => (
                  <button
                    key={c.id}
                    ref={
                      c.id === requestedCampaign ? selectedListItem : undefined
                    }
                    className="campaign-list-item"
                    data-system-source={isOrganicCampaign(c)}
                    title={c.code}
                    aria-current={
                      c.id === requestedCampaign ? "page" : undefined
                    }
                    onClick={() => openCampaign(c)}
                  >
                    {isOrganicCampaign(c) && (
                      <span className="campaign-list-source-label">
                        {u("System source")}
                      </span>
                    )}
                    <CampaignSidebarSummary
                      campaign={c}
                      lang={lang}
                      reviewCount={
                        promotionReviews.available
                          ? promotionReviews.counts[c.id]
                          : undefined
                      }
                    />
                  </button>
                ))
              )}
            </div>
          </aside>
          <div className="campaign-detail-column">
            <div className="campaign-list-access">
              <button
                ref={listToggle}
                className="campaign-workspace-action"
                aria-expanded={!listCollapsed}
                onClick={() => {
                  setListCollapsed(false);
                  setMobileList(true);
                }}
              >
                <PanelLeftOpen size={17} />
                <span>{u("Show campaign sidebar")}</span>
              </button>
              {mobileList && requestedCampaign && (
                <button
                  className="campaign-workspace-action"
                  onClick={() => setMobileList(false)}
                >
                  {u("Return to selected campaign")}
                </button>
              )}
            </div>

            {requestedCampaign && !activeDetailCampaign && (
              <section aria-live="polite">
                <p>
                  {isLoading
                    ? u("Loading campaign…")
                    : campaignError
                      ? u(
                          "Campaign unavailable. Retry to load its saved information.",
                        )
                      : u("Campaign not found or unavailable to your account.")}
                </p>
                <button
                  className="campaign-workspace-action"
                  onClick={() => void fetchCampaigns()}
                >
                  {u("Retry")}
                </button>
                <button
                  className="campaign-workspace-action"
                  onClick={closeCampaign}
                >
                  {u("Back to campaign list")}
                </button>
              </section>
            )}
            {/* Dedicated campaign workspace; normal document scrolling, no overlay. */}
            {activeDetailCampaign && (
              <section
                className="campaign-workpage crm-detail-panel"
                aria-labelledby="campaign-page-title"
              >
                <CrmDetailHeader
                  titleId="campaign-page-title"
                  titleRef={pageHeading}
                  title={
                    isOrganicCampaign(activeDetailCampaign)
                      ? organicCampaignName(lang)
                      : campaignName(activeDetailCampaign, lang)
                  }
                  meta={
                    <>
                      <code>{activeDetailCampaign.code}</code>
                      <span className="campaign-workpage-status">
                        {organicDetail
                          ? u("Read-only · System source")
                          : u(
                              CAMPAIGN_STATUS_OPTIONS.find(
                                (o) => o.value === activeDetailCampaign.status,
                              )?.labelEn || activeDetailCampaign.status,
                            )}
                      </span>
                    </>
                  }
                  actions={
                    <>
                      {canManageCampaigns &&
                        !isOrganicCampaign(activeDetailCampaign) && (
                          <button
                            className="campaign-workspace-action"
                            onClick={() =>
                              handleOpenEditWizard(activeDetailCampaign)
                            }
                          >
                            <Edit3 size={16} />
                            {u("Edit information")}
                          </button>
                        )}
                      <button
                        type="button"
                        className="crm-work-button"
                        title={u("Return to campaign cards")}
                        onClick={closeCampaign}
                      >
                        {u("Campaign list")}
                      </button>
                    </>
                  }
                />
                <CrmDetailTabs
                  id="crm-campaign"
                  contentId="crm-campaign-content"
                  label={u("Campaign sections")}
                  value={detailTab}
                  onChange={(tab, keyboard) =>
                    changeDetailTab(tab as DetailTab, keyboard)
                  }
                  tabs={
                    organicDetail
                      ? [
                          {
                            id: "leads",
                            label: u("Results & customers"),
                            icon: Users,
                          },
                          {
                            id: "info",
                            label: u("Source information"),
                            icon: FileText,
                          },
                        ]
                      : [
                          {
                            id: "overview",
                            label: u("Promotion links"),
                            icon: QrCode,
                          },
                          {
                            id: "info",
                            label: u("Campaign information"),
                            icon: Calendar,
                          },
                          {
                            id: "collaterals",
                            label: u("Materials"),
                            icon: FileText,
                          },
                          {
                            id: "leads",
                            label: u("Results & customers"),
                            icon: Users,
                          },
                        ]
                  }
                />
                <div
                  id="crm-campaign-content"
                  className="campaign-workpage-body crm-detail-body space-y-5"
                  role="tabpanel"
                  aria-labelledby={`crm-campaign-tab-${detailTab}`}
                >
                  {saveNotice && (
                    <CrmSaveFeedback lang={lang} state="saved">
                      {u(
                        "Campaign information saved. The campaign code and existing links stay unchanged.",
                      )}
                    </CrmSaveFeedback>
                  )}
                  {/* TAB 1: OVERVIEW */}
                  {detailTab === "overview" && (
                    <div className="space-y-4">
                      <CampaignPromotionLinks
                        lang={lang}
                        key={activeDetailCampaign.id + workspaceEpoch}
                        campaign={activeDetailCampaign}
                        isLight={isLight}
                        canManage={
                          canManageCampaigns &&
                          !isOrganicCampaign(activeDetailCampaign)
                        }
                        onSaved={(c) => {
                          updateCampaign(c);
                          void fetchCampaigns();
                        }}
                        onStateChange={(state) => {
                          materialState.current = state;
                        }}
                      />
                    </div>
                  )}
                  {detailTab === "info" && (
                    <>
                      {organicDetail ? (
                        <section className="campaign-info-section">
                          <h3>{u("Non-campaign source · System source")}</h3>
                          <p>
                            {u(
                              "Customers whose first registration did not carry a specific campaign code, including entries using the reserved home and organic codes. This does not identify organic search or prove the traffic was unpaid. For example, an advertising link with UTM parameters but no campaign code can appear here. Unknown campaign codes remain separate for verification.",
                            )}
                          </p>
                          <p>
                            {u(
                              "Existing first-touch attribution is retained when a customer returns through another campaign.",
                            )}
                          </p>
                          <p>
                            {u(
                              "This source is read-only. It does not require promotion entries or campaign materials.",
                            )}
                          </p>
                          <dl className="campaign-info-grid">
                            <div>
                              <dt>{u("Source code")}</dt>
                              <dd>
                                <code>{activeDetailCampaign.code}</code>
                              </dd>
                            </div>
                            <div>
                              <dt>{u("Management")}</dt>
                              <dd>{u("System managed")}</dd>
                            </div>
                          </dl>
                        </section>
                      ) : (
                        <CampaignInformation
                          lang={lang}
                          campaign={activeDetailCampaign}
                        />
                      )}
                      {canManageCampaigns &&
                        !isOrganicCampaign(activeDetailCampaign) && (
                          <details className="campaign-info-section">
                            <summary>{u("More campaign actions")}</summary>
                            <p className="campaign-hint">
                              {u(
                                "Archive a campaign by changing its status in Edit information. Campaigns with promotion links or verified source associations cannot be deleted.",
                              )}
                            </p>
                            <button
                              className="campaign-workspace-action"
                              onClick={() =>
                                void handleDeleteCampaign(
                                  activeDetailCampaign.id,
                                  activeDetailCampaign.name,
                                )
                              }
                            >
                              {u("Delete campaign")}
                            </button>
                            {campaignActionError && (
                              <p role="alert">
                                {crmError(campaignActionError, lang)}
                              </p>
                            )}
                          </details>
                        )}
                    </>
                  )}

                  {/* TAB 2: SOURCED LEADS (CLOSED-LOOP) */}
                  {detailTab === "leads" && (
                    <div className="space-y-3">
                      <CrmCampaignMeasures
                        campaigns={[activeDetailCampaign]}
                        lang={lang}
                        isLight={isLight}
                        detail
                        systemSource={organicDetail}
                        scopeLabel={
                          organicDetail ? u("This system source") : undefined
                        }
                      />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">
                          {organicDetail
                            ? u("Customers attributed to this source:")
                            : t(
                                "Leads automatically matched from CRM:",
                                "由该活动短链自动沉淀至 CRM 的潜客学员：",
                              )}
                        </span>
                        <span className="font-bold text-primary-600">
                          {matchedLeadsForActiveCampaign.length}{" "}
                          {organicDetail
                            ? u("Customers")
                            : t("Leads Total", "条线索")}
                        </span>
                      </div>

                      {campaignLeadError ? (
                        <p role="alert">
                          {t(
                            "Campaign customer list unavailable; reopen to retry.",
                            "活动客户列表暂不可用，请重新打开重试。",
                          )}
                        </p>
                      ) : matchedLeadsForActiveCampaign.length === 0 ? (
                        <div
                          className={`p-8 text-center rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
                        >
                          <Users className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-60" />
                          <p className="text-xs text-slate-400">
                            {organicDetail
                              ? u(
                                  "No customers are attributed to this system source yet.",
                                )
                              : t(
                                  "No leads have entered through this campaign short link yet.",
                                  "暂无学员通过该专属渠道短链完成进线留资。",
                                )}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {matchedLeadsForActiveCampaign.map((lead) => (
                            <div
                              key={lead.id}
                              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${isLight ? "bg-white border-slate-200 hover:border-slate-300" : "bg-slate-900 border-slate-800 hover:border-slate-700"}`}
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs truncate">
                                    {lead.fullName}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${lead.tier === "Hot" ? "bg-amber-500/20 text-amber-600" : "bg-slate-500/10 text-slate-500"}`}
                                  >
                                    {crmValue(lead.tier, lang)}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary-500/10 text-primary-600 font-medium">
                                    {crmValue(lead.currentStage, lang)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                  <span>
                                    {u("WA:")} {lead.whatsapp}
                                  </span>
                                  <span>•</span>
                                  <span className="truncate">
                                    {crmValue(lead.goal, lang)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {lead.revenue ? (
                                  <span className="text-xs font-mono font-bold text-emerald-600">
                                    {" "}
                                    {u("Rp")}{" "}
                                    {(lead.revenue / 1000000).toFixed(1)}
                                    {t("M", "百万")}
                                  </span>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onSelectLeadInCrm) {
                                      onSelectLeadInCrm(lead.id);
                                    }
                                    if (onNavigateTab) {
                                      onNavigateTab("leads");
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{t("View in CRM", "在CRM跟进")}</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {detailTab === "collaterals" && (
                    <CampaignMaterials
                      key={activeDetailCampaign.id + workspaceEpoch}
                      campaign={activeDetailCampaign}
                      lang={lang}
                      isLight={isLight}
                      canEdit={
                        canManageCampaigns &&
                        !isOrganicCampaign(activeDetailCampaign)
                      }
                      onStateChange={(dirty, busy) => {
                        materialState.current = { dirty, busy };
                      }}
                      onSaved={(c) => {
                        updateCampaign(c);
                        void fetchCampaigns();
                      }}
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
      {pendingLeave && (
        <CrmDiscardDialog
          lang={lang}
          isLight={isLight}
          onKeep={() => setPendingLeave(null)}
          onDiscard={finishLeave}
        />
      )}
      {editor !== undefined && (
        <CampaignEditor
          campaign={editor}
          lang={lang}
          isLight={isLight}
          onClose={() => setEditor(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
