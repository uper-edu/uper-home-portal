import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Phone, 
  Mail, 
  Target, 
  Award, 
  MapPin, 
  Sparkles, 
  Check,
  HelpCircle, 
  Globe2,
  Languages
} from 'lucide-react';
import { 
  LeadProfile, 
  CurrentStatusType, 
  GoalType, 
  ReportedLevelType, 
  CityType, 
  ModeType, 
  BuyingSignalType, 
  HookType, 
  HookContextType, 
  determineLevelState, 
  calculateLeadTier 
} from '../types/leadSystem';

interface GFormOnboardingModalProps {
  onComplete: (profile: LeadProfile, lang: 'en' | 'id' | 'zh') => void;
  isOpen: boolean;
  initialLang?: 'en' | 'id' | 'zh';
}

export default function GFormOnboardingModal({ 
  onComplete, 
  isOpen,
  initialLang = 'en'
}: GFormOnboardingModalProps) {
  const [lang, setLang] = useState<'en' | 'id' | 'zh'>(initialLang);

  // Extract URL parameters automatically
  const [urlParams, setUrlParams] = useState<{
    entry: string;
    campaign: string;
    placement: string;
    hook: HookType;
    context: HookContextType;
  }>({
    entry: 'campus',
    campaign: 'seminar_2026',
    placement: 'qr_scanner',
    hook: 'hsk_assessment',
    context: 'campus_career_talk'
  });

  const [campaignMeta, setCampaignMeta] = useState<{
    id: string;
    name: string;
    nameEn: string;
    venue?: string;
    city?: string;
    startDate?: string;
    startTime?: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const shortCode = sp.get('c') || sp.get('cid') || sp.get('campaign');

      setUrlParams({
        entry: sp.get('entry') || 'campus',
        campaign: shortCode || 'seminar_2026',
        placement: sp.get('placement') || 'qr_scanner',
        hook: (sp.get('hook') as HookType) || 'hsk_assessment',
        context: (sp.get('context') as HookContextType) || 'campus_career_talk'
      });

      const urlLang = sp.get('lang');
      if (urlLang === 'id' || urlLang === 'zh' || urlLang === 'en') {
        setLang(urlLang);
      }

      // If short campaign code is present, resolve full campaign attributes
      if (shortCode) {
        fetch(`/api/campaigns/${encodeURIComponent(shortCode)}`)
          .then(res => res.json())
          .then(data => {
            if (data?.campaign) {
              const c = data.campaign;
              setCampaignMeta({
                id: c.id,
                name: c.name,
                nameEn: c.nameEn,
                venue: c.venue,
                city: c.city,
                startDate: c.startDate,
                startTime: c.startTime
              });
              setUrlParams({
                entry: c.boundUtm?.utm_source || sp.get('entry') || 'campus',
                campaign: c.name || c.code || shortCode,
                placement: c.boundUtm?.utm_medium || sp.get('placement') || 'qr_poster',
                hook: (c.boundUtm?.defaultHook as HookType) || (sp.get('hook') as HookType) || 'hsk_assessment',
                context: (c.boundUtm?.defaultContext as HookContextType) || (sp.get('context') as HookContextType) || 'campus_career_talk'
              });
              if (c.boundUtm?.defaultLang && !sp.get('lang')) {
                setLang(c.boundUtm.defaultLang);
              }
              // Track impression in background
              fetch(`/api/campaigns/${encodeURIComponent(shortCode)}/impression`, { method: 'POST' }).catch(() => {});
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  // Form Fields - All initialized to null / empty (NO default selections)
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [currentStatus, setCurrentStatus] = useState<CurrentStatusType | null>(null);
  const [parentContact, setParentContact] = useState('');
  
  const [selectedGoals, setSelectedGoals] = useState<GoalType[]>([]);
  const [reportedLevel, setReportedLevel] = useState<ReportedLevelType | null>(null);
  const nextLabel = !reportedLevel
    ? {en:'Continue',zh:'继续',id:'Lanjut'}[lang]
    : determineLevelState(reportedLevel) === 'PARTIAL'
    ? {en:'Continue to assessment',zh:'进入测评',id:'Lanjut ke tes'}[lang]
    : {en:'Start AI consultation',zh:'开始 AI 咨询',id:'Mulai konsultasi AI'}[lang];
  const [city, setCity] = useState<CityType | null>(null);
  const [cityDetail, setCityDetail] = useState('');
  const [mode, setMode] = useState<ModeType | null>(null);
  
  const [selectedBuyingSignals, setSelectedBuyingSignals] = useState<BuyingSignalType[]>([]);
  const [hskExamPlan, setHskExamPlan] = useState<string>('Within 6 months');
  const [errorMsg, setErrorMsg] = useState('');

  const handleToggleGoal = (id: GoalType) => {
    setSelectedGoals(prev => 
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleToggleBuyingSignal = (id: BuyingSignalType) => {
    setSelectedBuyingSignals(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  // Step wizard for effortless mobile completion
  const [step, setStep] = useState<1 | 2>(1);

  if (!isOpen) return null;

  const handleNextStep = () => {
    if (!fullName.trim()) {
      setErrorMsg(
        lang === 'en' 
          ? 'Please enter your full name.' 
          : lang === 'zh' 
          ? '请填写您的完整姓名。' 
          : 'Mohon isi nama lengkap Anda.'
      );
      return;
    }
    if (!whatsapp.trim() || whatsapp.replace(/\D/g, '').length < 8) {
      setErrorMsg(
        lang === 'en' 
          ? 'Please enter an active WhatsApp number.' 
          : lang === 'zh' 
          ? '请填写有效的 WhatsApp 手机号码。' 
          : 'Mohon isi nomor WhatsApp yang aktif.'
      );
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg(
        lang === 'en' 
          ? 'Please enter a valid email address.' 
          : lang === 'zh' 
          ? '请填写有效的电子邮箱。' 
          : 'Mohon isi alamat email yang valid.'
      );
      return;
    }
    if (!currentStatus) {
      setErrorMsg(
        lang === 'en'
          ? 'Please select your current status.'
          : lang === 'zh'
          ? '请选择您的当前身份状态。'
          : 'Mohon pilih status Anda saat ini.'
      );
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedGoals.length === 0) {
      setErrorMsg(
        lang === 'en'
          ? 'Please select at least one reason for learning Mandarin.'
          : lang === 'zh'
          ? '请至少选择一项学习中文的主要目标。'
          : 'Mohon pilih minimal satu tujuan belajar Mandarin Anda.'
      );
      return;
    }
    if (!reportedLevel) {
      setErrorMsg(
        lang === 'en'
          ? 'Please select your current Mandarin level.'
          : lang === 'zh'
          ? '请选择您当前的中文水平基础。'
          : 'Mohon pilih tingkat Mandarin Anda saat ini.'
      );
      return;
    }
    if (!city) {
      setErrorMsg(
        lang === 'en'
          ? 'Please select which city you are currently in.'
          : lang === 'zh'
          ? '请选择您目前所在的城市。'
          : 'Mohon pilih kota tempat tinggal Anda.'
      );
      return;
    }
    if (!mode) {
      setErrorMsg(
        lang === 'en'
          ? 'Please select your preferred class format.'
          : lang === 'zh'
          ? '请选择期望的上课形式。'
          : 'Mohon pilih format kelas pilihan Anda.'
      );
      return;
    }

    const effectiveBuyingSignal = selectedBuyingSignals[0] || 'None yet';
    const effectiveCurrentStatus = currentStatus || 'Other';
    const effectiveGoal = selectedGoals[0] || 'Improve my Mandarin skills';
    const effectiveLevel = reportedLevel;
    const effectiveCity = city;
    const effectiveMode = mode;

    const levelState = determineLevelState(effectiveLevel);
    const tierResult = calculateLeadTier({
      buyingSignal: effectiveBuyingSignal,
      currentStatus: effectiveCurrentStatus,
      goal: effectiveGoal,
      levelState,
      city: effectiveCity,
      mode: effectiveMode,
      hskExamPlan,
      assessmentDone: false,
      trialAttended: false
    });

    const leadData: LeadProfile = {
      entryPoint: urlParams.entry,
      campaign: urlParams.campaign,
      placement: urlParams.placement,
      hookType: urlParams.hook,
      hookContext: urlParams.context,
      submittedAt: new Date().toISOString(),

      fullName: fullName.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
      currentStatus: effectiveCurrentStatus,
      parentContact: effectiveCurrentStatus === 'High school student' ? parentContact.trim() : undefined,

      goal: effectiveGoal,
      goals: selectedGoals,
      reportedLevel: effectiveLevel,
      levelState,
      city: effectiveCity,
      cityDetail: effectiveCity === 'Other' ? cityDetail.trim() : undefined,
      mode: effectiveMode,

      buyingSignal: effectiveBuyingSignal,
      buyingSignals: selectedBuyingSignals,
      nextStepInterest: 'hsk_assessment',
      hskExamPlan,

      tier: tierResult.tier,
      flag: tierResult.flag,
      tierSource: 'predicted'
    };

    onComplete(leadData, lang);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto"
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-primary-950 to-primary-900 text-white p-5 sm:p-6 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-300 uppercase tracking-widest bg-primary-800/40 px-2.5 py-1 rounded-full border border-primary-500/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              UPER Seminar Profile
            </span>

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-800/90 rounded-full p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 rounded-full transition-all font-semibold ${
                  lang === 'en' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('id')}
                className={`px-2 py-0.5 rounded-full transition-all font-semibold ${
                  lang === 'id' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLang('zh')}
                className={`px-2 py-0.5 rounded-full transition-all font-semibold ${
                  lang === 'zh' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                中文
              </button>
            </div>
          </div>

          {campaignMeta && (
            <div className="mb-3 p-2.5 bg-emerald-500/15 border border-emerald-400/30 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-200">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/25 text-emerald-300 font-bold text-[10px] uppercase tracking-wider">
                  {lang === 'zh' ? '专属活动通道' : lang === 'en' ? 'Event Channel' : 'Saluran Khusus Acara'}
                </span>
                <span className="font-semibold text-white">
                  {lang === 'zh' ? campaignMeta.name : (campaignMeta.nameEn || campaignMeta.name)}
                </span>
              </div>
              {campaignMeta.venue && (
                <span className="text-[11px] text-emerald-300/80">
                  📍 {campaignMeta.venue}
                </span>
              )}
            </div>
          )}

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {lang === 'en' && (step === 1 ? 'Personal Information' : 'Learning Goals & Mandarin Level')}
            {lang === 'id' && (step === 1 ? 'Informasi Pribadi & Kontak' : 'Tujuan Belajar & Tingkat Bahasa')}
            {lang === 'zh' && (step === 1 ? '个人基本信息登记' : '学习目标与当前中文基础')}
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
            {lang === 'en' && (step === 1 
              ? "Complete your details to receive your customized HSK roadmap and curriculum syllabus via WhatsApp."
              : "Our AI advisor will tailor your course schedule and activate placement assessment if appropriate.")}
            {lang === 'id' && (step === 1 
              ? 'Lengkapi kontak Anda untuk menerima silabus kelas dan materi persiapan HSK via WhatsApp.' 
              : 'AI kami akan menyesuaikan rekomendasi kelas dan mengaktifkan tes diagnostik yang tepat.')}
            {lang === 'zh' && (step === 1 
              ? '填写基本信息以获取个性化学习方案及专属 HSK 备考大纲。' 
              : 'AI 顾问将根据您的实际需求定制班级排期，并在需要时启动摸底测验。')}
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-slate-700/50 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-primary-400 h-full transition-all duration-300"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 1 ? (
            /* ================= STEP 1: Basic Identity ================= */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {lang === 'en' ? "1. What's your full name?" : lang === 'zh' ? '1. 您的全名 / Full Name' : '1. Nama Lengkap / Full Name'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={lang === 'en' ? 'e.g. Budi Santoso / Kevin Tan' : 'Contoh: Budi Santoso'}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {lang === 'en' ? '2. WhatsApp number (Active)' : lang === 'zh' ? '2. WhatsApp 电话号码 (用于接收方案)' : '2. Nomor WhatsApp (Aktif)'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="e.g. +62 812-3456-7890 / 0812..."
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {lang === 'en' 
                    ? "Our academic advisor will send your placement report and class schedule via WhatsApp."
                    : lang === 'zh'
                    ? 'UPER 课程顾问将通过 WhatsApp 发送您的排班与测评报告。'
                    : 'Konsultan UPER akan mengirimkan laporan analisis dan jadwal kelas via WA.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {lang === 'en' ? "3. What's your email address?" : lang === 'zh' ? '3. 电子邮箱 / Email Address' : '3. Alamat Email'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {lang === 'en'
                    ? "We'll send your assessment results and learning recommendations here."
                    : lang === 'zh'
                    ? '用于发送测评结果与学习建议。'
                    : 'Untuk pengiriman hasil tes dan rekomendasi belajar.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {lang === 'en' ? '4. What is your current status?' : lang === 'zh' ? '4. 当前身份状态' : '4. Status Anda Saat Ini'} <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                  {[
                    { 
                      id: 'University student', 
                      en: 'University student', 
                      id_id: 'Mahasiswa (Uni Student)', 
                      zh: '在读大学生' 
                    },
                    { 
                      id: 'Fresh graduate', 
                      en: 'Fresh graduate', 
                      id_id: 'Lulusan Baru (Fresh Grad)', 
                      zh: '应届毕业生' 
                    },
                    { 
                      id: 'Working professional', 
                      en: 'Working professional', 
                      id_id: 'Karyawan (Professional)', 
                      zh: '职场在职员工' 
                    },
                    { 
                      id: 'High school student', 
                      en: 'High school student', 
                      id_id: 'Siswa SMA (High School)', 
                      zh: '高中在读学生' 
                    },
                    { 
                      id: 'Teacher or school staff', 
                      en: 'Teacher or school staff', 
                      id_id: 'Guru / Staf Sekolah', 
                      zh: '教师 / 学校教职工' 
                    },
                    { 
                      id: 'Other', 
                      en: 'Other', 
                      id_id: 'Lainnya', 
                      zh: '其他' 
                    }
                  ].map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setCurrentStatus(s.id as CurrentStatusType)}
                      className={`p-2.5 text-left rounded-xl border transition-all ${
                        currentStatus === s.id 
                          ? 'border-primary-600 bg-primary-50/60 text-primary-950 font-semibold ring-1 ring-primary-500' 
                          : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100/60'
                      }`}
                    >
                      {lang === 'en' ? s.en : lang === 'zh' ? s.zh : s.id_id}
                    </button>
                  ))}
                </div>
              </div>

              {currentStatus === 'High school student' && (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    {lang === 'en' ? "Parent Contact (Optional)" : "Kontak Orang Tua / Wali (Opsional)"}
                  </label>
                  <input
                    type="text"
                    value={parentContact}
                    onChange={(e) => setParentContact(e.target.value)}
                    placeholder={lang === 'en' ? "Parent's Name & WhatsApp" : "Nama & Nomor WhatsApp Orang Tua"}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 outline-none text-slate-800"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleNextStep}
                className="w-full mt-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-sm shadow-md shadow-primary-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>{lang === 'en' ? 'Next: Goals & Level' : lang === 'zh' ? '下一步：目标与基础' : 'Lanjut ke Tujuan & Level'}</span>
              </button>
            </div>
          ) : (
            /* ================= STEP 2: Goal, Level, City & Priorities ================= */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-primary-600" />
                    {lang === 'en' 
                      ? '5. What is your main reason for learning Mandarin?' 
                      : lang === 'zh' 
                      ? '5. 学习中文的主要目标' 
                      : '5. Tujuan Utama Belajar Mandarin'} <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {lang === 'en' ? '(Select all that apply)' : lang === 'zh' ? '(可多选)' : '(Bisa pilih lebih dari 1)'}
                  </span>
                </label>
                <div className="space-y-1.5">
                  {[
                    { 
                      id: 'Work at a Chinese or China-Indonesia joint venture company in Indonesia', 
                      en: 'Work at a Chinese or China-Indonesia JV company in Indonesia', 
                      id_id: 'Bekerja di Perusahaan Cina / JV di Indonesia', 
                      zh: '印尼本地中资 / 合资企业就业 (职场中文)' 
                    },
                    { 
                      id: 'Study in China or scholarship', 
                      en: 'Study in China or obtain a full scholarship', 
                      id_id: 'Kuliah di Cina / Beasiswa Penuh (Scholarship)', 
                      zh: '赴华留学 / 申请全额奖学金' 
                    },
                    { 
                      id: 'Work in China', 
                      en: 'Work in China directly', 
                      id_id: 'Bekerja Langsung di Tiongkok', 
                      zh: '直接赴华工作发展' 
                    },
                    { 
                      id: 'Prepare for HSK certification', 
                      en: 'Prepare for official HSK certification', 
                      id_id: 'Sertifikasi Resmi HSK (Exam Prep)', 
                      zh: '考取 HSK 官方等级证书 (备考冲刺)' 
                    },
                    { 
                      id: 'Improve my Mandarin skills', 
                      en: 'Improve general Mandarin communication skills', 
                      id_id: 'Mengasah Percakapan Bahasa Sehari-hari', 
                      zh: '提升日常中文口语与听说技能' 
                    }
                  ].map((g) => {
                    const isSelected = selectedGoals.includes(g.id as GoalType);
                    return (
                      <button
                        type="button"
                        key={g.id}
                        onClick={() => handleToggleGoal(g.id as GoalType)}
                        className={`w-full p-2.5 text-left rounded-xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                          isSelected 
                            ? 'border-primary-600 bg-primary-50/80 text-primary-950 font-semibold ring-1 ring-primary-500' 
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="leading-snug">{lang === 'en' ? g.en : lang === 'zh' ? g.zh : g.id_id}</span>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 transition-all ${
                          isSelected 
                            ? 'bg-primary-600 border-primary-600 text-white' 
                            : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-primary-600" />
                  {lang === 'en' ? '6. What is your current Mandarin level?' : lang === 'zh' ? '6. 您当前的中文水平基础' : '6. Tingkat Mandarin Anda Saat Ini'} <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { 
                      id: 'Complete beginner', 
                      badge: 'Zero',
                      titleEn: 'Complete beginner (no Mandarin at all)', 
                      titleZh: '零基础（完全未接触过中文）',
                      descEn: 'Never studied Mandarin before',
                      descZh: '零基础，从未接触过中文'
                    },
                    { 
                      id: 'Beginner', 
                      badge: 'Pre-1',
                      titleEn: 'Beginner — basic words, never took HSK', 
                      titleZh: '入门进阶 — 会一些拼音/基础词汇',
                      descEn: 'Knows some Pinyin / basic words, unsure of level',
                      descZh: '掌握一些基础词汇/拼音，未考过 HSK'
                    },
                    { 
                      id: 'HSK 1', 
                      badge: 'HSK 1',
                      titleEn: 'Passed HSK 1', 
                      titleZh: '已通过 / 达到 HSK 1 级',
                      descEn: 'Approx. 150 vocabulary words',
                      descZh: '已掌握约 150 核心词汇'
                    },
                    { 
                      id: 'HSK 2', 
                      badge: 'HSK 2',
                      titleEn: 'Passed HSK 2', 
                      titleZh: '已通过 / 达到 HSK 2 级',
                      descEn: 'Approx. 300 vocabulary words',
                      descZh: '已掌握约 300 核心词汇'
                    },
                    { 
                      id: 'HSK 3', 
                      badge: 'HSK 3',
                      titleEn: 'Passed HSK 3', 
                      titleZh: '已通过 / 达到 HSK 3 级',
                      descEn: 'Approx. 600 vocabulary words',
                      descZh: '已掌握约 600 核心词汇'
                    },
                    { 
                      id: 'HSK 4+', 
                      badge: 'HSK 4+',
                      titleEn: 'HSK 4 or above (Advanced)', 
                      titleZh: '已达到 HSK 4 级或以上（进阶流利）',
                      descEn: 'Capable of fluent academic & business dialogue',
                      descZh: '具备流利学术与商务听说读写能力'
                    }
                  ].map((lvl) => (
                    <button
                      type="button"
                      key={lvl.id}
                      onClick={() => setReportedLevel(lvl.id as ReportedLevelType)}
                      className={`p-2.5 sm:p-3 text-left rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer ${
                        reportedLevel === lvl.id 
                          ? 'border-primary-600 bg-primary-50/80 text-primary-950 font-semibold ring-1 ring-primary-500 shadow-2xs' 
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-11 h-7 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-mono font-bold tracking-tight border ${
                        reportedLevel === lvl.id
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {lvl.badge}
                      </div>
                      <div className="flex flex-col items-start text-left min-w-0 flex-1 justify-center">
                        <span className="font-semibold text-xs text-slate-800 leading-snug block text-left">
                          {lang === 'zh' ? lvl.titleZh : lvl.titleEn}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5 leading-snug block text-left">
                          {lang === 'zh' ? lvl.descZh : lvl.descEn}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 7: Location & Learning Mode Preference */}
              <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3.5">
                {/* 7a. City Location */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary-600" />
                    <span>
                      {lang === 'en' ? '7. Which city are you currently in?' : lang === 'zh' ? '7. 您目前所在的城市' : '7. Kota Tempat Tinggal'}
                    </span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { 
                        id: 'Jakarta', 
                        en: 'Jakarta Area (Jabodetabek)', 
                        zh: '雅加达及周边地区（大雅加达）', 
                        idLang: 'Jakarta & Jabodetabek' 
                      },
                      { 
                        id: 'Other', 
                        en: 'Other Cities / Outside Jabodetabek', 
                        zh: '外岛/其他省市/海外', 
                        idLang: 'Luar Jabodetabek / Kota Lain' 
                      }
                    ].map((c) => {
                      const isSelected = city === c.id;
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => setCity(c.id as CityType)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary-600 bg-primary-50/80 text-primary-950 shadow-xs ring-1 ring-primary-500'
                              : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white hover:border-slate-300'
                          }`}
                        >
                          <span className="leading-snug">{lang === 'zh' ? c.zh : lang === 'id' ? c.idLang : c.en}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 7b. Preferred Class Format */}
                <div className="pt-2 border-t border-slate-200/80">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Globe2 className="w-3.5 h-3.5 text-primary-600" />
                    <span>
                      {lang === 'en' ? 'Preferred Class Format' : lang === 'zh' ? '期望的上课形式' : 'Format Kelas Pilihan'}
                    </span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      {
                        id: 'Offline',
                        en: 'Offline Class (Campus)',
                        zh: '线下校区面授班',
                        idLang: 'Kelas Tatap Muka (Offline)'
                      },
                      {
                        id: 'Online',
                        en: 'Live Online (Zoom)',
                        zh: '在线互动直播课',
                        idLang: 'Online Interaktif (Zoom)'
                      },
                      {
                        id: 'Not sure',
                        en: 'Flexible / Need Advice',
                        zh: '灵活 / 待顾问建议',
                        idLang: 'Fleksibel / Belum Pasti'
                      }
                    ].map((m) => {
                      const isSelected = mode === m.id;
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => setMode(m.id as ModeType)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary-600 bg-primary-50/80 text-primary-950 shadow-xs ring-1 ring-primary-500'
                              : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white hover:border-slate-300'
                          }`}
                        >
                          <span className="leading-snug">{lang === 'zh' ? m.zh : lang === 'id' ? m.idLang : m.en}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>
                    {lang === 'en' 
                      ? '8. What would you like to know more about?'
                      : lang === 'zh'
                      ? '8. 您目前最关心想了解的内容'
                      : '8. Hal yang Ingin Anda Ketahui Lebih Lanjut'}
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {lang === 'en' ? '(Select all that apply)' : lang === 'zh' ? '(可多选)' : '(Bisa pilih lebih dari 1)'}
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { 
                      id: 'Asked price', 
                      en: 'Class fees & payment plans', 
                      zh: '课程学费与付款方案',
                      idLang: 'Biaya kelas & skema cicilan'
                    },
                    { 
                      id: 'Asked schedule', 
                      en: 'Schedule & start dates', 
                      zh: '开班排期与上课时间',
                      idLang: 'Jadwal & tanggal mulai kelas'
                    },
                    { 
                      id: 'Which level is right', 
                      en: 'Which level is right for me', 
                      zh: '我适合从哪个班级起步',
                      idLang: 'Rekomendasi level yang cocok'
                    },
                    { 
                      id: 'None yet', 
                      en: 'General inquiry for now', 
                      zh: '暂无特殊需求，先咨询',
                      idLang: 'Konsultasi umum terlebih dahulu'
                    }
                  ].map((bs) => {
                    const isSelected = selectedBuyingSignals.includes(bs.id as BuyingSignalType);
                    return (
                      <button
                        type="button"
                        key={bs.id}
                        onClick={() => handleToggleBuyingSignal(bs.id as BuyingSignalType)}
                        className={`p-2.5 text-left rounded-xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                          isSelected 
                            ? 'border-primary-600 bg-primary-50/80 text-primary-950 font-semibold ring-1 ring-primary-500' 
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="leading-snug">{lang === 'zh' ? bs.zh : lang === 'id' ? bs.idLang : bs.en}</span>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 transition-all ${
                          isSelected 
                            ? 'bg-primary-600 border-primary-600 text-white' 
                            : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-xs"
                >
                  {lang === 'en' ? 'Back' : lang === 'zh' ? '上一步' : 'Kembali'}
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-primary-600/25 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>{nextLabel}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}
