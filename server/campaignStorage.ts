import {matchesCampaign} from "../src/utils/crmCampaignLink.ts";
import {campaignMetrics} from "../src/utils/crmCampaignMetrics.ts";
import fs from 'fs';
import path from 'path';
import type { 
  CrmCampaignRecord, 
  CampaignType, 
  CampaignStatus,
  CampaignAiAssets 
} from '../src/types/crmCampaign.ts';
import { queryLeads } from './leadStorage.ts';

const DB_DIR = path.join(process.cwd(), 'data');
const CAMPAIGNS_FILE = path.join(DB_DIR, 'campaigns_db.json');

function ensureDbExists(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

// In-memory cache for fast lookups
let campaignsCache: CrmCampaignRecord[] | null = null;

export function loadCampaigns(): CrmCampaignRecord[] {
  if (campaignsCache !== null) {
    return campaignsCache;
  }
  ensureDbExists();
  try {
    if (!fs.existsSync(CAMPAIGNS_FILE)) {
      fs.writeFileSync(CAMPAIGNS_FILE, '[]\n', 'utf-8');
      campaignsCache = [];
    } else {
      const raw = fs.readFileSync(CAMPAIGNS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Campaigns database must contain an array');
      campaignsCache = parsed as CrmCampaignRecord[];
    }
  } catch (err) {
    console.error('[CAMPAIGN DB] Error reading campaigns database:', err);
    throw err;
  }
  return campaignsCache;
}

export function persistCampaigns(): void {
  ensureDbExists();
  if (campaignsCache === null) return;
  try {
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaignsCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CAMPAIGN DB] Failed to save campaigns database:', err);
    throw err;
  }
}

/**
 * Returns campaigns enriched with live, real-time closed-loop stats calculated from CRM leads!
 */
export function getEnrichedCampaigns(leads = queryLeads({}).leads): CrmCampaignRecord[] {
  const campaigns = loadCampaigns();

  return campaigns.map(c => {
    // Match leads associated with this campaign by id, code, or name
    // An ambiguous historical campaign name cannot credit the same customer twice.
    const resolved=leads.filter(l=>campaigns.filter(candidate=>matchesCampaign(l,candidate)).length<=1);
    const metrics=campaignMetrics(resolved,c);
    const budgetCost = c.stats.budgetCost || 0;
    const roi = null; // Budget is not verified spend; recorded amounts are not verified profit.

    return {
      ...c,
      stats: {
        ...c.stats,
        ...metrics,
        roi
      }
    };
  });
}

/** PostgreSQL is the canonical customer source whenever the portal is configured. */
export async function getCurrentCampaigns(employee?: any): Promise<CrmCampaignRecord[]> {
  if (!process.env.DATABASE_URL) return getEnrichedCampaigns();
  const {pool} = await import('./portal/store.ts');
  const rows = (await pool.query('SELECT profile FROM portal_leads')).rows;
  const {allowed}=await import('./portal/identity.ts');
  return getEnrichedCampaigns(rows.map(row => row.profile).filter(p=>!employee || allowed(employee,p)));
}

/**
 * Find single campaign by id or short code
 */
export function getCampaignByIdOrCode(idOrCode: string): CrmCampaignRecord | undefined {
  if (!idOrCode) return undefined;
  const list = getEnrichedCampaigns();
  const search = idOrCode.trim().toLowerCase();
  return list.find(c => 
    c.id.toLowerCase() === search || 
    c.code.toLowerCase() === search ||
    c.name.toLowerCase() === search ||
    c.nameEn.toLowerCase() === search
  );
}

/**
 * Increment impressions when someone scans QR or opens short link
 */
export function trackCampaignImpression(idOrCode: string): boolean {
  const campaigns = loadCampaigns();
  const search = idOrCode.trim().toLowerCase();
  const target = campaigns.find(c => c.id.toLowerCase() === search || c.code.toLowerCase() === search);
  if (target) {
    target.stats.impressions = (target.stats.impressions || 0) + 1;
    target.updatedAt = new Date().toISOString();
    persistCampaigns();
    return true;
  }
  return false;
}

/**
 * Create or update a campaign
 */
export function saveCampaign(payload: Partial<CrmCampaignRecord> & { name: string }): CrmCampaignRecord {
  const campaigns = loadCampaigns();
  const now = new Date().toISOString();

  let code = payload.code?.trim();
  if (!code) {
    const slug = payload.nameEn ? payload.nameEn.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15) : 'camp';
    code = `c_${slug}_${Date.now().toString().slice(-4)}`;
  }

  const id = payload.id || code;
  const existingIdx = campaigns.findIndex(c => c.id === id || c.code === code);

  const defaultAiAssets: CampaignAiAssets = {
    posterHeading: payload.name,
    posterSubheading: payload.scheduleNotes || `${payload.startDate || ''} @ ${payload.venue || payload.city || ''}`,
    socialCopy: `UPER 官方特别呈现：${payload.name}\n时间：${payload.startDate || ''} ${payload.startTime || ''}\n地点：${payload.venue || payload.city || ''}\n欢迎点击或扫码预约！`,
    whatsappInvitation: `Halo! Kami mengundang Anda untuk menghadiri "${payload.nameEn || payload.name}". Waktu: ${payload.startDate || ''} ${payload.startTime || ''} @ ${payload.venue || ''}. Daftar sekarang: https://uperedu.com/chat?c=${code}`,
    chatWelcomeGreeting: `欢迎来到 ${payload.name} 专属通道！已为你开启活动专属特权，请随时开始定级测评或向我咨询！`,
    presentationOutline: `【活动全流程】\n1. 破冰与介绍\n2. 核心亮点解读\n3. 现场答疑与扫码进线测评`,
    deskTentBullets: [
      '现场免费定级测评',
      '名师一对一答疑与学习规划',
      '活动专属早鸟特惠权益'
    ]
  };

  const aiAssetsGenerated = payload.aiAssets || {};
  const existingAiAssets = (existingIdx >= 0 ? campaigns[existingIdx].aiAssets : {}) || {};

  const newRecord: CrmCampaignRecord = {
    id,
    code,
    name: payload.name,
    nameEn: payload.nameEn || payload.name,
    type: payload.type || 'campus_seminar',
    status: payload.status || 'planning',
    organizer: payload.organizer || 'Marketing Operations',
    startDate: payload.startDate || new Date().toISOString().split('T')[0],
    endDate: payload.endDate || payload.startDate || new Date().toISOString().split('T')[0],
    startTime: payload.startTime || '14:00',
    endTime: payload.endTime || '16:00',
    scheduleNotes: payload.scheduleNotes || '',
    locationType: payload.locationType || 'offline',
    city: payload.city || 'Jakarta',
    venue: payload.venue || 'TBA',
    address: payload.address || '',
    onlineLink: payload.onlineLink,
    targetAudience: payload.targetAudience || ['印尼大学生', '在职白领'],
    keyTopics: payload.keyTopics || ['HSK考级通关', '跨国名企求职'],
    speakers: payload.speakers || [],
    boundUtm: payload.boundUtm || {
      utm_source: 'campus_offline',
      utm_medium: 'qr_poster',
      utm_campaign: code,
      defaultHook: 'hsk_assessment',
      defaultContext: 'campus_career_talk',
      defaultLang: 'id'
    },
    aiAssets: {
      ...defaultAiAssets,
      ...existingAiAssets,
      ...aiAssetsGenerated,
      idAssets: (aiAssetsGenerated as any).idAssets || (existingAiAssets as any).idAssets || defaultAiAssets,
      enAssets: (aiAssetsGenerated as any).enAssets || (existingAiAssets as any).enAssets || defaultAiAssets
    },
    stats: existingIdx >= 0 ? {
      ...campaigns[existingIdx].stats,
      ...(payload.stats || {}),
      budgetCost: payload.stats?.budgetCost !== undefined ? payload.stats.budgetCost : campaigns[existingIdx].stats.budgetCost
    } : (payload.stats || {
      impressions: 0,
      leadsCount: 0,
      hotLeadsCount: 0,
      assessedCount: 0,
      enrolledCount: 0,
      totalRevenue: 0,
      conversionRate: 0,
      budgetCost: 0,
      roi: 0
    }),
    createdAt: existingIdx >= 0 ? campaigns[existingIdx].createdAt : now,
    updatedAt: now
  };

  if (existingIdx >= 0) {
    campaigns[existingIdx] = newRecord;
  } else {
    campaigns.unshift(newRecord);
  }

  persistCampaigns();
  return newRecord;
}

/**
 * Delete a campaign
 */
export function deleteCampaign(id: string): boolean {
  const campaigns = loadCampaigns();
  const idx = campaigns.findIndex(c => c.id === id || c.code === id);
  if (idx >= 0) {
    campaigns.splice(idx, 1);
    persistCampaigns();
    return true;
  }
  return false;
}

/**
 * AI Collateral Synthesizer: Generates rich multi-lingual marketing copy and presentation outlines
 */
export function synthesizeCampaignAiAssets(data: {
  name: string;
  nameEn?: string;
  type: CampaignType;
  city: string;
  venue: string;
  startDate: string;
  startTime: string;
  endTime: string;
  targetAudience: string[];
  keyTopics: string[];
  organizer?: string;
  code: string;
}): CampaignAiAssets {
  const shortLink = `https://uperedu.com/chat?c=${data.code}`;

  const idAssets = {
    posterHeading: `Seminar Karir & Beasiswa: ${data.nameEn || data.name}`,
    posterSubheading: `${data.startDate} | ${data.startTime} WIB @ ${data.venue}, ${data.city}`,
    socialCopy: `🚀 [SEMINAR EKSKLUSIF UPER] ${data.nameEn || data.name}\n\n🎯 Target Peserta: ${data.targetAudience.join(', ')}\n🗓️ Tanggal: ${data.startDate} (${data.startTime} - ${data.endTime} WIB)\n📍 Lokasi: ${data.venue}, ${data.city}\n\n🌟 Poin Utama Pembahasan:\n${data.keyTopics.map((tp, i) => `${i + 1}. ✨ ${tp}`).join('\n')}\n\n🎁 Benefit Eksklusif:\n- Tes Penempatan HSK Resmi 1-on-1 gratis\n- Konsultasi karir langsung dengan mentor UPER\n- Potongan Early Bird khusus peserta\n\n👉 Daftar sekarang di: ${shortLink}\n#UPERMandarin #KarirMandarin #BeasiswaChina`,
    whatsappInvitation: `Halo Rekan-rekan! 👋\n\nKami mengundang Anda hadir dalam seminar resmi UPER:\n🔥 "${data.nameEn || data.name}"\n\n🗓️ Tanggal: ${data.startDate}\n⏰ Waktu: ${data.startTime} - ${data.endTime} WIB\n📍 Lokasi: ${data.venue}, ${data.city}\n\n🎯 Amankan kursi & konsultasi gratis Anda di sini:\n🔗 ${shortLink}`,
    chatWelcomeGreeting: `👋 Halo! Selamat datang di jalur khusus "${data.nameEn || data.name}". Kami telah mengaktifkan hak istimewa konsultasi & tes HSK gratis untuk Anda. Silakan mulai tes level atau tanyakan info kelas sekarang!`,
    presentationOutline: `【Agenda Seminar 45 Menit】\n1. 00-10m: Peluang Karir & Kebutuhan Tenaga Kerja Bilingual Tiongkok di Indonesia\n2. 10-25m: Bedah Tuntas Standar HSK & Strategi Cepat Lulus Ujian\n3. 25-35m: Pengenalan Metode Belajar AI & Pengajar Profesional UPER\n4. 35-45m: Sesi Tanya Jawab (Q&A) & Pendaftaran Early Bird via Scan QR (${shortLink})`,
    deskTentBullets: [
      'Tes Diagnostik HSK Resmi Gratis di Tempat',
      'Konsultasi Karir & Penempatan Kerja 1-on-1',
      'Diskon Khusus Pendaftaran Hari H'
    ]
  };

  const enAssets = {
    posterHeading: `Official Masterclass: ${data.nameEn || data.name}`,
    posterSubheading: `${data.startDate} | ${data.startTime}-${data.endTime} @ ${data.venue} (${data.city})`,
    socialCopy: `🚀 [UPER OFFICIAL SEMINAR] ${data.nameEn || data.name}\n\n🎯 Target Audience: ${data.targetAudience.join(', ')}\n🗓️ Date: ${data.startDate} (${data.startTime} - ${data.endTime} WIB)\n📍 Venue: ${data.venue}, ${data.city}\n\n🌟 Key Takeaways:\n${data.keyTopics.map((tp, i) => `${i + 1}. ✨ ${tp}`).join('\n')}\n\n🎁 On-Site Perks:\n- Free Official HSK Placement Assessment\n- Direct career consultation with mentors\n- Exclusive Early Bird tuition discount\n\n👉 Secure your seat now: ${shortLink}\n#UPERMandarin #MandarinCareer #StudyInChina`,
    whatsappInvitation: `Hello! 👋 You are cordially invited to UPER's exclusive event:\n🔥 "${data.nameEn || data.name}"\n\n🗓️ Date: ${data.startDate}\n⏰ Time: ${data.startTime} - ${data.endTime} WIB\n📍 Venue: ${data.venue}, ${data.city}\n\n🎯 RSVP & claim your free diagnostic test here:\n🔗 ${shortLink}`,
    chatWelcomeGreeting: `🎉 Welcome to the official channel for "${data.nameEn || data.name}"! Your event privileges are active. Feel free to start your placement test or ask any questions!`,
    presentationOutline: `[45-Min Masterclass Agenda]\n1. 00-10m: Industry Insights & High-Paying Bilingual Career Opportunities\n2. 10-25m: HSK Standards Breakdown & Accelerated Exam Strategies\n3. 25-35m: UPER AI-Powered Immersive Learning Methodology\n4. 35-45m: Q&A & Exclusive Registration via QR (${shortLink})`,
    deskTentBullets: [
      'Free On-Site Official HSK Assessment',
      '1-on-1 Career & Scholarship Consultation',
      'Exclusive On-Site Tuition Discounts'
    ]
  };

  return {
    ...idAssets,
    idAssets,
    enAssets
  };
}
