/**
 * UPER Lead System Data Models & Business Rules Engine
 * Aligned strictly with:
 * 1. UPER 线索标签（Tag）与分层（Tier）使用规则
 * 2. UPER GForm（谷歌表单）优化提案
 * 3. UPER 线索数据表（Lark Sheet）字段优化提案
 */

export type TierType = 'Hot' | 'Warm-Offline' | 'Warm-Online' | 'School' | 'Cold-Nurture';
export type FlagType = 'Skip Assessment' | 'Assessment Needed';
export type LevelStateType = 'KNOWN' | 'PARTIAL' | 'ZERO';

export type CurrentStatusType = 
  | 'Working professional'
  | 'Fresh graduate'
  | 'University student'
  | 'High school student'
  | 'Teacher or school staff'
  | 'Other';

export type GoalType = 
  | 'Work in China'
  | 'Work at a Chinese or China-Indonesia joint venture company in Indonesia'
  | 'Study in China or scholarship'
  | 'Prepare for HSK certification'
  | 'Improve my Mandarin skills'
  | 'Other';

export type ReportedLevelType = 
  | 'Complete beginner'
  | 'Beginner'
  | 'Not sure'
  | 'HSK 1'
  | 'HSK 2'
  | 'HSK 3'
  | 'HSK 4+';

export type CityType = 'Jakarta' | 'Other';
export type ModeType = 'Offline' | 'Online' | 'Not sure';

export type BuyingSignalType = 
  | 'Asked price'
  | 'Asked schedule'
  | 'Asked payment'
  | 'Ready to enroll'
  | 'Ready to enrol'
  | 'None yet';

export type HookType = 
  | 'hsk_assessment'
  | 'trial_class'
  | 'consultation'
  | 'scholarship_materials'
  | 'webinar'
  | 'mbti_test'
  | 'download_guide'
  | 'referral';

export type HookContextType = 
  | 'campus_career_talk'
  | 'school_talk'
  | 'paid_social'
  | 'organic_dm'
  | 'website'
  | 'webinar'
  | 'expo'
  | 'referral';

export interface LeadProfile {
  // ① 场景来源数据
  entryPoint: string;
  campaign: string;
  placement: string;
  hookType: HookType;
  hookContext: HookContextType;
  submittedAt: string;

  // ② 客户基础数据
  fullName: string;
  whatsapp: string;
  email: string;
  currentStatus: CurrentStatusType;
  parentContact?: string;

  // ③ 核心三问数据
  goal: GoalType;
  goals?: GoalType[];
  reportedLevel: ReportedLevelType;
  levelState: LevelStateType;
  city: CityType;
  cityDetail?: string;
  mode: ModeType;
  levelConfirmed?: string;
  levelSource?: 'self' | 'assessment' | 'trial' | 'mixed';

  // ④ 钩子响应数据
  buyingSignal: BuyingSignalType;
  buyingSignals?: BuyingSignalType[];
  nextStepInterest: string;
  hskExamPlan?: string;

  // ⑥ 判定标签数据 (由规则引擎计算)
  tier: TierType;
  flag: FlagType;
  tierSource: 'predicted' | 'sales_confirmed' | 'behaviour_override' | 'buying_signal';
  
  // 测评数据
  quizScore?: number;
  totalQuestions?: number;
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
}

/**
 * 计算机考/问卷自报的 Level State
 */
export function determineLevelState(level: ReportedLevelType): LevelStateType {
  if (level === 'Complete beginner') return 'ZERO';
  if (level === 'Beginner' || level === 'Not sure') return 'PARTIAL';
  return 'KNOWN';
}

/**
 * 决定 Flag (Skip Assessment vs Assessment Needed)
 * 第 6 章 Flag 规则：
 * KNOWN (HSK1-4+) 或 ZERO -> Skip Assessment
 * PARTIAL -> Assessment Needed
 */
export function determineFlag(levelState: LevelStateType): FlagType {
  if (levelState === 'KNOWN' || levelState === 'ZERO') {
    return 'Skip Assessment';
  }
  return 'Assessment Needed';
}

/**
 * 严格执行第 2 章 Tier 判定规则 (R1 ~ R6)
 */
export function calculateLeadTier(data: {
  buyingSignal: BuyingSignalType;
  currentStatus: CurrentStatusType;
  goal: GoalType;
  levelState: LevelStateType;
  city: CityType;
  mode: ModeType;
  hskExamPlan?: string;
  assessmentDone?: boolean;
  trialAttended?: boolean;
}): { tier: TierType; flag: FlagType; levelState: LevelStateType } {
  const levelState = data.levelState;
  const flag = determineFlag(levelState);

  // R1: 人工信号覆盖 (Buying Signal ≠ None yet) -> 一律 Hot
  if (data.buyingSignal !== 'None yet') {
    return { tier: 'Hot', flag, levelState };
  }

  // 紧迫度高 (3个月内考证) 视为强烈购买意向 -> Hot
  if (data.hskExamPlan === 'Within 3 months') {
    return { tier: 'Hot', flag, levelState };
  }

  // R2: 行为覆盖 Trial Attended -> 一律 Hot
  if (data.trialAttended) {
    return { tier: 'Hot', flag, levelState };
  }

  // R3: B2B 优先 Current Status = Teacher / School staff -> School
  if (data.currentStatus === 'Teacher or school staff') {
    return { tier: 'School', flag, levelState };
  }

  // R4: 三问打底
  const isStrongGoal = 
    data.goal === 'Work in China' ||
    data.goal === 'Work at a Chinese or China-Indonesia joint venture company in Indonesia' ||
    data.goal === 'Study in China or scholarship' ||
    data.goal === 'Prepare for HSK certification';

  let tier: TierType = 'Cold-Nurture';

  if (!isStrongGoal) {
    // 仅提升能力 / 兴趣 / Other
    tier = 'Cold-Nurture';
  } else {
    // 强目标客群
    if (levelState === 'KNOWN') {
      // 强目标 + KNOWN -> 极高意愿，直接排班报价
      tier = 'Hot';
    } else if (data.city === 'Jakarta' && (data.mode === 'Offline' || data.mode === 'Not sure')) {
      // 强目标 + 雅加达本地 + 愿意线下 -> Warm-Offline
      tier = 'Warm-Offline';
    } else {
      // 其余线上或非雅加达 -> Warm-Online
      tier = 'Warm-Online';
    }
  }

  // R5: 行为微调 (Assessment Done -> 上升一档)
  if (data.assessmentDone && tier !== 'Cold-Nurture' && tier !== 'Hot') {
    if (tier === 'Warm-Offline') {
      tier = 'Hot';
    } else if (tier === 'Warm-Online') {
      tier = 'Hot';
    }
  }

  return { tier, flag, levelState };
}
