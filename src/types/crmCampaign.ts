import type { HookType, HookContextType } from './leadSystem.ts';

export type CampaignType = 
  | 'campus_seminar'        // 校园宣讲会 / Campus Seminar
  | 'enterprise_roadshow'    // 企业商会路演 / Enterprise Roadshow
  | 'webinar_class'          // 直播授课与大师课 / Webinar & Masterclass
  | 'social_paid_ad'         // 社交媒体信息流投放 / Social Paid Ads
  | 'community_referral'     // 社群裂变与转介绍 / Community & Referral
  | 'education_fair'         // 教育展会与博览会 / Education Fair & Expo
  | 'other';

export type CampaignStatus = 
  | 'planning'               // 筹备中 / Planning
  | 'active'                 // 进行中 / Active
  | 'completed'              // 已完成 / Completed
  | 'archived';              // 已归档 / Archived

export type CampaignLocationType = 'offline' | 'online' | 'hybrid';

export interface BoundUtmConfig {
  utm_source: string;        // e.g. 'campus_offline', 'instagram_ad', 'tiktok', 'edufair'
  utm_medium: string;        // e.g. 'qr_poster', 'cpc', 'flyer', 'bio_link'
  utm_campaign: string;      // Auto-bound campaign ID / tracking code
  utm_term?: string;         // e.g. 'hsk3_career_pass'
  utm_content?: string;      // e.g. 'a3_poster_v1', 'tent_card'
  defaultHook: HookType;     // e.g. 'hsk_assessment', 'trial_class', 'consultation'
  defaultContext: HookContextType; // e.g. 'campus_career_talk', 'school_talk'
  defaultLang: 'en' | 'id' | 'zh';
}

export interface CampaignAiAssets {
  posterHeading: string;
  posterSubheading: string;
  socialCopy: string;
  whatsappInvitation: string;
  chatWelcomeGreeting: string;
  presentationOutline: string;
  deskTentBullets: string[];
  idAssets?: {
    posterHeading: string;
    posterSubheading: string;
    socialCopy: string;
    whatsappInvitation: string;
    chatWelcomeGreeting: string;
    presentationOutline: string;
    deskTentBullets: string[];
  };
  enAssets?: {
    posterHeading: string;
    posterSubheading: string;
    socialCopy: string;
    whatsappInvitation: string;
    chatWelcomeGreeting: string;
    presentationOutline: string;
    deskTentBullets: string[];
  };
}

export interface CampaignClosedLoopStats {
  impressions: number;       // 链接打开次数（含重复）；不是 UV 或到场
  leadsCount: number;        // 获客入库数 (Sourced Leads)
  hotLeadsCount: number;     // Hot 高意向数
  assessedCount: number;     // 已保存服务端测评结果的客户记录数；不是活动到场人数
  enrolledCount: number;     // 已记录报名；不证明已缴费或入班
  totalRevenue: number;      // 已登记金额 IDR；缺失金额另报，不推定收款
  conversionRate: number | null; // 首次归因登记客户的报名占比；无分母不可计算
  assessmentRate?: number | null;
  confirmedAttendanceCount?: number;
  onsiteAttendanceCount?: number;
  onlineAttendanceCount?: number;
  revenueMissingCount?: number;
  budgetCost: number;        // 活动投入总预算 (IDR)
  roi: number | null;        // 预算与登记金额不能证明实际利润
}

export interface CrmCampaignRecord {
  id: string;                // e.g. 'seminar_2026', 'c_ui_career_2026'
  code: string;              // Short code used in URL parameter "?c=..."
  name: string;              // 中文名称
  nameEn: string;            // 英文名称
  type: CampaignType;
  status: CampaignStatus;
  organizer: string;         // 负责人 / 领队
  
  // 时间与日程
  startDate: string;         // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
  startTime: string;         // e.g. '14:00'
  endTime: string;           // e.g. '16:30'
  scheduleNotes?: string;    // 日程与时间说明

  // 地点与形态
  locationType: CampaignLocationType;
  city: string;              // e.g. 'Jakarta', 'Surabaya', 'Online'
  venue: string;             // e.g. 'Binus University Anggrek Campus Auditorium 3F'
  address: string;
  onlineLink?: string;       // Zoom / Google Meet / Live URL

  // 受众与核心卖点
  targetAudience: string[];  // e.g. ['印尼大学生', '在职白领', 'HSK备考人群']
  keyTopics: string[];       // e.g. ['中资企业印尼高薪就业绿色通道', 'HSK 3+ 通关提分技巧']
  speakers: Array<{
    name: string;
    title: string;
    bio?: string;
  }>;

  // 绑定的渠道 UTM 属性 (对外仅需使用短链 ?c=CODE)
  boundUtm: BoundUtmConfig;

  // AI 自动化营销物料包
  aiAssets: CampaignAiAssets;

  // 闭环数据跟踪与事后转化分析
  stats: CampaignClosedLoopStats;

  createdAt: string;
  updatedAt: string;
}

export const CAMPAIGN_TYPE_OPTIONS: Array<{
  value: CampaignType;
  labelEn: string;
  labelZh: string;
  iconName: string;
  color: string;
}> = [
  { value: 'campus_seminar', labelEn: 'Campus Seminar', labelZh: '校园宣讲 / 校园沙龙', iconName: 'GraduationCap', color: 'blue' },
  { value: 'enterprise_roadshow', labelEn: 'Enterprise Roadshow', labelZh: '企业 / 商会路演', iconName: 'Briefcase', color: 'indigo' },
  { value: 'webinar_class', labelEn: 'Webinar & Masterclass', labelZh: '直播授课与大师课', iconName: 'Video', color: 'emerald' },
  { value: 'social_paid_ad', labelEn: 'Social Paid Ads', labelZh: '信息流付费广告投放', iconName: 'Flame', color: 'amber' },
  { value: 'community_referral', labelEn: 'Community & Referral', labelZh: '社群裂变 / 转介绍', iconName: 'Users', color: 'purple' },
  { value: 'education_fair', labelEn: 'Education Fair & Expo', labelZh: '教育展会 / 留学博览会', iconName: 'Award', color: 'rose' },
  { value: 'other', labelEn: 'Other Activity', labelZh: '其他获客活动', iconName: 'Sparkles', color: 'slate' },
];

export const CAMPAIGN_STATUS_OPTIONS: Array<{
  value: CampaignStatus;
  labelEn: string;
  labelZh: string;
  badgeClass: string;
}> = [
  { value: 'planning', labelEn: 'Planning', labelZh: '筹备中', badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { value: 'active', labelEn: 'Active', labelZh: '进行中/招募中', badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { value: 'completed', labelEn: 'Completed', labelZh: '已结束', badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { value: 'archived', labelEn: 'Archived', labelZh: '已归档', badgeClass: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' },
];
