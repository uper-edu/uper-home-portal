import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, BookOpen, BrainCircuit, GraduationCap, 
  LineChart, ShieldCheck, Sparkles, Target, Trophy, 
  Users, Calculator, Languages, ArrowRight, CheckCircle2, TrendingUp,
  HelpCircle, ChevronDown
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SEO } from '../components/SEO';
import { Link } from 'react-router-dom';
import { cscaFaqsByLang } from '../data/cscaFaqs';
import { useDesignStyle } from '../utils/theme';
import ProgramFAQPortal from '../components/ProgramFAQPortal';

const CSCA = () => {
  const { t, i18n } = useTranslation();
  const { isApple } = useDesignStyle();
  const [selectedType, setSelectedType] = React.useState<'math' | 'chinese'>('math');

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const currentFaqs = cscaFaqsByLang[i18n.language] || cscaFaqsByLang['id'] || [];
  const topFaqs = currentFaqs.slice(0, 6).map(f => ({
    question: f.question,
    answer: f.answer.replace(/[#*`]/g, '').slice(0, 300)
  }));

  return (
    <div className="pt-32 pb-20">
      <SEO 
        title={t('meta.csca.title', 'UPER CSCA Coaching - The Academic Bridge')} 
        description={t('meta.csca.description', 'Bridging the gap between Indonesian high schools and elite Chinese Universities. Academic insurance for your study abroad journey.')} 
        canonicalUrl="https://uperedu.com/csca"
        breadcrumbs={[
          { name: 'Home', url: 'https://uperedu.com' },
          { name: 'CSCA Coaching', url: 'https://uperedu.com/csca' }
        ]}
        faqs={topFaqs}
        courseData={{
          name: 'UPER CSCA Exam Preparation Course',
          description: 'Comprehensive coaching and past paper drill for China Scholastic Competency Assessment in Mathematics, Physics, Chemistry, and English.',
          provider: 'PT UPER EDUCATION TECHNOLOGY'
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
              isApple 
                ? 'bg-slate-100 text-slate-800 border border-slate-200/60' 
                : 'bg-primary-50 border border-primary-100 text-primary-600'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{t("csca.header.tag")}</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 tracking-tight"
          >
            {t("csca.header.title1")} <span className="text-gradient">{t("csca.header.title2")}</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-600 mb-8"
          >
            {t("csca.header.desc")}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
             <a href="https://wa.me/6281116612062" target="_blank" rel="noopener noreferrer" className={`inline-flex text-white px-8 py-4 rounded-full font-medium transition-all items-center justify-center gap-2 text-lg ${
               isApple 
                 ? 'bg-[#0071e3] hover:bg-[#0077ed] shadow-none' 
                 : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/30'
             }`}>
                {t("csca.header.cta")} <ArrowRight className="w-5 h-5" />
              </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full aspect-[16/9] md:aspect-[2.5/1] rounded-3xl overflow-hidden shadow-2xl relative mb-20"
        >
          <div className="absolute inset-0 bg-slate-900/10 z-10"></div>
          <img 
            src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=2000" 
            alt="Modern University Campus" 
            className="w-full h-full object-cover relative z-0"
            referrerPolicy="no-referrer"
          />
        </motion.div>

        {/* What is CSCA informational block */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`text-white rounded-3xl p-8 md:p-12 relative overflow-hidden mb-24 border transition-all duration-300 ${
            isApple 
              ? 'bg-[#1c1c1e] border-slate-800 shadow-none' 
              : 'bg-gradient-to-r from-primary-900 to-slate-900 border-slate-800 shadow-2xl'
          }`}
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
            <div className="md:w-3/4">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 select-none rounded-full w-fit mb-5">
                <BrainCircuit className="w-4 h-4 text-primary-300" />
                <span className="text-xs font-bold tracking-widest uppercase">{t("csca.intro.tag", "什么是 CSCA？")}</span>
              </div>
              <h2 className="text-2xl md:text-3.5xl font-extrabold mb-4 tracking-tight leading-snug text-white">
                {t("csca.intro.title", "CSCA 中国学术水平评估 (Chinese Scholastic Assessment)")}
              </h2>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                {t("csca.intro.desc", "CSCA（Chinese Scholastic Assessment）是面向国际学生的重要中文能力与学术能力评估体系，重点考察学生的中文应用能力、逻辑思维能力以及学术潜力。这一考试是申请中国C9联盟、985或211高层学术专业以及全额本科奖学金过程中至关重要的学术论据与敲门砖。")}
              </p>
            </div>
            <div className="md:w-1/4 w-full flex justify-center shrink-0">
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center relative overflow-hidden shadow-inner hover:scale-105 transition-transform duration-500">
                <GraduationCap className={`w-12 h-12 mb-2 drop-shadow ${isApple ? 'text-slate-300' : 'text-primary-400'}`} />
                <span className="text-[10px] font-extrabold tracking-widest text-slate-300 uppercase">OFFICIAL STANDARD</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* The Hidden Crisis Section */}
      <section className="py-24 relative bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 tracking-tight">{t("csca.crisis.title1")} <span className="text-rose-500">{t("csca.crisis.title2")}</span></h2>
            <p className="text-lg text-slate-600">
              {t("csca.crisis.desc")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Crisis 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`p-10 rounded-3xl border relative overflow-hidden group transition-all duration-300 ${
                isApple 
                  ? 'bg-[#fcfcfd] border-slate-200/50 shadow-none hover:border-slate-300' 
                  : 'bg-slate-50 border border-slate-100 shadow-xl shadow-slate-200/40 hover:border-primary-200'
              }`}
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-slate-900">{t("csca.crisis.items.0.title")} <br/><span className={`text-lg font-medium ${isApple ? 'text-slate-800' : 'text-primary-600'}`}>{t("csca.crisis.items.0.subtitle")}</span></h3>
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm shrink-0 ml-4 -mt-5 -mr-5">
                  <Calculator className="w-7 h-7" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5"><AlertTriangle className="w-3.5 h-3.5" /></div>
                  <p className="text-slate-600"><strong className="text-slate-900">{t("csca.crisis.currentState", "Current State:")}</strong> {t("csca.crisis.items.0.current")}</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5"><AlertTriangle className="w-3.5 h-3.5" /></div>
                  <p className="text-slate-600"><strong className="text-slate-900">{t("csca.crisis.theCrisis", "The Crisis:")}</strong> {t("csca.crisis.items.0.crisis")}</p>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <p className="text-slate-700 italic">{t("csca.crisis.items.0.quote")}</p>
                </div>
              </div>
            </motion.div>

            {/* Crisis 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className={`p-10 rounded-3xl border relative overflow-hidden group transition-all duration-300 ${
                isApple 
                  ? 'bg-[#fcfcfd] border-slate-200/50 shadow-none hover:border-slate-300' 
                  : 'bg-slate-50 border border-slate-100 shadow-xl shadow-slate-200/40 hover:border-primary-200'
              }`}
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-slate-900">{t("csca.crisis.items.1.title")} <br/><span className={`text-lg font-medium ${isApple ? 'text-slate-800' : 'text-tech-600'}`}>{t("csca.crisis.items.1.subtitle")}</span></h3>
                <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm shrink-0 ml-4 -mt-5 -mr-5">
                  <Languages className="w-7 h-7" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5"><AlertTriangle className="w-3.5 h-3.5" /></div>
                  <p className="text-slate-600"><strong className="text-slate-900">{t("csca.crisis.currentState", "Current State:")}</strong> {t("csca.crisis.items.1.current")}</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5"><AlertTriangle className="w-3.5 h-3.5" /></div>
                  <p className="text-slate-600"><strong className="text-slate-900">{t("csca.crisis.theCrisis", "The Crisis:")}</strong> {t("csca.crisis.items.1.crisis")}</p>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <p className="text-slate-700 italic">{t("csca.crisis.items.1.quote")}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Ripple Effect / Warning Section */}
      <section className={`py-24 relative border-y transition-all duration-300 ${
        isApple ? 'bg-[#fafafa] border-slate-200/50' : 'bg-rose-50 border-rose-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 tracking-tight">{t("csca.preparation.title")}</h2>
            <p className="text-lg text-slate-700">{t("csca.preparation.desc")}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className={`bg-white p-8 rounded-3xl flex flex-col h-full transition-all duration-300 ${
              isApple ? 'border border-slate-200/50 shadow-none' : 'shadow-lg border border-rose-100'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-xl font-bold text-slate-900">{t("csca.preparation.items.0.title")}</h4>
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 ml-3 -mt-4 -mr-4 shadow-sm">
                  <TrendingUp className="w-7 h-7 rotate-180" />
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed mt-1">{t("csca.preparation.items.0.desc")}</p>
            </div>
            
            <div className={`bg-white p-8 rounded-3xl flex flex-col h-full transition-all duration-300 ${
              isApple ? 'border border-slate-200/50 shadow-none' : 'shadow-lg border border-rose-100'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-xl font-bold text-slate-900">{t("csca.preparation.items.1.title")}</h4>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 ml-3 -mt-4 -mr-4 shadow-sm">
                  <Users className="w-7 h-7" />
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed mt-1">{t("csca.preparation.items.1.desc")}</p>
            </div>

            <div className={`bg-white p-8 rounded-3xl flex flex-col h-full transition-all duration-300 ${
              isApple ? 'border border-slate-200/50 shadow-none' : 'shadow-lg border border-rose-100'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-xl font-bold text-slate-900">{t("csca.preparation.items.2.title")}</h4>
                <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 ml-3 -mt-4 -mr-4 shadow-sm">
                  <Target className="w-7 h-7" />
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed mt-1">{t("csca.preparation.items.2.desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CSCA Admission Benchmarks & Indonesian Weaknesses Analytics Dashboard */}
      <section className={`py-24 border-t border-b transition-all duration-300 ${
        isApple ? 'bg-[#fcfcfd] border-slate-200/50' : 'bg-slate-50 border-slate-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
              isApple 
                ? 'bg-slate-100 text-slate-800 border border-slate-200/60' 
                : 'bg-primary-50 border border-primary-100 text-primary-600'
            }`}>
              <LineChart className="w-4 h-4" />
              <span>{t("csca.analytics.tag", "权威报考量化分析 | Quantified Admission Analytics")}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              {t("csca.analytics.title", "报考指南 & 印尼学生学术能力报告")}
            </h2>
            <p className="text-slate-500 mt-3 text-sm md:text-base leading-relaxed">
              {t("csca.analytics.desc", "多维度深度透视报考指南与印尼中文、数学学术能力 data 表现，为您提供极高确定性的奖学金录取支持。")}
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-10 items-stretch">
            
            {/* Left Column: Admission Benchmark scores (6 cols) */}
            <div className={`lg:col-span-6 p-6 md:p-8 rounded-3xl border transition-all duration-300 flex flex-col justify-between ${
              isApple 
                ? 'bg-white border-slate-200/50 shadow-none' 
                : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'
            }`}>
              <div>
                               {/* Select Toggles */}
                <div className="bg-slate-50 p-1 rounded-xl flex border border-slate-100 w-fit mb-6">
                  <button 
                    onClick={() => setSelectedType('math')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedType === 'math' 
                        ? (isApple ? 'bg-slate-900 text-white shadow-none' : 'bg-primary-600 text-white shadow') 
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {t("csca.analytics.mathTab", "CSCA 数学")}
                  </button>
                  <button 
                    onClick={() => setSelectedType('chinese')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedType === 'chinese' 
                        ? (isApple ? 'bg-slate-900 text-white shadow-none' : 'bg-primary-600 text-white shadow') 
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {t("csca.analytics.chineseTab", "CSCA 综合中文")}
                  </button>
                </div>

                <p className="text-xs text-slate-400 mb-6 font-mono uppercase tracking-wider">
                  {t("csca.analytics.scoringRule", "* 2024-2025年印尼申请者实际全奖/半奖录取数据，总分100分制。")}
                </p>

                {selectedType === 'math' ? (
                  <div className="space-y-6">
                    {/* C9 */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative overflow-hidden group hover:border-amber-100 transition-colors">
                      <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-white font-mono text-[10px] font-extrabold rounded-bl-xl uppercase tracking-widest shadow-sm">C9 Lg</div>
                      <h4 className="font-extrabold text-sm text-slate-800 mb-2">{t("csca.analytics.math.c9.title", "C9联盟顶尖名校 (清北/复交/浙大/哈工大/中科大/南大等)")}</h4>
                      <p className="text-xs text-slate-500 mb-3">{t("csca.analytics.math.c9.desc", "录取几率极高：88～100分（顶尖免学费+生活费全额奖学金必备数理指标）")}</p>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full w-[88%]" />
                      </div>
                      <div className="flex justify-between items-center mt-2 text-[11px] font-mono font-bold text-slate-400">
                        <span>MIN SCORE: 88</span>
                        <span className="text-amber-500">88～100 / 100</span>
                      </div>
                    </div>

                    {/* 985 */}
                    <div className={`p-4 rounded-2xl border relative overflow-hidden group transition-all duration-300 ${
                      isApple 
                        ? 'bg-[#fcfcfd] border-slate-200/60 hover:border-slate-300' 
                        : 'bg-slate-50 border-slate-100 hover:border-primary-100'
                    }`}>
                      <div className={`absolute top-0 right-0 px-3 py-1 text-white font-mono text-[10px] font-extrabold rounded-bl-xl uppercase tracking-widest shadow-sm ${
                        isApple ? 'bg-slate-800' : 'bg-primary-600'
                      }`}>985 Group</div>
                      <h4 className="font-extrabold text-sm text-slate-800 mb-2">{t("csca.analytics.math.g985.title", "985工程一流名校 (同济/华师/山大/厦大等)")}</h4>
                      <p className="text-xs text-slate-500 mb-3">{t("csca.analytics.math.g985.desc", "录取几率极高：83～88分（全额或省市政府高额助学体系）")}</p>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full w-[83%] ${isApple ? 'bg-slate-700' : 'bg-primary-500'}`} />
                      </div>
                      <div className="flex justify-between items-center mt-2 text-[11px] font-mono font-bold text-slate-400">
                        <span>MIN SCORE: 83</span>
                        <span className={isApple ? 'text-slate-800' : 'text-primary-600'}>83～88 / 100</span>
                      </div>
                    </div>

                    {/* 211 */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative overflow-hidden group hover:border-slate-300 transition-colors">
                      <div className="absolute top-0 right-0 px-3 py-1 bg-slate-700 text-white font-mono text-[10px] font-extrabold rounded-bl-xl uppercase tracking-widest shadow-sm">211 Group</div>
                      <h4 className="font-extrabold text-sm text-slate-800 mb-2">{t("csca.analytics.math.g211.title", "211工程知名重点院校 (华大/东华/外经贸等)")}</h4>
                      <p className="text-xs text-slate-500 mb-3">{t("csca.analytics.math.g211.desc", "录取几率极高：70～78分（省市政府、校级高比例助学政策）")}</p>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-slate-600 h-full rounded-full w-[70%]" />
                      </div>
                      <div className="flex justify-between items-center mt-2 text-[11px] font-mono font-bold text-slate-400">
                        <span>MIN SCORE: 70</span>
                        <span className="text-slate-600">70～78 / 100</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* C9 */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative overflow-hidden group hover:border-amber-100 transition-colors">
                      <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-white font-mono text-[10px] font-extrabold rounded-bl-xl uppercase tracking-widest shadow-sm">C9 Lg</div>
                      <h4 className="font-extrabold text-sm text-slate-800 mb-2">{t("csca.analytics.chinese.c9.title", "C9联盟顶尖名校 (清北/复交/浙大等)")}</h4>
                      <p className="text-xs text-slate-500 mb-3">{t("csca.analytics.chinese.c9.desc", "录取参考标准：综合中文达到90～100分，或持有HSK 6级高分证书")}</p>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full w-[90%]" />
                      </div>
                      <div className="flex justify-between items-center mt-2 text-[11px] font-mono font-bold text-slate-400">
                        <span>MIN SCORE: 90</span>
                        <span className="text-amber-500">90～100 / 100</span>
                      </div>
                    </div>

                    {/* 985 */}
                    <div className={`p-4 rounded-2xl border relative overflow-hidden group transition-all duration-300 ${
                      isApple 
                        ? 'bg-[#fcfcfd] border-slate-200/60 hover:border-slate-300' 
                        : 'bg-slate-50 border-slate-100 hover:border-primary-100'
                    }`}>
                      <div className={`absolute top-0 right-0 px-3 py-1 text-white font-mono text-[10px] font-extrabold rounded-bl-xl uppercase tracking-widest shadow-sm ${
                        isApple ? 'bg-slate-800' : 'bg-primary-600'
                      }`}>985 Group</div>
                      <h4 className="font-extrabold text-sm text-slate-800 mb-2">{t("csca.analytics.chinese.g985.title", "985工程一流名校 (同济/华师/大连理工等)")}</h4>
                      <p className="text-xs text-slate-500 mb-3">{t("csca.analytics.chinese.g985.desc", "录取参考标准：综合中文达到90～100分，或持有HSK 5级高分（＞240）")}</p>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full w-[90%] ${isApple ? 'bg-slate-700' : 'bg-primary-500'}`} />
                      </div>
                      <div className="flex justify-between items-center mt-2 text-[11px] font-mono font-bold text-slate-400">
                        <span>MIN SCORE: 90</span>
                        <span className={isApple ? 'text-slate-800' : 'text-primary-600'}>90～100 / 100</span>
                      </div>
                    </div>

                    {/* 211 */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative overflow-hidden group hover:border-slate-300 transition-colors">
                      <div className="absolute top-0 right-0 px-3 py-1 bg-slate-700 text-white font-mono text-[10px] font-extrabold rounded-bl-xl uppercase tracking-widest shadow-sm">211 Group</div>
                      <h4 className="font-extrabold text-sm text-slate-800 mb-2">{t("csca.analytics.chinese.g211.title", "211工程重点商化与理工大学")}</h4>
                      <p className="text-xs text-slate-500 mb-3">{t("csca.analytics.chinese.g211.desc", "录取参考标准：综合中文达到85～89分，或持有HSK 5级合格（＞180）")}</p>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-slate-600 h-full rounded-full w-[85%]" />
                      </div>
                      <div className="flex justify-between items-center mt-2 text-[11px] font-mono font-bold text-slate-400">
                        <span>MIN SCORE: 85</span>
                        <span className="text-slate-600">85～89 / 100</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={`mt-6 pt-4 border-t p-4 rounded-2xl border border-dashed text-xs leading-relaxed ${
                isApple 
                  ? 'bg-slate-50 border-slate-200 text-slate-750' 
                  : 'bg-primary-50/50 border-primary-200/60 text-primary-800'
              }`}>
                <strong>{t("csca.analytics.academicAdvice.label", "UPER 学术建议:")}</strong> {t("csca.analytics.academicAdvice.text", "CSCA 录取分数线逐年提高，数理思维逻辑的劣势是印尼学生申请全额奖学金的普遍瓶颈，建立早期的强化复习是成功获批顶尖奖学金的硬保障。")}
              </div>
            </div>

            {/* Right Column: Weakness Analytics + Recommendations (6 cols) */}
            <div className={`lg:col-span-6 p-6 md:p-8 rounded-3xl border flex flex-col justify-between ${
              isApple 
                ? 'bg-white border-slate-200/50 shadow-none' 
                : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'
            }`}>
              <div>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                  <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                    <span className={`p-1 px-2.5 rounded-lg text-xs font-black uppercase font-mono ${
                      isApple ? 'bg-slate-100 text-slate-800 border border-slate-200/60' : 'bg-rose-50 text-rose-600'
                    }`}>DANGER ZONE</span>
                    <span>{t("csca.analytics.dangerZone.title", "印尼学生学术薄弱部分比例")}</span>
                  </h3>
                </div>
                <p className="text-slate-500 text-xs md:text-sm leading-relaxed mb-6">
                  {t("csca.analytics.dangerZone.desc", "结合2024届、2025届共计300余名印尼国际高中生（包含AP/IB/国定教学大纲学生）在CSCA测试与数理笔试中反映出的考点失分分布数据分析。")}
                </p>

                {/* Progress bars of topic weights */}
                <div className="space-y-4 mb-6">
                  {/* Item 1 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{t("csca.analytics.dangerZone.subjects.geometry.name", "解析几何与向量 / Geometry & Vectors")}</span>
                      <span className={isApple ? 'text-slate-800 font-mono' : 'text-rose-500 font-mono'}>{t("csca.analytics.dangerZone.subjects.geometry.val", "33% (最薄弱点)")}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full w-[33%] ${isApple ? 'bg-slate-800' : 'bg-gradient-to-r from-red-400 to-rose-500'}`} />
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{t("csca.analytics.dangerZone.subjects.trig.name", "三角函数与公式应用 / Trigonometry")}</span>
                      <span className={isApple ? 'text-slate-700 font-mono' : 'text-orange-500 font-mono'}>{t("csca.analytics.dangerZone.subjects.trig.val", "21%")}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full w-[21%] ${isApple ? 'bg-slate-700' : 'bg-gradient-to-r from-orange-400 to-amber-500'}`} />
                    </div>
                  </div>

                  {/* Item 3 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{t("csca.analytics.dangerZone.subjects.algebra.name", "代数运算与集合不等式 / Algebra & Sets")}</span>
                      <span className={isApple ? 'text-slate-600 font-mono' : 'text-amber-500 font-mono'}>{t("csca.analytics.dangerZone.subjects.algebra.val", "17%")}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full w-[17%] ${isApple ? 'bg-slate-600' : 'bg-amber-500'}`} />
                    </div>
                  </div>

                  {/* Item 4 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{t("csca.analytics.dangerZone.subjects.functions.name", "函数关系与图像解析 / Functions")}</span>
                      <span className={isApple ? 'text-slate-500 font-mono' : 'text-indigo-500 font-mono'}>{t("csca.analytics.dangerZone.subjects.functions.val", "15%")}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full w-[15%] ${isApple ? 'bg-slate-500' : 'bg-indigo-500'}`} />
                    </div>
                  </div>

                  {/* Item 5 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{t("csca.analytics.dangerZone.subjects.sequences.name", "数列与极限概念 / Sequences")}</span>
                      <span className={isApple ? 'text-slate-400 font-mono' : 'text-indigo-400 font-mono'}>{t("csca.analytics.dangerZone.subjects.sequences.val", "12%")}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full w-[12%] ${isApple ? 'bg-slate-400' : 'bg-indigo-400'}`} />
                    </div>
                  </div>

                  {/* Item 6 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{t("csca.analytics.dangerZone.subjects.prob.name", "概率统计与排列组合 / Probability")}</span>
                      <span className="text-slate-500 font-mono">{t("csca.analytics.dangerZone.subjects.prob.val", "2%")}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-slate-400 h-full rounded-full w-[2%]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className={`mt-2 p-4 rounded-2xl border ${
                isApple ? 'bg-slate-50 border-slate-200/60' : 'bg-gradient-to-r from-rose-50/50 to-amber-50/50 border-slate-100'
              }`}>
                <h4 className={`font-extrabold text-xs flex items-center gap-1.5 mb-2 uppercase tracking-wide ${
                  isApple ? 'text-slate-800' : 'text-rose-700'
                }`}>
                  <AlertTriangle className={`w-4 h-4 shrink-0 ${isApple ? 'text-slate-700' : 'text-rose-600'}`} />
                  <span>{t("csca.analytics.gaps.title", "印尼学生三大核心学术盲区与改进建议")}</span>
                </h4>
                <ul className="text-[11px] text-slate-600 space-y-2 leading-relaxed">
                  <li>
                    <strong className="text-slate-800">{t("csca.analytics.gaps.item1.title", "1. 向量结合图形的立体转换意识缺失：")}</strong>
                    {t("csca.analytics.gaps.item1.desc", "印尼学生习惯分步做平面代数，而CSCA要求高强度的向量立体统筹空间感，建议多刷中式考题加强物理/数理转换思维。")}
                  </li>
                  <li>
                    <strong className="text-slate-800">{t("csca.analytics.gaps.item2.title", "2. 重定理轻应用：")}</strong>
                    {t("csca.analytics.gaps.item2.desc", "能极快背诵三角函数及运算公式，但极易在综合不等式交叉变形中失分。需要极重 logic 链的深度针对性考前模战训练。")}
                  </li>
                  <li>
                    <strong className="text-slate-800">{t("csca.analytics.gaps.item3.title", "3. 专业术语中文障碍：")}</strong>
                    {t("csca.analytics.gaps.item3.desc", "读不懂复杂的中文题意。UPER特别提供双语中印数理专业特刊词汇大纲，穿透汉化门槛。")}
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Why UPER (Value Proposition) */}
      <section className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="w-full lg:w-1/2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/20 to-tech-500/20 blur-3xl rounded-full"></div>
                <img 
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1000" 
                  alt="Elite Students" 
                  className="relative rounded-3xl shadow-2xl border border-slate-100"
                />
                <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <ShieldCheck className="w-10 h-10 text-green-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-500 uppercase">{t("csca.why.badge1")}</p>
                      <p className="text-lg font-bold text-slate-900">{t("csca.why.badge2")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-1/2">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
                isApple 
                  ? 'bg-slate-100 text-slate-800 border border-slate-200/60' 
                  : 'bg-primary-50 border border-primary-100 text-primary-600'
              }`}>
                <BrainCircuit className="w-4 h-4" /> {t("csca.why.tag")}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 tracking-tight">{t("csca.why.title1")} <br/> <span className={isApple ? 'text-slate-800' : 'text-primary-600'}>{t("csca.why.title2")}</span></h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                {t("csca.why.desc")}
              </p>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isApple ? 'bg-slate-100 text-slate-800' : 'bg-primary-100 text-primary-600'
                  }`}>
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">{t("csca.why.items.0.title")}</h4>
                    <p className="text-slate-600">{t("csca.why.items.0.desc")}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isApple ? 'bg-slate-100 text-slate-800' : 'bg-tech-100 text-tech-600'
                  }`}>
                    <LineChart className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">{t("csca.why.items.1.title")}</h4>
                    <p className="text-slate-600">{t("csca.why.items.1.desc")}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isApple ? 'bg-slate-100 text-slate-800' : 'bg-amber-100 text-amber-600'
                  }`}>
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">{t("csca.why.items.2.title")}</h4>
                    <p className="text-slate-600">{t("csca.why.items.2.desc")}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* CSCA Subpage FAQs Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <CSCAFAQsAccordion />
      </section>

      {/* CSCA FAQ Portal */}
      <section className="mb-24 mt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProgramFAQPortal program="CSCA" />
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20">
          <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl ${
            isApple ? 'bg-slate-800' : 'bg-primary-500'
          }`}></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-tech-500 rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">{t("csca.cta.title1")} <br/> <span className={isApple ? 'text-slate-300' : 'text-primary-400'}>{t("csca.cta.title2")}</span></h2>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto font-light">
            {t("csca.cta.desc")}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a href="https://wa.me/6281116612062" target="_blank" rel="noopener noreferrer" className={`text-white px-8 py-4 rounded-full font-medium transition-all flex items-center justify-center gap-2 text-lg ${
              isApple 
                ? 'bg-[#0071e3] hover:bg-[#0077ed] shadow-none' 
                : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/30'
            }`}>
              {t("csca.cta.btn")} <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};



const CSCAFAQsAccordion = () => {
  const { t, i18n } = useTranslation();
  const { isApple } = useDesignStyle();
  const [openId, setOpenId] = React.useState<string | null>('csca_q1'); // Open first item by default

  const lang = (i18n.language || 'en').split('-')[0];
  const currentLang = ['en', 'zh', 'id'].includes(lang) ? lang : 'en';
  
  // Specific list of top 5 CSCA FAQs that are most relevant
  const selectedIds = ['csca_q1', 'csca_q2', 'csca_q4', 'csca_q8', 'csca_q14'];
  const allFaqs = cscaFaqsByLang[currentLang] || cscaFaqsByLang['en'] || [];
  const faqs = allFaqs.filter(f => selectedIds.includes(f.id));

  return (
    <div className="mt-32 mb-20">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full mb-4 border ${
          isApple 
            ? 'bg-slate-100 border-slate-200/60 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200' 
            : 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/30 dark:border-rose-900/30 dark:text-rose-400'
        }`}>
          {t('faq.tag', 'Instant Solutions')}
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
          CSCA {t('faq.title1', 'Frequently Asked')} <span className="text-gradient">{t('faq.title2', 'Questions')}</span>
        </h2>
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div 
              key={faq.id}
              className={`bg-white rounded-2xl border overflow-hidden transition-all duration-300 ${
                isApple 
                  ? 'border-slate-200/50 hover:border-slate-300 shadow-none' 
                  : 'border-slate-100 shadow-sm hover:border-rose-200'
              }`}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                className="w-full flex items-center justify-between p-6 text-left font-bold text-slate-800 gap-4 cursor-pointer"
              >
                <span>{faq.question}</span>
                <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-300 ${
                  isOpen 
                    ? isApple 
                      ? 'rotate-180 text-[#0071e3]' 
                      : 'rotate-180 text-rose-500'
                    : 'text-slate-400'
                }`} />
              </button>
              
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 pb-6 pt-2 border-t border-slate-50 text-slate-600 leading-relaxed text-sm">
                      <div className="prose prose-slate max-w-none text-sm text-slate-600 leading-relaxed prose-p:my-1 prose-p:leading-relaxed prose-ul:list-disc prose-ul:pl-4 prose-ul:my-1.5 prose-ol:list-decimal prose-ol:pl-4 prose-ol:my-1.5 prose-li:my-0.5 prose-table:w-full prose-table:border-collapse prose-table:my-4 prose-th:bg-slate-50 prose-th:border prose-th:border-slate-200 prose-th:p-2.5 prose-th:text-left prose-th:font-semibold prose-th:text-slate-800 prose-td:border prose-td:border-slate-200 prose-td:p-2.5 prose-td:text-slate-600">
                        <Markdown remarkPlugins={[remarkGfm]}>{faq.answer}</Markdown>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CSCA;

