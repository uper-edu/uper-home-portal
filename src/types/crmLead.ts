import type { 
  CurrentStatusType, 
  GoalType, 
  ReportedLevelType, 
  LevelStateType, 
  CityType, 
  ModeType, 
  BuyingSignalType, 
  TierType, 
  FlagType, 
  HookType, 
  HookContextType
} from './leadSystem.ts';
import {
  determineFlag,
  determineLevelState
} from './leadSystem.ts';

export type StageType = 
  | 'New'
  | 'Contacted'
  | 'Assessment Booked'
  | 'Assessment Done'
  | 'Trial Booked'
  | 'Trial Attended'
  | 'Enrolled'
  | 'Lost';

export type ConnectStatusType = 
  | 'Connected'
  | 'No Response'
  | 'Wrong Number'
  | 'Interested';

export type OutcomeType = 
  | 'Enrolled'
  | 'Paid'
  | 'Hold'
  | 'Lost';

export interface FollowUpLog {
  id: string;
  timestamp: string;
  staffName: string;
  channel: 'WhatsApp' | 'Phone Call' | 'Campus Visit' | 'Email' | 'Other';
  connectStatus: ConnectStatusType;
  previousStage: StageType;
  newStage: StageType;
  buyingSignalDetected?: BuyingSignalType;
  summary: string;
  nextAction: string;
  recordKind?: "contact" | "closure";
  requestId?: string;
  completeTaskIds?: string[];
  disposition?: string;
  nextFollowUpAt?: string;
}

export interface ChatTranscriptMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  timestampKnown?: boolean;
  created_at?: string;
  status?: string;
  source?: string;
  error?: string | null;
  originalTimestamp?: unknown;
  metadata?: {followupAction?: string;taskId?: string|null;language?: string;taskOperation?: "created"|"supplemented"};
}

export interface LeadAttention {
  unreadCount: number;
  observedAt: string;
  latest?: {type:string;at:string;source?:string};
  tasks: Array<{id:string;kind:string;ownerId:string|null;status:string;dueAt:string;originalDueAt?:string;scheduledAt?:string|null;timingKind?:string;details?:{action?:string;purpose?:string;sourceMessageId?:string;sourceConversationId?:string}}>;
  isMine: boolean;
}
export interface CrmLeadRecord {
  ownerChangedAt?: string;
  attendanceRecords?: Array<{campaignId:string;confirmed:boolean;mode:"onsite"|"online";reason:string;actor:string;recordedAt:string}>;
  communicationLanguage?: "en"|"id"|"zh"|"unknown";
  contactArrangement?: {state: "active"|"waiting"|"nurture"|"stopped"; reason:string;reviewAt?:string;at:string;actor:string;version:number};
  contactStats?: ReturnType<typeof import("../utils/crmContact").contactStatistics>;
  attention?: LeadAttention;

  // ① 场景来源
  id: string; // Immutable internal ID (UUID for new leads; imported IDs stay unchanged).
  businessNumber?: string; // CRM display number, YYYYMMDD-NNN, daily in Operating Timezone.
  entryPoint: string;
  campaign: string;
  campaignId?: string;
  placement: string;
  hookType: HookType;
  hookContext: HookContextType;
  submittedAt: string;

  // ② 客户基础
  fullName: string;
  whatsapp: string;
  email: string;
  currentStatus: CurrentStatusType;
  parentContact?: string;

  // ③ 核心三问
  goal: GoalType;
  goals?: GoalType[];
  reportedLevel: ReportedLevelType;
  levelState: LevelStateType;
  city: CityType;
  mode: ModeType;
  levelConfirmed?: string;
  levelSource?: 'self' | 'assessment' | 'trial' | 'mixed';

  // ④ 测评成绩
  quizScore?: number;
  quizMaxScore?: number;
  latestAssessment?: import('../data/hskAssessment').HskResult;
  assessmentProvenance?: 'server_recomputed_adapted_paper' | 'legacy_unverified';
  totalQuestions?: number;
  quizBreakdown?: {
    hsk1Correct?: number;
    hsk1Total?: number;
    hsk2Correct?: number;
    hsk2Total?: number;
    hsk3Correct?: number;
    hsk3Total?: number;
  };
  quizResultSummary?: string;

  // ⑤ 判定标签
  tier: TierType; // Current Effective Tier
  tierPredicted: TierType;
  tierConfirmed?: TierType;
  tierSource: 'predicted' | 'sales_confirmed' | 'behaviour_override' | 'buying_signal';
  tierUpdatedAt: string;
  flag: FlagType;
  slaDueTime: string; // ISO string

  // ⑥ 跟进依据
  currentStage: StageType;
  stageRevision?: number;
  stageUpdatedAt: string;
  buyingSignal: BuyingSignalType;
  buyingSignals?: BuyingSignalType[];
  buyingEvidence?: import("../utils/crmBuyingEvidence").BuyingEvidence[];
  connectStatus?: ConnectStatusType;
  touchCount: number;

  // ⑦ 任务与分配
  owner: string; // Sales A, Sales B, B2B owner, Online Ops
  followUpDisposition?: {kind: string; reason: string; at: string; actor: string};
  nextAction?: string;
  nextFollowUpAt?: string;
  reminderSent?: boolean;
  attendanceConfirmed?: boolean;

  // ⑧ 结果
  outcome?: OutcomeType;
  enrolledClass?: string;
  revenue?: number;

  // ⑨ 历史沟通记录
  followUpLogs: FollowUpLog[];

  // ⑩ AI 客服完整对话记录
  chatTranscript?: ChatTranscriptMessage[];

  // ⑪ 元数据
  lastContactedAt?: string;
  updatedAt: string;
}

/**
 * 计算 SLA 截止时间 (ISO 时间戳)
 */
export function calculateSlaDueTime(submittedAt: string, tier: TierType): string {
  const base = new Date(submittedAt).getTime() || Date.now();
  let hours = 48;
  if (tier === 'Hot') hours = 24;
  else if (tier === 'Warm-Offline') hours = 48;
  else if (tier === 'Warm-Online') hours = 72;
  else if (tier === 'School') hours = 48;
  else if (tier === 'Cold-Nurture') hours = 168; // 7 days for nurture

  return new Date(base + hours * 60 * 60 * 1000).toISOString();
}

/**
 * 完整 R1 ~ R6 Tier 推演引擎
 */
export function evaluateFullLeadTier(lead: {
  buyingSignal?: BuyingSignalType;
  currentStage?: StageType;
  currentStatus: CurrentStatusType;
  goal: GoalType;
  levelState: LevelStateType;
  city: CityType;
  mode: ModeType;
  hskExamPlan?: string;
  connectStatus?: ConnectStatusType;
  touchCount?: number;
  assessmentDone?: boolean;
}): { tier: TierType; flag: FlagType; source: 'predicted' | 'behaviour_override' | 'buying_signal' } {
  const levelState = lead.levelState;
  const flag = determineFlag(levelState);

  // R6: 回滚规则 Connect Status = No Response 且 Touch Count >= 3 -> 降至 Cold-Nurture
  if (lead.connectStatus === 'No Response' && (lead.touchCount || 0) >= 3) {
    return { tier: 'Cold-Nurture', flag, source: 'behaviour_override' };
  }

  // R1: 人工信号覆盖 (Buying Signal ≠ None yet) -> 一律 Hot
  if (lead.buyingSignal && lead.buyingSignal !== 'None yet') {
    return { tier: 'Hot', flag, source: 'buying_signal' };
  }

  // R2: 行为覆盖 Trial Attended -> 一律 Hot
  if (lead.currentStage === 'Trial Attended') {
    return { tier: 'Hot', flag, source: 'behaviour_override' };
  }

  // R3: B2B 优先 Current Status = Teacher / School staff -> School
  if (lead.currentStatus === 'Teacher or school staff') {
    return { tier: 'School', flag, source: 'predicted' };
  }

  // R4: 三问打底
  const isStrongGoal = 
    lead.goal === 'Work in China' ||
    lead.goal === 'Work at a Chinese or China-Indonesia joint venture company in Indonesia' ||
    lead.goal === 'Study in China or scholarship' ||
    lead.goal === 'Prepare for HSK certification';

  let tier: TierType = 'Cold-Nurture';

  if (!isStrongGoal) {
    tier = 'Cold-Nurture';
  } else {
    if (levelState === 'KNOWN') {
      tier = 'Hot';
    } else if (lead.city === 'Jakarta' && (lead.mode === 'Offline' || lead.mode === 'Not sure')) {
      tier = 'Warm-Offline';
    } else {
      tier = 'Warm-Online';
    }
  }

  // R5: 行为微调 (Assessment Done 或 Trial Booked -> 在 R4 结果上升一档，Cold 除外)
  const isStageAdvanced = 
    lead.currentStage === 'Assessment Done' || 
    lead.currentStage === 'Trial Booked' ||
    lead.assessmentDone;

  if (isStageAdvanced && tier !== 'Cold-Nurture') {
    if (tier === 'Warm-Offline' || tier === 'Warm-Online') {
      return { tier: 'Hot', flag, source: 'behaviour_override' };
    }
  }

  return { tier, flag, source: 'predicted' };
}
