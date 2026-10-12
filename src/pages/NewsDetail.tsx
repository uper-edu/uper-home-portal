import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { client } from '../sanityClient';
import imageUrlBuilder from '../sanityClient';
import { PortableText } from '@portabletext/react';
import { Skeleton } from '../components/ui/Skeleton';
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

function getShortLink(urlStr: string) {
  try {
    const url = new URL(urlStr);
    return url.hostname.replace('www.', '');
  } catch (e) {
    return urlStr;
  }
}

const FALLBACK_NEWS_DETAILS = [
  {
    _id: 'news-1',
    title: 'Peluang Beasiswa Penuh Pemerintah Tiongkok (CSC) 2026 Resmi Dibuka',
    publishedAt: '2026-03-15T00:00:00Z',
    slug: { current: 'csc-scholarship-2026-open' },
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800',
    summary: 'Simak panduan lengkap, persyaratan dokumen, dan strategi penulisan rencana studi untuk memenangkan beasiswa CSC di kampus impian Anda.',
    body: [
      {
        _key: 'b1',
        _type: 'block',
        children: [{ _key: 'b1c1', _type: 'span', text: 'UPER (Universal Prestasi Nusantara) dengan bangga mengumumkan bahwa gerbang pendaftaran Beasiswa Pemerintah Tiongkok (CSC) untuk tahun akademik 2026 telah dibuka secara resmi! Ini adalah kesempatan emas bagi mahasiswa Indonesia untuk menempuh pendidikan sarjana, magister, atau doktoral di universitas-universitas terbaik di dunia, seperti Tsinghua University, Peking University, Zhejiang University, dan Shanghai Jiao Tong University.' }]
      },
      {
        _key: 'b2',
        _type: 'block',
        children: [{ _key: 'b2c1', _type: 'span', text: 'Program beasiswa CSC mencakup seluruh biaya kuliah, akomodasi asrama gratis di lingkungan kampus, asuransi kesehatan komprehensif, serta uang saku bulanan yang sangat memadai untuk kebutuhan sehari-hari mahasiswa.' }]
      }
    ]
  },
  {
    _id: 'news-2',
    title: 'Delegasi UPER Kunjungi Universitas Top di Beijing Pererat Kerja Sama Akademik',
    publishedAt: '2026-02-28T00:00:00Z',
    slug: { current: 'uper-visit-beijing-universities' },
    image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800',
    summary: 'UPER menandatangani MoU baru yang membuka jalur eksklusif beasiswa prestasi dan program pertukaran mahasiswa.',
    body: [
      {
        _key: 'b1',
        _type: 'block',
        children: [{ _key: 'b1c1', _type: 'span', text: 'Dalam upaya memperluas jaringan kemitraan global dan membuka lebih banyak peluang masa depan bagi generasi muda Indonesia, delegasi resmi UPER telah melakukan kunjungan diplomatik ke sejumlah perguruan tinggi papan atas di Beijing, Tiongkok.' }]
      },
      {
        _key: 'b2',
        _type: 'block',
        children: [{ _key: 'b2c1', _type: 'span', text: 'Kunjungan strategis ini menghasilkan beberapa kesepakatan penting, termasuk program jalur rekomendasi khusus, percepatan proses admisi, serta pembentukan beasiswa talenta berprestasi (Achievement Scholarships) yang ditujukan khusus bagi siswa lulusan terbaik bimbingan UPER.' }]
      }
    ]
  },
  {
    _id: 'news-3',
    title: 'Pentingnya Sertifikasi HSK 4 & 5 dalam Seleksi Akademik di Universitas Tiongkok',
    publishedAt: '2026-02-10T00:00:00Z',
    slug: { current: 'hsk-certification-importance' },
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=800',
    summary: 'Meskipun beberapa jurusan menawarkan kelas pengantar bahasa Inggris, penguasaan Mandarin yang dibuktikan dengan sertifikat HSK tetap menjadi poin plus.',
    body: [
      {
        _key: 'b1',
        _type: 'block',
        children: [{ _key: 'b1c1', _type: 'span', text: 'Sertifikasi Hanyu Shuiping Kaoshi (HSK) merupakan salah satu pilar penentu keberhasilan saat melamar ke universitas di Tiongkok. UPER menyediakan program pembekalan bahasa yang intensif dari level pemula hingga mahir untuk membantu para peserta melampaui skor target minimum dengan percaya diri.' }]
      }
    ]
  },
  {
    _id: 'news-4',
    title: 'Sesi Pembekalan Keberangkatan (Departure Briefing) Mahasiswa UPER Angkatan 2026',
    publishedAt: '2026-01-20T00:00:00Z',
    slug: { current: 'departure-briefing-2026' },
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800',
    summary: 'Panduan lengkap mengenai persiapan visa JW202, asuransi kesehatan, tempat tinggal, hingga tips beradaptasi dengan budaya lokal.',
    body: [
      {
        _key: 'b1',
        _type: 'block',
        children: [{ _key: 'b1c1', _type: 'span', text: 'Sebelum resmi bertolak ke universitas tujuan masing-masing di Tiongkok, UPER menyelenggarakan sesi pembekalan keberangkatan komprehensif bagi seluruh mahasiswa angkatan 2026 guna memastikan transisi kehidupan dan akademis berjalan mulus tanpa kendala.' }]
      }
    ]
  }
];

export default function NewsDetail() {
  const { t } = useTranslation();
  const { isApple } = useDesignStyle();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [newsItem, setNewsItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (slug) {
      client.fetch(`*[_type == "news" && slug.current == $slug][0]`, { slug })
        .then((data) => {
          if (data) {
            setNewsItem(data);
          } else {
            const fallbackItem = FALLBACK_NEWS_DETAILS.find((item: any) => item.slug?.current === slug);
            setNewsItem(fallbackItem || null);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching news:", err);
          const fallbackItem = FALLBACK_NEWS_DETAILS.find((item: any) => item.slug?.current === slug);
          setNewsItem(fallbackItem || null);
          setLoading(false);
        });
    }
  }, [slug]);

  useEffect(() => {
    if (!newsItem) return;
    const imagesList = (newsItem.images && newsItem.images.length > 0) 
      ? newsItem.images 
      : ((newsItem.image || newsItem.mainImage) ? [newsItem.image || newsItem.mainImage].filter(Boolean) : []);
    
    if (imagesList.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % imagesList.length);
    }, 2500);

    return () => clearInterval(timer);
  }, [newsItem]);

  if (loading) {
    return (
      <article className="pt-32 pb-24 min-h-screen">
        <SEO title={t("details.loading", "Loading...")} description="Loading news article" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-6 w-32 mb-8" />
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-12 w-3/4 mb-8" />
          <Skeleton className="h-[400px] w-full rounded-2xl mb-12" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full mt-8" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </article>
    );
  }

  if (!newsItem) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">{t("details.notFound", "News not found")}</h1>
        <button onClick={() => navigate(-1)} className={`font-semibold flex items-center gap-2 transition-colors ${
          isApple ? 'text-[#0071e3] hover:text-[#0077ed]' : 'text-primary-600 hover:text-primary-700'
        }`}>
          <ArrowLeft className="w-4 h-4" /> {t("common.backToList", "Back to News")}
        </button>
      </div>
    );
  }

  return (
    <article className="pt-32 pb-24 min-h-screen">
      <SEO 
        title={newsItem.title} 
        description={newsItem.summary || newsItem.title} 
        image={newsItem.images?.length > 0 ? urlFor(newsItem.images[0])?.width(1200).height(630).url() : (newsItem.image ? urlFor(newsItem.image)?.width(1200).height(630).url() : undefined)}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <button onClick={() => navigate(-1)} className={`inline-flex items-center gap-2 text-slate-500 transition-colors mb-8 font-medium ${
          isApple ? 'hover:text-[#0071e3]' : 'hover:text-primary-600'
        }`}>
          <ArrowLeft className="w-4 h-4" /> {t("details.allNews", "Back to all news")}
        </button>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8 leading-tight">
            {newsItem.title}
          </h1>
          
          {(() => {
            const imagesList = (newsItem.images && newsItem.images.length > 0) ? newsItem.images : ((newsItem.image || newsItem.mainImage) ? [newsItem.image || newsItem.mainImage].filter(Boolean) : []);
            if (imagesList.length === 0) return null;

            const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % imagesList.length);
            const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + imagesList.length) % imagesList.length);

            return (
              <div className={`relative rounded-2xl overflow-hidden mb-6 group bg-slate-100 aspect-video w-full flex items-center justify-center transition-all duration-300 ${
                isApple ? 'border border-slate-200/50 shadow-none' : 'shadow-lg'
              }`}>
                <AnimatePresence>
                  <motion.img 
                    key={currentImageIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    src={urlFor(imagesList[currentImageIndex])?.width(1200).url() || ''} 
                    alt={`${newsItem.title} - ${currentImageIndex + 1}`} 
                    className="absolute inset-0 w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>

                {imagesList.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => { e.preventDefault(); prevImage(); }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white transition-all transform hover:scale-110 z-10"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); nextImage(); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white transition-all transform hover:scale-110 z-10"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-black/40 backdrop-blur-sm px-3 py-2 rounded-full">
                      {imagesList.map((_: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/80'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Unified Metadata Row containing Date, Type, and Optional External Link */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-100">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{newsItem.publishedAt ? new Date(newsItem.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}</span>
              </div>
              <span className="text-slate-200">|</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isApple ? 'bg-slate-100 text-slate-700 border border-slate-200/50' : 'bg-primary-50 text-primary-700'
              }`}>{t("news.newsBadge", "News")}</span>
            </div>

            {newsItem.source && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t('news.externalSource', 'External Press / Coverage')}:
                </span>
                <a 
                  href={newsItem.source} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl border transition-all font-mono shadow-xs ${
                    isApple 
                      ? 'text-slate-800 bg-slate-100 border-slate-200/50 hover:bg-slate-200' 
                      : 'text-indigo-600 bg-indigo-50/50 hover:bg-indigo-150 border-indigo-100/60 hover:border-indigo-200'
                  }`}
                >
                  <span>{getShortLink(newsItem.source)}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
          
          <div className={`prose prose-lg prose-slate max-w-none prose-headings:font-display prose-img:rounded-xl ${
            isApple ? 'prose-a:text-[#0071e3] hover:prose-a:text-[#0077ed]' : 'prose-a:text-primary-600 hover:prose-a:text-primary-700'
          }`}>
            {newsItem.body ? (
              <PortableText value={newsItem.body} components={ptComponents} />
            ) : (
              <p className="text-slate-500 italic">{t("news.noNews", "No content available.")}</p>
            )}
          </div>
        </motion.div>
      </div>
    </article>
  );
}
