import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Handshake, ExternalLink, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { client } from '../sanityClient';
import imageUrlBuilder from '../sanityClient';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/SEO';
import { useDesignStyle } from '../utils/theme';

// Image builder
const builder = imageUrlBuilder(client);
function urlFor(source: any) {
  try {
    if (!source) {
      const emptyHelper: any = {
        width: () => emptyHelper,
        height: () => emptyHelper,
        fit: () => emptyHelper,
        auto: () => emptyHelper,
        url: () => ''
      };
      return emptyHelper;
    }
    if (typeof source === 'string') {
      const stringHelper: any = {
        width: () => stringHelper,
        height: () => stringHelper,
        fit: () => stringHelper,
        auto: () => stringHelper,
        url: () => source
      };
      return stringHelper;
    }
    if (!source.asset || !source.asset._ref) {
      const emptyHelper: any = {
        width: () => emptyHelper,
        height: () => emptyHelper,
        fit: () => emptyHelper,
        auto: () => emptyHelper,
        url: () => ''
      };
      return emptyHelper;
    }
    return builder.image(source);
  } catch (e) {
    const emptyHelper: any = {
      width: () => emptyHelper,
      height: () => emptyHelper,
      fit: () => emptyHelper,
      auto: () => emptyHelper,
      url: () => ''
    };
    return emptyHelper;
  }
}

// Fallback data in case Sanity is empty
const FALLBACK_PARTNERS = [];

// Bento Scheme Design Architecture
const bentoConfigs = [
  {
     span: "col-span-1 lg:col-span-12",
     wrapper: "bg-gradient-to-br from-primary-50 to-tech-50 shadow-xl shadow-slate-200/40 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 lg:p-12 relative overflow-hidden border border-primary-100/50",
     titleText: "text-slate-900",
     subtitleText: "text-slate-600",
     divider: "bg-primary-200/60",
     card: "bg-white/80 backdrop-blur-sm shadow-sm border border-white hover:border-primary-300 hover:shadow-lg hover:-translate-y-1 group relative flex items-center justify-center rounded-2xl p-4 md:p-6 h-28 md:h-36 transition-all duration-300",
     gridCols: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
     badge: "bg-white border border-primary-100 text-primary-700 text-[10px] uppercase tracking-wider px-3 py-1 rounded-full",
     decorate: true,
  },
  {
     span: "col-span-1 lg:col-span-7",
     wrapper: "bg-white shadow-xl shadow-slate-200/50 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 border border-slate-100",
     titleText: "text-slate-900",
     subtitleText: "text-slate-500",
     divider: "bg-slate-100",
     card: "bg-slate-50 border border-slate-100 hover:bg-white hover:border-slate-300 hover:shadow-md hover:-translate-y-1 group relative flex items-center justify-center rounded-2xl p-4 md:p-6 h-28 md:h-32 transition-all duration-300",
     gridCols: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
     badge: "bg-slate-50 border border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider px-3 py-1 rounded-full",
     decorate: false,
  },
  {
     span: "col-span-1 lg:col-span-5",
     wrapper: "bg-gradient-to-br from-orange-50 to-amber-50 shadow-lg shadow-orange-900/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 border border-orange-100 relative overflow-hidden",
     titleText: "text-orange-950",
     subtitleText: "text-orange-700/80",
     divider: "bg-orange-200/60",
     card: "bg-white/90 backdrop-blur-sm shadow-sm border border-white hover:border-orange-300 hover:shadow-md hover:-translate-y-1 group relative flex items-center justify-center rounded-2xl p-4 md:p-6 h-28 md:h-32 transition-all duration-300",
     gridCols: "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3",
     badge: "bg-white border border-orange-100 text-orange-700 text-[10px] uppercase tracking-wider px-3 py-1 rounded-full",
     decorate: false,
  },
  {
     span: "col-span-1 lg:col-span-12",
     wrapper: "bg-gradient-to-br from-emerald-50/80 to-teal-50/70 shadow-md rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 lg:p-12 border border-emerald-100 relative overflow-hidden",
     titleText: "text-emerald-950",
     subtitleText: "text-emerald-700/80",
     divider: "bg-emerald-200/60",
     card: "bg-white/80 backdrop-blur-sm border border-white shadow-sm hover:border-emerald-300 hover:shadow-md hover:-translate-y-1 group relative flex items-center justify-center rounded-2xl p-4 md:p-6 h-28 md:h-36 transition-all duration-300",
     gridCols: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
     badge: "bg-white border border-emerald-100 text-emerald-700 text-[10px] uppercase tracking-wider px-3 py-1 rounded-full",
     decorate: false,
  },
  {
     span: "col-span-1 lg:col-span-6",
     wrapper: "bg-slate-50 shadow-inner rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 border border-slate-200",
     titleText: "text-slate-800",
     subtitleText: "text-slate-500",
     divider: "bg-slate-200",
     card: "bg-white border border-slate-100 shadow-sm hover:border-slate-300 hover:shadow-md hover:-translate-y-1 group relative flex items-center justify-center rounded-2xl p-4 md:p-6 h-28 md:h-32 transition-all duration-300",
     gridCols: "grid-cols-2 sm:grid-cols-3",
     badge: "bg-white border border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider px-3 py-1 rounded-full",
     decorate: false,
  },
  {
     span: "col-span-1 lg:col-span-6",
     wrapper: "bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg shadow-indigo-900/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 border border-indigo-100/60 relative overflow-hidden",
     titleText: "text-indigo-950",
     subtitleText: "text-indigo-700/80",
     divider: "bg-indigo-200/60",
     card: "bg-white/80 backdrop-blur-sm border border-white shadow-sm hover:border-indigo-300 hover:shadow-md hover:-translate-y-1 group relative flex items-center justify-center rounded-2xl p-4 md:p-6 h-28 md:h-32 transition-all duration-300",
     gridCols: "grid-cols-2 sm:grid-cols-3",
     badge: "bg-white border border-indigo-100 text-indigo-700 text-[10px] uppercase tracking-wider px-3 py-1 rounded-full",
     decorate: false,
  }
];

export default function Partners() {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (!loading && location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        // slight delay to ensure rendering layout is stable
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [loading, location.hash]);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const query = `*[_type == "partner" && isActive == true] | order(order asc, name asc)`;
        const data = await client.fetch(query);
        
        if (data && data.length > 0) {
          setPartners(data.filter(Boolean));
        } else {
          setPartners(FALLBACK_PARTNERS);
        }
      } catch (error) {
        console.error("Error fetching partners:", error);
        setPartners(FALLBACK_PARTNERS);
      } finally {
        setLoading(false);
      }
    };

    fetchPartners();
  }, []);

  // Compute Categories from Data (Without 'All' for Bento layout)
  const categories = Array.from(new Set(partners.map(p => p.category || 'Other')));

  // Group Data for Displaying sections
  const groupedPartners = partners.reduce((acc, partner) => {
    const cat = partner.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(partner);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="pt-32 min-h-screen pb-24">
      <SEO 
        title={t('meta.partners.title', 'Our Partners')} 
        description={t('meta.partners.description', 'Discover the universities, schools, and corporate partners collaborating with UPER.')} 
        canonicalUrl="https://uperedu.com/partners"
        breadcrumbs={[
          { name: 'Home', url: 'https://uperedu.com' },
          { name: 'Our Partners', url: 'https://uperedu.com/partners' }
        ]}
      />
      {/* Light Hero Section aligned with Home/HSK */}
      <section className="relative overflow-hidden mb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest mb-6 ${
              isApple 
                ? 'bg-slate-100 border border-slate-200 text-slate-800' 
                : 'bg-primary-50 border border-primary-100 text-primary-600 shadow-sm'
            }`}>
              <Handshake className="w-4 h-4" />
              <span>{t("partnersPage.tag", "Global Network")}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 tracking-tight">
              {t("partnersPage.title1", "Our Strategic ")} <span className="text-gradient">{t("partnersPage.title2", "Partners")}</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
              {t("partnersPage.desc")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Bento Showcase Grid */}
      {(!loading && partners.length === 0) ? (
        (import.meta as any).env.DEV ? (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 pb-24">
            <div className="py-12 bg-amber-50 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 rounded-3xl p-8 text-center">
              <h3 className="font-bold text-lg mb-2">🔧 [DEV MODE] No Strategic Partners Found</h3>
              <p className="text-sm opacity-90">
                This partner grid is completely hidden in <strong>Production</strong> because no items were returned from Sanity.
                Ensure you have created and published documents of type <code>partner</code> with <code>isActive == true</code> in Sanity Studio.
              </p>
            </div>
          </div>
        ) : null
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 min-h-[600px]">
         {loading ? (
          <div className="flex justify-center items-center py-32 bg-white rounded-3xl shadow-sm border border-slate-100">
            <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-r-transparent border-l-transparent ${
              isApple ? 'border-slate-800' : 'border-primary-600'
            }`}></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            {categories.map((categoryName, idx) => {
              const baseConfig = bentoConfigs[idx % bentoConfigs.length];
              const config = isApple ? {
                ...baseConfig,
                wrapper: "bg-[#f5f5f7]/70 backdrop-blur-sm shadow-none rounded-[2rem] p-6 md:p-10 lg:p-12 relative overflow-hidden border border-slate-200/50",
                titleText: "text-slate-800",
                subtitleText: "text-slate-500",
                divider: "bg-slate-200/50",
                card: "bg-white border border-slate-200/50 shadow-none hover:border-[#0071e3] hover:shadow-md group relative flex items-center justify-center rounded-2xl p-4 md:p-6 h-28 md:h-36 transition-all duration-300",
                badge: "bg-slate-100 border border-slate-200/60 text-slate-600 text-[10px] uppercase tracking-wider px-3 py-1 rounded-full",
                decorate: false,
              } : baseConfig;
              const items = groupedPartners[categoryName] || [];
              
              // Map into Sub-categories
              const subGroups = items.reduce((acc, p) => {
                const sub = p.subcategory || '@@NONE@@';
                if (!acc[sub]) acc[sub] = [];
                acc[sub].push(p);
                return acc;
              }, {} as Record<string, any[]>);
              
              return (
                <motion.div
                  key={categoryName}
                  id={`section-${categoryName.replace(/\s+/g, '-')}`}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className={`${config.span} ${config.wrapper} scroll-mt-24`}
                >
                  {/* Optional Decorative Glow for Dark Bento Boxes */}
                  {config.decorate && (
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary-500/20 blur-[100px] rounded-full pointer-events-none" />
                  )}
                  
                  <div className="relative z-10">
                    {/* Header */}
                    <div className="mb-2">
                      <h2 className={`text-2xl md:text-3xl font-display font-bold ${config.titleText}`}>{t(`partnersPage.categories.${categoryName}`, categoryName) as string}</h2>
                    </div>
                    
                    <div className={`h-px w-full my-6 md:my-8 ${config.divider}`} />
                    
                    {/* Subcategories & Logos Grid inside Bento */}
                    <div className="space-y-8 md:space-y-10">
                      {Object.entries(subGroups).map(([subTitle, subItems]) => (
                        <div key={subTitle}>
                          {subTitle !== '@@NONE@@' && (
                            <div className="flex items-center gap-4 mb-5">
                              <h4 className={`text-xs font-bold uppercase tracking-widest ${config.titleText} opacity-70`}>{t(`partnersPage.subcategories.${subTitle}`, subTitle) as string}</h4>
                              <div className={`h-px flex-grow ${config.divider} opacity-50`} />
                            </div>
                          )}
                          <div className={`grid ${config.gridCols} gap-4`}>
                            {(subItems as any[]).map((partner: any) => (
                              <a
                                key={partner._id}
                                href={partner.link || '#'}
                                target={partner.link ? "_blank" : "_self"}
                                rel="noopener noreferrer"
                                className={config.card}
                              >
                                {/* Inner Icons (External link vs verified) */}
                                <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                  {partner.link ? (
                                    <ExternalLink className={`w-3.5 h-3.5 text-slate-400 ${isApple ? 'group-hover:text-[#0071e3]' : 'group-hover:text-primary-500'}`} />
                                  ) : (
                                    <ShieldCheck className="w-3.5 h-3.5 text-slate-300" />
                                  )}
                                </div>
                                
                                {/* Logo Specific Image rendering */}
                                <div className="relative w-full h-full flex items-center justify-center p-2">
                                   <img 
                                     src={partner.logo && typeof partner.logo !== 'string' ? urlFor(partner.logo)?.url() || '' : partner.logo} 
                                     alt={partner.name} 
                                     className="max-h-full max-w-[85%] object-contain transition-transform duration-500 group-hover:scale-110"
                                   />
                                </div>
                                
                                {/* Hover text label */}
                                <div className="absolute inset-x-0 bottom-2 text-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 px-2 flex justify-center pointer-events-none z-20">
                                  <span className="text-[10px] font-semibold text-slate-800 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full shadow-md border border-slate-100 truncate max-w-full">
                                    {partner.name}
                                  </span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
