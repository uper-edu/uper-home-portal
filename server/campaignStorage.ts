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

// Initial rich seed campaigns to provide out-of-the-box real utility
const DEFAULT_CAMPAIGNS: CrmCampaignRecord[] = [
  {
    id: 'seminar_2026',
    code: 'seminar_2026',
    name: '2026印尼名校巡回中文就业宣讲会（Binus专场）',
    nameEn: '2026 Jakarta Campus Chinese Career Seminar (Binus)',
    type: 'campus_seminar',
    status: 'active',
    organizer: 'Marketing Ops & B2B Division (Kevin & Grace)',
    startDate: '2026-10-15',
    endDate: '2026-10-16',
    startTime: '14:00',
    endTime: '16:30',
    scheduleNotes: '周五下午 14:00-16:00 集中宣讲，16:00-16:30 现场 1v1 免费定级测评与企业内推答疑',
    locationType: 'offline',
    city: 'Jakarta',
    venue: 'Binus University Anggrek Campus Auditorium 3F',
    address: 'Jl. Kebon Jeruk Raya No. 27, Kebon Jeruk, Jakarta Barat 11530',
    targetAudience: ['印尼大学生 (Undergraduates)', '在职白领 (Job Seekers)', '高薪中企求职者'],
    keyTopics: [
      '中资企业高薪岗位汉语直推通道与薪酬对标',
      'HSK 3-4级职场急救提分与官方定级标准剖析',
      '现场即测即知：免费获得权威 HSK 能力评估与学习建议书',
      '前20位现场扫码进线预约者立享早鸟 8 折学费优惠及定制文创包'
    ],
    speakers: [
      { name: 'David Zhang', title: 'UPER 教学总监 & HSK 资深考评专家', bio: '原北京语言大学访问学者，深耕印尼中文教研 8 年' },
      { name: 'Siti Rahmawati', title: '中资头部能源企业印尼区 HRD', bio: '分享跨国中资企业对双语本土人才的招聘实战标准' }
    ],
    boundUtm: {
      utm_source: 'campus_offline',
      utm_medium: 'qr_poster',
      utm_campaign: 'seminar_2026',
      utm_term: 'binus_career_talk',
      utm_content: 'roll_up_banner_main',
      defaultHook: 'hsk_assessment',
      defaultContext: 'campus_career_talk',
      defaultLang: 'id'
    },
    aiAssets: {
      posterHeading: '2026 中资名企高薪就业直通宣讲会 · Binus 专场',
      posterSubheading: '掌握流利中文，直接对话跨国名企 HR · 现场免费获得权威 HSK 能力定级',
      socialCopy: `📢 Calling all BINUS students & ambitious job seekers in Jakarta! 🚀\n\nIngin tembus kerja di perusahaan multinasional Tiongkok dengan gaji 2x-3x lipat? 💼🇨🇳\n\nHadiri exclusive seminar "2026 Chinese Career & HSK FastTrack Masterclass":\n🗓️ Tanggal: 15-16 Oktober 2026\n⏰ Waktu: 14:00 - 16:30 WIB\n📍 Lokasi: Auditorium Kampus Anggrek Lantai 3, Binus University\n\n✨ Benefit Eksklusif:\n✅ Direct HR screening tips dari HRD perusahaan Tiongkok\n✅ Free Official HSK Placement Test (Langsung tahu levelmu!)\n✅ Early bird discount 20% khusus peserta seminar\n\n👉 Kuota terbatas! Scan QR atau klik link bio untuk RSVP sekarang! #UPERMandarin #BinusUniversity #KarirMandarin #KerjaDiBUMNChina`,
      whatsappInvitation: `Halo Rekan-rekan Mahasiswa/Profesional! 👋\n\nApakah kamu ingin meningkatkan peluang karir di perusahaan multinasional Tiongkok terkemuka di Indonesia?\n\nKami mengundang Anda menghadiri seminar karir eksklusif:\n📌 Topik: Peluang Karir Perusahaan Tiongkok & HSK Placement Test\n📅 Waktu: 15 Oktober 2026 (14:00 - 16:30 WIB)\n🏢 Tempat: Binus Anggrek Campus Auditorium Lt. 3\n\n🎯 Registrasi gratis & dapatkan tes penempatan level HSK resmi di sini:\n🔗 https://uperedu.com/chat?c=seminar_2026\n\nSampai jumpa di lokasi! Tim UPER siap membantu konsultasi karir & studi Anda.`,
      chatWelcomeGreeting: '🎉 欢迎来到 2026 Binus 宣讲会专属通道！听说你对中资企业高薪就业或 HSK 极速过级感兴趣，我们已为你自动激活现场专属特权，马上开始 3 分钟定级测评或向我咨询任何学习问题吧！',
      presentationOutline: `【45分钟宣讲会标准提纲】\n1. 00-10m: 印尼中资企业爆发式招聘需求与薪酬结构深度解密\n2. 10-25m: 职场中文技能点拆解：从日常沟通到商务谈判各需要达到 HSK 几级？\n3. 25-35m: UPER 沉浸式场景化 AI 智能学习路径介绍\n4. 35-45m: 互动答疑 & 现场引导扫码立牌进入 /chat 进行即时定级测评`,
      deskTentBullets: [
        '现场扫码 3 分钟免费获得权威 HSK 定级测评',
        '直达跨国中企求职推荐与简历辅导绿色通道',
        '宣讲会专属早鸟优惠：现场报名立减 20%'
      ]
    },
    stats: {
      impressions: 142,
      leadsCount: 1,
      hotLeadsCount: 1,
      attendedCount: 1,
      enrolledCount: 0,
      totalRevenue: 0,
      conversionRate: 0,
      budgetCost: 5000000,
      roi: -100
    },
    createdAt: '2026-09-28T09:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z'
  },
  {
    id: 'c_ui_career_2026',
    code: 'c_ui_career_2026',
    name: 'Universitas Indonesia 国际中文与赴华奖学金专场',
    nameEn: 'Universitas Indonesia Career Fair & CSC Scholarship Expo',
    type: 'campus_seminar',
    status: 'active',
    organizer: 'Study Abroad & Youth Team (Elena)',
    startDate: '2026-10-24',
    endDate: '2026-10-25',
    startTime: '10:00',
    endTime: '15:00',
    scheduleNotes: '两日全天展台咨询 + 每天下午 13:30 专题宣讲会',
    locationType: 'offline',
    city: 'Jakarta / Depok',
    venue: 'Balairung Universitas Indonesia, Depok',
    address: 'Jl. Lingkar Kampus Raya, Pondok Cina, Beji, Kota Depok, Jawa Barat',
    targetAudience: ['印尼大学生 (UI Students)', '计划赴华留学/CSC全奖申请者', '应届毕业生'],
    keyTopics: [
      '2027 中国政府 CSC / CIS 国际中文教师奖学金全额申请全景图',
      'HSK 4-5 级申请名校（清北复交/浙大）硬性门槛与备考时间轴',
      '免费领取《2026-2027 赴华留学申请白皮书》纸质精装版'
    ],
    speakers: [
      { name: 'Elena Lin', title: 'UPER 资深留学与奖学金申请专家', bio: '累计助力 300+ 印尼学子斩获全额政府奖学金' }
    ],
    boundUtm: {
      utm_source: 'campus_offline',
      utm_medium: 'booth_qr',
      utm_campaign: 'Universitas Indonesia Career Fair 2026',
      utm_term: 'ui_scholarship_talk',
      utm_content: 'flyer_qr_code',
      defaultHook: 'scholarship_materials',
      defaultContext: 'campus_career_talk',
      defaultLang: 'id'
    },
    aiAssets: {
      posterHeading: 'UI 专场 · 2027 赴华全额奖学金申请与 HSK 高分通关大会',
      posterSubheading: '免学费+免住宿+每月生活津贴！UPER 专家团现场一对一评估你的申请成功率',
      socialCopy: `Halo Makara Muda UI! 🟡✨\nMau kuliah S1/S2 di universitas top Tiongkok GRATIS lewat Beasiswa Penuh (CSC / CIS Scholarship)?\n\nKunjungi booth UPER di UI Career Fair:\n📅 24-25 Oktober 2026\n📍 Balairung UI Depok (Booth B-12)\n\nDapatkan:\n📚 E-Book Panduan Beasiswa Tiongkok 2027\n🔍 Evaluasi peluang beasiswa gratis & tes level HSK on-the-spot!\n\nScan QR atau akses: https://uperedu.com/chat?c=c_ui_career_2026`,
      whatsappInvitation: `Salam Hangat dari UPER! 🎓\nBagi rekan-rekan civitas akademika UI yang berencana melanjutkan studi ke Tiongkok dengan Beasiswa CSC/CIS:\nJangan lewatkan sesi konsultasi 1-on-1 kami di Balairung UI Depok tanggal 24-25 Okt 2026.\nReservasi slot konsultasimu sekarang: https://uperedu.com/chat?c=c_ui_career_2026`,
      chatWelcomeGreeting: '🎓 欢迎来到 UI 专场预约通道！如果你想申请 2027 中国名校全额奖学金或备战 HSK 4-5 级，请直接在对话框输入你的意向专业与目前中文基础，我将为你量身定制申请规划！',
      presentationOutline: `【UI宣讲会提纲】\n1. 奖学金类型剖析（CSC国家留学基金委 vs 国际中文教师奖学金 CIS vs 各省市奖学金）\n2. 申请材料踩坑指南：文书与导师推荐信如何脱颖而出\n3. HSK 与 HSKK 等级硬性指标与冲刺策略`,
      deskTentBullets: [
        '现场免费获取 2027 赴华留学全额奖学金择校规划',
        '扫码即测 HSK 等级，对标奖学金门槛',
        '预约资深文书导师 1 对 1 免费初审'
      ]
    },
    stats: {
      impressions: 98,
      leadsCount: 1,
      hotLeadsCount: 0,
      attendedCount: 0,
      enrolledCount: 0,
      totalRevenue: 0,
      conversionRate: 0,
      budgetCost: 7500000,
      roi: -100
    },
    createdAt: '2026-09-29T11:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z'
  },
  {
    id: 'c_meta_beasiswa_2026',
    code: 'c_meta_beasiswa_2026',
    name: 'Meta/IG 赴华留学与CSC全额奖学金信息流广告',
    nameEn: 'Meta / Instagram Paid Ads - CSC Scholarship & FastTrack HSK',
    type: 'social_paid_ad',
    status: 'active',
    organizer: 'Digital Performance Marketing (Wilson)',
    startDate: '2026-09-20',
    endDate: '2026-11-30',
    startTime: '00:00',
    endTime: '23:59',
    scheduleNotes: '全天候 Meta Feed & Reels 动态信息流投放，受众定向 18-28 岁大雅加达区印尼青年',
    locationType: 'online',
    city: 'Online (Meta / Instagram)',
    venue: 'Instagram Sponsored Story & Feed',
    address: 'Online Ad Traffic',
    targetAudience: ['雅加达青年学生', '自媒体华语爱好者', '奖学金意向人群'],
    keyTopics: [
      '2026-2027 赴华奖学金倒计时备考',
      '零基础到 HSK 3 级 90 天速成学习法',
      '线上 1 对 1 外教私塾免费试听体验'
    ],
    speakers: [],
    boundUtm: {
      utm_source: 'instagram_ads',
      utm_medium: 'cpc',
      utm_campaign: 'Google Search - Beasiswa CSC 2026',
      utm_term: 'beasiswa_csc_indonesia',
      utm_content: 'video_ad_reels_v2',
      defaultHook: 'scholarship_materials',
      defaultContext: 'paid_social',
      defaultLang: 'id'
    },
    aiAssets: {
      posterHeading: 'Beasiswa Kuliah di China 2027 Dibuka! Kuliah Gratis Sampai Lulus',
      posterSubheading: 'Persiapkan HSK-mu dari sekarang bersama mentor resmi UPER. Klik untuk konsultasi cepat!',
      socialCopy: `Mau kuliah GRATIS di kampus top dunia? 🇨🇳 Beasiswa CSC & CIS 2027 sudah mulai persiapan!\n\nPersyaratan utama: Sertifikat HSK!\nYuk tes kemampuan Mandarinmu gratis & dapatkan bimbingan aplikasi beasiswa dari para alumni UPER.\n\nKlik tautan sekarang 👉 https://uperedu.com/chat?c=c_meta_beasiswa_2026`,
      whatsappInvitation: `Terima kasih telah mengklik iklan UPER di Instagram! 🌟 Ingin konsultasi beasiswa China atau kelas persiapan HSK? Chat langsung bersama AI Konselor kami di: https://uperedu.com/chat?c=c_meta_beasiswa_2026`,
      chatWelcomeGreeting: '👋 Halo! Terima kasih telah mengunjungi UPER dari Instagram. Saya AI Konselor UPER, siap membantu Anda menemukan jalur beasiswa kuliah di Tiongkok dan persiapan HSK terbaik. Mau tanya tentang syarat beasiswa atau tes level?',
      presentationOutline: `【信息流落地页承接策略】\n1. 即时抓住痛点：奖学金名额有限，提前 6 个月准备 HSK 才有胜算\n2. 降低门槛：无需立刻买课，先做 3 分钟测评摸底`,
      deskTentBullets: [
        '90天冲刺 HSK 目标等级',
        '奖学金申请全程保姆式辅导',
        '100% 官方名师线上授课'
      ]
    },
    stats: {
      impressions: 480,
      leadsCount: 1,
      hotLeadsCount: 0,
      attendedCount: 0,
      enrolledCount: 0,
      totalRevenue: 0,
      conversionRate: 0,
      budgetCost: 3000000,
      roi: -100
    },
    createdAt: '2026-09-20T08:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z'
  },
  {
    id: 'c_b2b_schools',
    code: 'c_b2b_schools',
    name: '印尼国际三语学校师资与HSK考培合作研讨会',
    nameEn: 'Indonesian Trilingual School Mandarin Curriculum & HSK Summit',
    type: 'enterprise_roadshow',
    status: 'planning',
    organizer: 'B2B Institutional Partnerships (Grace)',
    startDate: '2026-11-10',
    endDate: '2026-11-10',
    startTime: '09:30',
    endTime: '12:30',
    scheduleNotes: '上午高规格闭门圆桌论坛，面向雅加达 20+ 所三语学校校长与中文教研组长',
    locationType: 'offline',
    city: 'Jakarta',
    venue: 'Hotel Mulia Senayan Jakarta, Ballroom B',
    address: 'Jl. Asia Afrika Senayan, Gelora, Kecamatan Tanah Abang, Jakarta Pusat',
    targetAudience: ['三语学校校长', '国际学校中文教研主管', '教育机构投资者'],
    keyTopics: [
      '新版 HSK 3.0 体系对印尼 K-12 华文课程的革新指引',
      'AI 赋能中文智慧课堂：UPER 校企双师云端教学方案',
      '共建雅加达青少年 HSK 考级官方绿色认证基地的合作契机'
    ],
    speakers: [
      { name: 'Prof. Li Wei', title: '汉考国际全球教研顾问', bio: '深耕东南亚华文教育20年' }
    ],
    boundUtm: {
      utm_source: 'b2b_offline',
      utm_medium: 'invitation_letter',
      utm_campaign: 'B2B High School Partner Network',
      utm_term: 'trilingual_summit',
      utm_content: 'vip_invitation_card',
      defaultHook: 'consultation',
      defaultContext: 'school_talk',
      defaultLang: 'zh'
    },
    aiAssets: {
      posterHeading: '2026 印尼国际三语学校中文教研与 HSK 合作峰会',
      posterSubheading: '汇聚 20+ 顶尖名校领导，探讨新课标与 AI 智慧华语教学未来',
      socialCopy: '诚挚邀请雅加达三语国际学校中文主管莅临 2026 印尼华语教研高峰论坛，共探 HSK 3.0 时代课程融合方案。',
      whatsappInvitation: '尊敬的校领导/教研主任：UPER 诚邀您出席 11 月 10 日在 Hotel Mulia 举办的三语学校中文教研圆桌研讨会，报名与方案咨询请访问专属通道：https://uperedu.com/chat?c=c_b2b_schools',
      chatWelcomeGreeting: '尊贵的教育机构合作伙伴，欢迎进入 UPER B2B 合作专属通道！我们为各级学校提供定制化的外教双师体系、新版 HSK 考点共建与教师培训方案，请随时与我们探讨合作细节。',
      presentationOutline: `【闭门研讨会提纲】\n1. 行业痛点：印尼三语学校本土华语师资稀缺与教案陈旧现状\n2. UPER B2B 解决方案：标准化教研+AI作业批改+权威考级闭环\n3. 现场签约签约意向学校授牌仪式`,
      deskTentBullets: [
        '共建官方认证青少年 HSK 考点',
        '全套标准化分级教材与教研培训支持',
        '一站式海内外名校升学直通通道'
      ]
    },
    stats: {
      impressions: 45,
      leadsCount: 1,
      hotLeadsCount: 0,
      attendedCount: 0,
      enrolledCount: 0,
      totalRevenue: 0,
      conversionRate: 0,
      budgetCost: 15000000,
      roi: -100
    },
    createdAt: '2026-09-25T14:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z'
  },
  {
    id: 'c_zoom_hsk3_pass',
    code: 'c_zoom_hsk3_pass',
    name: 'HSK 3+ 职场高薪通关线上名师体验课',
    nameEn: 'HSK 3+ Career Acceleration Online Masterclass',
    type: 'webinar_class',
    status: 'active',
    organizer: 'Online Academy (Sarah)',
    startDate: '2026-10-18',
    endDate: '2026-10-18',
    startTime: '19:30',
    endTime: '21:00',
    scheduleNotes: '周日晚 19:30-21:00 线上直播大班课，名额限 100 人',
    locationType: 'online',
    city: 'Online (Zoom Webinar)',
    venue: 'Zoom Live Webinar (ID: 882-9901-2231)',
    address: 'Online Live Streaming',
    onlineLink: 'https://zoom.us/j/88299012231',
    targetAudience: ['在职人员', '平时无法参加线下课程的学习者', '印尼外岛学员 (Surabaya/Bandung/Medan)'],
    keyTopics: [
      '职场常见 50 个高频中资商务邮件与沟通术语',
      '不用死记硬背！汉字声调与听力障碍 10 天攻坚突破',
      '课后 1 对 1 赠送外教 20 分钟口语水平连线摸底'
    ],
    speakers: [
      { name: 'Sarah Chen', title: 'UPER 在线学院金牌讲师', bio: '累计线上学员突破 5,000+，辅导 HSK 3-5 级学员通过率 98%' }
    ],
    boundUtm: {
      utm_source: 'webinar_live',
      utm_medium: 'direct_zoom',
      utm_campaign: 'c_zoom_hsk3_pass',
      utm_term: 'hsk3_fastpass',
      utm_content: 'zoom_landing',
      defaultHook: 'trial_class',
      defaultContext: 'webinar',
      defaultLang: 'id'
    },
    aiAssets: {
      posterHeading: 'Kelas Online Gratis: Rahasia Lulus HSK 3 & Sukses Kerja di Perusahaan Tiongkok',
      posterSubheading: 'Live via Zoom bersama Master Teacher Sarah Chen · Belajar langsung dari rumah!',
      socialCopy: `Sibuk kerja tapi mau upgrade skill Mandarin? 💻 Gabung Kelas Terbuka Online Gratis:\n"HSK 3 Career FastTrack Masterclass"\n🗓️ Minggu, 18 Oktober 2026\n⏰ 19:30 - 21:00 WIB (via Zoom)\n\nSlot terbatas 100 orang pertama! Daftar di: https://uperedu.com/chat?c=c_zoom_hsk3_pass`,
      whatsappInvitation: `Reminder Webinar UPER! 🔔 Jangan lewatkan kelas online gratis malam ini jam 19:30 WIB. Link pendaftaran & akses ruang Zoom: https://uperedu.com/chat?c=c_zoom_hsk3_pass`,
      chatWelcomeGreeting: '🎉 Halo! Selamat datang di jalur pendaftaran Kelas Online Terbuka UPER. Saya siap membantu konfirmasi slot Zoom Anda atau memberikan tes penempatan HSK sebelum kelas dimulai!',
      presentationOutline: `【线上公开课直播节奏】\n1. 00-15m: 破冰与职场真实痛点案例（商务对话误会集锦）\n2. 15-55m: 核心干货：HSK 3 级最常考的 3 大语法结构与职场口语模版\n3. 55-75m: 现场连麦学员实战演练与纠音\n4. 75-90m: 互动抽奖与系统班早鸟专属权益派发`,
      deskTentBullets: [
        '100% 互动直播，现场连麦纠音',
        '免费赠送商务中文高频词汇电子手册',
        '公开课学员报名正式班立赠口语私教课'
      ]
    },
    stats: {
      impressions: 210,
      leadsCount: 0,
      hotLeadsCount: 0,
      attendedCount: 0,
      enrolledCount: 0,
      totalRevenue: 0,
      conversionRate: 0,
      budgetCost: 1500000,
      roi: -100
    },
    createdAt: '2026-09-30T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z'
  }
];

export function loadCampaigns(): CrmCampaignRecord[] {
  if (campaignsCache !== null) {
    return campaignsCache;
  }
  ensureDbExists();
  try {
    if (!fs.existsSync(CAMPAIGNS_FILE)) {
      fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(DEFAULT_CAMPAIGNS, null, 2), 'utf-8');
      campaignsCache = DEFAULT_CAMPAIGNS;
    } else {
      const raw = fs.readFileSync(CAMPAIGNS_FILE, 'utf-8');
      campaignsCache = JSON.parse(raw) as CrmCampaignRecord[];
    }
  } catch (err) {
    console.error('[CAMPAIGN DB] Error reading DB file, using defaults:', err);
    campaignsCache = DEFAULT_CAMPAIGNS;
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
  }
}

/**
 * Returns campaigns enriched with live, real-time closed-loop stats calculated from CRM leads!
 */
export function getEnrichedCampaigns(): CrmCampaignRecord[] {
  const campaigns = loadCampaigns();
  const { leads } = queryLeads({});

  return campaigns.map(c => {
    // Match leads associated with this campaign by id, code, or name
    const matchedLeads = leads.filter(l => {
      const camp = (l.campaign || '').trim().toLowerCase();
      const cId = c.id.toLowerCase();
      const cCode = c.code.toLowerCase();
      const cName = c.name.toLowerCase();
      const cNameEn = c.nameEn.toLowerCase();
      return camp === cId || camp === cCode || camp === cName || camp === cNameEn ||
        (camp.includes('binus') && cId.includes('seminar_2026')) ||
        (camp.includes('indonesia') && cId.includes('c_ui_career_2026')) ||
        (camp.includes('beasiswa') && cId.includes('c_meta_beasiswa_2026')) ||
        (camp.includes('partner') && cId.includes('c_b2b_schools'));
    });

    const leadsCount = matchedLeads.length;
    const hotLeadsCount = matchedLeads.filter(l => l.tier === 'Hot').length;
    const attendedCount = matchedLeads.filter(l => 
      l.currentStage === 'Trial Attended' || 
      l.currentStage === 'Trial Booked' || 
      l.currentStage === 'Assessment Done' || 
      l.attendanceConfirmed
    ).length;
    const enrolledLeads = matchedLeads.filter(l => 
      l.currentStage === 'Enrolled' || 
      l.outcome === 'Enrolled' || 
      l.outcome === 'Paid'
    );
    const enrolledCount = enrolledLeads.length;

    // Calculate actual GMV revenue from matched leads
    const calculatedRevenue = enrolledLeads.reduce((acc, l) => acc + (l.revenue || 12800000), 0);
    const totalRevenue = calculatedRevenue > 0 ? calculatedRevenue : (c.stats.totalRevenue || 0);

    const conversionRate = leadsCount > 0 ? Math.round((enrolledCount / leadsCount) * 100) : 0;
    const budgetCost = c.stats.budgetCost || 0;
    const roi = budgetCost > 0 ? Math.round(((totalRevenue - budgetCost) / budgetCost) * 100) : 0;

    return {
      ...c,
      stats: {
        ...c.stats,
        leadsCount,
        hotLeadsCount,
        attendedCount,
        enrolledCount,
        totalRevenue,
        conversionRate,
        roi
      }
    };
  });
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
      attendedCount: 0,
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
