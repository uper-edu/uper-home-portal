import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDesignStyle } from '../utils/theme';

interface FAQConfigItem {
  title: string;
  desc: string;
  btn: string;
  badge: string;
  bg: string;
  accent: string;
  btnBg: string;
}

export default function ProgramFAQPortal({ program }: { program: 'HSK' | 'CSCA' | 'Study Abroad' }) {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  
  const configMap: Record<'HSK' | 'CSCA' | 'Study Abroad', FAQConfigItem> = {
    'HSK': {
      title: t('faq.portal.hsk.title', 'Have Questions about HSK?'),
      desc: t('faq.portal.hsk.desc', 'Get precise guidance about exam preparation, standard tutoring alignments, offline camp facilities, and tone diagnosis tools.'),
      btn: t('faq.portal.hsk.btn', 'Go to HSK FAQs'),
      badge: t('faq.portal.hsk.badge', 'Knowledge Portal'),
      bg: 'bg-gradient-to-tr from-primary-500/10 via-primary-500/[0.04] to-transparent',
      accent: 'border-primary-100 text-primary-600 bg-primary-50/80 dark:border-primary-900/30 dark:text-primary-400 dark:bg-primary-950/20',
      btnBg: 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/20'
    },
    'CSCA': {
      title: t('faq.portal.csca.title', 'Have Questions about CSCA Bridging?'),
      desc: t('faq.portal.csca.desc', 'Explore critical questions about scholastic evaluation benchmarks, advanced mathematical syllabuses, and how to prove STEM capabilities to elite CSC committees.'),
      btn: t('faq.portal.csca.btn', 'Go to CSCA FAQs'),
      badge: t('faq.portal.csca.badge', 'Academic Guide'),
      bg: 'bg-gradient-to-tr from-tech-500/10 via-tech-500/[0.04] to-transparent',
      accent: 'border-tech-100 text-tech-600 bg-tech-50/80 dark:border-tech-900/30 dark:text-tech-400 dark:bg-tech-950/20',
      btnBg: 'bg-tech-600 hover:bg-tech-700 shadow-tech-500/20'
    },
    'Study Abroad': {
      title: t('faq.portal.abroad.title', 'Have Questions about University Placements?'),
      desc: t('faq.portal.abroad.desc', 'Find essential compliance answers on fully-funded scholarship ratios, regional Chinese embassies/visa offices, PPIT student groups, and cross-border fintech.'),
      btn: t('faq.portal.abroad.btn', 'Go to Admission FAQs'),
      badge: t('faq.portal.abroad.badge', 'Expat Advisor'),
      bg: 'bg-gradient-to-tr from-emerald-500/10 via-emerald-500/[0.04] to-transparent',
      accent: 'border-emerald-100 text-emerald-600 bg-emerald-50/80 dark:border-emerald-900/30 dark:text-emerald-400 dark:bg-emerald-950/20',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
    }
  };

  const config = configMap[program];

  const cardBgClass = isApple 
    ? 'bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-800 shadow-none' 
    : `${config.bg} bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none`;
  
  const accentClass = isApple 
    ? 'border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800' 
    : config.accent;
  
  const buttonClass = isApple 
    ? 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-none' 
    : config.btnBg;

  const titleColorClass = 'text-slate-900 dark:text-white';

  const descColorClass = 'text-slate-600 dark:text-slate-300';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative rounded-3xl p-8 md:p-12 border overflow-hidden ${cardBgClass}`}
    >
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/40 dark:bg-slate-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="max-w-2xl text-left">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mb-4 ${accentClass}`}>
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{config.badge}</span>
          </div>
          <h3 className={`text-2xl md:text-3xl font-extrabold leading-tight mb-3 ${titleColorClass}`}>
            {config.title}
          </h3>
          <p className={`leading-relaxed text-sm md:text-base ${descColorClass}`}>
            {config.desc}
          </p>
        </div>
        <div className="shrink-0 flex">
          <Link
            to={`/faq?program=${encodeURIComponent(program)}`}
            className={`inline-flex items-center gap-2 text-white px-6 py-3.5 rounded-full font-bold transition-all shadow-lg text-sm cursor-pointer ${buttonClass}`}
          >
            <span>{config.btn}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
