import {crmMessageTimestamp,crmMessageTimeLabel,compareCrmEventTimes} from '../utils/crmMessageTime';
import { LeadActivity, LeadPendingAction } from '../components/LeadAttention';
import LeadTaskActions from '../components/LeadTaskActions';
import NotificationCenter from '../components/NotificationCenter';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { safeStorage } from '../utils/safeStorage';
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
  Target
} from 'lucide-react';
import { CrmLeadRecord, FollowUpLog, StageType, ConnectStatusType, OutcomeType } from '../types/crmLead';
import { TierType, BuyingSignalType } from '../types/leadSystem';
import type { CrmPolicyConfig } from '../types/crmPolicyConfig';
import { DEFAULT_CRM_POLICY_CONFIG } from '../types/crmPolicyConfig';
import { evaluateLeadCadence } from '../utils/cadenceEngine';
import { CrmPolicySettings, PolicyActionControls } from '../components/crm/CrmPolicySettings';
import { CrmUserGuide } from '../components/crm/CrmUserGuide';
import { CrmCampaignHub } from '../components/crm/CrmCampaignHub';

// Proven Objection Handling Playbook for EdTech Advisory
export const OBJECTION_HANDLING_ITEMS = [
  {
    tag: '学费价格',
    tagEn: 'Tuition & Price',
    question: '学费觉得有点贵，有没有打折或者额外优惠？',
    questionEn: 'Tuition feels a bit high, any discounts or promos?',
    answer: '“UPER 采用中印双师制 + 小班精细化分层授课，折算单课时仅约 Rp 85,000，且已包含中方全套原版备考教材与 1v1 口语模考诊断。目前本期开班有【早鸟名额减免 Rp 300,000】，今天帮您锁定名额，还可以赠送 2 次课后难点回放辅导。”',
    answerEn: '"UPER offers dual-instructor small classes, breaking down to just ~Rp 85k/hr including original official exam materials and 1-on-1 speaking mock test. We currently have an Early Bird voucher (Rp 300k off) if locked today, plus 2 complimentary replay review sessions."'
  },
  {
    tag: '模式效果',
    tagEn: 'Online vs Offline',
    question: '线上课效果能保障吗？会不会听不懂或者容易走神？',
    questionEn: 'Will online classes be effective? Worried about losing focus.',
    answer: '“我们的线上直播班每班限定 6~8 人，全程强制开麦开视频互动，主讲老师随堂点名提问与发音纠偏，助教课后 1v1 跟进打卡作业。更重要的是，支持随堂永久回放；若后续您方便，还支持无缝平移至雅加达 PIK 校区面授班！”',
    answerEn: '"Our live Zoom cohorts cap at 6-8 students with mandatory camera & microphone interactions. Real-time pronunciation corrections and 1v1 TA homework coaching ensure high retention. Plus, lifetime replays and free transfer to our PIK campus anytime!"'
  },
  {
    tag: '时间安排',
    tagEn: 'Busy Schedule',
    question: '平时上班/上学很忙，如果加班缺课了怎么办？',
    questionEn: 'Very busy with work/school, what if I miss a class?',
    answer: '“我们专门为印尼中资企业职场人和学生开设了【周六/周日周末集训班】及【平日晚间黄金班】。每次课都会生成高清录播与板书笔记，助教提供专属补课指导；同时我们支持首周不满意免手续费退转班，完全没有后顾之忧。”',
    answerEn: '"We offer dedicated Saturday/Sunday weekend tracks and weekday evening classes. Every session generates cloud replays and whiteboard notes with 1v1 TA catch-up. Plus full flexibility guarantee during week 1."'
  },
  {
    tag: '决策商量',
    tagEn: 'Need to Consult',
    question: '我还需要跟家长/配偶商量一下，过几天再说。',
    questionEn: 'Need to discuss with parents/spouse first.',
    answer: '“非常理解，学习确实是家庭的一项重要规划！我先把我们为印尼学员定制的《UPER 课程分级大纲与印尼中资名企薪酬前景指南》PDF 发到您的 WhatsApp 上，方便您和家人一起参考。因为本期班级仅剩 3 个席位，我先为您保留 48 小时优惠名额，周五下午给您发条信息确认，您看可以吗？”',
    answerEn: '"Understood! I will send the course syllabus PDF and career outlook guide to your WhatsApp for family review. Since only 3 seats remain for this batch, I will hold your spot for 48h and follow up Friday afternoon."'
  }
];

// Unified Global Stage Master Dictionary
export const STAGE_OPTIONS: { value: StageType; labelEn: string; labelZh: string }[] = [
  { value: 'New', labelEn: 'New', labelZh: '待初访' },
  { value: 'Contacted', labelEn: 'Contacted', labelZh: '已建联' },
  { value: 'Assessment Booked', labelEn: 'Assessment Booked', labelZh: '已约测评' },
  { value: 'Assessment Done', labelEn: 'Assessment Done', labelZh: '测评完成' },
  { value: 'Trial Booked', labelEn: 'Trial Booked', labelZh: '已约试听' },
  { value: 'Trial Attended', labelEn: 'Trial Attended', labelZh: '试听出席' },
  { value: 'Enrolled', labelEn: 'Enrolled', labelZh: '已报名签约' },
  { value: 'Lost', labelEn: 'Lost', labelZh: '已流失' }
];

export default function CrmWorkbench() {
  const [crmModule, setCrmModule] = useState<'leads' | 'campaigns' | 'policy' | 'docs'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'docs' || tab === 'policy' || tab === 'leads' || tab === 'campaigns') {
        return tab;
      }
    } catch {}
    return 'leads';
  });
  const [policyConfig, setPolicyConfig] = useState<CrmPolicyConfig>(DEFAULT_CRM_POLICY_CONFIG);
  const [policyControls, setPolicyControls] = useState<PolicyActionControls | null>(null);
  const [leads, setLeads] = useState<CrmLeadRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    hot: 0,
    warmOffline: 0,
    warmOnline: 0,
    school: 0,
    coldNurture: 0,
    overdueSla: 0,
    enrolled: 0,
    conversionRate: '0.0%'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [dataScope,setDataScope] = useState<'own'|'team'|'all'>('all');
  const [attentionFilter,setAttentionFilter] = useState<'all'|'mine'|'unread'|'unassigned'|'overdue'>('all');
  const [leadActionError,setLeadActionError] = useState('');
  const [selectedTierTab, setSelectedTierTab] = useState<string>('All');
  const [selectedStage, setSelectedStage] = useState<string>('All');
  const [selectedOwner, setSelectedOwner] = useState<string>('All');
  const [selectedConnectStatus, setSelectedConnectStatus] = useState<string>('All');
  const [selectedMode, setSelectedMode] = useState<string>('All');
  const [selectedBuyingSignal, setSelectedBuyingSignal] = useState<string>('All');
  const [selectedSlaStatus, setSelectedSlaStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CrmLeadRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'profile' | 'activities' | 'playbook' | 'chat'>('profile');
  const [isAddLogOpen, setIsAddLogOpen] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'logs' | 'engagement' | 'milestone'>('all');
  const [copiedObjectionIdx, setCopiedObjectionIdx] = useState<number | null>(null);

  // Language State: 'en' (default) vs 'zh'
  const [lang, setLang] = useState<'en' | 'zh'>(() => {
    try {
      const saved = safeStorage.getItem('uper_crm_lang');
      if (saved === 'en' || saved === 'zh') return saved;
    } catch {
      // fallback
    }
    return 'en'; // Default to English
  });

  const toggleLang = () => {
    const next = lang === 'en' ? 'zh' : 'en';
    setLang(next);
    try {
      safeStorage.setItem('uper_crm_lang', next);
    } catch {
      // fallback
    }
  };

  // Translation helper
  const t = (enText: string, zhText: string) => (lang === 'zh' ? zhText : enText);

  // Theme State: 'light' (Apple Style) vs 'dark'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = safeStorage.getItem('uper_crm_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // fallback
    }
    return 'light'; // Default to Apple Light theme
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      safeStorage.setItem('uper_crm_theme', next);
    } catch {
      // fallback
    }
  };

  const isLight = theme === 'light';

  // Option C: View Mode State: 'standard' (9 columns) vs 'expanded' (14 columns)
  const [viewMode, setViewMode] = useState<'standard' | 'expanded'>(() => {
    try {
      const saved = safeStorage.getItem('uper_crm_view_mode');
      if (saved === 'standard' || saved === 'expanded') return saved;
    } catch {
      // fallback
    }
    return 'standard';
  });

  // Dynamic Overdue Count based on live policy config & cadence rules
  const dynamicOverdueCount = leads.filter(l => l.attention ? l.attention.tasks.some(t=>t.status==='overdue'||Date.parse(t.dueAt)<Date.now()) : evaluateLeadCadence(l, policyConfig, lang).isOverdue).length;

  // Filtered Leads accounting for Stage, Owner, Search and all Telesales filters
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if(attentionFilter==='mine'&&(!lead.attention?.isMine||!lead.attention.tasks.length))return false;
      if(attentionFilter==='unread'&&!lead.attention?.unreadCount)return false;
      if(attentionFilter==='unassigned'&&lead.owner)return false;
      if(attentionFilter==='overdue'&&!lead.attention?.tasks.some(t=>t.status==='overdue'||Date.parse(t.dueAt)<Date.now()))return false;

      if (selectedConnectStatus !== 'All' && lead.connectStatus !== selectedConnectStatus) {
        return false;
      }
      if (selectedMode !== 'All' && lead.mode !== selectedMode) {
        return false;
      }
      if (selectedBuyingSignal !== 'All' && lead.buyingSignal !== selectedBuyingSignal) {
        return false;
      }
      if (selectedSlaStatus !== 'All') {
        const cadence = evaluateLeadCadence(lead, policyConfig, lang);
        if (selectedSlaStatus === 'overdue' && !cadence.isOverdue) return false;
        if (selectedSlaStatus === 'due_today' && (cadence.statusType !== 'scheduled' || cadence.isOverdue)) return false;
        if (selectedSlaStatus === 'first_response' && cadence.statusType !== 'first_response') return false;
        if (selectedSlaStatus === 'stale' && cadence.statusType !== 'stale_alert') return false;
      }
      return true;
    }).sort((a,b)=>{
      if(attentionFilter==='mine'||attentionFilter==='overdue'){const due=(l:CrmLeadRecord)=>Math.min(...(l.attention?.tasks||[]).map(t=>Date.parse(t.dueAt)));return due(a)-due(b);}
      if(attentionFilter==='unread')return Date.parse(b.attention?.latest?.at||'1970-01-01')-Date.parse(a.attention?.latest?.at||'1970-01-01');
      return 0;
    });
  }, [leads, attentionFilter, selectedConnectStatus, selectedMode, selectedBuyingSignal, selectedSlaStatus, policyConfig, lang]);

  // Check if any filters or search query are active
  const hasActiveFilters = Boolean(
    attentionFilter !== 'all' ||
    selectedTierTab !== 'All' ||
    selectedStage !== 'All' ||
    selectedSlaStatus !== 'All' ||
    selectedConnectStatus !== 'All' ||
    selectedMode !== 'All' ||
    selectedBuyingSignal !== 'All' ||
    selectedOwner !== 'All' ||
    searchQuery.trim().length > 0
  );

  // Count active dropdowns in advanced filters (6 dropdowns)
  const activeAdvancedFiltersCount = [
    selectedStage !== 'All',
    selectedSlaStatus !== 'All',
    selectedConnectStatus !== 'All',
    selectedMode !== 'All',
    selectedBuyingSignal !== 'All',
    selectedOwner !== 'All'
  ].filter(Boolean).length;

  const handleResetAdvancedFilters = () => {
    setSelectedStage('All');
    setSelectedSlaStatus('All');
    setSelectedConnectStatus('All');
    setSelectedMode('All');
    setSelectedBuyingSignal('All');
    setSelectedOwner('All');
  };

  const handleResetAllFilters = () => {
    const needManualFetch = selectedTierTab === 'All' && selectedStage === 'All' && selectedOwner === 'All' && searchQuery.trim().length > 0;
    setAttentionFilter('all'); setSelectedTierTab('All');
    setSelectedStage('All');
    setSelectedSlaStatus('All');
    setSelectedConnectStatus('All');
    setSelectedMode('All');
    setSelectedBuyingSignal('All');
    setSelectedOwner('All');
    setSearchQuery('');
    if (needManualFetch) {
      setTimeout(() => fetchLeads(), 0);
    }
  };

  const handleSetViewMode = (mode: 'standard' | 'expanded') => {
    setViewMode(mode);
    try {
      safeStorage.setItem('uper_crm_view_mode', mode);
    } catch {
      // fallback
    }
  };

  // Follow-up form state
  const [staffName, setStaffName] = useState('');
  const [employees,setEmployees] = useState<Array<{id:string}>>([]);
  useEffect(()=>{fetch('/api/portal/employees').then(r=>r.json()).then(setEmployees).catch(()=>{});},[]);
  const [channel, setChannel] = useState<'WhatsApp' | 'Phone Call' | 'Campus Visit' | 'Email' | 'Other'>('WhatsApp');
  const [connectStatus, setConnectStatus] = useState<ConnectStatusType>('Connected');
  const [newStage, setNewStage] = useState<StageType>('Contacted');
  const [buyingSignalDetected, setBuyingSignalDetected] = useState<BuyingSignalType>('None yet');
  const [notesSummary, setNotesSummary] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Fetch leads from backend
  const fetchLeads = async (quiet = false) => {
    if(!quiet) setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTierTab !== 'All') params.append('tier', selectedTierTab);
      if (selectedStage !== 'All') params.append('stage', selectedStage);
      if (selectedOwner !== 'All') params.append('owner', selectedOwner);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/crm/leads?${params.toString()}`);
      if(!res.ok){const error=await res.json();throw Error(error.error||String(res.status));}
      if (res.ok) {
        const data = await res.json();
        setLeadActionError('');
        setLeads(data.leads || []);
        if(data.dataScope)setDataScope(data.dataScope);
        if (data.stats) setStats(prev=>({...prev,...data.stats}));

        // Update selected lead if drawer is open
        if (selectedLead) {
          const updated = (data.leads || []).find((l: CrmLeadRecord) => l.id === selectedLead.id);
          if (updated) setSelectedLead(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load CRM leads:', err); setLeadActionError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeadsRef=useRef(fetchLeads);
  useEffect(()=>{fetchLeadsRef.current=fetchLeads;});
  useEffect(() => {
    fetchLeads();
    const timer=setInterval(()=>fetchLeadsRef.current(true),5000); return ()=>clearInterval(timer);
  }, [selectedTierTab, selectedStage, selectedOwner, selectedLead?.id]);

  // Load SLA & Cadence Policy Configuration
  const fetchPolicyConfig = async () => {
    try {
      const res = await fetch('/api/crm/policy-config');
      if (res.ok) {
        const data = await res.json();
        setPolicyConfig(data);
      }
    } catch (e) {
      console.error('Failed to load policy config:', e);
    }
  };

  useEffect(() => {
    fetchPolicyConfig();
  }, []);

  const handleSavePolicy = async (updated: CrmPolicyConfig): Promise<boolean> => {
    try {
      const res = await fetch('/api/crm/policy-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
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
      console.error('Failed to save policy config:', e);
    }
    return false;
  };

  const handleResetPolicy = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/crm/policy-config/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
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
      console.error('Failed to reset policy config:', e);
    }
    return false;
  };

  // Handle Search submit / debounce
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeads();
  };

  // Open drawer for a lead
  const handleOpenLeadDrawer = (lead: CrmLeadRecord, tab: 'profile' | 'activities' | 'playbook' | 'chat' = 'profile') => {
    setSelectedLead(lead);
    setNewStage(lead.currentStage || 'Contacted');
    setBuyingSignalDetected(lead.buyingSignal || 'None yet');
    setNextAction(lead.nextAction || '');
    setNextFollowUpAt(lead.nextFollowUpAt || '');
    setActiveDrawerTab(tab);
    setIsDrawerOpen(true);
    if(lead.attention?.unreadCount){fetch(`/api/crm/leads/${lead.id}/read`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({readThrough:lead.attention.observedAt})}).then(async r=>{if(!r.ok)throw Error((await r.json()).error);setLeadActionError('');fetchLeads(true);}).catch(e=>setLeadActionError(e.message));}
  };

  // Deep links from notifications fetch only the lead authorized by the server.
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('lead');
    if(!id)return;
    let active=true;
    fetch(`/api/crm/leads/${encodeURIComponent(id)}`).then(async response=>{
      const data=await response.json();if(!response.ok)throw Error(data.error || 'Lead unavailable');
      if(active){setCrmModule('leads');handleOpenLeadDrawer(data.lead || data,'activities');}
    }).catch(error=>{if(active)setLeadActionError(error.message);});
    return ()=>{active=false;};
  },[]);

  // Submit follow-up log
  const handleSaveFollowUpLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !notesSummary.trim()) return;

    setIsSubmittingLog(true);
    try {
      const res = await fetch(`/api/crm/leads/${selectedLead.id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffName,
          channel,
          connectStatus,
          newStage,
          buyingSignalDetected,
          summary: notesSummary.trim(),
          nextAction: nextAction.trim(),
          nextFollowUpAt: nextFollowUpAt || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.lead) {
          setSelectedLead(data.lead);
          setNotesSummary('');
          setIsAddLogOpen(false);
          setActiveDrawerTab('activities');
          fetchLeads();
        }
      }
    } catch (err) {
      console.error('Failed to add follow up log:', err);
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Helper for translating buying signal (hoisted function)
  function translateBuyingSignal(signal?: BuyingSignalType): string {
    if (!signal || signal === 'None yet') return t('No signal', '无信号');
    if (signal === 'Asked price') return t('Asked tuition', '问学费');
    if (signal === 'Asked schedule') return t('Asked schedule', '问排期');
    if (signal === 'Asked payment') return t('Asked installments', '问分期');
    if (signal === 'Ready to enroll' || signal === 'Ready to enrol') return t('Ready to enroll', '准备报名');
    return signal;
  }

  // Generate unified Customer Journey & Touch Timeline events
  const journeyTimelineEvents = useMemo(() => {
    if (!selectedLead) return [];
    const events: {
      id: string;
      timestamp: string;
      category: 'engagement' | 'follow_up' | 'milestone';
      actorType: 'client' | 'consultant' | 'system';
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
        category: 'engagement',
        actorType: 'client',
        actorName: selectedLead.fullName,
        icon: '📥',
        badgeText: t('Lead Ingestion', '留资进线'),
        badgeStyle: isLight 
          ? 'bg-blue-50 text-blue-700 border-blue-200' 
          : 'bg-blue-950/60 text-blue-300 border-blue-800',
        title: t(`Student submitted inquiry: ${selectedLead.goal}`, `学员提交留资需求：${selectedLead.goal}`),
        subtitle: `${t('Source:', '场景:')} ${selectedLead.entryPoint} · ${t('Campaign:', '战役:')} ${selectedLead.campaign || t('Direct', '官网直访')} · ${t('Mode:', '意向模式:')} ${selectedLead.mode}`,
        content: `${t('Self-reported:', '自报基础:')} ${selectedLead.reportedLevel} · ${t('City:', '意向城市:')} ${selectedLead.city} · ${t('Status:', '身份:')} ${selectedLead.currentStatus} · ${t('Hook:', '引流钩子:')} ${selectedLead.hookType} (${selectedLead.hookContext})`
      });
    }

    // 2. Client Live Inquiries from Intake Chat (Real Customer Dialogue Engagements)
    if (selectedLead.chatTranscript && selectedLead.chatTranscript.length > 0) {
      selectedLead.chatTranscript
        .filter(msg => msg.role === 'user' && msg.content && !msg.content.includes('---'))
        .forEach((msg, idx) => {
          events.push({
            id: `chat-inquiry-${msg.id || idx}`,
            timestamp: crmMessageTimestamp(msg) || '',
            category: 'engagement',
            actorType: 'client',
            actorName: selectedLead.fullName,
            icon: '💬',
            badgeText: t('Live Inquiry', '学员在线咨询'),
            badgeStyle: isLight
              ? 'bg-sky-50 text-sky-700 border-sky-200'
              : 'bg-sky-950/60 text-sky-300 border-sky-800',
            title: t(`Student asked: "${msg.content.slice(0, 45)}${msg.content.length > 45 ? '...' : ''}"`, `学员咨询提问："${msg.content.slice(0, 45)}${msg.content.length > 45 ? '...' : ''}"`),
            subtitle: t('Live conversation turn from landing page AI consultation', '落地页智能问答留痕'),
            content: msg.content
          });
        });
    }

    // 3. Placement Diagnostic Quiz Event
    if (typeof selectedLead.quizScore === 'number') {
      const breakdownText = selectedLead.quizBreakdown 
        ? `HSK 1: ${selectedLead.quizBreakdown.hsk1Correct}/${selectedLead.quizBreakdown.hsk1Total} · HSK 2: ${selectedLead.quizBreakdown.hsk2Correct}/${selectedLead.quizBreakdown.hsk2Total} · HSK 3: ${selectedLead.quizBreakdown.hsk3Correct}/${selectedLead.quizBreakdown.hsk3Total}`
        : undefined;

      events.push({
        id: `quiz-${selectedLead.id}`,
        timestamp: selectedLead.submittedAt,
        category: 'engagement',
        actorType: 'client',
        actorName: selectedLead.fullName,
        icon: '📊',
        badgeText: t('Placement Test', '定级测评'),
        badgeStyle: isLight 
          ? 'bg-purple-50 text-purple-700 border-purple-200' 
          : 'bg-purple-950/60 text-purple-300 border-purple-800',
        title: t(
          `Completed Diagnostic: ${selectedLead.quizScore}/${selectedLead.quizMaxScore ?? '?'} (${selectedLead.latestAssessment?.levelConfirmed || selectedLead.levelConfirmed || selectedLead.levelState})`,
          `完成摸底测评：${selectedLead.quizScore}/${selectedLead.quizMaxScore ?? '?'} 分 (分班参考: ${selectedLead.latestAssessment?.levelConfirmed || selectedLead.levelConfirmed || selectedLead.levelState})`
        ),
        subtitle: breakdownText,
        content: selectedLead.quizResultSummary || t('Diagnostic results synced to consultant dashboard for personalized curriculum recommendation.', '测评明细已生成，可为学员精准匹配对应的课程分级与班型。')
      });
    }

    // 4. Buying Signals Events (Multi-Signal Accumulation & Intent Evolution)
    const signalsList = selectedLead.buyingSignals && selectedLead.buyingSignals.length > 0
      ? selectedLead.buyingSignals.filter(s => s !== 'None yet')
      : (selectedLead.buyingSignal && selectedLead.buyingSignal !== 'None yet' ? [selectedLead.buyingSignal] : []);

    signalsList.forEach((sig, sIdx) => {
      events.push({
        id: `signal-${selectedLead.id}-${sIdx}`,
        timestamp: selectedLead.tierUpdatedAt || selectedLead.stageUpdatedAt || selectedLead.submittedAt,
        category: 'engagement',
        actorType: 'system',
        icon: '🔥',
        badgeText: t('Buying Signal', '购买信号'),
        badgeStyle: isLight 
          ? 'bg-rose-50 text-rose-700 border-rose-200' 
          : 'bg-rose-950/60 text-rose-300 border-rose-800',
        title: t(
          `High Intent Detected: ${translateBuyingSignal(sig)}`,
          `触发高意向购买信号：${translateBuyingSignal(sig)}`
        ),
        subtitle: t('Protocol Engine auto-escalated priority to Hot (24h response SLA required)', 'R1 智能分层引擎自动提升评级为 Hot（需 24h 内快速破冰）')
      });
    });

    // 5. Follow-up Logs by Consultants
    if (selectedLead.followUpLogs && selectedLead.followUpLogs.length > 0) {
      selectedLead.followUpLogs.forEach((log) => {
        const isConnected = log.connectStatus === 'Connected';
        events.push({
          id: `log-${log.id}`,
          timestamp: log.timestamp,
          category: 'follow_up',
          actorType: 'consultant',
          staffName: log.staffName,
          icon: log.channel === 'WhatsApp' ? '💬' : log.channel === 'Phone Call' ? '📞' : log.channel === 'Campus Visit' ? '🏫' : '📋',
          badgeText: `${t('Consultant Touch', '顾问跟进')} · ${log.channel}`,
          badgeStyle: isConnected
            ? isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
            : isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-950/60 text-amber-300 border-amber-800',
          title: `${log.staffName} · ${log.channel} (${log.connectStatus})`,
          subtitle: `${t('Stage:', '阶段推进:')} ${log.previousStage} ➔ ${log.newStage}`,
          content: log.summary,
          connectStatus: log.connectStatus,
          stageTransition: `${log.previousStage} ➔ ${log.newStage}`,
          nextAction: log.nextAction,
          nextFollowUpAt: log.nextFollowUpAt
        });
      });
    }

    // 6. Trial Session Event (if trial booked or attended)
    if (['Trial Booked', 'Trial Attended'].includes(selectedLead.currentStage)) {
      events.push({
        id: `trial-${selectedLead.id}`,
        timestamp: selectedLead.stageUpdatedAt || selectedLead.submittedAt,
        category: selectedLead.currentStage === 'Trial Attended' ? 'milestone' : 'engagement',
        actorType: 'client',
        actorName: selectedLead.fullName,
        icon: '🏫',
        badgeText: selectedLead.currentStage === 'Trial Attended' ? t('Trial Attended', '试听出席') : t('Trial Booked', '已约试听'),
        badgeStyle: isLight 
          ? 'bg-amber-50 text-amber-700 border-amber-300' 
          : 'bg-amber-950/60 text-amber-300 border-amber-700',
        title: selectedLead.currentStage === 'Trial Attended'
          ? t(`Attended trial lesson at ${selectedLead.city || 'PIK Campus'}`, `已到访 ${selectedLead.city || 'PIK 校区'} 参加试听课`)
          : t(`Booked trial class session (${selectedLead.mode})`, `预约试听课程 (${selectedLead.mode})`),
        subtitle: `${t('Mode:', '授课模式:')} ${selectedLead.mode} · ${t('City/Campus:', '校区城市:')} ${selectedLead.city}`
      });
    }

    // 7. Official Enrollment & Class Confirmation Milestone
    if (selectedLead.currentStage === 'Enrolled' || selectedLead.enrolledClass) {
      events.push({
        id: `milestone-${selectedLead.id}`,
        timestamp: selectedLead.stageUpdatedAt || selectedLead.updatedAt || selectedLead.submittedAt,
        category: 'milestone',
        actorType: 'system',
        icon: '🎓',
        badgeText: t('Enrolled Milestone', '已报名签约'),
        badgeStyle: isLight 
          ? 'bg-indigo-50 text-indigo-700 border-indigo-300' 
          : 'bg-indigo-950/60 text-indigo-300 border-indigo-800',
        title: t(`Enrolled in Course: ${selectedLead.enrolledClass || 'Chinese Core Curriculum'}`, `正式入班签约：${selectedLead.enrolledClass || '中文核心签约班'}`),
        subtitle: selectedLead.revenue 
          ? `${t('Tuition Paid:', '实缴学费:')} Rp ${selectedLead.revenue.toLocaleString()} · ${t('Mode:', '模式:')} ${selectedLead.mode}` 
          : `${t('Mode:', '模式:')} ${selectedLead.mode} · ${t('City:', '城市:')} ${selectedLead.city}`,
        content: t('Welcome package dispatched, class group created, teacher assigned.', '入学材料已发放，班级群已建立，授课师资对接完成。')
      });
    }

    // Sort all events by timestamp descending (newest at top), with logical secondary weight sorting when timestamps match
    return events.sort((a, b) => {
      const timeDiff = compareCrmEventTimes(a,b);
      if(!Number.isFinite(Date.parse(a.timestamp)) && !Number.isFinite(Date.parse(b.timestamp)))return 0;
      if (timeDiff !== 0) return timeDiff;

      const getWeight = (id: string) => {
        if (id.startsWith('intake-')) return 1;
        if (id.startsWith('chat-inquiry-')) return 2;
        if (id.startsWith('quiz-')) return 3;
        if (id.startsWith('signal-')) return 4;
        if (id.startsWith('trial-')) return 5;
        if (id.startsWith('log-')) return 6;
        if (id.startsWith('milestone-')) return 7;
        return 5;
      };

      return getWeight(a.id) - getWeight(b.id);
    });
  }, [selectedLead, isLight, lang]);

  // Dynamic counts for timeline filter pills
  const timelineCounts = useMemo(() => {
    return {
      all: journeyTimelineEvents.length,
      logs: journeyTimelineEvents.filter(e => e.category === 'follow_up').length,
      engagement: journeyTimelineEvents.filter(e => e.category === 'engagement').length,
      milestone: journeyTimelineEvents.filter(e => e.category === 'milestone').length,
    };
  }, [journeyTimelineEvents]);

  // Quick update owner or confirmed tier
  const handleUpdateLeadField = async (leadId: string, updates: Partial<CrmLeadRecord>) => {
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lead) {
          if (selectedLead && selectedLead.id === leadId) setSelectedLead(data.lead);
          fetchLeads();
        }
      }
    } catch (err) {
      console.error('Failed to update lead:', err);
    }
  };

  // Config-driven Dynamic Cadence & SLA calculation
  const getSlaDisplay = (lead: CrmLeadRecord) => {
    if(lead.attention){const task=lead.attention.tasks[0];const overdue=!!task&&(task.status==='overdue'||Date.parse(task.dueAt)<Date.now());return {text:task?(task.status==='migration_hold'?t('Historical task: review required','历史待办待确认'):overdue?t('Overdue','已逾期'):t('Follow-up pending','待跟进')):t('No pending follow-up','暂无待办'),color:overdue?'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800':'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',isOverdue:overdue,suggestedAction:lead.nextAction||'',statusType:task?'scheduled':'none'};}

    const cadence = evaluateLeadCadence(lead, policyConfig, lang);
    return { 
      text: cadence.badgeText, 
      color: cadence.badgeColor,
      isOverdue: cadence.isOverdue,
      suggestedAction: cadence.suggestedAction,
      statusType: cadence.statusType
    };
  };

  // Generate customized WhatsApp Link & text
  const getWhatsAppAction = (lead: CrmLeadRecord) => {
    const cleanPhone = (lead.whatsapp || '').replace(/\D/g, '').replace(/^0/, '62');
    const studentName = lead.fullName || 'Kak';

    let customGreeting = `Halo ${studentName}! Saya ${staffName || 'konsultan'} dari UPER Education. `;

    if (lead.tier === 'Hot') {
      if (lead.levelConfirmed && lead.levelConfirmed !== 'Below HSK 1') {
        customGreeting += `Terima kasih telah mengikuti asesmen HSK di UPER (Hasil: ${lead.levelConfirmed}, Skor: ${lead.quizScore || '-'} poin). Kami telah menyiapkan rekomendasi kelas akselerasi & jadwal terdekat untuk Anda:`;
      } else {
        customGreeting += `Terima kasih telah mengisi formulir minat di UPER Education. Terkait rencana Anda untuk ${lead.goal}, kami telah menyiapkan rincian jadwal dan paket kelas:`;
      }
    } else if (lead.tier === 'Warm-Offline') {
      customGreeting += `Kami melihat Anda berdomisili di area ${lead.city || 'Jabodetabek'} dan berminat kelas offline. Kami mengundang Anda untuk konsultasi tatap muka & trial class gratis di kampus UPER (PIK, Jakarta Utara):`;
    } else {
      customGreeting += `Terima kasih telah menghubungi UPER Education. Terkait minat belajar Mandarin untuk ${lead.goal}, ada yang bisa kami bantu jelaskan terlebih dahulu?`;
    }

    return {
      url: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(customGreeting)}`,
      greetingText: customGreeting
    };
  };

  // Tier Badge Color
  const getTierBadge = (tier: TierType) => {
    switch (tier) {
      case 'Hot':
        return 'bg-rose-600 text-white border-rose-600 shadow-2xs';
      case 'Warm-Offline':
        return 'bg-amber-600 text-white border-amber-600 shadow-2xs';
      case 'Warm-Online':
        return 'bg-blue-600 text-white border-blue-600 shadow-2xs';
      case 'School':
        return 'bg-purple-600 text-white border-purple-600 shadow-2xs';
      case 'Cold-Nurture':
      default:
        return isLight 
          ? 'bg-slate-100 text-slate-700 border-slate-300'
          : 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // Format Touches and Connect Status with bilingual support
  const formatTouchesDisplay = (lead: CrmLeadRecord) => {
    const count = lead.touchCount || 0;
    let statusText = t('Not Contacted', '未建联');
    let statusColor = 'text-slate-400';

    if (lead.connectStatus === 'Connected') {
      statusText = t('Replied', '已回复');
      statusColor = 'text-emerald-500 font-semibold';
    } else if (lead.connectStatus === 'No Response') {
      statusText = count >= 3 
        ? t('No answer (3 follow-ups)', '未接(已跟进3次)') 
        : t('No response', '未接通');
      statusColor = count >= 3 ? 'text-rose-500 font-bold' : 'text-amber-500';
    } else if (lead.connectStatus === 'Wrong Number') {
      statusText = t('Invalid number', '空号错号');
      statusColor = 'text-rose-400';
    } else if (lead.connectStatus === 'Interested') {
      statusText = t('High interest', '意向强烈');
      statusColor = 'text-primary-500 font-bold';
    }

    const countLabel = lang === 'zh' ? `跟进 ${count} 次` : `${count} ${count === 1 ? 'Follow-up' : 'Follow-ups'}`;

    return { count, countLabel, statusText, statusColor };
  };

  // Unified Global CRM Timestamp Formatter (Uniform format: YYYY-MM-DD HH:mm:ss)
  const formatCrmDateTime = (isoString?: string): string => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  };

  // Smart next action recommendation using policy configuration
  const getDisplayNextAction = (lead: CrmLeadRecord): string => {
    if (lead.nextAction && lead.nextAction.trim()) return lead.nextAction.trim();
    if(lead.attention){const task=lead.attention.tasks[0];if(!task)return t('No pending follow-up','暂无待跟进事项');const actions:Record<string,[string,string]>={consultation:['Contact and qualify','联系客户并确认需求'],handoff:['Advisor contact requested','安排顾问联系'],booking:['Confirm booking','确认预约安排'],enrollment:['Follow up enrollment','跟进报名意向']};return actions[task.kind]?.[lang==='zh'?1:0]||t('Follow up with customer','联系客户跟进');}

    return evaluateLeadCadence(lead, policyConfig, lang).suggestedAction;
  };

  // Dynamic, lead-tailored Objection Handling Playbook generator (Fully Personalized per Lead)
  const getPersonalizedObjections = (lead: CrmLeadRecord | null) => {
    if (!lead) return OBJECTION_HANDLING_ITEMS;
    
    let items = OBJECTION_HANDLING_ITEMS.map(item => ({ ...item }));

    // Deeply tailor all answer contents dynamically based on lead profile
    items.forEach(item => {
      if (item.tag === '学费价格') {
        item.answer = lang === 'zh'
          ? `“针对${lead.fullName}同学（身份：${lead.currentStatus}）的目标【${lead.goal}】（${lead.mode}模式 / ${lead.city}），UPER采用中印双师制+小班精细化分层授课，折算单课时仅约 Rp 85,000。目前本期开班有【早鸟名额减免 Rp 300,000】，今天帮您锁定名额，还可以赠送 2 次课后难点回放辅导与官方真题库。”`
          : `"Tailored for ${lead.fullName} (${lead.currentStatus}) targeting ${lead.goal} via ${lead.mode} in ${lead.city}, UPER offers dual-instructor small classes (~Rp 85k/hr) with official materials. Early bird discount of Rp 300k available if locked today!"`;
      } else if (item.tag === '模式效果') {
        item.answer = lang === 'zh'
          ? `“${lead.fullName}同学选择的【${lead.mode}】模式（${lead.city}）完美匹配我们的精品小班制。每班仅限 6~8 人，强制开麦视频互动。若您在${lead.city}，还可随时预约到线下 PIK 校区面授试听，线上线下无缝切换，完全不用担心效果。”`
          : `"For ${lead.fullName}'s chosen ${lead.mode} mode in ${lead.city}, our 6-8 person interactive small classes ensure high engagement. You can also mix with on-site visits at our PIK campus anytime."`;
      } else if (item.tag === '时间安排') {
        item.answer = lang === 'zh'
          ? `“考虑到${lead.fullName}同学身处【${lead.city}】且日程较满，我们专门开设了【周末集训班】与【平日晚间黄金班】。每次课均配有云端高清回放与助教 1v1 课后答疑，完美适配您的个人节奏。”`
          : `"Given ${lead.fullName}'s busy schedule in ${lead.city}, we offer weekend and weekday evening tracks with cloud replays and dedicated 1v1 TA catch-up."`;
      } else if (item.tag === '决策商量') {
        item.answer = lang === 'zh'
          ? `“非常理解！学习是${lead.fullName}及其家庭的重要投资。我已将《UPER 课程分级大纲与印尼中资名企薪酬前景指南》发送至您的 WhatsApp。由于当前【${lead.goal}】班级仅剩 3 个席位，我为您保留 48 小时早鸟特权，您看周五下午我们再沟通如何？”`
          : `"Understood! I've sent the UPER Syllabus & Career Guide to your WhatsApp. Since only 3 seats remain for ${lead.goal}, I will hold your 48h priority slot and follow up on Friday."`;
      }
    });

    // If chat transcript has user questions, dynamically inject a custom targeted objection item
    if (lead.chatTranscript && lead.chatTranscript.length > 0) {
      const userMsgs = lead.chatTranscript.filter(m => m.role === 'user');
      if (userMsgs.length > 0) {
        const lastUserQ = userMsgs[userMsgs.length - 1].content;
        items.unshift({
          tag: '专属进线提问',
          tagEn: 'Intake Inquiry',
          question: `学员进线提问：“${lastUserQ}”`,
          questionEn: `Student intake inquiry: "${lastUserQ}"`,
          answer: lang === 'zh'
            ? `“针对您刚刚关注的【${lastUserQ}】问题：UPER 设有专属教研团队与资深导师。我们会根据您的测试水平（${lead.quizScore !== undefined ? lead.quizScore + '分' : '待测'}）为您量身定制学习路径，确保高通过率与实用性！”`
            : `"Regarding your inquiry about '${lastUserQ}': UPER's expert academic team customizes your path based on your level to ensure high success rate and practical fluency!"`,
          answerEn: `"Regarding your inquiry about '${lastUserQ}': UPER's expert academic team customizes your path based on your level to ensure high success rate and practical fluency!"`
        });
      }
    }

    // Reorder based on buying signal & tier
    if (lead.buyingSignal === 'Asked price' || lead.buyingSignal === 'Asked payment') {
      items.sort((a, b) => (a.tag === '学费价格' ? -1 : b.tag === '学费价格' ? 1 : 0));
    } else if (lead.buyingSignal === 'Asked schedule') {
      items.sort((a, b) => (a.tag === '时间安排' ? -1 : b.tag === '时间安排' ? 1 : 0));
    } else if (lead.buyingSignal === 'Ready to enroll' || lead.buyingSignal === 'Ready to enrol') {
      items.sort((a, b) => (a.tag === '模式效果' ? -1 : b.tag === '模式效果' ? 1 : 0));
    } else if (lead.tier === 'Hot') {
      items.sort((a, b) => (a.tag === '学费价格' ? -1 : b.tag === '学费价格' ? 1 : 0));
    }

    return items;
  };

  // Dynamic Assessment Badge (Test Req vs Tested vs Booked vs Skip)
  const getAssessmentBadge = (lead: CrmLeadRecord) => {
    const isCompleted = typeof lead.quizScore === 'number' || 
                        lead.levelSource === 'assessment' || 
                        ['Assessment Done', 'Trial Booked', 'Trial Attended', 'Enrolled'].includes(lead.currentStage);

    if (isCompleted) {
      const scoreStr = typeof lead.quizScore === 'number' ? ` (${lead.quizScore}分)` : '';
      const scoreStrEn = typeof lead.quizScore === 'number' ? ` (${lead.quizScore}pts)` : '';
      return {
        text: lang === 'zh' ? `✓ 已测${scoreStr}` : `✓ Tested${scoreStrEn}`,
        className: isLight 
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
          : 'bg-emerald-950 text-emerald-300 border-emerald-800',
        title: typeof lead.quizScore === 'number'
          ? t(`Quiz score: ${lead.quizScore}/${lead.quizMaxScore ?? '?'}`, `测评得分: ${lead.quizScore}/${lead.quizMaxScore ?? '?'}`)
          : t('Assessment completed', '已完成在线测评')
      };
    }

    if (lead.currentStage === 'Assessment Booked') {
      return {
        text: lang === 'zh' ? '📅 已约测' : '📅 Booked',
        className: isLight 
          ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
          : 'bg-indigo-950 text-indigo-300 border-indigo-800',
        title: t('Assessment appointment booked', '已预约测试时间')
      };
    }

    if (lead.flag === 'Skip Assessment') {
      return {
        text: lang === 'zh' ? '免测分班' : 'Skip Test',
        className: isLight 
          ? 'bg-blue-50 text-blue-700 border-blue-200' 
          : 'bg-blue-950 text-blue-400 border-blue-800',
        title: t('Direct placement without test', '符合免测直通分班规则')
      };
    }

    return {
      text: lang === 'zh' ? '需测评' : 'Test Req',
      className: isLight 
        ? 'bg-amber-50 text-amber-700 border-amber-200' 
        : 'bg-amber-950 text-amber-400 border-amber-800',
      title: t('Needs diagnostic language test', '待安排中文测评')
    };
  };

  // Professional Designer Polish: Clean Empty State for Tables
  const renderEmptyState = (colSpan: number) => (
    <tr>
      <td colSpan={colSpan} className="py-16 text-center">
        <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3.5 border transition-colors ${
            isLight ? 'bg-slate-100/80 text-slate-400 border-slate-200' : 'bg-slate-800/80 text-slate-500 border-slate-700'
          }`}>
            <Filter className="w-5 h-5 opacity-70" />
          </div>
          <h3 className={`text-sm font-bold mb-1 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
            {t('No leads match the current filters', '暂无符合当前筛选条件的线索')}
          </h3>
          <p className={`text-xs mb-4 leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('Try adjusting or clearing your filters to explore more student inquiries.', '可以尝试调整或清空部分筛选条件，查看全部咨询线索。')}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="px-3.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 active:scale-95 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('Reset All Filters', '清空所有筛选条件')}</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  // Professional Designer Polish: Subtle Skeleton Rows during Loading
  const renderSkeletonRows = (colSpan: number) => {
    return Array.from({ length: 6 }).map((_, i) => (
      <tr key={`skeleton-${i}`} className={`animate-pulse ${isLight ? 'border-b border-slate-100' : 'border-b border-slate-800/60'}`}>
        <td className="py-3.5 px-3">
          <div className={`h-4 w-16 rounded-md ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
          <div className={`h-2.5 w-20 rounded mt-1.5 ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} />
        </td>
        <td className="py-3.5 px-3">
          <div className={`h-4 w-28 rounded-md ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
          <div className={`h-3 w-16 rounded mt-1.5 ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} />
        </td>
        <td className="py-3.5 px-3">
          <div className={`h-4 w-20 rounded-md ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
          <div className={`h-3 w-24 rounded mt-1.5 ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} />
        </td>
        <td className="py-3.5 px-3">
          <div className={`h-4 w-24 rounded-md ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
          <div className={`h-3 w-16 rounded mt-1.5 ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} />
        </td>
        <td className="py-3.5 px-3">
          <div className={`h-4 w-20 rounded-md ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
          <div className={`h-3 w-28 rounded mt-1.5 ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} />
        </td>
        <td className="py-3.5 px-3">
          <div className={`h-4 w-16 rounded-md ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
        </td>
        <td className="py-3.5 px-2.5">
          <div className={`h-6 w-20 rounded-lg ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
        </td>
        <td className="py-3.5 px-3">
          <div className={`h-4 w-16 rounded-md ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
        </td>
        <td className="py-3.5 px-3 text-left">
          <div className={`h-7 w-20 rounded-lg inline-block ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
        </td>
        {colSpan > 9 && Array.from({ length: colSpan - 9 }).map((_, extraIdx) => (
          <td key={`extra-skel-${extraIdx}`} className="py-3.5 px-3 text-left">
            <div className={`h-4 w-16 rounded-md ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
          </td>
        ))}
      </tr>
    ));
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 select-text ${
      isLight ? 'bg-[#f5f5f7] text-[#1d1d1f]' : 'bg-slate-950 text-slate-100'
    }`}>
      {/* Top Apple-Style / Dark Navigation Bar - Stable 2-Row Architecture */}
      <header className={`sticky top-0 z-30 transition-colors duration-200 border-b shadow-2xs ${
        isLight 
          ? 'bg-white/90 backdrop-blur-md border-slate-200/90' 
          : 'bg-slate-900/95 backdrop-blur-md border-slate-800 shadow-md'
      }`}>
        {/* ROW 1: Brand & Module Context Title */}
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2 shrink-0 group hover:opacity-95 transition-opacity" title={t('Back to UPER Homepage', '返回 UPER 官网首页')}>
              <img 
                src="/uper-logo-mark.svg" 
                alt="UPER Logo" 
                width="34"
                height="34"
                className="h-[32px] w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
              />
              <span className={`font-extrabold text-[20px] tracking-[0.03em] leading-none font-sans ${
                isLight ? 'text-slate-900 font-extrabold' : 'text-white'
              }`}>
                UPER
              </span>
            </Link>

            <div className={`h-5 w-px ${isLight ? 'bg-slate-200' : 'bg-slate-800'} hidden sm:block mx-0.5 shrink-0`} />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`text-sm sm:text-base font-bold tracking-tight truncate ${
                  isLight ? 'text-slate-900 font-extrabold' : 'text-white'
                }`}>
                  {crmModule === 'campaigns'
                    ? t('Marketing Campaign & Tracking Hub', '营销活动中心与渠道追溯看板')
                    : crmModule === 'leads' 
                      ? t('Telemarketing & Advisory CRM', '电销跟进与学术顾问 CRM')
                      : crmModule === 'policy'
                        ? t('SLA & Sales Policy Engine', 'SLA 时效与跟进策略配置中心')
                        : t('CRM User Guide & Handbook', 'CRM 在线使用手册与操作指南')}
                </h1>
                <span className="text-slate-300 dark:text-slate-600 select-none hidden md:inline">·</span>
                <span className={`text-[11px] font-mono hidden md:inline ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {crmModule === 'campaigns' ? 'Campaign Hub v2.5' : crmModule === 'leads' ? '2026 Enterprise' : crmModule === 'policy' ? 'Policy v2.0' : 'Handbook v2.0'}
                </span>
              </div>
              <p className={`text-[11px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {crmModule === 'campaigns'
                  ? t('Campaign-to-Leads Closed-Loop Funnel, Unique UTM Short Links & AI Collateral Generator', '营销活动立项、唯一渠道短链追溯、多语种 AI 物料生成与线索闭环漏斗')
                  : crmModule === 'leads' 
                    ? t('Standard Enterprise Data Model & R1~R6 Tier Protocol Engine', '标准数据字典与 R1~R6 智能分层引擎')
                    : crmModule === 'policy'
                      ? t('Configure Business Hours, First Response SLAs, Retries & Automation Triggers', '全域线索作息日历、首响应分级时限与止损策略配置中心')
                      : t('Comprehensive System Architecture, Rules, Data Dictionary & WhatsApp Scripts', '全景业务架构、推演算法、标准数据字典与金牌话术库')}
              </p>
            </div>
          </div>

          {/* Row 1 Right: Quiet system status indicator */}
          <div className="hidden lg:flex items-center gap-2 shrink-0 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono text-[11px]">Jakarta WIB UTC+7</span>
          </div>
        </div>

        {/* ROW 2: Fixed, Always-on-Second-Row Navigation Pills & Actions */}
        <div className="px-4 sm:px-6 py-2 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          {/* Left Cluster of Row 2: Module Switcher Pills + Preferences Group (Language & Theme) */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* 1. Module Switcher Pills (左侧功能页区) */}
            <div className={`flex items-center p-1 rounded-xl border shrink-0 ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}>
              {/* 1. Marketing Campaigns (Placed first for campaign-first workflow) */}
              <button
                type="button"
                onClick={() => setCrmModule('campaigns')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  crmModule === 'campaigns'
                    ? isLight ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'bg-primary-600 text-white shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Target className="w-3.5 h-3.5 text-blue-500" />
                <span>{t('Marketing Campaigns', '营销活动中心')}</span>
              </button>

              {/* 2. Leads CRM */}
              <button
                type="button"
                onClick={() => setCrmModule('leads')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  crmModule === 'leads'
                    ? isLight ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'bg-primary-600 text-white shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{t('Leads CRM', '销售线索')}</span>
              </button>

              {/* 3. SLA & Sales Policy */}
              <button
                type="button"
                onClick={() => setCrmModule('policy')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  crmModule === 'policy'
                    ? isLight ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'bg-primary-600 text-white shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t('SLA & Policy', 'SLA策略配置')}</span>
              </button>

              {/* 4. User Guide & Handbook */}
              <button
                type="button"
                onClick={() => setCrmModule('docs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  crmModule === 'docs'
                    ? isLight ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'bg-primary-600 text-white shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                <span>{t('User Guide & Docs', '在线使用手册')}</span>
              </button>
            </div>

            {/* 2. Unified Preferences Group: Language & Theme Switcher (常驻在左侧三个功能页区的右侧) */}
            <div className={`flex items-center p-1 rounded-xl border shrink-0 ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
            }`}>
              {/* Language Switcher */}
              <button
                type="button"
                onClick={toggleLang}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isLight 
                    ? 'hover:bg-white/90 text-slate-700 hover:shadow-2xs' 
                    : 'hover:bg-slate-700/90 text-slate-200'
                }`}
                title={lang === 'en' ? 'Switch to Chinese Interface' : '切换至英文界面'}
              >
                <Globe className="w-3.5 h-3.5 text-primary-500" />
                <span>{lang === 'en' ? '中文 (ZH)' : 'English (EN)'}</span>
              </button>

              <div className={`h-4 w-px mx-0.5 ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`} />

              {/* Theme Switcher */}
              <button
                type="button"
                onClick={toggleTheme}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isLight 
                    ? 'hover:bg-white/90 text-slate-700 hover:shadow-2xs' 
                    : 'hover:bg-slate-700/90 text-slate-200'
                }`}
                title={isLight ? t('Switch to Dark Mode', '切换至深色模式') : t('Switch to Apple Light Mode', '切换至浅色模式')}
              >
                {isLight ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{t('Dark', '深色')}</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('Light', '浅色')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right of Row 2: Contextual Business Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Contextual Actions in Leads: Refresh & Export */}
            {crmModule === 'leads' && (
              <>
                <button
                  type="button"
                  onClick={()=>fetchLeads()}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 shadow-2xs'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary-500' : ''}`} />
                  <span>{t('Refresh', '刷新数据')}</span>
                </button>

                <a
                  href="/api/crm/export"
                  className="flex items-center gap-1.5 h-8 px-3.5 bg-primary-600 hover:bg-primary-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-primary-900/20 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('Export CSV Data (.CSV)', '导出标准数据 (.CSV)')}</span>
                </a>
              </>
            )}

            {/* Contextual Actions in Policy: Reset Defaults & Save Changes */}
            {crmModule === 'policy' && (
              <>
                {policyControls?.isDirty && (
                  <button
                    type="button"
                    onClick={policyControls.discard}
                    disabled={policyControls.isSaving}
                    className={`flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isLight 
                        ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 shadow-2xs' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                    title={t('Discard current modifications', '放弃本次修改')}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t('Discard', '放弃修改')}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => policyControls?.reset()}
                  disabled={!policyControls || policyControls.isResetting || policyControls.isSaving}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 shadow-2xs'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title={t('Reset all policies to factory default recommendations', '恢复系统官方标准推荐配置')}
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${policyControls?.isResetting ? 'animate-spin' : ''}`} />
                  <span>{t('Reset Defaults', '恢复官方设置')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => policyControls?.save()}
                  disabled={!policyControls || policyControls.isSaving || policyControls.isResetting}
                  className={`flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                    policyControls?.isDirty
                      ? 'bg-primary-600 hover:bg-primary-500 active:scale-95 text-white shadow-primary-900/20 ring-2 ring-primary-400/30'
                      : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/90 shadow-2xs'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  <Save className={`w-3.5 h-3.5 ${policyControls?.isSaving ? 'animate-spin' : ''}`} />
                  <span>
                    {policyControls?.isSaving
                      ? t('Saving...', '保存中...')
                      : policyControls?.isDirty
                        ? t(`Save (${policyControls.modifiedCount})`, `保存 (${policyControls.modifiedCount})`)
                        : t('Save Policies', '保存配置')}
                  </span>
                </button>
              </>
            )}

            {/* Contextual Actions in Docs: Print / PDF */}
            {crmModule === 'docs' && (
              <button
                type="button"
                onClick={() => window.print()}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 shadow-2xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title={t('Print or Export PDF Handbook', '打印或导出 PDF 知识库')}
              >
                <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                <span>{t('Print / PDF', '打印/PDF')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1560px] w-full mx-auto space-y-5">
        {crmModule === 'campaigns' ? (
          <CrmCampaignHub
            isLight={isLight}
            lang={lang}
            leads={leads}
            onSelectLeadInCrm={(leadId) => {
              const target = leads.find(l => l.id === leadId);
              if (target) {
                setSelectedLead(target);
                setIsDrawerOpen(true);
                setCrmModule('leads');
              }
            }}
            onNavigateTab={(tab) => setCrmModule(tab)}
          />
        ) : crmModule === 'policy' ? (
          <>
          <CrmPolicySettings
            isLight={isLight}
            lang={lang}
            policyConfig={policyConfig}
            onSavePolicy={handleSavePolicy}
            onResetPolicy={handleResetPolicy}
            onNavigateTab={(tab) => setCrmModule(tab)}
            onActionControlsChange={setPolicyControls}
          />
          <NotificationCenter isLight={isLight} lang={lang} />
          </>
        ) : crmModule === 'docs' ? (
          <CrmUserGuide
            isLight={isLight}
            lang={lang}
            onNavigateTab={(tab) => setCrmModule(tab)}
          />
        ) : (
          <>
            {/* KPI Dashboard Grid with Standardized Height and Pixel-Perfect Alignment */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Card 1: Total */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group ${
                isLight 
                  ? 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs' 
                  : 'bg-slate-900 border-slate-800 shadow-sm hover:border-slate-700 hover:shadow-md'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    {t('Total Inquiries', '咨询总量')}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-slate-300' : 'bg-slate-600'}`} />
                </div>
                <div className={`text-2xl sm:text-[26px] font-bold font-mono tracking-tight tabular-nums my-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {stats.total}
                </div>
                <span className={`text-[11px] font-medium leading-tight truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('Deduplicated Leads', '去重线索总数')}
                </span>
              </div>

              {/* Card 2: Hot Leads */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group ${
                isLight 
                  ? 'bg-amber-50/40 border-amber-200/70 shadow-2xs hover:border-amber-300 hover:shadow-xs' 
                  : 'bg-amber-950/20 border-amber-900/40 shadow-sm hover:border-amber-800 hover:shadow-md'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                    🔥 {t('Hot Leads', 'Hot 高意向')}
                  </span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                </div>
                <div className={`text-2xl sm:text-[26px] font-bold font-mono tracking-tight tabular-nums my-1.5 ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                  {stats.hot}
                </div>
                <span className={`text-[11px] font-medium leading-tight truncate ${isLight ? 'text-amber-700/80' : 'text-amber-400/80'}`}>
                  {t('Configured SLA', '按配置响应')}
                </span>
              </div>

              {/* Card 3: Overdue SLA */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group ${
                dynamicOverdueCount > 0 
                  ? isLight
                    ? 'bg-rose-50/60 border-rose-300 shadow-2xs text-rose-900 hover:border-rose-400 hover:shadow-xs'
                    : 'bg-rose-950/30 border-rose-800/80 shadow-sm text-rose-200 hover:border-rose-700 hover:shadow-md' 
                  : isLight
                    ? 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs'
                    : 'bg-slate-900 border-slate-800 shadow-sm hover:border-slate-700 hover:shadow-md'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${
                    dynamicOverdueCount > 0 
                      ? isLight ? 'text-rose-800 font-bold' : 'text-rose-300 font-bold'
                      : isLight ? 'text-slate-600' : 'text-slate-300'
                  }`}>
                    ⚠️ {t('Overdue SLA', '逾期待办')}
                  </span>
                  {dynamicOverdueCount > 0 ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    </span>
                  ) : (
                    <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-slate-300' : 'bg-slate-600'}`} />
                  )}
                </div>
                <div className={`text-2xl sm:text-[26px] font-bold font-mono tracking-tight tabular-nums my-1.5 ${
                  dynamicOverdueCount > 0 
                    ? isLight ? 'text-rose-700 font-extrabold' : 'text-rose-300' 
                    : isLight ? 'text-slate-700 font-bold' : 'text-slate-400'
                }`}>
                  {dynamicOverdueCount}
                </div>
                <span className={`text-[11px] font-medium leading-tight truncate ${
                  dynamicOverdueCount > 0
                    ? isLight ? 'text-rose-600 font-semibold' : 'text-rose-400'
                    : isLight ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {dynamicOverdueCount > 0 ? t('Immediate Action Needed', '需立即响应破冰') : t('All In Cadence', '当前无逾期待办')}
                </span>
              </div>

              {/* Card 4: Warm-Offline */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group ${
                isLight 
                  ? 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs' 
                  : 'bg-slate-900 border-slate-800 shadow-sm hover:border-slate-700 hover:shadow-md'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    🏫 {t('Warm-Offline', 'Warm-线下')}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-amber-400' : 'bg-amber-500'}`} />
                </div>
                <div className={`text-2xl sm:text-[26px] font-bold font-mono tracking-tight tabular-nums my-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {stats.warmOffline}
                </div>
                <span className={`text-[11px] font-medium leading-tight truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('Campus Trial Targets', '校区面谈试听目标')}
                </span>
              </div>

              {/* Card 5: Warm-Online */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group ${
                isLight 
                  ? 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs' 
                  : 'bg-slate-900 border-slate-800 shadow-sm hover:border-slate-700 hover:shadow-md'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    🌐 {t('Warm-Online', 'Warm-线上')}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-blue-400' : 'bg-blue-500'}`} />
                </div>
                <div className={`text-2xl sm:text-[26px] font-bold font-mono tracking-tight tabular-nums my-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {stats.warmOnline}
                </div>
                <span className={`text-[11px] font-medium leading-tight truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('Zoom Class Targets', '线上直播班级目标')}
                </span>
              </div>

              {/* Card 6: Enrolled */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group ${
                isLight 
                  ? 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs' 
                  : 'bg-slate-900 border-slate-800 shadow-sm hover:border-slate-700 hover:shadow-md'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    🎓 {t('Enrolled (Closed)', '已报名签约')}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
                </div>
                <div className={`text-2xl sm:text-[26px] font-bold font-mono tracking-tight tabular-nums my-1.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {stats.enrolled}
                </div>
                <span className={`text-[11px] font-medium leading-tight truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('Conv. Rate', '转化率')}: <strong className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.conversionRate}</strong>
                </span>
              </div>
            </div>

            {leadActionError&&<p role="alert" className="text-xs text-rose-500">{leadActionError}</p>}
            <div className="flex gap-2 flex-wrap" aria-label={t('Work queue','工作队列')}>
              {([{id:'all',en:'All accessible leads',zh:'全部可见线索'},{id:'mine',en:'My pending follow-up',zh:'我的待办'},{id:'unread',en:'Unread activity',zh:'未读动态'},{id:'unassigned',en:'Unassigned',zh:'待分配'},{id:'overdue',en:'Overdue',zh:'已逾期'}] as const).filter(f=>f.id!=='unassigned'||dataScope!=='own').map(f=><button key={f.id} type="button" aria-pressed={attentionFilter===f.id} onClick={()=>setAttentionFilter(f.id)} className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${attentionFilter===f.id?'bg-primary-600 text-white border-primary-600':isLight?'bg-white text-slate-600 border-slate-200':'bg-slate-900 text-slate-300 border-slate-700'}`}>{t(f.en,f.zh)}</button>)}
            </div>
        {/* Filter Bar: Row 1 (Tier + Advanced Filters Toggle) -> Collapsible 6 Dropdowns -> Bottom Row (Search + Column Switcher) */}
        <div className={`rounded-2xl p-3.5 space-y-3 transition-colors ${
          isLight ? 'bg-white border border-slate-200/90 shadow-2xs' : 'bg-slate-900 border border-slate-800'
        }`}>
          {/* ROW 1: Tier Category Tabs (Left) + 「高级筛选 ▼」 Button (Right) */}
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            {/* Left: Tier Tabs with horizontal scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0">
              {[
                { id: 'All', label: t('All Leads', '全部线索') },
                { id: 'Hot', label: t('🔥 Hot', '🔥 高意向') },
                { id: 'Warm-Offline', label: t('🏫 Warm-Offline', '🏫 Warm-线下') },
                { id: 'Warm-Online', label: t('🌐 Warm-Online', '🌐 Warm-线上') },
                { id: 'School', label: t('🏢 School (B2B)', '🏢 院校合作(B2B)') },
                { id: 'Cold-Nurture', label: t('❄️ Cold-Nurture', '❄️ 培育池') }
              ].map(tab => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setSelectedTierTab(tab.id)}
                  className={`flex items-center h-8.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    selectedTierTab === tab.id
                      ? 'bg-primary-600 text-white shadow-2xs shadow-primary-900/20'
                      : isLight 
                        ? 'bg-slate-100 hover:bg-slate-200/90 text-slate-600'
                        : 'bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right: 「高级筛选 ▼」 Button (Default collapsed, toggles 6 dropdown filters) */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 h-8.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                showAdvancedFilters
                  ? isLight
                    ? 'bg-primary-50 text-primary-700 border-primary-300 shadow-2xs'
                    : 'bg-primary-950/60 text-primary-300 border-primary-700 shadow-xs'
                  : activeAdvancedFiltersCount > 0
                    ? isLight
                      ? 'bg-primary-50/70 text-primary-700 border-primary-300 shadow-2xs'
                      : 'bg-primary-950/40 text-primary-300 border-primary-700/80'
                    : isLight
                      ? 'bg-slate-100 hover:bg-slate-200/90 text-slate-700 border-slate-200'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={t('Toggle 6 dimension advanced filter dropdowns', '展开/收起 6 大维度高级筛选下拉框')}
            >
              <Filter className={`w-3.5 h-3.5 ${showAdvancedFilters || activeAdvancedFiltersCount > 0 ? 'text-primary-600 dark:text-primary-400' : ''}`} />
              <span>{t('Advanced Filters', '高级筛选')}</span>
              {activeAdvancedFiltersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary-600 text-white leading-tight">
                  {activeAdvancedFiltersCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* COLLAPSIBLE SECTION: 6 Advanced Filter Dropdowns (Default Collapsed) */}
          {showAdvancedFilters && (
            <div className={`pt-3 border-t transition-all ${
              isLight ? 'border-slate-100' : 'border-slate-800/80'
            }`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 w-full">
                {/* 1. Stage Filter (Synchronized with STAGE_OPTIONS) */}
                <div className={`relative flex items-center h-8.5 rounded-xl border transition-all focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200/80 dark:focus-within:border-slate-500 dark:focus-within:ring-slate-800 ${
                  selectedStage !== 'All'
                    ? isLight 
                      ? 'bg-white border-slate-300 shadow-2xs' 
                      : 'bg-slate-900 border-slate-700'
                    : isLight 
                      ? 'bg-slate-50/80 border-slate-200/90 hover:border-slate-300 hover:bg-white' 
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}>
                  <span className={`pl-2.5 pr-1 text-xs font-medium shrink-0 whitespace-nowrap select-none ${
                    selectedStage !== 'All' 
                      ? isLight ? 'text-slate-800 font-semibold' : 'text-slate-200 font-semibold'
                      : isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {t('Stage:', '阶段:')}
                  </span>
                  <select
                    value={selectedStage}
                    onChange={(e) => {
                      setSelectedStage(e.target.value);
                      e.currentTarget.blur();
                    }}
                    onBlur={(e) => e.currentTarget.blur()}
                    style={{ fontSize: '12px', outline: 'none', boxShadow: 'none', backgroundColor: 'transparent' }}
                    className={`w-full h-full pl-0.5 pr-7 appearance-none !text-xs font-sans bg-transparent outline-none focus:outline-none focus:ring-0 focus-visible:outline-none border-none ring-0 cursor-pointer truncate ${
                      selectedStage !== 'All'
                        ? isLight ? 'text-slate-900 font-semibold' : 'text-white font-semibold'
                        : isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'
                    }`}
                  >
                    <option value="All" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('All', '全部')}
                    </option>
                    {STAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                        {t(opt.labelEn, opt.labelZh)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`w-3.5 h-3.5 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-400' : 'text-slate-500'
                  }`} />
                </div>

                {/* 2. Cadence & SLA Filter */}
                <div className={`relative flex items-center h-8.5 rounded-xl border transition-all focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200/80 dark:focus-within:border-slate-500 dark:focus-within:ring-slate-800 ${
                  selectedSlaStatus !== 'All'
                    ? isLight 
                      ? 'bg-white border-slate-300 shadow-2xs' 
                      : 'bg-slate-900 border-slate-700'
                    : isLight 
                      ? 'bg-slate-50/80 border-slate-200/90 hover:border-slate-300 hover:bg-white' 
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}>
                  <span className={`pl-2.5 pr-1 text-xs font-medium shrink-0 whitespace-nowrap select-none ${
                    selectedSlaStatus !== 'All' 
                      ? isLight ? 'text-slate-800 font-semibold' : 'text-slate-200 font-semibold'
                      : isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {t('Cadence:', '时效:')}
                  </span>
                  <select
                    value={selectedSlaStatus}
                    onChange={(e) => {
                      setSelectedSlaStatus(e.target.value);
                      e.currentTarget.blur();
                    }}
                    onBlur={(e) => e.currentTarget.blur()}
                    style={{ fontSize: '12px', outline: 'none', boxShadow: 'none', backgroundColor: 'transparent' }}
                    className={`w-full h-full pl-0.5 pr-7 appearance-none !text-xs font-sans bg-transparent outline-none focus:outline-none focus:ring-0 focus-visible:outline-none border-none ring-0 cursor-pointer truncate ${
                      selectedSlaStatus !== 'All'
                        ? isLight ? 'text-slate-900 font-semibold' : 'text-white font-semibold'
                        : isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'
                    }`}
                  >
                    <option value="All" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('All', '全部')}
                    </option>
                    <option value="overdue" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Overdue', '仅看逾期')}
                    </option>
                    <option value="due_today" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Due Today', '今日约定')}
                    </option>
                    <option value="first_response" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('FRT Due', '待首访响应')}
                    </option>
                    <option value="stale" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Stale', '停滞回访')}
                    </option>
                  </select>
                  <ChevronDown className={`w-3.5 h-3.5 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-400' : 'text-slate-500'
                  }`} />
                </div>

                {/* 3. Connect Status Filter */}
                <div className={`relative flex items-center h-8.5 rounded-xl border transition-all focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200/80 dark:focus-within:border-slate-500 dark:focus-within:ring-slate-800 ${
                  selectedConnectStatus !== 'All'
                    ? isLight 
                      ? 'bg-white border-slate-300 shadow-2xs' 
                      : 'bg-slate-900 border-slate-700'
                    : isLight 
                      ? 'bg-slate-50/80 border-slate-200/90 hover:border-slate-300 hover:bg-white' 
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}>
                  <span className={`pl-2.5 pr-1 text-xs font-medium shrink-0 whitespace-nowrap select-none ${
                    selectedConnectStatus !== 'All' 
                      ? isLight ? 'text-slate-800 font-semibold' : 'text-slate-200 font-semibold'
                      : isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {t('Connect:', '接通:')}
                  </span>
                  <select
                    value={selectedConnectStatus}
                    onChange={(e) => {
                      setSelectedConnectStatus(e.target.value);
                      e.currentTarget.blur();
                    }}
                    onBlur={(e) => e.currentTarget.blur()}
                    style={{ fontSize: '12px', outline: 'none', boxShadow: 'none', backgroundColor: 'transparent' }}
                    className={`w-full h-full pl-0.5 pr-7 appearance-none !text-xs font-sans bg-transparent outline-none focus:outline-none focus:ring-0 focus-visible:outline-none border-none ring-0 cursor-pointer truncate ${
                      selectedConnectStatus !== 'All'
                        ? isLight ? 'text-slate-900 font-semibold' : 'text-white font-semibold'
                        : isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'
                    }`}
                  >
                    <option value="All" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('All', '全部')}
                    </option>
                    <option value="Connected" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Connected', '已建联/沟通中')}
                    </option>
                    <option value="No Response" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('No Response', '未接通/需重试')}
                    </option>
                    <option value="Interested" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Interested', '意向强烈')}
                    </option>
                    <option value="Wrong Number" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Invalid', '空号/错号')}
                    </option>
                  </select>
                  <ChevronDown className={`w-3.5 h-3.5 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-400' : 'text-slate-500'
                  }`} />
                </div>

                {/* 4. Campus Mode Filter */}
                <div className={`relative flex items-center h-8.5 rounded-xl border transition-all focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200/80 dark:focus-within:border-slate-500 dark:focus-within:ring-slate-800 ${
                  selectedMode !== 'All'
                    ? isLight 
                      ? 'bg-white border-slate-300 shadow-2xs' 
                      : 'bg-slate-900 border-slate-700'
                    : isLight 
                      ? 'bg-slate-50/80 border-slate-200/90 hover:border-slate-300 hover:bg-white' 
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}>
                  <span className={`pl-2.5 pr-1 text-xs font-medium shrink-0 whitespace-nowrap select-none ${
                    selectedMode !== 'All' 
                      ? isLight ? 'text-slate-800 font-semibold' : 'text-slate-200 font-semibold'
                      : isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {t('Mode:', '模式:')}
                  </span>
                  <select
                    value={selectedMode}
                    onChange={(e) => {
                      setSelectedMode(e.target.value);
                      e.currentTarget.blur();
                    }}
                    onBlur={(e) => e.currentTarget.blur()}
                    style={{ fontSize: '12px', outline: 'none', boxShadow: 'none', backgroundColor: 'transparent' }}
                    className={`w-full h-full pl-0.5 pr-7 appearance-none !text-xs font-sans bg-transparent outline-none focus:outline-none focus:ring-0 focus-visible:outline-none border-none ring-0 cursor-pointer truncate ${
                      selectedMode !== 'All'
                        ? isLight ? 'text-slate-900 font-semibold' : 'text-white font-semibold'
                        : isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'
                    }`}
                  >
                    <option value="All" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('All', '全部')}
                    </option>
                    <option value="Offline" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Offline (PIK Campus)', '线下面授 (PIK)')}
                    </option>
                    <option value="Online" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Online (Live Cohort)', '线上直播班')}
                    </option>
                  </select>
                  <ChevronDown className={`w-3.5 h-3.5 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-400' : 'text-slate-500'
                  }`} />
                </div>

                {/* 5. Buying Signal Filter */}
                <div className={`relative flex items-center h-8.5 rounded-xl border transition-all focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200/80 dark:focus-within:border-slate-500 dark:focus-within:ring-slate-800 ${
                  selectedBuyingSignal !== 'All'
                    ? isLight 
                      ? 'bg-white border-slate-300 shadow-2xs' 
                      : 'bg-slate-900 border-slate-700'
                    : isLight 
                      ? 'bg-slate-50/80 border-slate-200/90 hover:border-slate-300 hover:bg-white' 
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}>
                  <span className={`pl-2.5 pr-1 text-xs font-medium shrink-0 whitespace-nowrap select-none ${
                    selectedBuyingSignal !== 'All' 
                      ? isLight ? 'text-slate-800 font-semibold' : 'text-slate-200 font-semibold'
                      : isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {t('Buying Signal:', '购买信号:')}
                  </span>
                  <select
                    value={selectedBuyingSignal}
                    onChange={(e) => {
                      setSelectedBuyingSignal(e.target.value);
                      e.currentTarget.blur();
                    }}
                    onBlur={(e) => e.currentTarget.blur()}
                    style={{ fontSize: '12px', outline: 'none', boxShadow: 'none', backgroundColor: 'transparent' }}
                    className={`w-full h-full pl-0.5 pr-7 appearance-none !text-xs font-sans bg-transparent outline-none focus:outline-none focus:ring-0 focus-visible:outline-none border-none ring-0 cursor-pointer truncate ${
                      selectedBuyingSignal !== 'All'
                        ? isLight ? 'text-slate-900 font-semibold' : 'text-white font-semibold'
                        : isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'
                    }`}
                  >
                    <option value="All" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('All', '全部')}
                    </option>
                    <option value="Asked price" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Asked tuition', '咨询学费')}
                    </option>
                    <option value="Asked schedule" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Asked schedule', '咨询时间')}
                    </option>
                    <option value="Asked payment" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Installments', '分期付款')}
                    </option>
                    <option value="Ready to enroll" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('Ready enroll', '准备报名')}
                    </option>
                  </select>
                  <ChevronDown className={`w-3.5 h-3.5 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-400' : 'text-slate-500'
                  }`} />
                </div>

                {/* 6. Owner Filter */}
                <div className={`relative flex items-center h-8.5 rounded-xl border transition-all focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200/80 dark:focus-within:border-slate-500 dark:focus-within:ring-slate-800 ${
                  selectedOwner !== 'All'
                    ? isLight 
                      ? 'bg-white border-slate-300 shadow-2xs' 
                      : 'bg-slate-900 border-slate-700'
                    : isLight 
                      ? 'bg-slate-50/80 border-slate-200/90 hover:border-slate-300 hover:bg-white' 
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}>
                  <span className={`pl-2.5 pr-1 text-xs font-medium shrink-0 whitespace-nowrap select-none ${
                    selectedOwner !== 'All' 
                      ? isLight ? 'text-slate-800 font-semibold' : 'text-slate-200 font-semibold'
                      : isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {t('Owner:', '顾问:')}
                  </span>
                  <select
                    value={selectedOwner}
                    onChange={(e) => {
                      setSelectedOwner(e.target.value);
                      e.currentTarget.blur();
                    }}
                    onBlur={(e) => e.currentTarget.blur()}
                    style={{ fontSize: '12px', outline: 'none', boxShadow: 'none', backgroundColor: 'transparent' }}
                    className={`w-full h-full pl-0.5 pr-7 appearance-none !text-xs font-sans bg-transparent outline-none focus:outline-none focus:ring-0 focus-visible:outline-none border-none ring-0 cursor-pointer truncate ${
                      selectedOwner !== 'All'
                        ? isLight ? 'text-slate-900 font-semibold' : 'text-white font-semibold'
                        : isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'
                    }`}
                  >
                    <option value="All" style={{ fontSize: '12px' }} className={isLight ? 'bg-white text-slate-800 !text-xs' : 'bg-slate-900 text-slate-200 !text-xs'}>
                      {t('All', '全部')}
                    </option>
                    <option value="">未分配</option>{Array.from(new Set(leads.map(l=>l.owner).filter(o=>o&&!employees.some(e=>e.id===o)))).map(owner=><option key={owner} value={owner}>{owner}（历史归属）</option>)}{employees.map(e=><option key={e.id} value={e.id}>{e.id}</option>)}
                  </select>
                  <ChevronDown className={`w-3.5 h-3.5 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-400' : 'text-slate-500'
                  }`} />
                </div>
              </div>
            </div>
          )}

          {/* BOTTOM ROW: Search (Left) + Column Mode Switcher (Right, without 'Frozen' in label) */}
          <div className={`pt-2.5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isLight ? 'border-slate-100' : 'border-slate-800/80'
          }`}>
            {/* Left: Search Box Form + Match Count Tag + Optional Reset */}
            <div className="flex items-center gap-2 flex-1 max-w-2xl w-full flex-wrap sm:flex-nowrap">
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[220px]">
                <div className="relative flex-1">
                  <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                  <input
                    type="text"
                    placeholder={t('Search name, phone / WhatsApp, lead ID...', '搜索姓名、手机 / WhatsApp、线索ID...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full h-8.5 pl-9 pr-7 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700 focus:border-slate-400 transition-colors ${
                      isLight 
                        ? 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white' 
                        : 'bg-slate-950 border border-slate-800 text-slate-200'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-0.5"
                      title={t('Clear search', '清除搜索')}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className={`h-8.5 px-3.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shrink-0 ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-2xs'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  {t('Search', '搜索')}
                </button>
              </form>

              {/* Match count badge */}
              <div className={`flex items-center gap-1.5 px-2.5 h-8.5 rounded-xl text-[11px] font-mono border shrink-0 ${
                isLight ? 'bg-slate-50 border-slate-200/80 text-slate-600' : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{t(`Showing ${filteredLeads.length} leads`, `共匹配 ${filteredLeads.length} 条线索`)}</span>
              </div>

              {/* Reset all filters button if any active */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className={`flex items-center gap-1 h-8.5 px-2.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                    isLight 
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 shadow-2xs' 
                      : 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border-amber-800/60'
                  }`}
                  title={t('Reset all filter criteria', '清空所有筛选条件')}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{t('Reset', '重置')}</span>
                </button>
              )}
            </div>

            {/* Right: Column Count Switcher Capsule (Text without "Frozen") */}
            <div className={`flex items-center p-0.5 rounded-xl border shrink-0 self-end sm:self-auto ${
              isLight ? 'bg-slate-100 border-slate-200/90' : 'bg-slate-800 border-slate-700'
            }`}>
              {/* Standard 9-col */}
              <button
                type="button"
                onClick={() => handleSetViewMode('standard')}
                className={`flex items-center gap-1.5 h-7.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'standard'
                    ? isLight ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'bg-primary-600 text-white shadow-sm font-bold'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('Standard View: 9 columns optimized for screen with frozen columns', '标准视图：9列整屏适配，首两列吸附冻结')}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>{t('9 Cols', '9列')}</span>
              </button>

              {/* Expanded 14-col */}
              <button
                type="button"
                onClick={() => handleSetViewMode('expanded')}
                className={`flex items-center gap-1.5 h-7.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'expanded'
                    ? isLight ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'bg-primary-600 text-white shadow-sm font-bold'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('Expanded View: 14 columns full spreadsheet with frozen columns', '宽表明细：14列全字段明细，首两列平滑冻结')}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>{t('14 Cols', '14列')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Lead Table Container with strict horizontal gesture containment to prevent back/forward swipe navigation */}
        <div className={`rounded-2xl overflow-hidden transition-colors ${
          isLight 
            ? 'bg-white border border-slate-200/90 shadow-xs' 
            : 'bg-slate-900 border border-slate-800 shadow-lg'
        }`}>
          {/* overscroll-x-contain strictly prevents horizontal scroll from triggering browser page swipe / back navigation */}
          <div className="overflow-x-auto overscroll-x-contain select-text [touch-action:pan-x_pan-y]">
            {/* VIEW MODE 1: STANDARD 9 COLUMNS (标准自适应 9 列视图 - 冻结左侧核心标识列) */}
            {viewMode === 'standard' && (
              <table className="w-full text-left text-xs min-w-[1240px] border-separate border-spacing-0">
                <thead className={`font-semibold uppercase tracking-wider border-b ${
                  isLight 
                    ? 'bg-slate-50/95 text-slate-500 border-slate-200/90' 
                    : 'bg-slate-800/95 text-slate-400 border-slate-800'
                }`}>
                  <tr>
                    {/* Fixed Column 1: Lead ID & Date */}
                    <th className={`py-3 px-3 text-left whitespace-nowrap sticky left-0 z-20 w-[115px] min-w-[115px] border-b ${
                      isLight ? 'bg-slate-50 border-slate-200/90' : 'bg-slate-800 border-slate-700'
                    }`}>
                      {t('Lead ID & Date', '线索编号 & 提交')}
                    </th>
                    {/* Fixed Column 2: Student & WhatsApp with Right Divider Shadow */}
                    <th className={`py-3 px-3 text-left whitespace-nowrap sticky left-[115px] z-20 w-[190px] min-w-[190px] border-b border-r shadow-[4px_0_10px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] ${
                      isLight ? 'bg-slate-50 border-slate-200/90 border-r-slate-200' : 'bg-slate-800 border-slate-700 border-r-slate-700'
                    }`}>
                      {t('Student & WhatsApp', '学员 & WhatsApp')}
                    </th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('City & Mode', '城市与授课模式')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Goal & Placement', '目标与测评定级')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Tier & Next Action', '生源分层 & 下一步待办')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Buying Signal', '购买信号')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Current Stage', '推进阶段')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Follow-up Count', '跟进次数')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b w-[130px] ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Owner', '归属顾问')}</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/80'}`}>
                  {isLoading ? (
                    renderSkeletonRows(9)
                  ) : filteredLeads.length === 0 ? (
                    renderEmptyState(9)
                  ) : (
                    filteredLeads.map((lead) => {
                      const sla = getSlaDisplay(lead);
                      const wa = getWhatsAppAction(lead);
                      const touches = formatTouchesDisplay(lead);

                      return (
                        <tr 
                          key={lead.id} 
                          className={`transition-colors cursor-pointer group ${
                            isLight 
                              ? selectedLead?.id === lead.id 
                                ? 'bg-primary-50/60' 
                                : 'hover:bg-slate-50/90'
                              : selectedLead?.id === lead.id 
                                ? 'bg-primary-950/30' 
                                : 'hover:bg-slate-800/50'
                          }`}
                          onClick={() => handleOpenLeadDrawer(lead, 'profile')}
                        >
                          {/* 1. 冻结列 1: 线索编号 & 提交时间 */}
                          <td className={`py-3 px-3 whitespace-nowrap sticky left-0 z-10 w-[115px] min-w-[115px] border-b ${
                            selectedLead?.id === lead.id
                              ? isLight ? 'bg-primary-50 border-slate-100 text-slate-900' : 'bg-primary-950 border-slate-800 text-slate-100'
                              : isLight ? 'bg-white border-slate-100 text-slate-800 group-hover:bg-slate-50' : 'bg-slate-900 border-slate-800 text-slate-200 group-hover:bg-slate-800/80'
                          }`}>
                            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md inline-block ${
                              isLight ? 'bg-slate-100 text-slate-700 border border-slate-200/70' : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                            }`}>
                              {lead.id.replace(/^UPER-/, '')}
                            </span>
                            <span className={`text-[10px] font-mono block mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {formatCrmDateTime(lead.submittedAt)}
                            </span>
                          </td>

                          {/* 2. 冻结列 2: 学员姓名 & WhatsApp 悬停直达图标 & 身份 (带右侧分割阴影) */}
                          <td 
                            className={`py-3 px-3 whitespace-nowrap sticky left-[115px] z-10 w-[190px] min-w-[190px] border-b border-r shadow-[4px_0_10px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] ${
                              selectedLead?.id === lead.id
                                ? isLight ? 'bg-primary-50 border-slate-100 border-r-slate-200 text-slate-900' : 'bg-primary-950 border-slate-800 border-r-slate-700 text-white'
                                : isLight ? 'bg-white border-slate-100 border-r-slate-200 text-slate-900 group-hover:bg-slate-50' : 'bg-slate-900 border-slate-800 border-r-slate-700 text-white group-hover:bg-slate-800/80'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between gap-2.5 max-w-[185px]">
                              <span className={`font-bold text-sm truncate ${isLight ? 'text-slate-900 group-hover:text-primary-600 transition-colors' : 'text-white group-hover:text-primary-400 transition-colors'}`} title={lead.fullName}>
                                {lead.fullName}
                              </span>
                              {/* Vertically aligned WhatsApp Icon with instant 0ms hover tooltip */}
                              <div className="relative group/wa shrink-0">
                                <a
                                  href={wa.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                                    isLight
                                      ? 'bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border-emerald-200 hover:border-emerald-600'
                                      : 'bg-emerald-950/80 hover:bg-emerald-600 text-emerald-400 hover:text-white border-emerald-800/80'
                                  }`}
                                  aria-label={`WhatsApp: ${lead.whatsapp}`}
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                                {/* Instant 0ms Hover Tooltip */}
                                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/wa:flex flex-col items-center z-50 transition-all duration-150">
                                  <div className={`px-2.5 py-1.5 rounded-lg shadow-xl text-[11px] whitespace-nowrap border ${
                                    isLight 
                                      ? 'bg-slate-900 text-white border-slate-700' 
                                      : 'bg-white text-slate-900 border-slate-200'
                                  }`}>
                                    <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-400">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                      <span>{lead.whatsapp}</span>
                                    </div>
                                    <div className={`text-[9.5px] mt-0.5 ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>
                                      {t('Click to launch WhatsApp chat', '点击直接发起 WhatsApp 对话')}
                                    </div>
                                  </div>
                                  <div className={`w-2 h-2 rotate-45 -mt-1 border-r border-b ${
                                    isLight ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                                  }`} />
                                </div>
                              </div>
                            </div>
                            <LeadActivity lead={lead} lang={lang} onOpen={()=>handleOpenLeadDrawer(lead,'chat')} />
                            <span className={`inline-block mt-0.5 px-1.5 py-0.2 text-[9px] rounded font-medium ${
                              lead.currentStatus === 'Working professional'
                                ? isLight ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-blue-950 text-blue-300'
                                : lead.currentStatus === 'Teacher or school staff'
                                ? isLight ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-purple-950 text-purple-300'
                                : isLight ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {lead.currentStatus}
                            </span>
                          </td>

                          {/* 3. 城市与授课模式 */}
                          <td className={`py-3 px-3 whitespace-nowrap border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                            <div className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                              {!lead.city ? t('Unknown','未知') : lead.city === 'Jakarta' ? t('Jakarta (Jabodetabek)', '雅加达 (Jabodetabek)') : t('Other City / Islands', '其他城市/外岛')}
                            </div>
                            <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              lead.mode === 'Offline'
                                ? isLight ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-amber-950 text-amber-300'
                                : lead.mode === 'Online'
                                ? isLight ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-blue-950 text-blue-300'
                                : isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {lead.mode === 'Offline' 
                                ? t('🏫 Offline (PIK Campus)', '🏫 线下面授 (PIK校区)') 
                                : lead.mode === 'Online' 
                                ? t('🌐 Online (Live Zoom)', '🌐 线上直播 (Zoom)') 
                                : t('Flexible / Pending', '灵活/待定')}
                            </span>
                          </td>

                          {/* 4. 目标与定级结果 (Academic Goal & Placement) */}
                          <td className={`py-3 px-3 max-w-[220px] border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                            <span className={`block truncate font-medium text-xs ${isLight ? 'text-slate-800' : 'text-slate-300'}`} title={lead.goal}>
                              {lead.goal}
                            </span>
                            <div className="mt-1">
                              {lead.levelConfirmed || typeof lead.quizScore === 'number' || lead.levelSource === 'assessment' ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-semibold border ${
                                  isLight 
                                    ? 'bg-indigo-50 border-indigo-200/90 text-indigo-700' 
                                    : 'bg-indigo-950/80 border-indigo-800/90 text-indigo-300'
                                }`}>
                                  <span className="text-emerald-500 font-bold">✓</span>
                                  <span>{lead.levelConfirmed || lead.reportedLevel}</span>
                                  <span className="opacity-75">{lead.levelSource==='trial' ? t('Teacher placement','教师定级') : lead.latestAssessment ? t('Paper result','本卷参考') : lead.levelSource==='assessment' ? t('Legacy unverified','历史未核验') : t('Confirmed','已定级')}</span>
                                  {typeof lead.quizScore === 'number' && (
                                    <span className="font-mono font-bold opacity-90">· {t('Paper','本卷')} {lead.quizScore}/{lead.quizMaxScore ?? '?'}{t('pts', '分')}</span>
                                  )}
                                </span>
                              ) : lead.reportedLevel && lead.reportedLevel !== 'Beginner' ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${
                                  isLight 
                                    ? 'bg-amber-50 border-amber-200/90 text-amber-800' 
                                    : 'bg-amber-950/80 border-amber-800/90 text-amber-300'
                                }`}>
                                  <span>{lead.reportedLevel}</span>
                                  <span className="opacity-70">({t('Self-reported', '自述')})</span>
                                  <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">· {t('Test Req', '待测评')}</span>
                                </span>
                              ) : (
                                <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${
                                  isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}>
                                  {lead.reportedLevel === 'Beginner' ? t('Beginner / Zero-base', '零基础') : t('Unknown', '未知')}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 5. 优先级 & 下一步待办 (Priority & Next Action) */}
                          <td className={`py-3 px-3 max-w-[240px] border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border shadow-2xs ${getTierBadge(lead.tier)}`}>
                                {lead.tier}
                              </span>
                              <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${sla.color}`}>
                                {sla.text}
                              </span>
                            </div>
                            <div 
                              className="mt-1 flex items-center gap-1 max-w-[230px]" 
                              title={`${t('Next Action:', '下一步动作:')} ${getDisplayNextAction(lead)}`}
                            >
                              <span className="text-primary-500 text-[10px] shrink-0 font-bold">👉</span>
                              <span className={`text-[10.5px] truncate font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                                {getDisplayNextAction(lead)}
                              </span>
                            </div>
                            <LeadPendingAction lead={lead} lang={lang} />
                          </td>

                          {/* 6. 购买信号 */}
                          <td className={`py-3 px-3 whitespace-nowrap border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                            {lead.buyingSignals && lead.buyingSignals.filter(s => s !== 'None yet').length > 0 ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                {lead.buyingSignals.filter(s => s !== 'None yet').map((sig, sIdx) => (
                                  <span key={sIdx} className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 border ${
                                    isLight 
                                      ? 'bg-rose-50 text-rose-800 border-rose-200 shadow-2xs' 
                                      : 'bg-rose-950 text-rose-300 border-rose-800'
                                  }`}>
                                    <span>🔥</span>
                                    <span>{translateBuyingSignal(sig)}</span>
                                  </span>
                                ))}
                              </div>
                            ) : lead.buyingSignal && lead.buyingSignal !== 'None yet' ? (
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 border ${
                                isLight 
                                  ? 'bg-rose-50 text-rose-800 border-rose-200 shadow-2xs' 
                                  : 'bg-rose-950 text-rose-300 border-rose-800'
                              }`}>
                                <span>🔥</span>
                                <span>{translateBuyingSignal(lead.buyingSignal)}</span>
                              </span>
                            ) : (
                              <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                {t('No signal', '无信号')}
                              </span>
                            )}
                          </td>

                          {/* 7. 当前阶段 (Stage) */}
                          <td className={`py-3 px-2.5 whitespace-nowrap border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`} onClick={(e) => e.stopPropagation()}>
                            <select
                              value={lead.currentStage}
                              onChange={(e) => {
                                handleUpdateLeadField(lead.id, { currentStage: e.target.value as StageType });
                                e.currentTarget.blur();
                              }}
                              onBlur={(e) => e.currentTarget.blur()}
                              style={{ fontSize: '11px', outline: 'none', boxShadow: 'none' }}
                              className={`border text-[11px] rounded-lg h-7.5 px-2 font-medium transition-colors outline-none cursor-pointer focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-500 ${
                                isLight 
                                  ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300' 
                                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
                              }`}
                            >
                              {STAGE_OPTIONS.map((opt) => (
                                <option 
                                  key={opt.value} 
                                  value={opt.value} 
                                  style={{ fontSize: '11px' }} 
                                  className={isLight ? 'bg-white text-slate-800' : 'bg-slate-900 text-slate-100'}
                                >
                                  {t(opt.labelEn, opt.labelZh)}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 8. 跟进统计 (Touches) */}
                          <td className={`py-3 px-3 whitespace-nowrap border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                            <div className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                              {lang === 'zh' ? (
                                <>跟进 <b className="font-mono text-primary-600">{touches.count}</b> 次</>
                              ) : (
                                <><b className="font-mono text-primary-600">{touches.count}</b> {touches.count === 1 ? 'Touch' : 'Touches'}</>
                              )}
                            </div>
                            <span className={`text-[10px] block mt-0.5 ${touches.statusColor}`}>
                              · {touches.statusText}
                            </span>
                          </td>

                          {/* 9. 归属顾问 (Owner) */}
                          <td className={`py-3 px-3 text-left whitespace-nowrap w-[130px] border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`} onClick={(e) => e.stopPropagation()}>
                            <select
                              value={lead.owner || ''}
                              disabled={dataScope==='own'}
                              onChange={(e) => {
                                handleUpdateLeadField(lead.id, { owner: e.target.value });
                                e.currentTarget.blur();
                              }}
                              onBlur={(e) => e.currentTarget.blur()}
                              style={{ fontSize: '11px', outline: 'none', boxShadow: 'none' }}
                              className={`border text-[11px] rounded-lg h-7.5 px-2 font-medium transition-colors outline-none cursor-pointer focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-500 ${
                                isLight 
                                  ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300' 
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <option value="">未分配</option>{lead.owner && !employees.some(e=>e.id===lead.owner) && <option value={lead.owner}>{lead.owner}（历史归属）</option>}{employees.map(e=><option key={e.id} value={e.id}>{e.id}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* VIEW MODE 2: EXPANDED 14 COLUMNS (宽表明细模式 - 冻结左侧核心标识列) */}
            {viewMode === 'expanded' && (
              <table className="w-full text-left text-xs min-w-[1680px] border-separate border-spacing-0">
                <thead className={`font-semibold uppercase tracking-wider border-b ${
                  isLight 
                    ? 'bg-slate-50/95 text-slate-500 border-slate-200/90' 
                    : 'bg-slate-800/95 text-slate-400 border-slate-800'
                }`}>
                  <tr>
                    {/* Fixed Column 1: Lead ID */}
                    <th className={`py-3 px-3 text-left whitespace-nowrap sticky left-0 z-20 w-[95px] min-w-[95px] border-b ${
                      isLight ? 'bg-slate-50 border-slate-200/90' : 'bg-slate-800 border-slate-700'
                    }`}>
                      {t('Lead ID', '线索ID')}
                    </th>
                    {/* Fixed Column 2: Student Name with Right Divider Shadow */}
                    <th className={`py-3 px-3 text-left whitespace-nowrap sticky left-[95px] z-20 w-[140px] min-w-[140px] border-b border-r shadow-[4px_0_10px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] ${
                      isLight ? 'bg-slate-50 border-slate-200/90 border-r-slate-200' : 'bg-slate-800 border-slate-700 border-r-slate-700'
                    }`}>
                      {t('Student Name', '学员姓名')}
                    </th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Submitted At', '提交时间')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Status', '当前身份')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>WhatsApp</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('City', '所在城市')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Mode', '授课模式')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Goal', '学习目标')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Placement Level', '测评定级')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Tier', '生源分层')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('SLA Status', 'SLA倒计时')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Next Action', '下一步动作')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Buying Signal', '购买信号')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Current Stage', '推进阶段')}</th>
                    <th className={`py-3 px-3 text-center whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Follow-up Count', '跟进次数')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Connect Status', '接通状态')}</th>
                    <th className={`py-3 px-3 text-left whitespace-nowrap border-b w-[130px] ${isLight ? 'border-slate-200/90' : 'border-slate-800'}`}>{t('Owner', '归属顾问')}</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/80'}`}>
                  {isLoading ? (
                    renderSkeletonRows(17)
                  ) : filteredLeads.length === 0 ? (
                    renderEmptyState(17)
                  ) : (
                    filteredLeads.map((lead) => {
                      const sla = getSlaDisplay(lead);
                      const wa = getWhatsAppAction(lead);
                      const touches = formatTouchesDisplay(lead);

                      return (
                        <tr 
                          key={lead.id} 
                          className={`transition-colors cursor-pointer group ${
                            isLight 
                              ? selectedLead?.id === lead.id 
                                ? 'bg-primary-50/60' 
                                : 'hover:bg-slate-50/90'
                              : selectedLead?.id === lead.id 
                                ? 'bg-primary-950/30' 
                                : 'hover:bg-slate-800/50'
                          }`}
                          onClick={() => handleOpenLeadDrawer(lead, 'profile')}
                        >
                          {/* 1. 冻结列 1: 线索ID */}
                          <td className={`py-3 px-3 font-mono font-bold whitespace-nowrap sticky left-0 z-10 w-[95px] min-w-[95px] border-b ${
                            selectedLead?.id === lead.id
                              ? isLight ? 'bg-primary-50 border-slate-100 text-slate-900' : 'bg-primary-950 border-slate-800 text-slate-100'
                              : isLight ? 'bg-white border-slate-100 text-slate-800 group-hover:bg-slate-50' : 'bg-slate-900 border-slate-800 text-slate-200 group-hover:bg-slate-800/80'
                          }`}>
                            <span className={`px-1.5 py-0.5 rounded-md inline-block ${
                              isLight ? 'bg-slate-100 border border-slate-200/70' : 'bg-slate-800 border border-slate-700/60'
                            }`}>
                              {lead.id.replace(/^UPER-/, '')}
                            </span>
                          </td>

                          {/* 2. 冻结列 2: 学员姓名 (带右侧分割轻阴影) */}
                          <td className={`py-3 px-3 font-bold whitespace-nowrap sticky left-[95px] z-10 w-[140px] min-w-[140px] border-b border-r shadow-[4px_0_10px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] ${
                            selectedLead?.id === lead.id
                              ? isLight ? 'bg-primary-50 border-slate-100 border-r-slate-200 text-slate-900' : 'bg-primary-950 border-slate-800 border-r-slate-700 text-white'
                              : isLight ? 'bg-white border-slate-100 border-r-slate-200 text-slate-900 group-hover:bg-slate-50' : 'bg-slate-900 border-slate-800 border-r-slate-700 text-white group-hover:bg-slate-800/80'
                          }`}>
                            <div className="truncate max-w-[130px]" title={lead.fullName}>
                              {lead.fullName}
                            </div>
                            <LeadActivity lead={lead} lang={lang} onOpen={()=>handleOpenLeadDrawer(lead,'chat')} />
                          </td>

                          {/* 3. 提交时间 */}
                          <td className={`py-3 px-3 whitespace-nowrap font-mono text-slate-500 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                            {formatCrmDateTime(lead.submittedAt)}
                          </td>

                          {/* 4. 身份 */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              isLight ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {lead.currentStatus}
                            </span>
                          </td>

                          {/* 5. WhatsApp */}
                          <td className="py-3 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <a
                              href={wa.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 font-mono font-semibold inline-flex items-center gap-1"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>{lead.whatsapp}</span>
                            </a>
                          </td>

                          {/* 6. 城市 */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {lead.city}
                          </td>

                          {/* 7. 模式 */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              lead.mode === 'Offline'
                                ? 'bg-amber-100 text-amber-800'
                                : lead.mode === 'Online'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {lead.mode}
                            </span>
                          </td>

                          {/* 8. 目标 */}
                          <td className="py-3 px-3 max-w-[180px] truncate" title={lead.goal}>
                            {lead.goal}
                          </td>

                          {/* 9. 测评定级 */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {lead.levelConfirmed || typeof lead.quizScore === 'number' || lead.levelSource === 'assessment' ? (
                              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-semibold border ${
                                isLight 
                                  ? 'bg-indigo-50 border-indigo-200/90 text-indigo-700' 
                                  : 'bg-indigo-950/80 border-indigo-800/90 text-indigo-300'
                              }`}>
                                <span className="text-emerald-500 font-bold">✓</span>
                                <span>{lead.levelConfirmed || lead.reportedLevel}</span>
                                <span className="opacity-75">{lead.levelSource==='trial' ? t('Teacher placement','教师定级') : lead.latestAssessment ? t('Paper result','本卷参考') : lead.levelSource==='assessment' ? t('Legacy unverified','历史未核验') : t('Confirmed','已定级')}</span>
                                {typeof lead.quizScore === 'number' && (
                                  <span className="font-mono font-bold opacity-90">· {t('Paper','本卷')} {lead.quizScore}/{lead.quizMaxScore ?? '?'}{t('pts', '分')}</span>
                                )}
                              </span>
                            ) : lead.reportedLevel && lead.reportedLevel !== 'Beginner' ? (
                              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${
                                isLight 
                                  ? 'bg-amber-50 border-amber-200/90 text-amber-800' 
                                  : 'bg-amber-950/80 border-amber-800/90 text-amber-300'
                              }`}>
                                <span>{lead.reportedLevel}</span>
                                <span className="opacity-70">({t('Self-reported', '自述')})</span>
                                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">· {t('Test Req', '待测评')}</span>
                              </span>
                            ) : (
                              <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${
                                isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}>
                                {lead.reportedLevel === 'Beginner' ? t('Beginner / Zero-base', '零基础') : t('Unknown', '未知')}
                              </span>
                            )}
                          </td>

                          {/* 10. Tier评级 (纯粹聚焦销售优先度) */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wide border shadow-2xs ${getTierBadge(lead.tier)}`}>
                              {lead.tier}
                            </span>
                          </td>

                          {/* 11. SLA */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sla.color}`}>
                              {sla.text}
                            </span>
                          </td>

                          {/* 12. 下一步动作 (Next Action) */}
                          <td className="py-3 px-3 max-w-[220px]" title={getDisplayNextAction(lead)}>
                            <div className="flex items-center gap-1">
                              <span className="text-primary-500 text-[10px] shrink-0 font-bold">👉</span>
                              <span className={`text-[11px] truncate font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                                {getDisplayNextAction(lead)}
                              </span>
                            </div>
                          <LeadPendingAction lead={lead} lang={lang} />
                          </td>

                          {/* 13. 购买信号 */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {lead.buyingSignals && lead.buyingSignals.filter(s => s !== 'None yet').length > 0 ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                {lead.buyingSignals.filter(s => s !== 'None yet').map((sig, sIdx) => (
                                  <span key={sIdx} className="text-rose-600 font-bold text-xs inline-flex items-center gap-0.5">
                                    🔥 {translateBuyingSignal(sig)}
                                  </span>
                                ))}
                              </div>
                            ) : lead.buyingSignal && lead.buyingSignal !== 'None yet' ? (
                              <span className="text-rose-600 font-bold">🔥 {translateBuyingSignal(lead.buyingSignal)}</span>
                            ) : (
                              <span className="text-slate-400">{t('None', '无')}</span>
                            )}
                          </td>

                          {/* 13. 推进阶段 - 精准对齐紧凑 11px 字号 */}
                          <td className="py-3 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={lead.currentStage}
                              onChange={(e) => {
                                handleUpdateLeadField(lead.id, { currentStage: e.target.value as StageType });
                                e.currentTarget.blur();
                              }}
                              onBlur={(e) => e.currentTarget.blur()}
                              style={{ fontSize: '11px', outline: 'none', boxShadow: 'none' }}
                              className={`border text-[11px] rounded-lg h-7.5 px-2 font-medium transition-colors outline-none cursor-pointer focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-500 ${
                                isLight 
                                  ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-300' 
                                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
                              }`}
                            >
                              {STAGE_OPTIONS.map((opt) => (
                                <option 
                                  key={opt.value} 
                                  value={opt.value} 
                                  style={{ fontSize: '11px' }} 
                                  className={isLight ? 'bg-white text-slate-800' : 'bg-slate-900 text-slate-200'}
                                >
                                  {t(opt.labelEn, opt.labelZh)}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 14. 触达次数 */}
                          <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-center">
                            {touches.count}
                          </td>

                          {/* 15. 接通状态 */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`text-[11px] ${touches.statusColor}`}>
                              {touches.statusText}
                            </span>
                          </td>

                          {/* 16. 归属顾问 (Owner) - 纯净左对齐，无右箭头 */}
                          <td className="py-3 px-3 text-left whitespace-nowrap w-[130px]" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={lead.owner || ''}
                              disabled={dataScope==='own'}
                              onChange={(e) => {
                                handleUpdateLeadField(lead.id, { owner: e.target.value });
                                e.currentTarget.blur();
                              }}
                              onBlur={(e) => e.currentTarget.blur()}
                              style={{ fontSize: '11px', outline: 'none', boxShadow: 'none' }}
                              className={`border text-[11px] rounded-lg h-7.5 px-2 font-medium transition-colors outline-none cursor-pointer focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-500 ${
                                isLight 
                                  ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300' 
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <option value="">未分配</option>{lead.owner && !employees.some(e=>e.id===lead.owner) && <option value={lead.owner}>{lead.owner}（历史归属）</option>}{employees.map(e=><option key={e.id} value={e.id}>{e.id}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
          </>
        )}
      </div>

      {/* Slide-out Action Drawer */}
      {isDrawerOpen && selectedLead && (
        <div className={`fixed inset-0 z-50 flex justify-end transition-opacity ${
          isLight ? 'bg-slate-900/35 backdrop-blur-2xs' : 'bg-black/60 backdrop-blur-xs'
        }`}>
          <div className={`w-full sm:max-w-3xl lg:max-w-4xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 ${
            isLight ? 'bg-white border-l border-slate-200 text-slate-800' : 'bg-slate-900 border-l border-slate-800 text-slate-100'
          }`}>
            {/* Drawer Header: Sticky, high-context business intelligence header */}
            <div className={`p-4 sm:p-5 border-b flex items-start justify-between gap-3 sticky top-0 z-10 ${
              isLight ? 'bg-slate-50/95 backdrop-blur-md border-slate-200' : 'bg-slate-900/95 backdrop-blur-md border-slate-800'
            }`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getTierBadge(selectedLead.tier)}`}>
                    {selectedLead.tier}
                  </span>
                  {(() => {
                    const badge = getAssessmentBadge(selectedLead);
                    return (
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${badge.className}`} title={badge.title}>
                        {badge.text}
                      </span>
                    );
                  })()}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}>
                    {selectedLead.currentStage}
                  </span>
                  <span className={`font-mono text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{selectedLead.id.replace(/^UPER-/, '')}</span>
                  <span className={`text-[10px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    SLA: {new Date(selectedLead.slaDueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
                  <h2 className={`text-lg font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {selectedLead.fullName}
                  </h2>
                  <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>({selectedLead.currentStatus})</span>
                  <span className={`text-xs font-mono font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    · {selectedLead.whatsapp}
                  </span>
                  <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    · {t('Owner:', '顾问:')} <b className={isLight ? 'text-slate-800' : 'text-slate-200'}>{selectedLead.owner}</b>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={getWhatsAppAction(selectedLead).url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
                  title={t('Directly open WhatsApp chat with this student', '直接发起 WhatsApp 沟通')}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                    isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/80' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={t('Close drawer', '关闭窗口')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Tabs: 4-Tab Human-Centric Architecture (Cognition -> Action -> Playbook -> Intake) */}
            <div className={`flex items-center border-b px-4 text-xs font-semibold overflow-x-auto ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}>
              {/* Tab 1: 👤 学员档案 (Student Profile - Default) */}
              <button
                type="button"
                onClick={() => setActiveDrawerTab('profile')}
                className={`py-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeDrawerTab === 'profile'
                    ? 'border-primary-500 text-primary-600 font-bold'
                    : isLight ? 'border-transparent text-slate-500 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{t('Student Profile', '学员档案')}</span>
              </button>

              {/* Tab 2: 📋 全景时间轴 (Unified Journey & Activities Timeline) */}
              <button
                type="button"
                onClick={() => setActiveDrawerTab('activities')}
                className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeDrawerTab === 'activities'
                    ? 'border-primary-500 text-primary-600 font-bold'
                    : isLight ? 'border-transparent text-slate-500 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>{t('Journey Timeline', '全景时间轴')}</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${
                  isLight ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-slate-800 text-slate-300'
                }`}>
                  {timelineCounts.all}
                </span>
              </button>

              {/* Tab 3: 🎯 转化攻坚 (Sales Playbook & Objection Handling) */}
              <button
                type="button"
                onClick={() => setActiveDrawerTab('playbook')}
                className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeDrawerTab === 'playbook'
                    ? 'border-primary-500 text-primary-600 font-bold'
                    : isLight ? 'border-transparent text-slate-500 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>{t('Sales Playbook', '转化攻坚')}</span>
              </button>

              {/* Tab 4: 💬 进线对话 (Intake Chat Transcript) */}
              <button
                type="button"
                onClick={() => setActiveDrawerTab('chat')}
                className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeDrawerTab === 'chat'
                    ? 'border-primary-500 text-primary-600 font-bold'
                    : isLight ? 'border-transparent text-slate-500 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{t('Intake Chat', '进线对话')}</span>
                {selectedLead.chatTranscript && selectedLead.chatTranscript.length > 0 && (
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-full border ${
                    isLight 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                      : 'bg-indigo-900/60 text-indigo-300 border-indigo-700/50'
                  }`}>
                    {selectedLead.chatTranscript.length}
                  </span>
                )}
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* TAB 1: 👤 学员档案 (Student 360° Profile) */}
              {activeDrawerTab === 'profile' && (
                <div className="space-y-4">
                  {/* 1. Identity & Contact Information */}
                  <div className={`p-4 rounded-xl border space-y-2.5 ${
                    isLight ? 'bg-slate-50/80 border-slate-200/90' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-800 border-slate-200' : 'text-slate-200 border-slate-800'}`}>
                        <Users className="w-3.5 h-3.5 text-primary-600" />
                        <span>{t('Contact & Identity', '联系方式与学员身份')}</span>
                      </h3>
                      <span className={`text-[10px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t('Entry:', '进线:')} {formatCrmDateTime(selectedLead.submittedAt)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div><span className={isLight ? 'text-slate-500' : 'text-slate-500'}>{t('Name:', '姓名:')}</span> <b className={isLight ? 'text-slate-900 font-semibold' : 'text-slate-200 font-semibold'}>{selectedLead.fullName}</b></div>
                      <div><span className={isLight ? 'text-slate-500' : 'text-slate-500'}>WhatsApp:</span> <b className="text-emerald-600 font-bold font-mono">{selectedLead.whatsapp}</b></div>
                      <div><span className={isLight ? 'text-slate-500' : 'text-slate-500'}>Email:</span> <b className={isLight ? 'text-slate-900' : 'text-slate-200'}>{selectedLead.email}</b></div>
                      <div><span className={isLight ? 'text-slate-500' : 'text-slate-500'}>{t('Status:', '身份:')}</span> <b className={isLight ? 'text-slate-900' : 'text-slate-200'}>{selectedLead.currentStatus}</b></div>
                      {selectedLead.parentContact && (
                        <div><span className={isLight ? 'text-slate-500' : 'text-slate-500'}>{t('Parent Contact:', '家长联系方式:')}</span> <b className="text-amber-600 font-bold font-mono">{selectedLead.parentContact}</b></div>
                      )}
                      <div><span className={isLight ? 'text-slate-500' : 'text-slate-500'}>{t('Assigned Owner:', '责任顾问:')}</span> <b className={isLight ? 'text-slate-800' : 'text-slate-200'}>{selectedLead.owner}</b></div>
                    </div>
                  </div>

                  {/* 2. Core 3 Questions & Study Intent Profile */}
                  <div className={`p-4 rounded-xl border space-y-2.5 ${
                    isLight ? 'bg-slate-50/80 border-slate-200/90' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <h3 className={`font-bold border-b pb-2 text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-800 border-slate-200' : 'text-slate-200 border-slate-800'}`}>
                      <Activity className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{t('Core 3 Questions & Study Intent', '核心三问意向画像')}</span>
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>{t('Goal:', '目标需求:')}</span> <b className={isLight ? 'text-primary-700' : 'text-indigo-300'}>{selectedLead.goal}</b>
                      </div>
                      {selectedLead.goals && selectedLead.goals.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {selectedLead.goals.map((g, idx) => (
                            <span key={idx} className={`px-2 py-0.5 rounded text-[10px] border ${
                              isLight ? 'bg-white border-slate-200 text-slate-800 font-medium' : 'bg-slate-900 border-slate-800 text-slate-300'
                            }`}>
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                        <div><span className="text-slate-500">{t('Self-Reported:', '自报基础:')}</span> <b className={isLight ? 'text-slate-800' : 'text-slate-200'}>{selectedLead.reportedLevel}</b></div>
                        <div><span className="text-slate-500">{t('Level State:', '状态判断:')}</span> <b className={isLight ? 'text-slate-800' : 'text-slate-200'}>{selectedLead.levelState}</b></div>
                        <div><span className="text-slate-500">{t('Target City:', '意向城市:')}</span> <b className={isLight ? 'text-slate-800' : 'text-slate-200'}>{selectedLead.city}</b></div>
                        <div><span className="text-slate-500">{t('Course Mode:', '授课模式:')}</span> <b className={isLight ? 'text-slate-800' : 'text-slate-200'}>{selectedLead.mode}</b></div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Placement Diagnostic Performance */}
                  <div className={`p-4 rounded-xl border space-y-2.5 ${
                    isLight ? 'bg-slate-50/80 border-slate-200/90' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <h3 className={`font-bold border-b pb-2 text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-800 border-slate-200' : 'text-slate-200 border-slate-800'}`}>
                      <Award className="w-3.5 h-3.5 text-purple-500" />
                      <span>{t('Placement Diagnostic', '测评定级表现')}</span>
                    </h3>
                    {typeof selectedLead.quizScore === 'number' ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                            {t('Diagnostic Score & Confirmed Level:', '摸底得分与判定级别:')}
                          </span>
                          <span className="font-bold font-mono text-emerald-600 text-sm">
                            {selectedLead.quizScore} / {selectedLead.quizMaxScore ?? '?'} ({selectedLead.latestAssessment?.levelConfirmed || selectedLead.levelConfirmed || selectedLead.levelState})
                          </span>
                        </div>
                        {selectedLead.quizBreakdown && (
                          <div className="grid grid-cols-3 gap-2 text-[10px] text-center pt-1">
                            <div className={`p-1.5 rounded-lg border ${isLight ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'}`}>
                              <span className="text-slate-500 block">HSK 1</span>
                              <b className={isLight ? 'text-slate-800 font-bold' : 'text-slate-200 font-bold'}>{selectedLead.quizBreakdown.hsk1Correct}/{selectedLead.quizBreakdown.hsk1Total}</b>
                            </div>
                            <div className={`p-1.5 rounded-lg border ${isLight ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'}`}>
                              <span className="text-slate-500 block">HSK 2</span>
                              <b className={isLight ? 'text-slate-800 font-bold' : 'text-slate-200 font-bold'}>{selectedLead.quizBreakdown.hsk2Correct}/{selectedLead.quizBreakdown.hsk2Total}</b>
                            </div>
                            <div className={`p-1.5 rounded-lg border ${isLight ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'}`}>
                              <span className="text-slate-500 block">HSK 3</span>
                              <b className={isLight ? 'text-slate-800 font-bold' : 'text-slate-200 font-bold'}>{selectedLead.quizBreakdown.hsk3Correct}/{selectedLead.quizBreakdown.hsk3Total}</b>
                            </div>
                          </div>
                        )}
                        {selectedLead.quizResultSummary && (
                          <p className={`text-[11px] leading-relaxed pt-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                            {selectedLead.quizResultSummary}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className={`text-xs italic ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t(`Bypassed per rule (${selectedLead.flag}). Level State is ${selectedLead.levelState}.`, `根据规则免测 (${selectedLead.flag})。水平状态判定为 ${selectedLead.levelState}。`)}
                      </p>
                    )}
                  </div>

                  {/* 4. Marketing Attribution & Lead Context */}
                  <div className={`p-4 rounded-xl border space-y-2 text-[11px] ${
                    isLight ? 'bg-slate-50/80 border-slate-200/90' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <h3 className={`font-bold border-b pb-2 text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-800 border-slate-200' : 'text-slate-200 border-slate-800'}`}>
                      <Building className="w-3.5 h-3.5 text-blue-500" />
                      <span>{t('Attribution & Source', '渠道归因与引流场景')}</span>
                    </h3>
                    <div><span className="text-slate-500">{t('Entry Point:', '进线入口:')}</span> <span className={isLight ? 'text-slate-800' : 'text-slate-300'}>{selectedLead.entryPoint}</span></div>
                    <div><span className="text-slate-500">{t('Campaign:', '推广战役:')}</span> <span className={isLight ? 'text-slate-800' : 'text-slate-300'}>{selectedLead.campaign || t('Direct Web', '官网自然访问')}</span></div>
                    <div><span className="text-slate-500">{t('Hook Context:', '诱饵钩子:')}</span> <span className={isLight ? 'text-slate-800' : 'text-slate-300'}>{selectedLead.hookType} ({selectedLead.hookContext})</span></div>
                  </div>
                </div>
              )}

              {/* TAB 2: 📋 动态与时间轴 (Unified Customer Journey Timeline & Activities) */}
              {activeDrawerTab === 'activities' && (
                <div className="space-y-4">
                  <LeadTaskActions key={selectedLead.id} leadId={selectedLead.id} isLight={isLight} lang={lang} onChange={()=>fetchLeads(true)} />
                  {/* Top Action Bar: Add Follow-up Toggle + Timeline Filter */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsAddLogOpen(!isAddLogOpen)}
                      className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isAddLogOpen
                          ? isLight ? 'bg-primary-50 text-primary-700 border-primary-300 shadow-2xs' : 'bg-primary-950/60 text-primary-300 border-primary-700'
                          : isLight ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 shadow-2xs' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      <PlusCircle className={`w-3.5 h-3.5 transition-transform duration-200 ${isAddLogOpen ? 'rotate-45 text-primary-600' : 'text-primary-500'}`} />
                      <span>{isAddLogOpen ? t('Close Follow-up Form', '收起跟进表单') : t('Log New Follow-up', '记录本次跟进')}</span>
                    </button>

                    {/* Timeline Category Filter */}
                    <div className={`flex items-center p-0.5 rounded-xl border text-[11px] ${
                      isLight ? 'bg-slate-100 border-slate-200/90' : 'bg-slate-800 border-slate-700'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setTimelineFilter('all')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                          timelineFilter === 'all'
                            ? isLight ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'bg-slate-900 text-white shadow-xs font-bold'
                            : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t('All Activities', '全景动态')} ({timelineCounts.all})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimelineFilter('logs')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                          timelineFilter === 'logs'
                            ? isLight ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'bg-slate-900 text-white shadow-xs font-bold'
                            : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t('Follow-ups', '顾问跟进')} ({timelineCounts.logs})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimelineFilter('engagement')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                          timelineFilter === 'engagement'
                            ? isLight ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'bg-slate-900 text-white shadow-xs font-bold'
                            : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t('Student Inquiries', '学员互动')} ({timelineCounts.engagement})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimelineFilter('milestone')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                          timelineFilter === 'milestone'
                            ? isLight ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'bg-slate-900 text-white shadow-xs font-bold'
                            : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t('Milestones', '关键里程碑')} ({timelineCounts.milestone})
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Follow-up Logging Form */}
                  {isAddLogOpen && (
                    <div className={`p-4 rounded-2xl border space-y-3 transition-all ${
                      isLight ? 'bg-slate-50/90 border-slate-200/90 shadow-2xs' : 'bg-slate-950 border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200/70 dark:border-slate-800/70">
                        <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          ✍️ {t('Quick Follow-up Form', '记录顾问触达与跟进结果')}
                        </span>
                        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {t('Saves to timeline & syncs Tier protocol', '保存后自动同步至客户旅程时间轴并更新评级')}
                        </span>
                      </div>

                      <form onSubmit={handleSaveFollowUpLog} className="space-y-3.5">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={`block font-medium mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {t('Staff / Consultant', '顾问责任人')}
                            </label>
                            <select
                              value={staffName}
                              onChange={(e) => {
                                setStaffName(e.target.value);
                                e.currentTarget.blur();
                              }}
                              style={{ outline: 'none', boxShadow: 'none' }}
                              className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-600 ${
                                isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-slate-900 border border-slate-800 text-slate-200'
                              }`}
                            >
                              <option value="">未分配</option>{employees.map(e=><option key={e.id} value={e.id}>{e.id}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className={`block font-medium mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {t('Channel', '沟通方式')}
                            </label>
                            <select
                              value={channel}
                              onChange={(e) => {
                                setChannel(e.target.value as any);
                                e.currentTarget.blur();
                              }}
                              style={{ outline: 'none', boxShadow: 'none' }}
                              className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-600 ${
                                isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-slate-900 border border-slate-800 text-slate-200'
                              }`}
                            >
                              <option value="WhatsApp">WhatsApp</option>
                              <option value="Phone Call">{t('Phone Call', 'Phone Call (电话)')}</option>
                              <option value="Campus Visit">{t('Campus Visit', 'Campus Visit (校区接待)')}</option>
                              <option value="Email">Email</option>
                              <option value="Other">{t('Other', '其他')}</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={`block font-medium mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {t('Connect Status', '接通情况')}
                            </label>
                            <select
                              value={connectStatus}
                              onChange={(e) => {
                                setConnectStatus(e.target.value as any);
                                e.currentTarget.blur();
                              }}
                              style={{ outline: 'none', boxShadow: 'none' }}
                              className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-600 ${
                                isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-slate-900 border border-slate-800 text-slate-200'
                              }`}
                            >
                              <option value="Connected">{t('Connected / Replied', '已接通 / 已回复')}</option>
                              <option value="No Response">{t('No Response / Unreachable', '未接通 / 未回应')}</option>
                              <option value="Wrong Number">{t('Wrong / Invalid Number', '空号错号')}</option>
                              <option value="Interested">{t('High Interest', '意向强烈')}</option>
                            </select>
                          </div>

                          <div>
                            <label className={`block font-medium mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {t('New Stage', '推进阶段')}
                            </label>
                            <select
                              value={newStage}
                              onChange={(e) => {
                                setNewStage(e.target.value as any);
                                e.currentTarget.blur();
                              }}
                              style={{ outline: 'none', boxShadow: 'none' }}
                              className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-600 font-semibold ${
                                isLight ? 'bg-white border border-slate-200 text-slate-900' : 'bg-slate-900 border border-slate-800 text-slate-200'
                              }`}
                            >
                              {STAGE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.value} ({t(opt.labelEn, opt.labelZh)})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className={`block font-medium mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                            {t('Buying Signal (Triggers R1 auto-promotion to Hot)', '是否有购买信号 - 触发R1自动升级Hot')}
                          </label>
                          <select
                            value={buyingSignalDetected}
                            onChange={(e) => {
                              setBuyingSignalDetected(e.target.value as any);
                              e.currentTarget.blur();
                            }}
                            style={{ outline: 'none', boxShadow: 'none' }}
                            className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-600 ${
                              isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-slate-900 border border-slate-800 text-slate-200'
                            }`}
                          >
                            <option value="None yet">{t('None yet', '暂未出现')}</option>
                            <option value="Asked price">{t('Asked tuition/fees', '咨询学费政策')}</option>
                            <option value="Asked schedule">{t('Asked schedule / start date', '询问开班时间')}</option>
                            <option value="Asked payment">{t('Asked payment / installments', '询问付款方案/分期')}</option>
                            <option value="Ready to enroll">{t('Ready to enroll', '准备报名')}</option>
                          </select>
                        </div>

                        <div>
                          <label className={`block font-medium mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                            {t('Communication Notes & Client Feedback', '沟通记录与学员反馈')} <span className="text-rose-500">*</span>
                          </label>
                          <textarea
                            required
                            rows={3}
                            value={notesSummary}
                            onChange={(e) => setNotesSummary(e.target.value)}
                            placeholder={t('e.g. Student works at a Chinese JV, interested in weekend class in PIK, planning to visit next week...', '例如：客户已在印尼中资企业上班，希望周六上课，对 HSK 2 进阶班很感兴趣，准备下周来 PIK 校区面谈...')}
                            className={`w-full rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-600 ${
                              isLight ? 'bg-white border border-slate-200 text-slate-900 focus:bg-white' : 'bg-slate-900 border border-slate-800 text-slate-200'
                            }`}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 items-end">
                          <div>
                            <label className={`block font-medium mb-1 text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {t('Next Action', '下一步动作')}
                            </label>
                            <input
                              type="text"
                              value={nextAction}
                              onChange={(e) => setNextAction(e.target.value)}
                              placeholder={t('e.g. Send Saturday schedule and campus location', '例如：发送周六班级课表与校区定位')}
                              style={{ fontSize: '12px' }}
                              className={`w-full h-[38px] rounded-xl px-3 text-xs font-sans transition-colors outline-none focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-600 ${
                                isLight 
                                  ? 'bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400' 
                                  : 'bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-500'
                              }`}
                            />
                          </div>

                          <div>
                            <label className={`block font-medium mb-1 text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {t('Next Follow-up Date', '下次跟进时间')}
                            </label>
                            <input
                              type="datetime-local"
                              value={nextFollowUpAt}
                              onChange={(e) => setNextFollowUpAt(e.target.value)}
                              style={{ fontSize: '12px' }}
                              className={`w-full h-[38px] rounded-xl px-3 text-xs font-sans transition-colors outline-none focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-400 dark:focus:ring-slate-700 dark:focus:border-slate-600 ${
                                isLight 
                                  ? 'bg-white border border-slate-200 text-slate-900' 
                                  : 'bg-slate-900 border border-slate-800 text-slate-200'
                              }`}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="submit"
                            disabled={isSubmittingLog || !notesSummary.trim()}
                            className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-500 active:scale-[0.99] disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md shadow-primary-900/20 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isSubmittingLog ? t('Saving...', '保存中...') : t('Save Communication Log & Update Tier', '保存跟进记录并同步评级')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddLogOpen(false)}
                            className={`py-2.5 px-3 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                              isLight ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {t('Cancel', '取消')}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Unified Customer Journey Timeline */}
                  <div className="pt-1">
                    {journeyTimelineEvents.length === 0 ? (
                      <div className={`py-12 text-center rounded-2xl border border-dashed ${
                        isLight ? 'bg-slate-50/50 border-slate-200 text-slate-400' : 'bg-slate-950/50 border-slate-800 text-slate-500'
                      }`}>
                        <History className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                        <p>{t('No timeline events recorded yet.', '暂无旅程动态事件。')}</p>
                      </div>
                    ) : (
                      <div className="relative pl-7 sm:pl-9 space-y-4 before:absolute before:left-3.5 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                        {journeyTimelineEvents
                          .filter(e => {
                            if (timelineFilter === 'logs') return e.category === 'follow_up';
                            if (timelineFilter === 'engagement') return e.category === 'engagement';
                            if (timelineFilter === 'milestone') return e.category === 'milestone';
                            return true;
                          })
                          .map((ev) => (
                            <div key={ev.id} className="relative group">
                              {/* Left Node Icon */}
                              <div className={`absolute -left-7 sm:-left-9 top-2 w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-xs border-2 z-10 transition-transform group-hover:scale-110 ${
                                ev.category === 'follow_up'
                                  ? isLight ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-emerald-500/10' : 'bg-emerald-950 border-emerald-600 text-emerald-300'
                                  : ev.category === 'milestone'
                                  ? isLight ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-indigo-500/10' : 'bg-indigo-950 border-indigo-600 text-indigo-300'
                                  : isLight ? 'bg-sky-50 border-sky-400 text-sky-700 shadow-sky-500/10' : 'bg-sky-950 border-sky-600 text-sky-300'
                              }`}>
                                <span className="text-xs select-none">{ev.icon}</span>
                              </div>

                              {/* Event Card */}
                              <div className={`p-3.5 rounded-xl border space-y-2 transition-all shadow-2xs ${
                                isLight 
                                  ? 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs' 
                                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                              }`}>
                                <div className="flex items-center justify-between text-[11px] gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {/* Action Initiator Tag */}
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                      ev.actorType === 'client'
                                        ? isLight ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-sky-950/60 text-sky-300 border-sky-800'
                                        : ev.actorType === 'consultant'
                                        ? isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                        : isLight ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-950/60 text-purple-300 border-purple-800'
                                    }`}>
                                      {ev.actorType === 'client' 
                                        ? `👤 ${t('Client Action', '客户自主')}` 
                                        : ev.actorType === 'consultant' 
                                        ? `👨‍💼 ${t('Consultant Touch', '顾问跟进')}` 
                                        : `🤖 ${t('System Intelligence', '智能判定')}`}
                                    </span>

                                    {/* Event Category Badge */}
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ev.badgeStyle}`}>
                                      {ev.badgeText}
                                    </span>

                                    {ev.staffName && (
                                      <span className={`font-bold text-xs ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                                        {ev.staffName}
                                      </span>
                                    )}
                                  </div>

                                  <span className={`font-mono text-[10.5px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                    <Clock className="w-3 h-3" />
                                    {ev.timestamp && Number.isFinite(Date.parse(ev.timestamp))?formatCrmDateTime(ev.timestamp):t('Unknown time','未知时间')}
                                  </span>
                                </div>

                                <div className={`font-semibold text-xs leading-snug ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                                  {ev.title}
                                </div>

                                {ev.subtitle && (
                                  <div className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {ev.subtitle}
                                  </div>
                                )}

                                {ev.content && (
                                  <p className={`text-xs leading-relaxed whitespace-pre-wrap pt-0.5 ${
                                    isLight ? 'text-slate-700' : 'text-slate-300'
                                  }`}>
                                    {ev.content}
                                  </p>
                                )}

                                {(ev.nextAction || ev.stageTransition) && (
                                  <div className={`flex items-center justify-between pt-2 border-t text-[10px] gap-2 flex-wrap ${
                                    isLight ? 'border-slate-100 text-slate-500' : 'border-slate-800 text-slate-400'
                                  }`}>
                                    {ev.stageTransition && (
                                      <span className="flex items-center gap-1">
                                        {t('Stage:', '阶段推进:')} <b className="text-primary-600 font-medium">{ev.stageTransition}</b>
                                      </span>
                                    )}
                                    {ev.nextAction && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-primary-500" />
                                        {t('Next:', '下一步:')} <span className={isLight ? 'text-slate-800 font-semibold' : 'text-slate-200 font-semibold'}>{ev.nextAction}</span>
                                        {ev.nextFollowUpAt && (
                                          <span className="text-slate-400 font-mono">
                                            ({new Date(ev.nextFollowUpAt).toLocaleDateString([], { month: 'numeric', day: 'numeric' })})
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
              {activeDrawerTab === 'playbook' && (
                <div className="space-y-4">
                  {/* Strategy Guidance */}
                  <div className={`p-4 rounded-xl border ${
                    isLight ? 'bg-indigo-50/80 border-indigo-200/90 text-indigo-950' : 'bg-indigo-950/40 border-indigo-800/60'
                  }`}>
                    <span className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-indigo-900' : 'text-indigo-300'}`}>
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>{t('Target Strategy:', '核心转化攻坚策略:')} {selectedLead.tier} · {selectedLead.flag}</span>
                    </span>
                    <p className={`text-[11px] mt-1.5 leading-relaxed ${isLight ? 'text-indigo-800' : 'text-indigo-200/80'}`}>
                      {selectedLead.tier === 'Hot'
                        ? t('Direct class recommendation + tuition quote + remaining quota. Level is confirmed; do not force testing to avoid friction.', '直接给班级建议 + 报价 + 锁定剩余名额。水平已清，严禁硬推测验以免打退客户。')
                        : selectedLead.tier === 'Warm-Offline'
                        ? t('Jakarta local candidate: prioritize invitation for face-to-face consultation at PIK campus or offline free trial session.', '雅加达本地客户，重点邀约到 PIK 校区面谈或参加线下免费试听课。')
                        : selectedLead.tier === 'Warm-Online'
                        ? t('Online remote student: if level state is partial, first step is booking diagnostic test.', '线上客户，若水平未知（PARTIAL）则第一步必须先约测评定级。')
                        : t('Institutional or school representative: route to B2B partnership workflow.', '学校老师或机构客户，转 B2B 合作流程。')}
                    </p>
                  </div>

                  {/* Recommended WhatsApp Icebreaker Pitch */}
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    isLight ? 'bg-slate-50 border-slate-200/90' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t('Recommended WhatsApp Pitch:', '推荐 WhatsApp 破冰话术:')}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const wa = getWhatsAppAction(selectedLead);
                          navigator.clipboard.writeText(wa.greetingText);
                          setCopiedScript(true);
                          setTimeout(() => setCopiedScript(false), 2000);
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg cursor-pointer transition-all ${
                          isLight 
                            ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs' 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedScript ? t('Copied!', '已复制!') : t('Copy Text', '复制话术')}</span>
                      </button>
                    </div>

                    <p className={`text-xs leading-relaxed p-3 rounded-lg border select-all font-sans ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-800 shadow-2xs' 
                        : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}>
                      {getWhatsAppAction(selectedLead).greetingText}
                    </p>

                    <a
                      href={getWhatsAppAction(selectedLead).url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{t('Open WhatsApp Directly', '立即唤起 WhatsApp 发起对话')}</span>
                    </a>
                  </div>

                  {/* Battle-Tested Objection Handling Playbook */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between pb-1">
                      <span className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                        <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t('Objection Handling Playbook', '高频异议化解金牌对策')}</span>
                      </span>
                      <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t('4 Common Scenarios', '4 大经典场景')}
                      </span>
                    </div>

                    {/* Smart Personalization Banner */}
                    <div className={`p-3 rounded-xl border text-[11px] flex items-start gap-2 mb-2.5 ${
                      isLight ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900' : 'bg-indigo-950/40 border-indigo-800 text-indigo-200'
                    }`}>
                      <Sparkles className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block mb-0.5">
                          {t('Tailored for this specific student profile', '已针对该学员画像智能定制与排序')}
                        </span>
                        <span>
                          {t(
                            `Prioritized based on ${selectedLead.fullName}'s intent (${selectedLead.buyingSignal || 'General'}) and mode (${selectedLead.mode} in ${selectedLead.city}).`,
                            `已根据 ${selectedLead.fullName} 的身份（${selectedLead.currentStatus}）、购买信号（${selectedLead.buyingSignal || '无'}）及授课模式（${selectedLead.mode} / ${selectedLead.city}）自动定制话术切入点并重新排序。`
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {getPersonalizedObjections(selectedLead).map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                            isLight ? 'bg-white border-slate-200/90 shadow-2xs' : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] gap-2">
                            <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] border ${
                              isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}>
                              {lang === 'zh' ? item.tag : item.tagEn}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const text = lang === 'zh' ? item.answer : item.answerEn;
                                navigator.clipboard.writeText(text);
                                setCopiedObjectionIdx(idx);
                                setTimeout(() => setCopiedObjectionIdx(null), 2000);
                              }}
                              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-lg border transition-all cursor-pointer ${
                                isLight 
                                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200' 
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                            >
                              {copiedObjectionIdx === idx ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedObjectionIdx === idx ? t('Copied!', '已复制') : t('Copy Answer', '复制应答')}</span>
                            </button>
                          </div>

                          <div className={`font-semibold text-xs ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                            ❓ {lang === 'zh' ? item.question : item.questionEn}
                          </div>

                          <p className={`text-[11px] leading-relaxed p-2.5 rounded-lg border font-sans select-all ${
                            isLight ? 'bg-slate-50/80 border-slate-100 text-slate-700' : 'bg-slate-950/60 border-slate-800 text-slate-300'
                          }`}>
                            💡 {lang === 'zh' ? item.answer : item.answerEn}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: 💬 进线对话 (Intake Chat Transcript) */}
              {activeDrawerTab === 'chat' && (
                <div className="space-y-3">
                  <div className={`p-3 rounded-xl flex items-center justify-between text-xs border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <div>
                      <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                        {t('AI Advisory Dialogue Transcript', 'AI 咨询全量对话记录')}
                      </span>
                      <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('Full conversation logs between student and AI advisor at intake', '记录学员在入口端与 AI / 顾问的每一轮真实提问与回复')}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 font-mono text-[10px] rounded border ${
                      isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}>
                      {selectedLead.chatTranscript?.length || 0} {t('messages', '条消息')}
                    </span>
                  </div>

                  {(!selectedLead.chatTranscript || selectedLead.chatTranscript.length === 0) ? (
                    <div className={`py-12 text-center rounded-xl border border-dashed ${
                      isLight ? 'bg-slate-50/50 border-slate-200 text-slate-400' : 'bg-slate-950/50 border-slate-800 text-slate-500'
                    }`}>
                      <MessageCircle className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                      <p>{t('No chat logs recorded yet (student submitted form directly).', '暂无对话记录（该学员直接提交了表单或尚未发送提问）')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      {selectedLead.chatTranscript.map((msg, idx) => {
                        const isDivider = msg.content?.includes('--- 📅') || msg.role === 'system';
                        if (isDivider) {
                          return (
                            <div key={msg.id || idx} className="py-2.5 flex items-center justify-center">
                              <span className={`px-3 py-1 rounded-full text-[10.5px] font-medium tracking-wide border shadow-2xs ${
                                isLight 
                                  ? 'bg-amber-50 text-amber-900 border-amber-200/90' 
                                  : 'bg-amber-950/70 text-amber-300 border-amber-800/80'
                              }`}>
                                {msg.content.replace(/---/g, '').trim()}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={msg.id || idx}
                            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                              <span className={`font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                {msg.role === 'user' ? `👤 ${selectedLead.fullName}` : '🤖 UPER AI Advisor'}
                              </span>
                              <span className="font-mono">
                                · {crmMessageTimeLabel(msg,lang,formatCrmDateTime)}
                              </span>
                            </div>
                            <div
                              className={`p-3 rounded-2xl max-w-[88%] text-xs leading-relaxed whitespace-pre-wrap ${
                                msg.role === 'user'
                                  ? 'bg-primary-600 text-white rounded-tr-xs shadow-xs'
                                  : isLight
                                    ? 'bg-slate-100 text-slate-900 rounded-tl-xs border border-slate-200/90 shadow-2xs'
                                    : 'bg-slate-950 text-slate-200 rounded-tl-xs border border-slate-800 shadow-sm'
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
