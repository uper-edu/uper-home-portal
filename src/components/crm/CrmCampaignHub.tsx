import {CrmCampaignSources} from "./CrmCampaignSources";
import {isOrganicCampaign,organicCampaignName} from '../../utils/organicCampaign';
import {CrmCampaignMeasures} from "./CrmCampaignMeasures";
import { campaignChatLink, matchesCampaign } from "../../utils/crmCampaignLink";
import { CrmSelect } from "./CrmSelect";
import { crmId } from "../../utils/crmIndonesian";
import { crmValue, crmError, crmLocale } from "../../utils/crmLanguage";
import React, { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import {
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
  canManageCampaigns=false,
  isLight,
  lang,
  leads,
  onSelectLeadInCrm,
  onNavigateTab,
}: CrmCampaignHubProps) {
  const t = (en: string, zh: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? zh : en;
  const [campaigns, setCampaigns] = useState<CrmCampaignRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [campaignError,setCampaignError]=useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  // Active view: 'cards' | 'table'
  const [viewLayout, setViewLayout] = useState<"cards" | "table">("cards");
  // QR Modal State
  const [activeQrCampaign, setActiveQrCampaign] =
    useState<CrmCampaignRecord | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Detail Drawer State
  const [activeDetailCampaign, setActiveDetailCampaign] =
    useState<CrmCampaignRecord | null>(null);
  const [detailTab, setDetailTab] = useState<
    "overview" | "leads" | "collaterals" | "print" | "analytics"
  >("overview");
  // Create / Edit Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
    null,
  );
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  // Wizard Form Fields
  const [formName, setFormName] = useState("");
  const [formNameEn, setFormNameEn] = useState("");
  const [formType, setFormType] = useState<CampaignType>("campus_seminar");
  const [formStatus, setFormStatus] = useState<CampaignStatus>("planning");
  const [formOrganizer, setFormOrganizer] = useState("");
  const [formStartDate, setFormStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [formEndDate, setFormEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [formStartTime, setFormStartTime] = useState("14:00");
  const [formEndTime, setFormEndTime] = useState("16:30");
  const [formScheduleNotes, setFormScheduleNotes] = useState("");
  const [formLocationType, setFormLocationType] =
    useState<CampaignLocationType>("offline");
  const [formCity, setFormCity] = useState("Jakarta");
  const [formVenue, setFormVenue] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formOnlineLink, setFormOnlineLink] = useState("");
  const [formAudienceInput, setFormAudienceInput] =
    useState("印尼大学生, 在职白领");
  const [formTopicsInput, setFormTopicsInput] = useState(
    "中资企业高薪中文岗位就业直推, HSK 3-4级职场急救提分与官方定级",
  );
  const [formSpeakerName, setFormSpeakerName] = useState("");
  const [formSpeakerTitle, setFormSpeakerTitle] = useState("");
  // Bound UTM & Code
  const [formCode, setFormCode] = useState("");
  const [formSource, setFormSource] = useState("campus_offline");
  const [formMedium, setFormMedium] = useState("qr_poster");
  const [formHook, setFormHook] = useState<HookType>("hsk_assessment");
  const [formContext, setFormContext] =
    useState<HookContextType>("campus_career_talk");
  const [formDefaultLang, setFormDefaultLang] = useState<"id" | "en" | "zh">(
    "id",
  );
  const [formBudgetCost, setFormBudgetCost] = useState<number>(3000000);
  const [enableUtmConfig, setEnableUtmConfig] = useState<boolean>(false);
  // Automatically sync UTM context and hook based on campaign type selection
  useEffect(() => {
    if (formType === "campus_seminar") {
      setFormContext("campus_career_talk");
      setFormHook("hsk_assessment");
      setFormSource("campus_offline");
      setFormMedium("qr_poster");
    } else if (formType === "enterprise_roadshow") {
      setFormContext("school_talk");
      setFormHook("consultation");
      setFormSource("enterprise_offline");
      setFormMedium("flyer");
    } else if (formType === "webinar_class") {
      setFormContext("webinar");
      setFormHook("trial_class");
      setFormSource("whatsapp");
      setFormMedium("social");
    } else if (formType === "education_fair") {
      setFormContext("expo");
      setFormHook("scholarship_materials");
      setFormSource("edufair");
      setFormMedium("qr_poster");
    } else if (formType === "social_paid_ad") {
      setFormContext("paid_social");
      setFormHook("hsk_assessment");
      setFormSource("instagram");
      setFormMedium("cpc");
    } else {
      setFormContext("referral");
      setFormHook("consultation");
      setFormSource("whatsapp");
      setFormMedium("social");
    }
  }, [formType]);
  // AI Assets
  const [formPosterHeading, setFormPosterHeading] = useState("");
  const [formPosterSubheading, setFormPosterSubheading] = useState("");
  const [formSocialCopy, setFormSocialCopy] = useState("");
  const [formWhatsappInvite, setFormWhatsappInvite] = useState("");
  const [formWelcomeGreeting, setFormWelcomeGreeting] = useState("");
  const [formPresentationOutline, setFormPresentationOutline] = useState("");
  const [generatedIdAssets, setGeneratedIdAssets] = useState<any>(null);
  const [generatedEnAssets, setGeneratedEnAssets] = useState<any>(null);
  const [previewLang, setPreviewLang] = useState<"id" | "en">("id");
  const [activeAssetTab, setActiveAssetTab] = useState<
    "poster" | "social" | "whatsapp" | "greeting" | "outline"
  >("poster");
  const handleSwitchPreviewLang = (lang: "id" | "en") => {
    const currentSnapshot = {
      posterHeading: formPosterHeading,
      posterSubheading: formPosterSubheading,
      socialCopy: formSocialCopy,
      whatsappInvitation: formWhatsappInvite,
      chatWelcomeGreeting: formWelcomeGreeting,
      presentationOutline: formPresentationOutline,
    };
    if (previewLang === "id") {
      setGeneratedIdAssets(currentSnapshot);
    } else {
      setGeneratedEnAssets(currentSnapshot);
    }
    setPreviewLang(lang);
    const target =
      lang === "id"
        ? generatedIdAssets || currentSnapshot
        : generatedEnAssets || currentSnapshot;
    if (target) {
      setFormPosterHeading(target.posterHeading || "");
      setFormPosterSubheading(target.posterSubheading || "");
      setFormSocialCopy(target.socialCopy || "");
      setFormWhatsappInvite(target.whatsappInvitation || "");
      setFormWelcomeGreeting(target.chatWelcomeGreeting || "");
      setFormPresentationOutline(target.presentationOutline || "");
    }
  };
  // Fetch campaigns
  const fetchCampaigns = async () => {
    setIsLoading(true);
    setCampaignError(false);
    try {
      const res = await fetch("/api/crm/campaigns");
      if(!res.ok)throw Error('Campaign data unavailable');
      const data = await res.json();
      if (data?.campaigns) {
        setCampaigns(data.campaigns);
      }
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
  // Generate QR Code data URL whenever activeQrCampaign changes
  useEffect(() => {
    if (activeQrCampaign) {
      const url = campaignChatLink(activeQrCampaign.code);
      QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      })
        .then((dataUri) => {
          setQrDataUrl(dataUri);
        })
        .catch((err) => {
          console.error("Failed to generate QR code:", err);
        });
    } else {
      setQrDataUrl("");
    }
  }, [activeQrCampaign]);
  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (selectedType !== "All" && c.type !== selectedType) return false;
      if (selectedStatus !== "All" && c.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inName = c.name.toLowerCase().includes(query);
        const inNameEn = c.nameEn.toLowerCase().includes(query);
        const inCode = c.code.toLowerCase().includes(query);
        const inVenue = c.venue.toLowerCase().includes(query);
        const inCity = c.city.toLowerCase().includes(query);
        const inOrganizer = c.organizer.toLowerCase().includes(query);
        if (
          !inName &&
          !inNameEn &&
          !inCode &&
          !inVenue &&
          !inCity &&
          !inOrganizer
        ) {
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
  // Open Create Wizard
  const handleOpenCreateWizard = () => {
    setEditingCampaignId(null);
    setWizardStep(1);
    setFormName("");
    setFormNameEn("");
    setFormType("" as any);
    setFormStatus("" as any);
    setFormOrganizer("");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate(new Date().toISOString().split("T")[0]);
    setFormStartTime("");
    setFormEndTime("");
    setFormScheduleNotes("");
    setFormLocationType("" as any);
    setFormCity("");
    setFormVenue("");
    setFormAddress("");
    setFormOnlineLink("");
    setFormAudienceInput("");
    setFormTopicsInput("");
    setFormSpeakerName("");
    setFormSpeakerTitle("");
    setFormCode(`c_${Date.now().toString().slice(-6)}`);
    setFormSource("" as any);
    setFormMedium("" as any);
    setFormHook("" as any);
    setFormContext("campus_career_talk");
    setFormDefaultLang("id");
    setFormBudgetCost("" as any);
    setFormPosterHeading("");
    setFormPosterSubheading("");
    setFormSocialCopy("");
    setFormWhatsappInvite("");
    setFormWelcomeGreeting("");
    setFormPresentationOutline("");
    setEnableUtmConfig(false);
    setIsWizardOpen(true);
  };
  // Open Edit Wizard
  const handleOpenEditWizard = (c: CrmCampaignRecord) => {
    setEditingCampaignId(c.id);
    setWizardStep(1);
    setFormName(c.name);
    setFormNameEn(c.nameEn);
    setFormType(c.type);
    setFormStatus(c.status);
    setFormOrganizer(c.organizer);
    setFormStartDate(c.startDate);
    setFormEndDate(c.endDate);
    setFormStartTime(c.startTime);
    setFormEndTime(c.endTime);
    setFormScheduleNotes(c.scheduleNotes || "");
    setFormLocationType(c.locationType);
    setFormCity(c.city);
    setFormVenue(c.venue);
    setFormAddress(c.address);
    setFormOnlineLink(c.onlineLink || "");
    setFormAudienceInput(c.targetAudience.join(", "));
    setFormTopicsInput(c.keyTopics.join(", "));
    setFormSpeakerName(c.speakers?.[0]?.name || "");
    setFormSpeakerTitle(c.speakers?.[0]?.title || "");
    setFormCode(c.code);
    setFormSource(c.boundUtm.utm_source);
    setFormMedium(c.boundUtm.utm_medium);
    setFormHook(c.boundUtm.defaultHook);
    setFormContext(c.boundUtm.defaultContext);
    setFormDefaultLang(c.boundUtm.defaultLang || "id");
    setFormBudgetCost(c.stats.budgetCost || 0);
    setFormPosterHeading(c.aiAssets.posterHeading);
    setFormPosterSubheading(c.aiAssets.posterSubheading);
    setFormSocialCopy(c.aiAssets.socialCopy);
    setFormWhatsappInvite(c.aiAssets.whatsappInvitation);
    setFormWelcomeGreeting(c.aiAssets.chatWelcomeGreeting);
    setFormPresentationOutline(c.aiAssets.presentationOutline);
    setGeneratedIdAssets(
      c.aiAssets.idAssets || {
        posterHeading: c.aiAssets.posterHeading,
        posterSubheading: c.aiAssets.posterSubheading,
        socialCopy: c.aiAssets.socialCopy,
        whatsappInvitation: c.aiAssets.whatsappInvitation,
        chatWelcomeGreeting: c.aiAssets.chatWelcomeGreeting,
        presentationOutline: c.aiAssets.presentationOutline,
      },
    );
    setGeneratedEnAssets(
      c.aiAssets.enAssets || {
        posterHeading: c.aiAssets.posterHeading,
        posterSubheading: c.aiAssets.posterSubheading,
        socialCopy: c.aiAssets.socialCopy,
        whatsappInvitation: c.aiAssets.whatsappInvitation,
        chatWelcomeGreeting: c.aiAssets.chatWelcomeGreeting,
        presentationOutline: c.aiAssets.presentationOutline,
      },
    );
    setPreviewLang("id");
    setEnableUtmConfig(
      Boolean(
        c.boundUtm?.utm_source &&
        [
          "instagram",
          "facebook",
          "tiktok",
          "google",
          "cpc",
          "youtube",
          "linkedin",
        ].includes(c.boundUtm.utm_source),
      ),
    );
    setIsWizardOpen(true);
  };
  // Trigger AI Generator
  const handleGenerateAiAssets = async () => {
    setIsAiGenerating(true);
    try {
      const audiences = formAudienceInput
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const topics = formTopicsInput
        .split(/[,，;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/crm/campaigns/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName || "UPER 官方宣讲会",
          nameEn: formNameEn,
          type: formType,
          city: formCity,
          venue: formVenue,
          startDate: formStartDate,
          startTime: formStartTime,
          endTime: formEndTime,
          targetAudience: audiences,
          keyTopics: topics,
          organizer: formOrganizer,
          code: formCode,
        }),
      });
      const data = await res.json();
      if (data?.aiAssets) {
        const idA = data.aiAssets.idAssets || data.aiAssets;
        const enA = data.aiAssets.enAssets || data.aiAssets;
        setGeneratedIdAssets(idA);
        setGeneratedEnAssets(enA);
        setPreviewLang("id");
        setFormPosterHeading(idA.posterHeading || "");
        setFormPosterSubheading(idA.posterSubheading || "");
        setFormSocialCopy(idA.socialCopy || "");
        setFormWhatsappInvite(idA.whatsappInvitation || "");
        setFormWelcomeGreeting(idA.chatWelcomeGreeting || "");
        setFormPresentationOutline(idA.presentationOutline || "");
      }
    } catch (err) {
      console.error("[AI ASSET GENERATION] Error:", err);
    } finally {
      setIsAiGenerating(false);
    }
  };
  // Save Campaign (Create or Update)
  const handleSaveCampaign = async () => {
    if (!formName.trim()) {
      alert(t("Please enter campaign name", "请输入活动名称"));
      return;
    }
    if (formStartDate && formEndDate && formEndDate < formStartDate) {
      alert(
        t(
          "End Date cannot be earlier than Start Date",
          "活动结束日期不能早于开始日期",
        ),
      );
      return;
    }
    const audiences = formAudienceInput
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const topics = formTopicsInput
      .split(/[,，;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const currentSnapshot = {
      posterHeading: formPosterHeading,
      posterSubheading: formPosterSubheading,
      socialCopy: formSocialCopy,
      whatsappInvitation: formWhatsappInvite,
      chatWelcomeGreeting: formWelcomeGreeting,
      presentationOutline: formPresentationOutline,
    };
    const finalIdAssets =
      previewLang === "id"
        ? currentSnapshot
        : generatedIdAssets || currentSnapshot;
    const finalEnAssets =
      previewLang === "en"
        ? currentSnapshot
        : generatedEnAssets || currentSnapshot;
    const payload = {
      name: formName.trim(),
      nameEn: formNameEn.trim() || formName.trim(),
      type: formType,
      status: formStatus,
      organizer: formOrganizer.trim() || "Marketing Operations",
      startDate: formStartDate,
      endDate: formEndDate,
      startTime: formStartTime,
      endTime: formEndTime,
      scheduleNotes: formScheduleNotes.trim(),
      locationType: formLocationType,
      city: formCity.trim(),
      venue: formVenue.trim(),
      address: formAddress.trim(),
      onlineLink: formOnlineLink.trim(),
      targetAudience: audiences,
      keyTopics: topics,
      speakers: formSpeakerName
        ? [{ name: formSpeakerName, title: formSpeakerTitle }]
        : [],
      code: formCode.trim() || `c_${Date.now().toString().slice(-6)}`,
      boundUtm: {
        utm_source: formSource,
        utm_medium: formMedium,
        utm_campaign: formCode.trim(),
        defaultHook: formHook,
        defaultContext: formContext,
        defaultLang: formDefaultLang,
      },
      aiAssets: {
        posterHeading: finalIdAssets.posterHeading || formName,
        posterSubheading:
          finalIdAssets.posterSubheading || `${formStartDate} @ ${formVenue}`,
        socialCopy: finalIdAssets.socialCopy || `UPER 活动：${formName}`,
        whatsappInvitation:
          finalIdAssets.whatsappInvitation ||
          `Kami mengundang Anda ke ${formName}`,
        chatWelcomeGreeting:
          finalIdAssets.chatWelcomeGreeting ||
          `欢迎来到 ${formName} 专属通道！`,
        presentationOutline:
          finalIdAssets.presentationOutline ||
          "【宣讲会提纲】\n1. 介绍\n2. 方案\n3. 现场测评",
        deskTentBullets: [
          "现场免费定级测评",
          "名师一对一答疑与学习规划",
          "活动专属早鸟特惠权益",
        ],
        idAssets: finalIdAssets,
        enAssets: finalEnAssets,
      },
      stats: {
        budgetCost: formBudgetCost || 0,
      },
    };
    try {
      const url = editingCampaignId
        ? `/api/crm/campaigns/${editingCampaignId}`
        : "/api/crm/campaigns";
      const method = editingCampaignId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsWizardOpen(false);
        fetchCampaigns();
      }
    } catch (err) {
      console.error("[SAVE CAMPAIGN ERROR]", err);
    }
  };
  // Delete Campaign
  const handleDeleteCampaign = async (id: string, name: string) => {
    if (
      !window.confirm(
        t(
          `Are you sure you want to delete campaign "${name}"?`,
          `确定要删除获客活动「${name}」吗？`,
        ),
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/crm/campaigns/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (activeDetailCampaign?.id === id) {
          setActiveDetailCampaign(null);
        }
        fetchCampaigns();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };
  const [campaignLeads,setCampaignLeads]=useState<CrmLeadRecord[]>([]);
  const [campaignLeadError,setCampaignLeadError]=useState(false);
  useEffect(()=>{if(!activeDetailCampaign)return;let alive=true;setCampaignLeadError(false);fetch('/api/crm/leads?ownership=all&workScope=all').then(async r=>{if(!r.ok)throw Error('unavailable');const d=await r.json();if(alive)setCampaignLeads(d.leads||[]);}).catch(()=>{if(alive){setCampaignLeads([]);setCampaignLeadError(true);}});return()=>{alive=false};},[activeDetailCampaign?.id]);
  // Campaign cohort is independent of the worklist's current filters.

  const matchedLeadsForActiveCampaign = useMemo(() => {
    if (!activeDetailCampaign) return [];
    return campaignLeads.filter(l => matchesCampaign(l,activeDetailCampaign)&&campaigns.filter(c=>matchesCampaign(l,c)).length===1);
  }, [activeDetailCampaign, campaignLeads,campaigns]);
  const getTypeIcon = (type: CampaignType) => {
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
    <div className="crm-campaigns space-y-5 animate-in fade-in duration-300" data-theme={isLight?"light":"dark"}>
      {campaignError?<p role="alert">{t('Campaign metrics unavailable; refresh to retry.','营销指标暂不可用，请刷新重试。')}</p>:isLoading?<p role="status">{t('Loading campaign metrics…','正在加载营销指标…')}</p>:<CrmCampaignMeasures campaigns={filteredCampaigns} lang={lang} isLight={isLight}/>}
      {canManageCampaigns&&<CrmCampaignSources lang={lang} isLight={isLight} campaigns={campaigns} onChanged={fetchCampaigns} onLead={onSelectLeadInCrm}/>}
      {/* 2. Control Toolbar: Search, Filters & Action Button */}
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${isLight ? "bg-white border-slate-200/90 shadow-2xs" : "bg-slate-900 border-slate-800"}`}
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              aria-label={t("Search campaigns", "搜索活动")}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(
                "Search campaigns, code, venue...",
                "搜索活动名称、识别码、地点...",
              )}
              className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs outline-none transition-all border ${
                isLight
                  ? "bg-slate-50 border-slate-200 focus:bg-white focus:border-primary-500 text-slate-800"
                  : "bg-slate-800/80 border-slate-700 focus:bg-slate-800 focus:border-primary-400 text-slate-100"
              }`}
            />
          </div>

          {/* Type Filter */}
          <CrmSelect label={t("All Event Types", "所有活动形态")} value={selectedType} onChange={(value) => setSelectedType(value)} lang={lang} isLight={isLight} className="min-w-[160px]">
            <option value="All">{t("All Event Types", "所有活动形态")}</option>
            {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {lang === "id"
                  ? crmId(opt.labelEn)
                  : lang === "zh"
                    ? opt.labelZh
                    : opt.labelEn}
              </option>
            ))}
          </CrmSelect>

          {/* Status Filter */}
          <CrmSelect label={t("All Statuses", "所有状态")} value={selectedStatus} onChange={(value) => setSelectedStatus(value)} lang={lang} isLight={isLight} className="min-w-[160px]">
            <option value="All">{t("All Statuses", "所有状态")}</option>
            {CAMPAIGN_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {lang === "id"
                  ? crmId(opt.labelEn)
                  : lang === "zh"
                    ? opt.labelZh
                    : opt.labelEn}
              </option>
            ))}
          </CrmSelect>

          {/* Refresh button */}
          <button
            type="button"
            onClick={fetchCampaigns}
            disabled={isLoading}
            className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${isLight ? "bg-white border-slate-200 hover:bg-slate-50 text-slate-600" : "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"}`}
            title={t("Refresh campaigns data", "刷新活动列表")}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-primary-500" : ""}`}
            />
          </button>
        </div>

        {/* Right Actions: View switch & New Campaign */}
        <div className="flex items-center gap-2">
          {/* New Campaign Button */}
          {canManageCampaigns&&<button
            type="button"
            onClick={handleOpenCreateWizard}
            className="flex items-center gap-1.5 h-8 px-3.5 bg-primary-700 hover:bg-primary-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-primary-900/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("New Campaign", "新建营销活动")}</span>
          </button>}
        </div>
      </div>

      {/* 3. Campaign Card Grid */}
      {filteredCampaigns.length === 0 ? (
        <div
          className={`p-12 text-center rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
        >
          <Target className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3
            className={`text-base font-bold mb-1 ${isLight ? "text-slate-800" : "text-slate-200"}`}
          >
            {t("No marketing campaigns found", "未找到匹配的获客活动")}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            {t(
              "Create a campaign to generate clean tracking short links, bind UTM attributes, and activate AI-powered marketing materials.",
              "发起一次获客活动，为宣讲会或投放生成专属唯一渠道短链，全自动闭环追踪潜客来源与签约产值。",
            )}
          </p>
          {canManageCampaigns&&<button
            type="button"
            onClick={handleOpenCreateWizard}
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            {t("+ Create First Campaign", "+ 发起第一个营销活动")}
          </button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns.map((camp) => {
            const shortUrl = campaignChatLink(camp.code);
            const typeConfig = CAMPAIGN_TYPE_OPTIONS.find(
              (o) => o.value === camp.type,
            );
            const statusConfig = CAMPAIGN_STATUS_OPTIONS.find(
              (o) => o.value === camp.status,
            );
            return (
              <div
                key={camp.id}
                className={`rounded-2xl border transition-all flex flex-col justify-between group overflow-hidden ${
                  isLight
                    ? "bg-white border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Card Top: Type & Status */}
                <div className="p-4 sm:p-5 pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      {getTypeIcon(camp.type)}
                      <span
                        className={`text-xs font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`}
                      >
                        {lang === "id"
                          ? crmId(typeConfig?.labelEn)
                          : lang === "zh"
                            ? typeConfig?.labelZh
                            : typeConfig?.labelEn}
                      </span>
                    </div>

                    <span
                      className="crm-campaign-status" data-state={camp.status}
                    >
                      {lang === "id"
                        ? crmId(statusConfig?.labelEn)
                        : lang === "zh"
                          ? statusConfig?.labelZh
                          : statusConfig?.labelEn}
                    </span>
                  </div>

                  {/* Campaign Title */}
                  <button type="button"
                    onClick={() => {
                      setActiveDetailCampaign(camp);
                      setDetailTab("overview");
                    }}
                    className={`crm-campaign-title text-left font-bold text-sm sm:text-base leading-snug cursor-pointer transition-colors line-clamp-2 ${isLight ? "text-slate-900 hover:text-primary-600" : "text-slate-100 hover:text-primary-400"}`}
                  >
                    {isOrganicCampaign(camp)?organicCampaignName(lang):lang === "id"
                      ? camp.nameEn
                      : lang === "zh"
                        ? camp.name
                        : camp.nameEn}
                  </button>

                  {/* Schedule & Location */}
                  {isOrganicCampaign(camp)?<p className="crm-campaign-muted mt-2.5 text-xs">{lang==="zh"?"系统预置 · 长期有效 · 不可编辑或删除":lang==="id"?"Bawaan sistem · Selalu aktif · Tidak dapat diubah atau dihapus":"System preset · Always active · Cannot edit or delete"}</p>:<div className="crm-campaign-muted space-y-1 mt-2.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">
                        {camp.startDate}{" "}
                        {camp.startTime
                          ? `(${camp.startTime}-${camp.endTime})`
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">
                        {camp.venue} · {camp.city}
                      </span>
                    </div>
                  </div>

                  }
                  {/* Tracking Short Code Pill */}
                  <div
                    className={`mt-3 p-2 rounded-xl border flex items-center justify-between gap-2 ${isLight ? "bg-slate-50 border-slate-200/80" : "bg-slate-800/60 border-slate-700/60"}`}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="crm-campaign-muted text-xs">
                        ID:
                      </span>
                      <code className="crm-campaign-muted text-xs font-mono truncate">
                        ?c={camp.code}
                      </code>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(shortUrl, `url-${camp.id}`)}
                        className={`p-1 rounded-lg text-xs transition-colors cursor-pointer ${
                          copiedKey === `url-${camp.id}`
                            ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                            : isLight
                              ? "text-slate-600 hover:bg-slate-200"
                              : "text-slate-300 hover:bg-slate-700"
                        }`}
                        title={t("Copy short link", "复制专属短链接")}
                      >
                        {copiedKey === `url-${camp.id}` ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveQrCampaign(camp)}
                        className={`p-1 rounded-lg text-xs transition-colors cursor-pointer ${isLight ? "text-slate-600 hover:bg-slate-200" : "text-slate-300 hover:bg-slate-700"}`}
                        title={t("Show QR Code", "查看并下载高清二维码")}
                      >
                        <QrCode className="w-3.5 h-3.5 text-indigo-500" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`px-4 py-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-3 text-center ${isLight?'bg-slate-50 border-slate-200 text-slate-700':'bg-slate-900 border-slate-700 text-slate-200'}`}>
                  {[[t('Registered customers','已登记客户'),camp.stats.leadsCount],[t('Assessments saved','已保存测评'),camp.stats.assessedCount],[t('Confirmed participation','已确认参与'),camp.stats.confirmedAttendanceCount],[t('Enrollment recorded','已记录报名'),camp.stats.enrolledCount]].map(([label,value])=><div key={label}><p className="text-xs">{label}</p><strong className="text-sm tabular-nums">{value||0}</strong></div>)}
                </div>
                {/* Card Bottom: Quick Actions */}
                <div
                  className={`p-3 px-4 sm:px-5 border-t flex items-center justify-between gap-2 ${isLight ? "bg-white border-slate-100" : "bg-slate-900 border-slate-800"}`}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDetailCampaign(camp);
                        setDetailTab("collaterals");
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isLight
                          ? "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                      }`}
                      title={t(
                        "View AI Marketing Collaterals",
                        "查看 AI 营销物料与话术",
                      )}
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>{t("AI Collaterals", "物料")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveDetailCampaign(camp);
                        setDetailTab("leads");
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isLight
                          ? "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                      }`}
                      title={t(
                        "View Sourced Leads from this campaign",
                        "查看本次活动获取的所有学员线索",
                      )}
                    >
                      <Users className="w-3 h-3 text-indigo-500" />
                      <span>
                        {camp.stats.leadsCount || 0} {t("Registered leads", "已登记客户")}
                      </span>
                    </button>
                  </div>

                  {canManageCampaigns&&!isOrganicCampaign(camp)&&<div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditWizard(camp)}
                      className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${isLight ? "hover:bg-slate-100 text-slate-500" : "hover:bg-slate-800 text-slate-400"}`}
                      title={t("Edit Campaign", "编辑活动配置")}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCampaign(camp.id, camp.name)}
                      className="p-1.5 rounded-lg text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title={t("Delete Campaign", "删除活动")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Quick QR Code & Link Modal */}
      {activeQrCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-md w-full rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
          >
            <div
              className={`p-5 border-b flex items-center justify-between ${isLight ? "border-slate-100 bg-slate-50/50" : "border-slate-800 bg-slate-800/40"}`}
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary-500/10 text-primary-600">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}
                  >
                    {t(
                      "Official Tracking QR & Short Link",
                      "活动专属追溯二维码与短链",
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[260px]">
                    {activeQrCampaign.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveQrCampaign(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 text-center space-y-4">
              {/* QR Code Canvas/Image */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm inline-block mx-auto">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={t("Tracking QR code", "活动追踪二维码")}
                    className="w-48 h-48 sm:w-56 sm:h-56 mx-auto object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                    {t("Generating QR code…", "正在生成二维码…")}
                  </div>
                )}
                <div className="mt-2 text-[11px] font-bold text-slate-800 uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {t("UPER campaign portal", "UPER 活动页面")}
                </div>
              </div>

              {/* Clean Short Link Box */}
              <div
                className={`p-3 rounded-xl border text-left space-y-1.5 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/60 border-slate-700"}`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>
                    {t(
                      "Clean Short Tracking URL (Single ID)",
                      "对外极简短链接 (单标识)",
                    )}
                  </span>
                  <span className="text-[10px] text-emerald-500 font-semibold">
                    {t("Auto UTM Bound", "自动绑定UTM")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    readOnly
                    value={campaignChatLink(activeQrCampaign.code)}
                    className={`w-full font-mono text-xs font-semibold bg-transparent outline-none ${isLight ? "text-primary-700" : "text-primary-400"}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        campaignChatLink(activeQrCampaign.code),
                        "modal-short-link",
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold shrink-0 cursor-pointer"
                  >
                    {copiedKey === "modal-short-link"
                      ? t("Copied!", "已复制")
                      : t("Copy", "复制")}
                  </button>
                </div>
              </div>

              {/* Full UTM URL for digital ad managers */}
              <div
                className={`p-3 rounded-xl border text-left space-y-1 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/60 border-slate-700"}`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>
                    {t(
                      "Full UTM Parameter Link (Optional for Ads)",
                      "带显式 UTM 全参数链接 (可选用于广告)",
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-slate-500 truncate">
                    {`${campaignChatLink(activeQrCampaign.code)}&utm_source=${encodeURIComponent(activeQrCampaign.boundUtm.utm_source)}&utm_medium=${encodeURIComponent(activeQrCampaign.boundUtm.utm_medium)}`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        `${campaignChatLink(activeQrCampaign.code)}&utm_source=${encodeURIComponent(activeQrCampaign.boundUtm.utm_source)}&utm_medium=${encodeURIComponent(activeQrCampaign.boundUtm.utm_medium)}`,
                        "modal-full-utm",
                      )
                    }
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                  >
                    {copiedKey === "modal-full-utm"
                      ? t("Copied", "已复制")
                      : t("Copy Full", "复制全文")}
                  </button>
                </div>
              </div>

              {/* Download & Preview Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <a
                  href={qrDataUrl}
                  download={`UPER_QR_${activeQrCampaign.code}.png`}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200" : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t("Download PNG QR", "下载高清二维码")}</span>
                </a>

                <a
                  href={`/chat?c=${activeQrCampaign.code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-3 rounded-xl text-xs font-bold bg-primary-700 hover:bg-primary-800 text-white flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t("Open Landing Page", "测试打开落地页")}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Closed-Loop Detail & Marketing Collaterals Drawer */}
      {activeDetailCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div
            className={`w-full max-w-2xl h-full flex flex-col shadow-2xl border-l animate-in slide-in-from-right duration-300 ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-900 border-slate-800 text-white"}`}
          >
            {/* Drawer Header */}
            <div
              className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${isLight ? "border-slate-100 bg-slate-50/50" : "border-slate-800 bg-slate-800/40"}`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 border border-primary-500/20">
                    {activeDetailCampaign.code}
                  </span>
                  <span
                    className={`text-xs font-semibold ${isLight ? "text-slate-500" : "text-slate-400"}`}
                  >
                    {activeDetailCampaign.organizer}
                  </span>
                </div>
                <h3 className="font-bold text-base sm:text-lg leading-tight">
                  {isOrganicCampaign(activeDetailCampaign)?organicCampaignName(lang):lang === "id"
                    ? activeDetailCampaign.nameEn
                    : lang === "zh"
                      ? activeDetailCampaign.name
                      : activeDetailCampaign.nameEn}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {canManageCampaigns&&!isOrganicCampaign(activeDetailCampaign)&&<button
                  type="button"
                  onClick={() => handleOpenEditWizard(activeDetailCampaign)}
                  className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${isLight ? "bg-white border-slate-200 hover:bg-slate-100 text-slate-600" : "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"}`}
                  title={t("Edit campaign", "编辑活动")}
                >
                  <Edit3 className="w-4 h-4" />
                </button>}

                <button
                  type="button"
                  onClick={() => setActiveDetailCampaign(null)}
                  className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Navigation Tabs */}
            <div
              className={`flex items-center px-4 border-b gap-1 overflow-x-auto shrink-0 ${isLight ? "border-slate-100 bg-slate-50/20" : "border-slate-800 bg-slate-900"}`}
            >
              {[
                {
                  id: "overview",
                  labelZh: "活动概览与短链",
                  labelEn: "Overview & Link",
                  icon: Target,
                },
                {
                  id: "leads",
                  labelZh: `获客线索闭环 (${matchedLeadsForActiveCampaign.length})`,
                  labelEn: `Sourced Leads (${matchedLeadsForActiveCampaign.length})`,
                  icon: Users,
                },
                {
                  id: "collaterals",
                  labelZh: "AI 营销物料库",
                  labelEn: "AI Collaterals",
                  icon: Sparkles,
                },
                {
                  id: "print",
                  labelZh: "立牌/海报排版预览",
                  labelEn: "Desk Tent Preview",
                  icon: Printer,
                },
                {
                  id: "analytics",
                  labelZh: "统计与归因",
                  labelEn: "Measures & attribution",
                  icon: BarChart3,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = detailTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDetailTab(tab.id as any)}
                    className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? "border-primary-600 text-primary-600 dark:text-primary-400"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>
                      {lang === "id"
                        ? crmId(tab.labelEn)
                        : lang === "zh"
                          ? tab.labelZh
                          : tab.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Drawer Body Scroll Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* TAB 1: OVERVIEW */}
              {detailTab === "overview" && (
                <div className="space-y-4">
                  {/* Quick Short Link & QR Banner */}
                  <div
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${isLight ? "bg-primary-50/40 border-primary-200/80" : "bg-primary-950/20 border-primary-900/40"}`}
                  >
                    <div className="space-y-1 text-center sm:text-left">
                      <div className="text-xs font-bold text-primary-800 dark:text-primary-300">
                        {t("Clean Short Tracking Link", "活动唯一追溯短链")}
                      </div>
                      <code className="text-xs font-mono font-bold text-slate-900 dark:text-white break-all">
                        {campaignChatLink(activeDetailCampaign.code)}
                      </code>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            campaignChatLink(activeDetailCampaign.code),
                            "drawer-short-copy",
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        {copiedKey === "drawer-short-copy" ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {copiedKey === "drawer-short-copy"
                            ? t("Copied", "已复制")
                            : t("Copy Link", "复制短链")}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveQrCampaign(activeDetailCampaign)
                        }
                        className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${isLight ? "bg-white border-slate-200 hover:bg-slate-50" : "bg-slate-800 border-slate-700 hover:bg-slate-700"}`}
                        title={t("Show QR Code", "查看二维码")}
                      >
                        <QrCode className="w-4 h-4 text-indigo-500" />
                      </button>
                    </div>
                  </div>

                  {/* Core Event Specifications */}
                  <div
                    className={`p-4 rounded-2xl border space-y-3 ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
                  >
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {t(
                        "Event Specifications & Location",
                        "活动时间、地点与日程",
                      )}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">
                          {t("Event Dates", "活动日期")}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {activeDetailCampaign.startDate} ~{" "}
                          {activeDetailCampaign.endDate}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">
                          {t("Time Schedule", "活动时间")}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {activeDetailCampaign.startTime} -{" "}
                          {activeDetailCampaign.endTime} WIB
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">
                          {t("City & Venue", "活动城市与场馆")}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {activeDetailCampaign.venue} (
                          {activeDetailCampaign.city})
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">
                          {t(
                            "Venue Address / Online Link",
                            "详细地址 / 线上链接",
                          )}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 break-all">
                          {activeDetailCampaign.address ||
                            activeDetailCampaign.onlineLink ||
                            "Offline Campus"}
                        </span>
                      </div>
                    </div>

                    {activeDetailCampaign.scheduleNotes && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <span className="text-slate-400 block">
                          {t("Schedule Notes", "日程节奏说明")}
                        </span>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                          {activeDetailCampaign.scheduleNotes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Target Audience & Key Topics */}
                  <div
                    className={`p-4 rounded-2xl border space-y-3 ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
                  >
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {t(
                        "Target Audience & Key Selling Points",
                        "目标受众与核心卖点",
                      )}
                    </h4>

                    <div>
                      <span className="text-slate-400 text-xs block mb-1.5">
                        {t("Target Audiences", "目标人群")}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeDetailCampaign.targetAudience.map((aud, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-medium"
                          >
                            {aud}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 text-xs block mb-1.5">
                        {t("Key Topics & Benefits", "核心亮点与收益")}
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {activeDetailCampaign.keyTopics.map((top, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-primary-500 font-bold">
                              •
                            </span>
                            <span>{top}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SOURCED LEADS (CLOSED-LOOP) */}
              {detailTab === "leads" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {t(
                        "Leads automatically matched from CRM:",
                        "由该活动短链自动沉淀至 CRM 的潜客学员：",
                      )}
                    </span>
                    <span className="font-bold text-primary-600">
                      {matchedLeadsForActiveCampaign.length}{" "}
                      {t("Leads Total", "条线索")}
                    </span>
                  </div>

                  {campaignLeadError?<p role="alert">{t("Campaign customer list unavailable; reopen to retry.","活动客户列表暂不可用，请重新打开重试。")}</p>:matchedLeadsForActiveCampaign.length === 0 ? (
                    <div
                      className={`p-8 text-center rounded-2xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
                    >
                      <Users className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-60" />
                      <p className="text-xs text-slate-400">
                        {t(
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
                              <span>WA: {lead.whatsapp}</span>
                              <span>•</span>
                              <span className="truncate">
                                {crmValue(lead.goal, lang)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {lead.revenue ? (
                              <span className="text-xs font-mono font-bold text-emerald-600">
                                Rp {(lead.revenue / 1000000).toFixed(1)}
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

              {/* TAB 3: AI COLLATERALS */}
              {detailTab === "collaterals" && (
                <div className="space-y-4">
                  {/* WhatsApp Invitation Blast */}
                  <div
                    className={`p-4 rounded-2xl border space-y-2.5 ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Send className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {t(
                            "WhatsApp Mass Invitation & Direct Chat Script",
                            "WhatsApp 邀请群发与私信模版",
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            activeDetailCampaign.aiAssets.whatsappInvitation,
                            "drawer-copy-wa",
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === "drawer-copy-wa" ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>
                          {copiedKey === "drawer-copy-wa"
                            ? t("Copied", "已复制")
                            : t("Copy Script", "复制话术")}
                        </span>
                      </button>
                    </div>

                    <pre
                      className={`p-3 rounded-xl text-xs font-sans whitespace-pre-wrap leading-relaxed border ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-slate-800/80 border-slate-700 text-slate-200"}`}
                    >
                      {activeDetailCampaign.aiAssets.whatsappInvitation}
                    </pre>
                  </div>

                  {/* Social Media Copywriting */}
                  <div
                    className={`p-4 rounded-2xl border space-y-2.5 ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {t(
                            "Social media copy (Instagram / TikTok / Xiaohongshu)",
                            "社媒招募与推广文案",
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            activeDetailCampaign.aiAssets.socialCopy,
                            "drawer-copy-social",
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === "drawer-copy-social" ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>
                          {copiedKey === "drawer-copy-social"
                            ? t("Copied", "已复制")
                            : t("Copy Copywriting", "复制文案")}
                        </span>
                      </button>
                    </div>

                    <pre
                      className={`p-3 rounded-xl text-xs font-sans whitespace-pre-wrap leading-relaxed border ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-slate-800/80 border-slate-700 text-slate-200"}`}
                    >
                      {activeDetailCampaign.aiAssets.socialCopy}
                    </pre>
                  </div>

                  {/* Landing Page Tailored Welcome Greeting */}
                  <div
                    className={`p-4 rounded-2xl border space-y-2.5 ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {t(
                            "AI Landing Chat Tailored Welcome Greeting",
                            "落地页专属进线欢迎语",
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            activeDetailCampaign.aiAssets.chatWelcomeGreeting,
                            "drawer-copy-greeting",
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === "drawer-copy-greeting" ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>
                          {copiedKey === "drawer-copy-greeting"
                            ? t("Copied", "已复制")
                            : t("Copy Greeting", "复制问候语")}
                        </span>
                      </button>
                    </div>

                    <p
                      className={`p-3 rounded-xl text-xs font-sans leading-relaxed border ${isLight ? "bg-blue-50/50 border-blue-200 text-blue-950" : "bg-blue-950/20 border-blue-900/60 text-blue-200"}`}
                    >
                      {activeDetailCampaign.aiAssets.chatWelcomeGreeting}
                    </p>
                  </div>

                  {/* Presentation Outline & Talking Points */}
                  <div
                    className={`p-4 rounded-2xl border space-y-2.5 ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {t(
                            "45-min Seminar Outline & Speaker Talking Points",
                            "45分钟宣讲会提纲与破冰互动",
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            activeDetailCampaign.aiAssets.presentationOutline,
                            "drawer-copy-outline",
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === "drawer-copy-outline" ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>
                          {copiedKey === "drawer-copy-outline"
                            ? t("Copied", "已复制")
                            : t("Copy Outline", "复制提纲")}
                        </span>
                      </button>
                    </div>

                    <pre
                      className={`p-3 rounded-xl text-xs font-sans whitespace-pre-wrap leading-relaxed border ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-slate-800/80 border-slate-700 text-slate-200"}`}
                    >
                      {activeDetailCampaign.aiAssets.presentationOutline}
                    </pre>
                  </div>
                </div>
              )}

              {/* TAB 4: PRINTABLE DESK TENT PREVIEW */}
              {detailTab === "print" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {t(
                        "On-site Desk Tent Card / Roll-Up Banner Print Layout:",
                        "宣讲会桌面立牌 / 易拉宝现场展示排版：",
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-1.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{t("Print This Tent Card", "打印此立牌")}</span>
                    </button>
                  </div>

                  {/* Printable Tent Card Container */}
                  <div className="p-8 rounded-3xl border-2 border-primary-500/40 bg-white text-slate-900 shadow-xl space-y-6 text-center max-w-lg mx-auto">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-600 text-white font-bold flex items-center justify-center text-sm">
                        UP
                      </div>
                      <span className="font-extrabold text-sm tracking-wider uppercase text-slate-900">
                        {t(
                          "UPER Education · Official event",
                          "UPER 教育官方活动",
                        )}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-tight">
                        {activeDetailCampaign.aiAssets.posterHeading}
                      </h2>
                      <p className="text-xs font-medium text-slate-600 mt-1">
                        {activeDetailCampaign.aiAssets.posterSubheading}
                      </p>
                    </div>

                    {/* QR Code Centerpiece */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
                      {qrDataUrl && (
                        <img
                          src={qrDataUrl}
                          alt={t("Table display QR code", "桌牌二维码")}
                          className="w-48 h-48 mx-auto object-contain"
                        />
                      )}
                      <div className="mt-2 text-[11px] font-bold text-primary-700 uppercase tracking-widest">
                        {t(
                          "Scan to register and assess your level",
                          "扫码报名并进行水平测评",
                        )}
                      </div>
                    </div>

                    {/* Key Highlights */}
                    <div className="text-left bg-primary-50/50 p-4 rounded-2xl border border-primary-100 space-y-2">
                      <div className="text-xs font-bold text-primary-900 uppercase tracking-wider">
                        {t("Exclusive on-site benefits", "现场扫码专属福利")}
                      </div>
                      <ul className="text-xs text-slate-700 space-y-1.5">
                        {activeDetailCampaign.aiAssets.deskTentBullets?.map(
                          (bullet, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                              <span>{bullet}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>

                    <div className="text-[10px] text-slate-400 border-t pt-3 font-mono">
                      {t(
                        "Tracking link:",
                        "活动链接：",
                      )}
                      {campaignChatLink(activeDetailCampaign.code)}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === "analytics" && <CrmCampaignMeasures campaigns={[activeDetailCampaign]} lang={lang} isLight={isLight} detail/>}
            </div>
          </div>
        </div>
      )}

      {/* 6. Create / Edit Campaign Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-2xl w-full h-[720px] max-h-[88vh] rounded-3xl border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}
          >
            {/* Modal Header */}
            <div
              className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${isLight ? "border-slate-100 bg-slate-50/60" : "border-slate-800 bg-slate-800/40"}`}
            >
              <div>
                <h3
                  className={`font-bold text-base ${isLight ? "text-slate-900" : "text-white"}`}
                >
                  {editingCampaignId
                    ? t("Edit Marketing Campaign", "编辑营销获客活动")
                    : t("New Campaign", "新建营销活动")}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t(
                    "Step-by-step campaign setup with automatic UTM binding and AI asset generation.",
                    "通过向导配置时间、地点、受众，自动绑定唯一渠道短链，并一键生成全套 AI 宣讲物料。",
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Indicators */}
            <div
              className={`grid grid-cols-4 p-2 border-b shrink-0 text-center text-xs font-bold ${isLight ? "border-slate-100 bg-slate-50/30" : "border-slate-800 bg-slate-900"}`}
            >
              {[
                { num: 1, labelZh: "1. 基本信息", labelEn: "1. Basic Info" },
                {
                  num: 2,
                  labelZh: "2. 时间地点受众",
                  labelEn: "2. Venue & Target",
                },
                {
                  num: 3,
                  labelZh: "3. 渠道绑定短链",
                  labelEn: "3. Tracking & UTM",
                },
                {
                  num: 4,
                  labelZh: "4. AI 物料生成",
                  labelEn: "4. AI Collaterals",
                },
              ].map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setWizardStep(s.num as any)}
                  className={`py-2 rounded-xl transition-all cursor-pointer ${
                    wizardStep === s.num
                      ? "bg-primary-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {lang === "id"
                    ? crmId(s.labelEn)
                    : lang === "zh"
                      ? s.labelZh
                      : s.labelEn}
                </button>
              ))}
            </div>

            {/* Modal Body Form */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {/* STEP 1: BASIC INFO */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t("Campaign name (Chinese display)", "活动名称（中文显示）")}{" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder={t(
                        "Example: campus Mandarin career seminar",
                        "示例：校园中文职业发展讲座",
                      )}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none ${isLight ? "bg-slate-50 border-slate-200 focus:bg-white focus:border-primary-500 text-slate-900" : "bg-slate-800 border-slate-700 focus:border-primary-400 text-white"}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t("Campaign name (English / Indonesian display)", "活动名称（英文／印尼文显示）")}
                    </label>
                    <input
                      type="text"
                      value={formNameEn}
                      onChange={(e) => setFormNameEn(e.target.value)}
                      placeholder={t(
                        "Example: Mandarin career seminar",
                        "示例：中文职业发展讲座",
                      )}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none ${isLight ? "bg-slate-50 border-slate-200 focus:bg-white focus:border-primary-500 text-slate-900" : "bg-slate-800 border-slate-700 focus:border-primary-400 text-white"}`}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Activity Type", "场景活动类型")}
                      </label>
                      <CrmSelect label={t("Activity Type", "场景活动类型")} value={formType} onChange={(value) =>
                          setFormType(value as CampaignType)} lang={lang} isLight={isLight}>
                        <option value="" disabled>
                          {t(
                            "-- Select Activity Type --",
                            "-- 请选择场景活动类型 --",
                          )}
                        </option>
                        {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {lang === "id"
                              ? crmId(opt.labelEn)
                              : lang === "zh"
                                ? opt.labelZh
                                : opt.labelEn}
                          </option>
                        ))}
                      </CrmSelect>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Delivery Medium", "举办媒介形态 ")}
                      </label>
                      <CrmSelect label={t("Delivery Medium", "举办媒介形态 ")} value={formLocationType} onChange={(value) =>
                          setFormLocationType(
                            value as CampaignLocationType,
                          )} lang={lang} isLight={isLight}>
                        <option value="" disabled>
                          {t("-- Select Medium --", "-- 请选择举办媒介形态 --")}
                        </option>
                        <option value="offline">
                          {t("📍 Offline (On-site)", "📍 线下活动 ")}
                        </option>
                        <option value="online">
                          {t("🌐 Online (Virtual)", "🌐 线上活动 ")}
                        </option>
                        <option value="hybrid">
                          {t("🔀 Hybrid Mode", "🔀 线上线下混合 ")}
                        </option>
                      </CrmSelect>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Status", "活动状态")}
                      </label>
                      <CrmSelect label={t("Status", "活动状态")} value={formStatus} onChange={(value) =>
                          setFormStatus(value as CampaignStatus)} lang={lang} isLight={isLight}>
                        <option value="" disabled>
                          {t("-- Select Status --", "-- 请选择活动状态 --")}
                        </option>
                        {CAMPAIGN_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {lang === "id"
                              ? crmId(opt.labelEn)
                              : lang === "zh"
                                ? opt.labelZh
                                : opt.labelEn}
                          </option>
                        ))}
                      </CrmSelect>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Default Hook Type", "默认获客入口")}
                      </label>
                      <CrmSelect label={t("Default Hook Type", "默认获客入口")} value={formHook} onChange={(value) =>
                          setFormHook(value as HookType)} lang={lang} isLight={isLight}>
                        <option value="" disabled>
                          {t(
                            "-- Select Hook Type --",
                            "-- 请选择默认获客入口 --",
                          )}
                        </option>
                        <option value="hsk_assessment">
                          {t("HSK placement assessment", "汉语水平定级测评")}
                        </option>
                        <option value="trial_class">
                          {t("Trial class", "试听体验课")}
                        </option>
                        <option value="consultation">
                          {t("Individual consultation", "一对一顾问咨询")}
                        </option>
                        <option value="scholarship_materials">
                          {t("Scholarship materials", "奖学金资料包")}
                        </option>
                        <option value="webinar">
                          {t("Public webinar", "公开讲座")}
                        </option>
                      </CrmSelect>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Organizer / Lead Team", "活动负责人 / 协同团队")}
                      </label>
                      <input
                        type="text"
                        value={formOrganizer}
                        onChange={(e) => setFormOrganizer(e.target.value)}
                        placeholder={t(
                          "Example: Marketing and business development",
                          "示例：营销与业务拓展团队",
                        )}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none ${isLight ? "bg-slate-50 border-slate-200 focus:bg-white focus:border-primary-500 text-slate-900" : "bg-slate-800 border-slate-700 focus:border-primary-400 text-white"}`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Budget Cost (IDR)", "活动预算 (IDR)")}
                      </label>
                      <input
                        type="number"
                        value={formBudgetCost}
                        onChange={(e) =>
                          setFormBudgetCost(Number(e.target.value) || 0)
                        }
                        placeholder="3000000"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-mono ${isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: SCHEDULE, VENUE & AUDIENCE */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Start Date", "开始日期")}
                      </label>
                      <input
                        type="date"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("End Date", "结束日期")}
                      </label>
                      <input
                        type="date"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Start Time", "开始时间")}
                      </label>
                      <input
                        type="time"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("End Time", "结束时间")}
                      </label>
                      <input
                        type="time"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("City", "所在城市")}
                      </label>
                      <input
                        type="text"
                        value={formCity}
                        onChange={(e) => setFormCity(e.target.value)}
                        placeholder={t("Example: Jakarta", "示例：雅加达")}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none ${isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t(
                          "Venue / Campus / Room",
                          "具体场馆 / 校园礼堂 / 教室",
                        )}
                      </label>
                      <input
                        type="text"
                        value={formVenue}
                        onChange={(e) => setFormVenue(e.target.value)}
                        placeholder={t(
                          "Example: campus auditorium",
                          "示例：大学报告厅",
                        )}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none ${isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t(
                        "Target Audience (Comma separated)",
                        "目标受众群体 (逗号分隔)",
                      )}
                    </label>
                    <input
                      type="text"
                      value={formAudienceInput}
                      onChange={(e) => setFormAudienceInput(e.target.value)}
                      placeholder={t(
                        "University students, working professionals, HSK candidates",
                        "大学生、在职人士、汉语水平考试备考者",
                      )}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none ${isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t(
                        "Key Topics & Selling Points (Comma or line separated)",
                        "核心议题与卖点 (逗号或换行分隔)",
                      )}
                    </label>
                    <textarea
                      rows={2}
                      value={formTopicsInput}
                      onChange={(e) => setFormTopicsInput(e.target.value)}
                      placeholder={t(
                        "Career advice, free level assessment, early registration offer",
                        "职业咨询、免费水平测评、提前报名优惠",
                      )}
                      className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none ${isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: TRACKING & UTM BINDING */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-2xl border space-y-2 ${isLight ? "bg-emerald-50/50 border-emerald-200" : "bg-emerald-950/20 border-emerald-900/60"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {t(
                          "Single Short ID Tracking Link",
                          "对外唯一极简短链标识",
                        )}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                        {t("Recommended Standard Practice", "营销行业标准做法")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-mono">
                        {campaignChatLink('')}
                      </span>
                      <input
                        type="text"
                        value={formCode}
                        onChange={(e) =>
                          setFormCode(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_-]/g, ""),
                          )
                        }
                        placeholder={t(
                          "Example: seminar_2026",
                          "示例：seminar_2026",
                        )}
                        className="px-2.5 py-1.5 rounded-lg border border-emerald-300 font-mono font-bold text-xs text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-800 outline-none flex-1"
                      />
                    </div>
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
                      {t(
                        "All leads automatically attribute to this code via short link ?c=CODE without needing messy UTM query parameters.",
                        "所有线索通过极简短链 ?c=CODE 即可自动完美归因，无需在日常宣传中携带冗长杂乱的 UTM 参数。",
                      )}
                    </p>
                  </div>

                  {/* Online Ad UTM Config Toggle Switch */}
                  <div
                    className={`p-4 rounded-2xl border space-y-2.5 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/60 border-slate-700"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id="enable-utm-toggle"
                          checked={enableUtmConfig}
                          onChange={(e) => setEnableUtmConfig(e.target.checked)}
                          className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                        />
                        <label
                          htmlFor="enable-utm-toggle"
                          className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          {t(
                            "Configure UTM Parameters for Online Paid Ads",
                            "启用线上广告平台 UTM 追踪高级配置",
                          )}
                        </label>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                        {t("Optional / Paid Ads Only", "广告投放可选")}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        "Turn on if running Google, Meta/Facebook, or TikTok paid ads. For offline campus seminars or organic events, leave unchecked.",
                        "若通过 Google、Meta/Facebook 或 TikTok 等付费广告投放时开启。纯线下活动、校园宣讲或自然流量无需开启。",
                      )}
                    </p>
                  </div>

                  {enableUtmConfig && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 animate-in fade-in duration-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          utm_source ({t("Source", "渠道来源")})
                        </label>
                        <CrmSelect label={t("Source", "渠道来源")} value={formSource} onChange={(value) => setFormSource(value)} lang={lang} isLight={isLight}>
                          <option value="" disabled>
                            {t(
                              "-- Select UTM Source --",
                              "-- 请选择渠道来源 --",
                            )}
                          </option>
                          <option value="instagram">instagram</option>
                          <option value="facebook">facebook</option>
                          <option value="tiktok">tiktok</option>
                          <option value="google">google</option>
                          <option value="youtube">youtube</option>
                          <option value="linkedin">linkedin</option>
                          <option value="whatsapp">whatsapp</option>
                          <option value="campus_offline">
                            {t("Campus event", "校园活动")}
                          </option>
                          <option value="enterprise_offline">
                            {t("Enterprise event", "企业活动")}
                          </option>
                          <option value="edufair">
                            {t("Education fair", "教育展会")}
                          </option>
                        </CrmSelect>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          utm_medium ({t("Medium", "物料媒介")})
                        </label>
                        <CrmSelect label={t("Medium", "媒介形态")} value={formMedium} onChange={(value) => setFormMedium(value)} lang={lang} isLight={isLight}>
                          <option value="" disabled>
                            {t(
                              "-- Select UTM Medium --",
                              "-- 请选择媒介形态 --",
                            )}
                          </option>
                          <option value="cpc">
                            {t("Paid clicks", "按点击付费")}
                          </option>
                          <option value="social">
                            {t("Social media", "社交媒体")}
                          </option>
                          <option value="qr_poster">
                            {t("QR poster", "二维码海报")}
                          </option>
                          <option value="flyer">{t("Flyer", "传单")}</option>
                          <option value="email">
                            {t("Email", "电子邮件")}
                          </option>
                          <option value="referral">
                            {t("Referral", "转介绍")}
                          </option>
                        </CrmSelect>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: AI MARKETING ASSET GENERATOR */}
              {wizardStep === 4 && (
                <div className="space-y-5">
                  {/* Top Hero Banner & Actions */}
                  <div
                    className={`p-5 rounded-2xl border flex flex-col gap-4 ${isLight ? "bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30 border-amber-200/80 shadow-xs" : "bg-gradient-to-br from-amber-950/30 via-slate-900 to-amber-950/10 border-amber-900/50"}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow-xs">
                            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                          </div>
                          <span className="text-sm tracking-tight">
                            {t(
                              "AI Marketing Collateral Generator",
                              "AI 智能获客物料与话术全栈生成器",
                            )}
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-700/80 dark:text-amber-400/90 mt-1 pl-7 leading-relaxed">
                          {t(
                            "Instant multi-lingual synthesis for Instagram posts, WhatsApp blasts, talk outlines, and chatbot greetings.",
                            "一键智能合成 Instagram 社媒文案、WhatsApp 裂变群发、45分钟宣讲提纲及 AI 进线问候语。",
                          )}
                        </div>
                      </div>

                      {/* Generate Button */}
                      <div className="flex items-center gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200/60 dark:border-amber-900/40">
                        <button
                          type="button"
                          onClick={handleGenerateAiAssets}
                          disabled={isAiGenerating}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/25 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shrink-0"
                        >
                          <Sparkles
                            className={`w-3.5 h-3.5 ${isAiGenerating ? "animate-spin" : ""}`}
                          />
                          <span>
                            {isAiGenerating
                              ? t("Synthesizing...", "AI生成中...")
                              : t("Generate All Assets", "开始生成全套物料")}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Asset Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    {[
                      {
                        id: "poster",
                        label: t("Poster & Title", "海报主副标题"),
                        icon: Award,
                        color: "text-blue-500",
                      },
                      {
                        id: "social",
                        label: t("Social Promo Copy", "社媒宣传文案"),
                        icon: Share2,
                        color: "text-indigo-500",
                      },
                      {
                        id: "whatsapp",
                        label: t("WhatsApp Script", "WhatsApp 邀约"),
                        icon: MessageSquare,
                        color: "text-emerald-500",
                      },
                      {
                        id: "greeting",
                        label: t("Chat Welcome", "机器人问候语"),
                        icon: Bot,
                        color: "text-purple-500",
                      },
                      {
                        id: "outline",
                        label: t("Seminar Outline", "宣讲提纲"),
                        icon: FileText,
                        color: "text-amber-500",
                      },
                    ].map((tab) => {
                      const IconComponent = tab.icon;
                      const isActive = activeAssetTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveAssetTab(tab.id as any)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isActive
                              ? "bg-primary-600 text-white shadow-sm"
                              : isLight
                                ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                          }`}
                        >
                          <IconComponent
                            className={`w-3.5 h-3.5 ${isActive ? "text-white" : tab.color}`}
                          />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Tab Content Panel */}
                  <div
                    className={`p-5 rounded-2xl border min-h-[240px] flex flex-col justify-between ${isLight ? "bg-slate-50/70 border-slate-200" : "bg-slate-800/40 border-slate-700/80"}`}
                  >
                    {/* Tab 1: Poster & Heading */}
                    {activeAssetTab === "poster" && (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700/60">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Award className="w-4 h-4 text-blue-500" />
                            <span>
                              {t(
                                "Poster heading and subheading",
                                "海报主标题与副标题",
                              )}
                            </span>
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-700 rounded-lg">
                              <button
                                type="button"
                                onClick={() => handleSwitchPreviewLang("id")}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewLang === "id" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                              >
                                {t("Indonesian content", "印尼语内容")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwitchPreviewLang("en")}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewLang === "en" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                              >
                                {t("English content", "英语内容")}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  `${formPosterHeading} | ${formPosterSubheading}`,
                                  "wizard-poster",
                                )
                              }
                              title={
                                copiedKey === "wizard-poster"
                                  ? t("Copied", "已复制")
                                  : t("Copy to Clipboard", "快捷复制")
                              }
                              className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/50 flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                              {t("Poster Heading", "海报主标题")}
                            </label>
                            <input
                              type="text"
                              value={formPosterHeading}
                              onChange={(e) =>
                                setFormPosterHeading(e.target.value)
                              }
                              className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                              {t("Poster Subheading", "海报副标题")}
                            </label>
                            <input
                              type="text"
                              value={formPosterSubheading}
                              onChange={(e) =>
                                setFormPosterSubheading(e.target.value)
                              }
                              className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Social Media Promo Copy */}
                    {activeAssetTab === "social" && (
                      <div className="space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700/60">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Share2 className="w-4 h-4 text-indigo-500" />
                            <span>
                              {t(
                                "Social Media Promo Copy (Instagram / TikTok / Feed)",
                                "社媒招募与推广文案 (Instagram / TikTok)",
                              )}
                            </span>
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-700 rounded-lg">
                              <button
                                type="button"
                                onClick={() => handleSwitchPreviewLang("id")}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewLang === "id" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                              >
                                {t("Indonesian content", "印尼语内容")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwitchPreviewLang("en")}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewLang === "en" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                              >
                                {t("English content", "英语内容")}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(formSocialCopy, "wizard-social")
                              }
                              title={
                                copiedKey === "wizard-social"
                                  ? t("Copied", "已复制")
                                  : t("Copy to Clipboard", "快捷复制")
                              }
                              className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/50 flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={6}
                          value={formSocialCopy}
                          onChange={(e) => setFormSocialCopy(e.target.value)}
                          placeholder={t(
                            "Enter promotional copy for the selected content language",
                            "输入所选内容语言的推广文案",
                          )}
                          className={`w-full p-3.5 rounded-xl text-xs border outline-none font-sans leading-relaxed ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                        />
                      </div>
                    )}

                    {/* Tab 3: WhatsApp Group & Direct Chat Invitation Script */}
                    {activeAssetTab === "whatsapp" && (
                      <div className="space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700/60">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-emerald-500" />
                            <span>
                              {t(
                                "WhatsApp Group & Direct Chat Invitation Script",
                                "WhatsApp 邀请文案与群发通知模版",
                              )}
                            </span>
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-700 rounded-lg">
                              <button
                                type="button"
                                onClick={() => handleSwitchPreviewLang("id")}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewLang === "id" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                              >
                                {t("Indonesian content", "印尼语内容")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwitchPreviewLang("en")}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewLang === "en" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                              >
                                {t("English content", "英语内容")}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(formWhatsappInvite, "wizard-wa")
                              }
                              title={
                                copiedKey === "wizard-wa"
                                  ? t("Copied", "已复制")
                                  : t("Copy to Clipboard", "快捷复制")
                              }
                              className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/50 flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={6}
                          value={formWhatsappInvite}
                          onChange={(e) =>
                            setFormWhatsappInvite(e.target.value)
                          }
                          placeholder={t(
                            "Enter an invitation for the selected content language",
                            "输入所选内容语言的邀请文案",
                          )}
                          className={`w-full p-3.5 rounded-xl text-xs border outline-none font-sans leading-relaxed ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                        />
                      </div>
                    )}

                    {/* Tab 4: AI Landing Chat Welcome Greeting */}
                    {activeAssetTab === "greeting" && (
                      <div className="space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700/60">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Bot className="w-4 h-4 text-purple-500" />
                            <span>
                              {t(
                                "AI Landing Chat Tailored Welcome Greeting",
                                "落地页专属进线接待问候语",
                              )}
                            </span>
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-700 rounded-lg">
                              <button
                                type="button"
                                onClick={() => handleSwitchPreviewLang("id")}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewLang === "id" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                              >
                                {t("Indonesian content", "印尼语内容")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwitchPreviewLang("en")}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewLang === "en" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                              >
                                {t("English content", "英语内容")}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  formWelcomeGreeting,
                                  "wizard-greeting",
                                )
                              }
                              title={
                                copiedKey === "wizard-greeting"
                                  ? t("Copied", "已复制")
                                  : t("Copy to Clipboard", "快捷复制")
                              }
                              className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/50 flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={4}
                          value={formWelcomeGreeting}
                          onChange={(e) =>
                            setFormWelcomeGreeting(e.target.value)
                          }
                          placeholder={t(
                            "Enter a greeting for the selected content language",
                            "输入所选内容语言的欢迎语",
                          )}
                          className={`w-full p-3.5 rounded-xl text-xs border outline-none font-sans leading-relaxed ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                        />
                      </div>
                    )}

                    {/* Tab 5: Seminar Presentation Outline */}
                    {activeAssetTab === "outline" && (
                      <div className="space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700/60">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-amber-500" />
                            <span>
                              {t(
                                "45-Min Seminar Talk Track & Outline",
                                "45分钟宣讲会标准互动提纲",
                              )}
                            </span>
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-700 rounded-lg">
                              <button
                                type="button"
                                onClick={() => handleSwitchPreviewLang("id")}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewLang === "id" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                              >
                                {t("Indonesian content", "印尼语内容")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwitchPreviewLang("en")}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewLang === "en" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                              >
                                {t("English content", "英语内容")}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  formPresentationOutline,
                                  "wizard-outline",
                                )
                              }
                              title={
                                copiedKey === "wizard-outline"
                                  ? t("Copied", "已复制")
                                  : t("Copy to Clipboard", "快捷复制")
                              }
                              className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/50 flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={6}
                          value={formPresentationOutline}
                          onChange={(e) =>
                            setFormPresentationOutline(e.target.value)
                          }
                          className={`w-full p-3.5 rounded-xl text-xs border outline-none font-mono leading-relaxed ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-800 border-slate-700 text-white"}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div
              className={`p-4 sm:p-5 border-t flex items-center justify-between shrink-0 ${isLight ? "border-slate-100 bg-slate-50/60" : "border-slate-800 bg-slate-800/40"}`}
            >
              <div>
                {wizardStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setWizardStep((prev) => (prev - 1) as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${isLight ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-100" : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"}`}
                  >
                    {t("Previous Step", "上一步")}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                >
                  {t("Cancel", "取消")}
                </button>

                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 1 && !formName.trim()) {
                        alert(
                          t("Please enter campaign name", "请输入活动名称"),
                        );
                        return;
                      }
                      setWizardStep((prev) => (prev + 1) as any);
                    }}
                    className="px-4 py-2 bg-primary-700 hover:bg-primary-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{t("Next Step", "下一步")}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveCampaign}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {editingCampaignId
                        ? t("Update Campaign", "保存更新活动")
                        : t(
                            "Complete & Generate Tracking Link",
                            "完成创建并激活短链",
                          )}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
