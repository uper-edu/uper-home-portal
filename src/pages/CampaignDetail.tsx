import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { client } from '../sanityClient';
import imageUrlBuilder from '../sanityClient';
import { PortableText } from '@portabletext/react';
import { ArrowLeft, Calendar, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { SEO } from '../components/SEO';
import { useTranslation } from 'react-i18next';
import { useDesignStyle } from '../utils/theme';

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

const ptComponents = {
  types: {
    image: ({ value }: any) => {
      if (!value?.asset?._ref) {
        return null;
      }
      return (
        <img
          alt={value.alt || ' '}
          loading="lazy"
          src={urlFor(value)?.width(800).fit('max').auto('format').url() || ''}
          className="rounded-2xl my-8 w-full object-cover"
          referrerPolicy="no-referrer"
        />
      );
    },
  },
  block: {
    h1: ({ children }: any) => <h1 className="text-4xl font-bold mt-12 mb-6 text-slate-900">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-3xl font-bold mt-10 mb-5 text-slate-900">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-2xl font-bold mt-8 mb-4 text-slate-900">{children}</h3>,
    normal: ({ children }: any) => <p className="text-lg text-slate-700 leading-relaxed mb-6">{children}</p>,
    blockquote: ({ children }: any) => {
      const isApple = document.documentElement.getAttribute('data-design-style') === 'apple';
      return (
        <blockquote className={`border-l-4 pl-6 italic text-slate-600 my-8 text-xl ${
          isApple ? 'border-slate-300' : 'border-primary-500'
        }`}>
          {children}
        </blockquote>
      );
    },
  },
  list: {
    bullet: ({ children }: any) => <ul className="list-disc pl-6 mb-6 text-lg text-slate-700 space-y-2">{children}</ul>,
    number: ({ children }: any) => <ol className="list-decimal pl-6 mb-6 text-lg text-slate-700 space-y-2">{children}</ol>,
  },
};

const FALLBACK_CAMPAIGNS_DETAILS = [];

export default function CampaignDetail() {
  const { isApple } = useDesignStyle();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.fetch(`*[_type == "campaign" && slug.current == $slug][0]`, { slug })
      .then((data) => {
        if (data) {
          setCampaign(data);
        } else {
          const fallbackItem = FALLBACK_CAMPAIGNS_DETAILS.find((item: any) => item.slug?.current === slug);
          setCampaign(fallbackItem || null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching campaign details:", err);
        const fallbackItem = FALLBACK_CAMPAIGNS_DETAILS.find((item: any) => item.slug?.current === slug);
        setCampaign(fallbackItem || null);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen pt-32 pb-20 flex items-center justify-center">
        <SEO title={t("details.loading")} description="Loading campaign details" />
        <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${isApple ? 'border-slate-800' : 'border-primary-600'}`}></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen pt-32 pb-20 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">{t("details.notFound")}</h1>
        <p className="text-lg text-slate-600 mb-8">{t("details.campaignNotFoundDesc")}</p>
        <button onClick={() => navigate(-1)} className={`px-8 py-3 rounded-full font-medium transition-colors text-white ${
          isApple ? 'bg-[#0071e3] hover:bg-[#0077ed]' : 'bg-primary-600 hover:bg-primary-700'
        }`}>
          {t("details.returnBack")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20">
      <SEO 
        title={campaign.title} 
        description={campaign.subtitle || campaign.title} 
        image={campaign.image ? urlFor(campaign.image)?.width(1200).height(630).url() : undefined}
      />
      {/* Hero Section */}
      <div className="relative h-[40vh] md:h-[60vh] w-full bg-slate-900">
        <img 
          src={urlFor(campaign.image)?.width(2000).url() || "https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&q=80&w=2000"} 
          alt={campaign.title} 
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
        
        <div className="absolute inset-0 flex items-end pb-12 md:pb-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-8 transition-colors">
              <ArrowLeft className="w-5 h-5" /> {t("details.back")}
            </button>
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/20 backdrop-blur-md border border-primary-500/30 text-sm font-bold text-primary-100 uppercase tracking-wider mb-4">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>{t("details.specialCampaign")}</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
              {campaign.title}
            </h1>
            <p className="text-xl text-white/90 max-w-2xl">
              {campaign.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-white rounded-3xl p-8 md:p-12 -mt-32 relative z-10 transition-all duration-300 ${
            isApple 
              ? 'border border-slate-200/50 shadow-none' 
              : 'border border-slate-100 shadow-xl shadow-slate-200/50'
          }`}
        >
          {campaign.countdownDate && (
            <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl mb-10 font-medium border transition-all duration-300 ${
              isApple 
                ? 'bg-slate-100 text-slate-800 border-slate-200/60' 
                : 'bg-primary-50 text-primary-600 border-transparent'
            }`}>
              <Calendar className="w-6 h-6" />
              <span>{t("details.endsOn")} {new Date(campaign.countdownDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          )}

          <div className="prose prose-lg prose-slate max-w-none">
            {campaign.content ? (
              <PortableText value={campaign.content} components={ptComponents} />
            ) : (
              <p className="text-lg text-slate-600">{t("details.moreDetailsSoon")}</p>
            )}
          </div>

          {campaign.buttonLink && (
            <div className="mt-12 pt-12 border-t border-slate-100 text-center">
              <a 
                href={campaign.buttonLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center gap-2 text-white px-10 py-4 rounded-full font-bold transition-all text-lg ${
                  isApple 
                    ? 'bg-[#0071e3] hover:bg-[#0077ed] shadow-none' 
                    : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/30'
                }`}
              >
                {campaign.buttonText || t("details.participateNow")}
              </a>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
