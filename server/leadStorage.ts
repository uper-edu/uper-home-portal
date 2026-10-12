import fs from 'fs';
import path from 'path';
import type { 
  CrmLeadRecord, 
  FollowUpLog, 
  StageType, 
  ConnectStatusType, 
  OutcomeType
} from '../src/types/crmLead.ts';
import {
  evaluateFullLeadTier,
  calculateSlaDueTime
} from '../src/types/crmLead.ts';
import type { 
  CurrentStatusType, 
  GoalType, 
  ReportedLevelType, 
  LevelStateType, 
  CityType, 
  ModeType, 
  BuyingSignalType, 
  TierType, 
  HookType, 
  HookContextType 
} from '../src/types/leadSystem.ts';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'leads_db.json');

// Ensure database directory and file exist
function ensureDbExists(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

// In-memory cache
let leadsCache: CrmLeadRecord[] | null = null;

function loadLeads(): CrmLeadRecord[] {
  if (leadsCache !== null) {
    return leadsCache;
  }
  ensureDbExists();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    leadsCache = JSON.parse(raw) as CrmLeadRecord[];
  } catch (err) {
    console.error('[LEAD DB] Error reading DB file, resetting cache:', err);
    leadsCache = [];
  }
  return leadsCache;
}

function persistLeads(): void {
  ensureDbExists();
  if (leadsCache === null) return;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(leadsCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[LEAD DB] Failed to save leads database:', err);
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0/, '62');
}

let ownerIndex = 0;
function assignInitialOwner(status: CurrentStatusType, tier: TierType): string {
  if (status === 'Teacher or school staff' || tier === 'School') {
    return 'B2B owner';
  }
  if (tier === 'Cold-Nurture') {
    return 'Online Ops';
  }
  const salesTeam = ['Sales A', 'Sales B'];
  const assigned = salesTeam[ownerIndex % salesTeam.length];
  ownerIndex++;
  return assigned;
}

// Smart Chat Transcript merger that stacks multiple sessions without overwriting
function mergeChatTranscripts(
  existing: any[] = [],
  incoming: any[] = []
): any[] {
  if (!incoming || incoming.length === 0) return existing || [];
  if (!existing || existing.length === 0) return incoming;

  const existingTexts = existing.map(m => `${m.role}:${(m.content || m.text || '').trim()}`);
  const incomingTexts = incoming.map(m => `${m.role}:${(m.content || m.text || '').trim()}`);

  // Check if incoming is a direct continuation of current session
  const isContinuation = existing.length <= incoming.length && 
    existing.every((m, idx) => `${m.role}:${(m.content || m.text || '').trim()}` === incomingTexts[idx]);

  if (isContinuation) {
    return incoming;
  }

  // Filter messages not yet recorded
  const newMessages = incoming.filter(inc => {
    const key = `${inc.role}:${(inc.content || inc.text || '').trim()}`;
    return !existingTexts.includes(key);
  });

  if (newMessages.length === 0) {
    return existing;
  }

  // Insert a distinct session separator badge so sales staff clearly sees each session
  const now = new Date();
  const dividerMessage = {
    id: `divider-${Date.now()}`,
    role: 'assistant',
    content: `--- 📅 新会话记录 / New Chat Session (${now.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) ---`,
    timestamp: now.toISOString()
  };

  return [...existing, dividerMessage, ...newMessages];
}

export function upsertLeadFromIntake(payload: {
  fullName: string;
  whatsapp: string;
  email: string;
  currentStatus: CurrentStatusType;
  parentContact?: string;
  goal: GoalType;
  goals?: GoalType[];
  reportedLevel: ReportedLevelType;
  levelState: LevelStateType;
  city: CityType;
  mode: ModeType;
  buyingSignal?: BuyingSignalType;
  buyingSignals?: BuyingSignalType[];
  hskExamPlan?: string;
  entryPoint?: string;
  campaign?: string;
  placement?: string;
  hookType?: HookType;
  hookContext?: HookContextType;
  quizScore?: number;
  totalQuestions?: number;
  levelConfirmed?: string;
  quizResultSummary?: string;
  quizBreakdown?: {
    hsk1Correct?: number;
    hsk1Total?: number;
    hsk2Correct?: number;
    hsk2Total?: number;
    hsk3Correct?: number;
    hsk3Total?: number;
  };
  chatTranscript?: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }>;
}): CrmLeadRecord {
  const leads = loadLeads();
  const normPhone = normalizePhone(payload.whatsapp);
  const normEmail = (payload.email || '').trim().toLowerCase();

  // Deduplicate by normalized WhatsApp or Email
  const existingIdx = leads.findIndex(l => {
    const lPhone = normalizePhone(l.whatsapp);
    const lEmail = (l.email || '').trim().toLowerCase();
    return (normPhone && lPhone && normPhone === lPhone) || (normEmail && lEmail && normEmail === lEmail);
  });

  const nowIso = new Date().toISOString();

  // Calculate R1 ~ R6 Tier
  const tierResult = evaluateFullLeadTier({
    buyingSignal: payload.buyingSignal,
    currentStatus: payload.currentStatus,
    goal: payload.goal,
    levelState: payload.levelState,
    city: payload.city,
    mode: payload.mode,
    hskExamPlan: payload.hskExamPlan,
    assessmentDone: typeof payload.quizScore === 'number'
  });

  if (existingIdx >= 0) {
    // Merge / update existing lead
    const existing = leads[existingIdx];
    
    // Check if re-engaged via a different campaign (Multi-Touch Attribution)
    if (payload.campaign && payload.campaign !== existing.campaign) {
      (existing as any).latestCampaign = payload.campaign;
      if (!existing.followUpLogs) existing.followUpLogs = [];
      existing.followUpLogs.unshift({
        id: `log-${Date.now()}`,
        timestamp: nowIso,
        staffName: 'AI Attribution Engine',
        channel: 'WhatsApp',
        connectStatus: 'Connected',
        previousStage: existing.currentStage,
        newStage: existing.currentStage,
        summary: `🔄 [Multi-Touch Attribution] Lead re-engaged via Campaign: "${payload.campaign}" (Original First-Touch: "${existing.campaign}")`,
        nextAction: 'Review re-engagement intent and provide updated campaign offer.'
      });
    }

    // Save chat transcript if provided - merge & stack without overwriting past conversations
    if (payload.chatTranscript && payload.chatTranscript.length > 0) {
      existing.chatTranscript = mergeChatTranscripts(existing.chatTranscript || [], payload.chatTranscript);
    }
    
    // Update quiz info if new assessment taken
    if (typeof payload.quizScore === 'number') {
      existing.quizScore = payload.quizScore;
      existing.totalQuestions = payload.totalQuestions;
      existing.levelConfirmed = payload.levelConfirmed || existing.levelConfirmed;
      existing.levelSource = 'assessment';
      existing.quizResultSummary = payload.quizResultSummary || existing.quizResultSummary;
      if (payload.quizBreakdown) {
        existing.quizBreakdown = payload.quizBreakdown;
      }
      if (existing.currentStage === 'New' || existing.currentStage === 'Contacted') {
        existing.currentStage = 'Assessment Done';
        existing.stageUpdatedAt = nowIso;
      }
    }

    if (payload.goals && payload.goals.length > 0) existing.goals = payload.goals;
    if (payload.buyingSignals && payload.buyingSignals.length > 0) existing.buyingSignals = payload.buyingSignals;
    if (payload.buyingSignal && payload.buyingSignal !== 'None yet') {
      existing.buyingSignal = payload.buyingSignal;
    }

    // Recalculate Tier if not confirmed by sales
    if (!existing.tierConfirmed) {
      const recalculated = evaluateFullLeadTier({
        buyingSignal: existing.buyingSignal,
        currentStage: existing.currentStage,
        currentStatus: existing.currentStatus,
        goal: existing.goal,
        levelState: existing.levelState,
        city: existing.city,
        mode: existing.mode,
        hskExamPlan: payload.hskExamPlan,
        connectStatus: existing.connectStatus,
        touchCount: existing.touchCount,
        assessmentDone: typeof existing.quizScore === 'number'
      });
      existing.tier = recalculated.tier;
      existing.tierPredicted = recalculated.tier;
      existing.tierSource = recalculated.source;
      existing.tierUpdatedAt = nowIso;
      existing.flag = recalculated.flag;
      existing.slaDueTime = calculateSlaDueTime(existing.submittedAt, existing.tier);
    }

    existing.updatedAt = nowIso;
    persistLeads();
    return existing;
  }

  // Create brand new Lead
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randSeq = String(leads.length + 1).padStart(4, '0');
  const leadId = `${dateStr}-${randSeq}`;

  const slaDueTime = calculateSlaDueTime(nowIso, tierResult.tier);
  const initialStage: StageType = typeof payload.quizScore === 'number' ? 'Assessment Done' : 'New';
  const owner = assignInitialOwner(payload.currentStatus, tierResult.tier);

  const newLead: CrmLeadRecord = {
    id: leadId,
    entryPoint: payload.entryPoint || 'Direct Portal',
    campaign: payload.campaign || 'Seminar 2026',
    placement: payload.placement || 'QR Scanner',
    hookType: payload.hookType || 'hsk_assessment',
    hookContext: payload.hookContext || 'campus_career_talk',
    submittedAt: nowIso,

    fullName: payload.fullName,
    whatsapp: payload.whatsapp,
    email: payload.email,
    currentStatus: payload.currentStatus,
    parentContact: payload.parentContact,

    goal: payload.goal,
    goals: payload.goals || [payload.goal],
    reportedLevel: payload.reportedLevel,
    levelState: payload.levelState,
    city: payload.city,
    mode: payload.mode,
    levelConfirmed: payload.levelConfirmed || (payload.levelState === 'ZERO' ? 'Below HSK 1' : undefined),
    levelSource: typeof payload.quizScore === 'number' ? 'assessment' : 'self',

    quizScore: payload.quizScore,
    totalQuestions: payload.totalQuestions,
    quizBreakdown: payload.quizBreakdown,
    quizResultSummary: payload.quizResultSummary,

    tier: tierResult.tier,
    tierPredicted: tierResult.tier,
    tierSource: tierResult.source,
    tierUpdatedAt: nowIso,
    flag: tierResult.flag,
    slaDueTime,

    currentStage: initialStage,
    stageUpdatedAt: nowIso,
    buyingSignal: payload.buyingSignal || 'None yet',
    buyingSignals: payload.buyingSignals || (payload.buyingSignal ? [payload.buyingSignal] : []),
    touchCount: 0,

    owner,
    nextAction: tierResult.tier === 'Hot' ? 'Direct class advice & quotation via WhatsApp' : 'First contact & qualification',
    
    followUpLogs: [],
    chatTranscript: payload.chatTranscript || [],
    updatedAt: nowIso
  };

  leads.unshift(newLead);
  persistLeads();
  return newLead;
}

export function syncLeadChatMessages(
  identifier: { whatsapp?: string; email?: string; leadId?: string },
  messages: Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }>
): CrmLeadRecord | null {
  const leads = loadLeads();
  const normPhone = identifier.whatsapp ? normalizePhone(identifier.whatsapp) : '';
  const normEmail = (identifier.email || '').trim().toLowerCase();

  const lead = leads.find(l => {
    if (identifier.leadId && l.id === identifier.leadId) return true;
    const lPhone = normalizePhone(l.whatsapp);
    const lEmail = (l.email || '').trim().toLowerCase();
    return (normPhone && lPhone && normPhone === lPhone) || (normEmail && lEmail && normEmail === lEmail);
  });

  if (!lead) return null;

  lead.chatTranscript = mergeChatTranscripts(lead.chatTranscript || [], messages);
  lead.updatedAt = new Date().toISOString();
  persistLeads();
  return lead;
}

export function addFollowUpLog(
  leadId: string,
  logData: {
    staffName: string;
    channel: 'WhatsApp' | 'Phone Call' | 'Campus Visit' | 'Email' | 'Other';
    connectStatus: ConnectStatusType;
    newStage: StageType;
    buyingSignalDetected?: BuyingSignalType;
    summary: string;
    nextAction: string;
    nextFollowUpAt?: string;
  }
): CrmLeadRecord | null {
  const leads = loadLeads();
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return null;

  const nowIso = new Date().toISOString();
  const logId = `LOG-${Date.now()}`;

  const newLog: FollowUpLog = {
    id: logId,
    timestamp: nowIso,
    staffName: logData.staffName,
    channel: logData.channel,
    connectStatus: logData.connectStatus,
    previousStage: lead.currentStage,
    newStage: logData.newStage,
    buyingSignalDetected: logData.buyingSignalDetected,
    summary: logData.summary,
    nextAction: logData.nextAction,
    nextFollowUpAt: logData.nextFollowUpAt
  };

  lead.followUpLogs.unshift(newLog);

  // Update lead fields
  lead.touchCount = (lead.touchCount || 0) + 1;
  lead.connectStatus = logData.connectStatus;
  lead.lastContactedAt = nowIso;
  lead.nextAction = logData.nextAction;
  lead.nextFollowUpAt = logData.nextFollowUpAt;
  lead.owner = logData.staffName || lead.owner;

  if (lead.currentStage !== logData.newStage) {
    lead.currentStage = logData.newStage;
    lead.stageUpdatedAt = nowIso;
  }

  if (logData.buyingSignalDetected && logData.buyingSignalDetected !== 'None yet') {
    lead.buyingSignal = logData.buyingSignalDetected;
    if (!lead.buyingSignals) lead.buyingSignals = [];
    if (!lead.buyingSignals.includes(logData.buyingSignalDetected)) {
      lead.buyingSignals.push(logData.buyingSignalDetected);
    }
  }

  // Re-evaluate R1 ~ R6 Tier dynamically!
  if (!lead.tierConfirmed) {
    const recalculated = evaluateFullLeadTier({
      buyingSignal: lead.buyingSignal,
      currentStage: lead.currentStage,
      currentStatus: lead.currentStatus,
      goal: lead.goal,
      levelState: lead.levelState,
      city: lead.city,
      mode: lead.mode,
      connectStatus: lead.connectStatus,
      touchCount: lead.touchCount,
      assessmentDone: typeof lead.quizScore === 'number'
    });
    lead.tier = recalculated.tier;
    lead.tierSource = recalculated.source;
    lead.tierUpdatedAt = nowIso;
    lead.flag = recalculated.flag;
  }

  lead.updatedAt = nowIso;
  persistLeads();
  return lead;
}

export function updateLeadDetails(
  leadId: string,
  updates: {
    owner?: string;
    tierConfirmed?: TierType;
    currentStage?: StageType;
    outcome?: OutcomeType;
    enrolledClass?: string;
    revenue?: number;
    levelConfirmed?: string;
    nextAction?: string;
    nextFollowUpAt?: string;
  }
): CrmLeadRecord | null {
  const leads = loadLeads();
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return null;

  const nowIso = new Date().toISOString();

  if (updates.owner !== undefined) lead.owner = updates.owner;
  if (updates.tierConfirmed !== undefined) {
    lead.tierConfirmed = updates.tierConfirmed;
    lead.tier = updates.tierConfirmed;
    lead.tierSource = 'sales_confirmed';
    lead.tierUpdatedAt = nowIso;
  }
  if (updates.currentStage !== undefined && updates.currentStage !== lead.currentStage) {
    lead.currentStage = updates.currentStage;
    lead.stageUpdatedAt = nowIso;
  }
  if (updates.outcome !== undefined) lead.outcome = updates.outcome;
  if (updates.enrolledClass !== undefined) lead.enrolledClass = updates.enrolledClass;
  if (updates.revenue !== undefined) lead.revenue = updates.revenue;
  if (updates.levelConfirmed !== undefined) lead.levelConfirmed = updates.levelConfirmed;
  if (updates.nextAction !== undefined) lead.nextAction = updates.nextAction;
  if (updates.nextFollowUpAt !== undefined) lead.nextFollowUpAt = updates.nextFollowUpAt;

  lead.updatedAt = nowIso;
  persistLeads();
  return lead;
}

export function queryLeads(params: {
  tier?: string;
  stage?: string;
  search?: string;
  owner?: string;
}): {
  leads: CrmLeadRecord[];
  stats: {
    total: number;
    hot: number;
    warmOffline: number;
    warmOnline: number;
    school: number;
    coldNurture: number;
    overdueSla: number;
    enrolled: number;
    conversionRate: string;
  };
} {
  const allLeads = loadLeads();
  const nowMs = Date.now();

  // Compute summary stats
  const total = allLeads.length;
  const hot = allLeads.filter(l => l.tier === 'Hot').length;
  const warmOffline = allLeads.filter(l => l.tier === 'Warm-Offline').length;
  const warmOnline = allLeads.filter(l => l.tier === 'Warm-Online').length;
  const school = allLeads.filter(l => l.tier === 'School').length;
  const coldNurture = allLeads.filter(l => l.tier === 'Cold-Nurture').length;

  const overdueSla = allLeads.filter(l => {
    if (l.currentStage === 'Enrolled' || l.currentStage === 'Lost') return false;
    if (l.tier === 'Cold-Nurture') return false;
    const dueMs = new Date(l.slaDueTime).getTime();
    return dueMs < nowMs && l.touchCount === 0;
  }).length;

  const enrolled = allLeads.filter(l => l.currentStage === 'Enrolled' || l.outcome === 'Enrolled').length;
  const conversionRate = total > 0 ? ((enrolled / total) * 100).toFixed(1) + '%' : '0.0%';

  // Filter
  let filtered = [...allLeads];

  if (params.tier && params.tier !== 'All') {
    filtered = filtered.filter(l => l.tier === params.tier);
  }

  if (params.stage && params.stage !== 'All') {
    filtered = filtered.filter(l => l.currentStage === params.stage);
  }

  if (params.owner && params.owner !== 'All') {
    filtered = filtered.filter(l => l.owner === params.owner);
  }

  if (params.search) {
    const q = params.search.toLowerCase().trim();
    filtered = filtered.filter(l => 
      l.fullName.toLowerCase().includes(q) ||
      l.whatsapp.includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q) ||
      (l.city && l.city.toLowerCase().includes(q))
    );
  }

  return {
    leads: filtered,
    stats: {
      total,
      hot,
      warmOffline,
      warmOnline,
      school,
      coldNurture,
      overdueSla,
      enrolled,
      conversionRate
    }
  };
}

export function getLeadById(leadId: string): CrmLeadRecord | null {
  const leads = loadLeads();
  return leads.find(l => l.id === leadId) || null;
}

export function generateLarkSheetCsv(): string {
  const leads = loadLeads();
  // 12 categories aligned with Lark Sheet Field Optimization Proposal
  const headers = [
    'Lead ID',
    'Submitted At',
    'Full Name',
    'WhatsApp',
    'Email',
    'Current Status',
    'Parent Contact',
    'Goal',
    'Level (Reported)',
    'Level State',
    'City',
    'Mode',
    'Level Confirmed',
    'Level Source',
    'Quiz Score',
    'Total Questions',
    'Tier (Current)',
    'Tier (Predicted)',
    'Tier (Confirmed)',
    'Tier Source',
    'Flag',
    'SLA Due Time',
    'Current Stage',
    'Connect Status',
    'Buying Signal',
    'Touch Count',
    'Owner',
    'Next Action',
    'Next Follow-up At',
    'Outcome',
    'Enrolled Class',
    'Revenue',
    'Entry Point',
    'Campaign',
    'Hook Type',
    'Hook Context'
  ];

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = leads.map(l => [
    escapeCsv(l.id),
    escapeCsv(l.submittedAt),
    escapeCsv(l.fullName),
    escapeCsv(l.whatsapp),
    escapeCsv(l.email),
    escapeCsv(l.currentStatus),
    escapeCsv(l.parentContact || ''),
    escapeCsv(l.goal),
    escapeCsv(l.reportedLevel),
    escapeCsv(l.levelState),
    escapeCsv(l.city),
    escapeCsv(l.mode),
    escapeCsv(l.levelConfirmed || ''),
    escapeCsv(l.levelSource || ''),
    escapeCsv(l.quizScore ?? ''),
    escapeCsv(l.totalQuestions ?? ''),
    escapeCsv(l.tier),
    escapeCsv(l.tierPredicted),
    escapeCsv(l.tierConfirmed || ''),
    escapeCsv(l.tierSource),
    escapeCsv(l.flag),
    escapeCsv(l.slaDueTime),
    escapeCsv(l.currentStage),
    escapeCsv(l.connectStatus || ''),
    escapeCsv(l.buyingSignal),
    escapeCsv(l.touchCount),
    escapeCsv(l.owner),
    escapeCsv(l.nextAction || ''),
    escapeCsv(l.nextFollowUpAt || ''),
    escapeCsv(l.outcome || ''),
    escapeCsv(l.enrolledClass || ''),
    escapeCsv(l.revenue ?? ''),
    escapeCsv(l.entryPoint),
    escapeCsv(l.campaign),
    escapeCsv(l.hookType),
    escapeCsv(l.hookContext)
  ].join(','));

  // UTF-8 BOM for flawless Excel & Lark Sheet Chinese/Indonesian display
  return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
}
