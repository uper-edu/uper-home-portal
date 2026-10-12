import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Newspaper, 
  GraduationCap, 
  Sparkles, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Upload, 
  Check, 
  X, 
  ExternalLink, 
  Image as ImageIcon, 
  Save, 
  RefreshCw,
  Award,
  Calendar,
  LayoutList,
  AlertCircle,
  ChevronRight,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { urlFor } from '../../sanityClient';

interface ContentManagementPanelProps {
  isLight: boolean;
  lang: 'en' | 'zh';
}

export type CmsSection = 
  | 'partners' 
  | 'news' 
  | 'trendingPrograms' 
  | 'studentStories' 
  | 'admissionsList' 
  | 'campaigns' 
  | 'newsPage';

export interface CmsSectionItem {
  id: CmsSection;
  titleEn: string;
  titleZh: string;
  icon: any;
  descEn: string;
  descZh: string;
  defaultCount: number;
}

export interface CmsSectionGroup {
  groupEn: string;
  groupZh: string;
  items: CmsSectionItem[];
}

export const CMS_SECTION_GROUPS: CmsSectionGroup[] = [
  {
    groupEn: 'Academic & Programs',
    groupZh: '学术与院校体系',
    items: [
      {
        id: 'partners',
        titleEn: 'Partners & Universities',
        titleZh: '合作院校库',
        icon: Building2,
        descEn: 'Chinese & global universities, school partners',
        descZh: '中国及海外合作高校、国际教育伙伴与校区机构',
        defaultCount: 54
      },
      {
        id: 'trendingPrograms',
        titleEn: 'Trending Programs',
        titleZh: '精选热门项目',
        icon: GraduationCap,
        descEn: 'HSK courses, study tours & scholarship tracks',
        descZh: 'HSK考级班、名校游学营与奖学金直通班型',
        defaultCount: 8
      },
      {
        id: 'admissionsList',
        titleEn: 'Admissions Honors',
        titleZh: '录取捷报榜单',
        icon: Award,
        descEn: 'Offer notices, scholarship awards & certificates',
        descZh: '清北浙大等中国名校录取通知与奖学金捷报',
        defaultCount: 1
      }
    ]
  },
  {
    groupEn: 'Media & Publications',
    groupZh: '媒体资讯与发布',
    items: [
      {
        id: 'news',
        titleEn: 'News & Articles',
        titleZh: '新闻动态资讯',
        icon: Newspaper,
        descEn: 'Education news, policy briefs & announcements',
        descZh: '赴华留学政策、印尼华文教育前沿与官方公告',
        defaultCount: 19
      },
      {
        id: 'campaigns',
        titleEn: 'Special Campaigns',
        titleZh: '主题专案活动',
        icon: Calendar,
        descEn: 'Webinars, expos, admissions masterclasses',
        descZh: '名师公开课、教育展会巡展与留学讲座',
        defaultCount: 2
      },
      {
        id: 'newsPage',
        titleEn: 'News Channel Directory',
        titleZh: '资讯频道栏目',
        icon: LayoutList,
        descEn: 'Channel classification metadata & landing banners',
        descZh: '官网资讯中心栏目分类、封面图与频道元数据',
        defaultCount: 7
      }
    ]
  },
  {
    groupEn: 'Student Community',
    groupZh: '学员社群与口碑',
    items: [
      {
        id: 'studentStories',
        titleEn: 'Student Stories',
        titleZh: '优秀学员案例',
        icon: Sparkles,
        descEn: 'Alumni testimonials, exam scores & career paths',
        descZh: '学员真实高分见证、就业转折与赴华学习感言',
        defaultCount: 5
      }
    ]
  }
];

export default function ContentManagementPanel({ isLight, lang }: ContentManagementPanelProps) {
  const [activeSection, setActiveSection] = useState<CmsSection>('partners');
  const [items, setItems] = useState<any[]>([]);
  const [sectionCounts, setSectionCounts] = useState<Record<CmsSection, number>>({
    partners: 54,
    news: 19,
    trendingPrograms: 8,
    studentStories: 5,
    admissionsList: 1,
    campaigns: 2,
    newsPage: 7
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTargetField, setUploadTargetField] = useState<'image' | 'certificateImage'>('image');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    id: string;
    name: string;
    section: CmsSection;
    sectionTitleEn?: string;
    sectionTitleZh?: string;
    subtitle?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = (en: string, zh: string) => (lang === 'zh' ? zh : en);

  const allSectionItems = CMS_SECTION_GROUPS.flatMap(g => g.items);
  const currentActiveMeta = allSectionItems.find(s => s.id === activeSection) || allSectionItems[0];

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchItems = async (section: CmsSection) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/cms/content/${section}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
        setSectionCounts(prev => ({ ...prev, [section]: data.items.length }));
      } else {
        setItems([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch CMS items:', err);
      showNotification('error', t('Failed to load content', '加载内容失败'));
    } finally {
      setIsLoading(false);
    }
  };

  // Sync all collection counts in background on mount
  useEffect(() => {
    const sections: CmsSection[] = ['partners', 'news', 'trendingPrograms', 'studentStories', 'admissionsList', 'campaigns', 'newsPage'];
    sections.forEach(async (sec) => {
      try {
        const res = await fetch(`/api/cms/content/${sec}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setSectionCounts(prev => ({ ...prev, [sec]: data.items.length }));
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    fetchItems(activeSection);
  }, [activeSection]);

  const handleOpenAdd = () => {
    let emptyItem: any = {};
    if (activeSection === 'partners') {
      emptyItem = {
        name: '',
        category: 'Chinese Universities',
        subcategory: '',
        link: '',
        order: items.length + 1,
        isActive: true,
        logo: { url: '' }
      };
    } else if (activeSection === 'news') {
      emptyItem = {
        title: '',
        slug: { current: '' },
        publishedAt: new Date().toISOString(),
        excerpt: '',
        source: '',
        image: { url: '' },
        images: [{ url: '' }],
        body: [
          {
            _type: 'block',
            children: [{ _type: 'span', text: '', marks: [] }],
            markDefs: [],
            style: 'normal'
          }
        ]
      };
    } else if (activeSection === 'trendingPrograms') {
      emptyItem = {
        title: '',
        category: '📚 HSK',
        badge: '📚 In Progress',
        desc: '',
        price: 'IDR 1.000.000',
        term: '10 Weeks',
        startDate: 'July 15, 2026',
        seats: '15 Seats',
        link: '/hsk',
        order: items.length + 1,
        isActive: true,
        image: { url: '' }
      };
    } else if (activeSection === 'studentStories') {
      emptyItem = {
        name: '',
        school: '',
        quote: '',
        order: items.length + 1,
        image: { url: '' }
      };
    } else if (activeSection === 'admissionsList') {
      emptyItem = {
        name: '',
        school: '',
        program: '',
        scholarship: 'Chinese Government Scholarship - Full Scholarship',
        admissionDate: 'September 2026 to July 2028',
        image: { url: '' },
        certificateImage: { url: '' }
      };
    } else if (activeSection === 'campaigns') {
      emptyItem = {
        title: '',
        subtitle: '',
        slug: { current: '' },
        countdownDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        isActive: true,
        image: { url: '' },
        content: [
          {
            _type: 'block',
            children: [{ _type: 'span', text: '', marks: [] }],
            markDefs: [],
            style: 'normal'
          }
        ]
      };
    } else if (activeSection === 'newsPage') {
      emptyItem = {
        title: '',
        subtitle: '',
        order: items.length + 1,
        coverImage: { url: '' }
      };
    }
    setEditingItem(emptyItem);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(JSON.parse(JSON.stringify(item)));
    setIsModalOpen(true);
  };

  const requestDelete = (item: any) => {
    const id = item._id || item.id;
    const name = item.name || item.title || t('Untitled Item', '无标题内容');
    const subtitle = item.category || item.university || item.school || item.subtitle || '';
    setDeleteConfirmTarget({
      id,
      name,
      section: activeSection,
      sectionTitleEn: currentActiveMeta.titleEn,
      sectionTitleZh: currentActiveMeta.titleZh,
      subtitle
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;

    setIsDeleting(true);
    const { id, section, name } = deleteConfirmTarget;

    try {
      const res = await fetch(`/api/cms/content/${section}/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', t(`"${name}" was deleted successfully`, `已成功删除 "${name}"`));
        setItems(prev => prev.filter(i => (i._id || i.id) !== id));
        setSectionCounts(prev => ({
          ...prev,
          [section]: Math.max(0, (prev[section] || 1) - 1)
        }));
        setDeleteConfirmTarget(null);
      } else {
        showNotification('error', data.error || t('Delete failed', '删除失败'));
      }
    } catch (err: any) {
      showNotification('error', err.message || t('Delete failed', '删除失败'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const res = await fetch(`/api/cms/content/${activeSection}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: editingItem })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', t('Saved successfully!', '内容保存成功！'));
        setIsModalOpen(false);
        setEditingItem(null);
        fetchItems(activeSection);
      } else {
        showNotification('error', data.error || t('Save failed', '保存失败'));
      }
    } catch (err: any) {
      showNotification('error', err.message || t('Save failed', '保存失败'));
    }
  };

  // Image Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const res = await fetch('/api/cms/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            data: base64Data
          })
        });
        const uploadResult = await res.json();
        if (uploadResult.success && uploadResult.url) {
          const uploadedUrl = uploadResult.url;
          setEditingItem((prev: any) => {
            const next = { ...prev };
            if (activeSection === 'partners') {
              next.logo = { ...(next.logo || {}), url: uploadedUrl };
            } else if (activeSection === 'news') {
              next.image = { ...(next.image || {}), url: uploadedUrl };
              next.images = [{ ...(next.images?.[0] || {}), url: uploadedUrl, asset: { url: uploadedUrl } }];
            } else if (activeSection === 'trendingPrograms') {
              next.image = { ...(next.image || {}), url: uploadedUrl };
            } else if (activeSection === 'studentStories') {
              next.image = { ...(next.image || {}), url: uploadedUrl };
              next.avatar = { ...(next.avatar || {}), url: uploadedUrl };
            } else if (activeSection === 'admissionsList') {
              if (uploadTargetField === 'certificateImage') {
                next.certificateImage = { ...(next.certificateImage || {}), url: uploadedUrl };
              } else {
                next.image = { ...(next.image || {}), url: uploadedUrl };
              }
            } else if (activeSection === 'campaigns') {
              next.image = { ...(next.image || {}), url: uploadedUrl };
            } else if (activeSection === 'newsPage') {
              next.coverImage = { ...(next.coverImage || {}), url: uploadedUrl };
            }
            return next;
          });
          showNotification('success', t('Image uploaded successfully!', '图片上传成功！'));
        } else {
          showNotification('error', uploadResult.error || t('Upload failed', '上传失败'));
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Upload error:', err);
      showNotification('error', err.message || t('Upload failed', '上传失败'));
      setIsUploading(false);
    }
  };

  // Helper to extract image URL from any section item using urlFor
  const getItemImageUrl = (item: any) => {
    if (!item) return '';
    try {
      if (item.logo) return urlFor(item.logo)?.url() || '';
      if (item.coverImage) return urlFor(item.coverImage)?.url() || '';
      if (item.certificateImage) return urlFor(item.certificateImage)?.url() || '';
      if (item.avatar) return urlFor(item.avatar)?.url() || '';
      if (item.image) return urlFor(item.image)?.url() || '';
      if (Array.isArray(item.images) && item.images.length > 0) {
        return urlFor(item.images[0])?.url() || '';
      }
    } catch {
      // fallback
    }
    return '';
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    const title = (item.name || item.title || '').toLowerCase();
    const cat = (item.category || item.university || item.school || item.subtitle || '').toLowerCase();
    return title.includes(q) || cat.includes(q);
  });

  return (
    <div className={`rounded-2xl border transition-all ${
      isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900 border-slate-800'
    }`}>
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-200 ${
          notification.type === 'success' 
            ? 'bg-emerald-600 text-white shadow-emerald-600/20' 
            : 'bg-rose-600 text-white shadow-rose-600/20'
        }`}>
          {notification.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Panel Top Header Bar */}
      <div className={`p-4 sm:p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        isLight ? 'border-slate-100 bg-slate-50/50' : 'border-slate-800/80 bg-slate-950/40'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600/10 text-primary-600 flex items-center justify-center font-bold shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`font-bold text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {t('Website Content & Media Center', '官网全量内容与素材配置中心')}
              </h2>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-950/40 text-amber-300 border-amber-800'
              }`}>
                CMS Engine
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {t(
                'Professional Master-Detail CMS Workspace · 7 Core Collections · Direct Local JSON Persistence',
                '专业双栏 Master-Detail 内容工作台 · 完整管理 7 大核心业务数据表 · 实时本地双向持久化'
              )}
            </p>
          </div>
        </div>

        {/* Global Stats Summary */}
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 ${
            isLight ? 'bg-white border-slate-200 text-slate-700 shadow-2xs' : 'bg-slate-900 border-slate-700 text-slate-300'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">{t('Total Live Entities:', '全站在线素材与数据:')}</span>
            <span className="font-mono font-bold text-primary-600 dark:text-primary-400">
              {Object.values(sectionCounts).reduce((a, b) => a + b, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Master-Detail Body */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-start min-h-[660px] divide-y lg:divide-y-0 lg:divide-x border-slate-100 dark:border-slate-800 relative">
        
        {/* LEFT COLUMN: Master Resource & Model Navigation Sidebar (Sticky on desktop, independent scroll) */}
        <aside className={`w-full lg:w-72 xl:w-80 shrink-0 p-3.5 sm:p-4 flex flex-col justify-between lg:sticky lg:top-[74px] lg:self-start lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto ${
          isLight ? 'bg-slate-50/70' : 'bg-slate-950/40'
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {t('Content Collections', '内容数据模型与素材表')}
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                isLight ? 'bg-white text-slate-600 border-slate-200' : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}>
                7 {t('Models', '个模块')}
              </span>
            </div>

            {/* Navigation Groups */}
            <div className="space-y-4">
              {CMS_SECTION_GROUPS.map((group) => (
                <div key={group.groupEn} className="space-y-1">
                  <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                    isLight ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {t(group.groupEn, group.groupZh)}
                  </div>

                  <div className="space-y-1">
                    {group.items.map((sec) => {
                      const Icon = sec.icon;
                      const isActive = activeSection === sec.id;
                      const count = sectionCounts[sec.id] ?? sec.defaultCount;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            setActiveSection(sec.id);
                            setSearchQuery('');
                          }}
                          className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer border ${
                            isActive
                              ? isLight 
                                ? 'bg-white text-primary-700 border-slate-200 shadow-2xs font-bold' 
                                : 'bg-slate-900 text-primary-400 border-slate-700 shadow-sm font-bold'
                              : isLight 
                                ? 'text-slate-600 hover:bg-white/80 hover:text-slate-900 border-transparent' 
                                : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`p-1.5 rounded-lg shrink-0 ${
                              isActive 
                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-400' 
                                : isLight ? 'bg-slate-200/60 text-slate-500' : 'bg-slate-800 text-slate-400'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs truncate">{t(sec.titleEn, sec.titleZh)}</div>
                              <div className={`text-[10px] truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                {t(sec.descEn, sec.descZh)}
                              </div>
                            </div>
                          </div>

                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 font-semibold ${
                            isActive
                              ? 'bg-primary-600 text-white'
                              : isLight ? 'bg-slate-200/70 text-slate-600' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Live System Tip */}
          <div className={`mt-6 p-3 rounded-xl border text-[11px] leading-relaxed ${
            isLight ? 'bg-white/80 border-slate-200/70 text-slate-600' : 'bg-slate-900/80 border-slate-800 text-slate-400'
          }`}>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{t('Instant Site Sync', '即时热更新机制')}</span>
            </span>
            <span>
              {t(
                'Data mutations are saved directly to local JSON models and instantly reflected across all website pages.',
                '此处修改或新增的图文数据，直接持久化写入本地 JSON 实体，官网前台即时同步热重载。'
              )}
            </span>
          </div>
        </aside>

        {/* RIGHT COLUMN: Detail Workspace Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 flex flex-col">
          {/* Active Category Header & Workspace Action Bar */}
          {(() => {
            const allItems = CMS_SECTION_GROUPS.flatMap(g => g.items);
            const activeMeta = allItems.find(s => s.id === activeSection) || allItems[0];
            const ActiveSectionIcon = activeMeta.icon;

            return (
              <div className={`p-4 rounded-xl border mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isLight ? 'bg-slate-50/70 border-slate-200/80' : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary-600 text-white shadow-xs">
                    <ActiveSectionIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {t(activeMeta.titleEn, activeMeta.titleZh)}
                      </h3>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}>
                        {items.length} {t('records', '条数据')}
                      </span>
                    </div>
                    <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {t(activeMeta.descEn, activeMeta.descZh)}
                    </p>
                  </div>
                </div>

                {/* Action Bar (Search & Add New) */}
                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  <div className="relative flex-1 sm:w-60">
                    <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t(`Search in this table...`, `搜索当前分类内容...`)}
                      className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border transition-colors outline-none ${
                        isLight 
                          ? 'bg-white border-slate-200 text-slate-900 focus:border-primary-500' 
                          : 'bg-slate-900 border-slate-700 text-slate-100 focus:border-primary-500'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchItems(activeSection)}
                    className={`p-1.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                      isLight ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                    title={t('Refresh data', '刷新数据')}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary-500' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('Add New Item', '新增内容')}</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Content Grid / List */}
          <div className="flex-1">
            {isLoading ? (
              <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
                <span>{t('Loading local content...', '正在加载本地数据...')}</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className={`py-16 text-center text-xs rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 ${
                isLight ? 'border-slate-200 text-slate-400 bg-slate-50/50' : 'border-slate-800 text-slate-500 bg-slate-950/20'
              }`}>
                <ImageIcon className="w-8 h-8 opacity-40" />
                <span>{t('No matching items found in this section.', '未找到符合条件的内容条目。')}</span>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="mt-1 text-xs text-primary-600 hover:underline font-semibold cursor-pointer"
                >
                  + {t('Create first record', '创建第一条数据')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredItems.map((item, idx) => {
                  const itemId = item._id || item.id || `idx-${idx}`;
                  const imgUrl = getItemImageUrl(item);
                  const title = item.name || item.title || t('Untitled', '无标题');
                  const subtitle = item.category || item.university || item.school || item.degree || item.subtitle || '';

                  return (
                    <div
                      key={itemId}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                        isLight 
                          ? 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:shadow-md' 
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Thumbnail Image with fallback */}
                        <div className={`w-14 h-14 rounded-lg shrink-0 border overflow-hidden flex items-center justify-center ${
                          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
                        }`}>
                          {imgUrl ? (
                            <img 
                              src={imgUrl} 
                              alt={title} 
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <ImageIcon className={`w-5 h-5 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full truncate max-w-[150px] ${
                              isLight ? 'bg-slate-200/60 text-slate-600' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {subtitle || activeSection}
                            </span>
                            {item.isActive !== false ? (
                              <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                {t('Active', '在线')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 shrink-0">{t('Hidden', '隐藏')}</span>
                            )}
                          </div>

                          <h4 className={`text-xs font-bold mt-1.5 line-clamp-1 ${
                            isLight ? 'text-slate-900' : 'text-slate-100'
                          }`}>
                            {title}
                          </h4>

                          <p className={`text-[11px] mt-0.5 line-clamp-2 leading-relaxed ${
                            isLight ? 'text-slate-500' : 'text-slate-400'
                          }`}>
                            {item.excerpt || item.subcategory || item.quote || item.desc || item.program || item.scholarship || item.subtitle || item.link || t('No description', '无附加描述')}
                          </p>
                        </div>
                      </div>

                      {/* Card Bottom Actions */}
                      <div className={`mt-3 pt-2.5 border-t flex items-center justify-between text-xs ${
                        isLight ? 'border-slate-200/60' : 'border-slate-800/80'
                      }`}>
                        <span className="text-[10px] text-slate-400 font-mono">
                          #{idx + 1}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium cursor-pointer ${
                              isLight ? 'text-slate-600 hover:bg-slate-200/60' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5 text-primary-500" />
                            <span>{t('Edit', '编辑')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => requestDelete(item)}
                            className="p-1.5 rounded-lg transition-colors text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            title={t('Delete item (double confirmation required)', '删除此项（需二次确认）')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className={`w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
          }`}>
            <form onSubmit={handleSave}>
              <div className={`p-4 border-b flex items-center justify-between sticky top-0 z-10 ${
                isLight ? 'bg-white/95 border-slate-100' : 'bg-slate-900/95 border-slate-800'
              }`}>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-primary-600" />
                  <span>
                    {editingItem._id ? t('Edit Item', '编辑内容与图片') : t('Create New Item', '新建内容')}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-slate-800 text-slate-500'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* Primary Image Upload & Preview Box */}
                <div className={`p-4 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                }`}>
                  <label className="block font-semibold mb-2 flex items-center justify-between">
                    <span>{t('Primary Image / Logo', '主图片 / Logo 封面')}</span>
                    <span className="text-[10px] text-primary-600 font-normal">
                      {t('Local storage in public/images/uploads/', '直接保存至工程本地目录')}
                    </span>
                  </label>

                  <div className="flex items-center gap-4">
                    {/* Live Preview */}
                    <div className={`w-20 h-20 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
                    }`}>
                      {getItemImageUrl(editingItem) ? (
                        <img 
                          src={getItemImageUrl(editingItem)} 
                          alt="preview" 
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => {
                            setUploadTargetField('image');
                            fileInputRef.current?.click();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploading && uploadTargetField === 'image' ? t('Uploading...', '正在上传...') : t('Upload New Image', '上传本地图片')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (activeSection === 'partners') setEditingItem({ ...editingItem, logo: { url: '' } });
                            else if (activeSection === 'news') setEditingItem({ ...editingItem, image: { url: '' }, images: [] });
                            else if (activeSection === 'trendingPrograms') setEditingItem({ ...editingItem, image: { url: '' } });
                            else if (activeSection === 'studentStories') setEditingItem({ ...editingItem, image: { url: '' }, avatar: { url: '' } });
                            else if (activeSection === 'campaigns') setEditingItem({ ...editingItem, image: { url: '' } });
                            else if (activeSection === 'admissionsList') setEditingItem({ ...editingItem, image: { url: '' } });
                            else if (activeSection === 'newsPage') setEditingItem({ ...editingItem, coverImage: { url: '' } });
                          }}
                          className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-100' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {t('Clear', '清空')}
                        </button>
                      </div>

                      {/* Manual URL input fallback */}
                      <input
                        type="text"
                        placeholder="https://... 或 /images/uploads/..."
                        value={getItemImageUrl(editingItem)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingItem((prev: any) => {
                            const next = { ...prev };
                            if (activeSection === 'partners') next.logo = { ...(next.logo || {}), url: val };
                            else if (activeSection === 'news') {
                              next.image = { ...(next.image || {}), url: val };
                              next.images = [{ ...(next.images?.[0] || {}), url: val }];
                            }
                            else if (activeSection === 'trendingPrograms') next.image = { ...(next.image || {}), url: val };
                            else if (activeSection === 'studentStories') {
                              next.image = { ...(next.image || {}), url: val };
                              next.avatar = { ...(next.avatar || {}), url: val };
                            }
                            else if (activeSection === 'campaigns') next.image = { ...(next.image || {}), url: val };
                            else if (activeSection === 'admissionsList') next.image = { ...(next.image || {}), url: val };
                            else if (activeSection === 'newsPage') next.coverImage = { ...(next.coverImage || {}), url: val };
                            return next;
                          });
                        }}
                        className={`w-full px-2.5 py-1 rounded-lg border font-mono text-[11px] ${
                          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Secondary Certificate Upload Box for admissionsList */}
                {activeSection === 'admissionsList' && (
                  <div className={`p-4 rounded-xl border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <label className="block font-semibold mb-2">
                      {t('Admission Certificate / Letter Image', '录取通知书 / 奖学金证书图片')}
                    </label>
                    <div className="flex items-center gap-3">
                      <div className={`w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 ${
                        isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
                      }`}>
                        {editingItem.certificateImage ? (
                          <img 
                            src={urlFor(editingItem.certificateImage)?.url() || ''} 
                            alt="certificate" 
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <Award className="w-6 h-6 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => {
                            setUploadTargetField('certificateImage');
                            fileInputRef.current?.click();
                          }}
                          className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{t('Upload Certificate Image', '上传证书图片')}</span>
                        </button>
                        <input
                          type="text"
                          placeholder="https://... 或 /images/uploads/..."
                          value={urlFor(editingItem.certificateImage)?.url() || ''}
                          onChange={(e) => setEditingItem({
                            ...editingItem,
                            certificateImage: { ...(editingItem.certificateImage || {}), url: e.target.value }
                          })}
                          className={`w-full px-2.5 py-1 rounded-lg border font-mono text-[11px] ${
                            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Name / Title */}
                <div>
                  <label className="block font-semibold mb-1">
                    {activeSection === 'partners' 
                      ? t('Institution Name', '院校或机构名称')
                      : activeSection === 'studentStories' || activeSection === 'admissionsList'
                      ? t('Student Full Name', '学员姓名')
                      : t('Title', '标题')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editingItem.name || editingItem.title || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (editingItem.name !== undefined) setEditingItem({ ...editingItem, name: val });
                      else setEditingItem({ ...editingItem, title: val });
                    }}
                    className={`w-full px-3 py-1.5 rounded-lg border ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                    }`}
                  />
                </div>

                {/* Conditional Fields: Partners */}
                {activeSection === 'partners' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">{t('Category', '所属类别')}</label>
                      <select
                        value={editingItem.category || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      >
                        <option value="Chinese Universities">Chinese Universities (中国高校)</option>
                        <option value="Indonesian Universities & Schools">Indonesian Universities & Schools (印尼院校/中学)</option>
                        <option value="Educational Institutions">Educational Institutions (教育机构)</option>
                        <option value="Corporate Partners">Corporate Partners (企业伙伴)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">{t('Subcategory', '细分子类/备注')}</label>
                      <input
                        type="text"
                        placeholder="e.g. 985/211 / High School"
                        value={editingItem.subcategory || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, subcategory: e.target.value })}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block font-semibold mb-1">{t('Official Website Link', '官方网址')}</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={editingItem.link || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Conditional Fields: News */}
                {activeSection === 'news' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">{t('Article Slug (URL path)', '文章别名 (URL路径)')}</label>
                        <input
                          type="text"
                          required
                          value={editingItem.slug?.current || ''}
                          onChange={(e) => setEditingItem({
                            ...editingItem,
                            slug: { ...(editingItem.slug || {}), current: e.target.value }
                          })}
                          placeholder="e.g. beasiswa-kuliah-di-china-2026"
                          className={`w-full px-3 py-1.5 rounded-lg border font-mono ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">{t('Original News Source Link', '原始新闻来源链接')}</label>
                        <input
                          type="url"
                          value={editingItem.source || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, source: e.target.value })}
                          placeholder="https://..."
                          className={`w-full px-3 py-1.5 rounded-lg border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">{t('Summary / Excerpt', '文章摘要')}</label>
                      <textarea
                        rows={2}
                        value={editingItem.excerpt || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, excerpt: e.target.value })}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">{t('Full Text Content (Paragraphs)', '正文段落内容')}</label>
                      <textarea
                        rows={5}
                        placeholder={t('Enter news content paragraphs here...', '在此输入新闻正文段落...')}
                        value={
                          Array.isArray(editingItem.body) 
                            ? editingItem.body.map((b: any) => b.children?.map((c: any) => c.text).join('')).join('\n\n')
                            : ''
                        }
                        onChange={(e) => {
                          const text = e.target.value;
                          const paragraphs = text.split('\n\n').filter(p => p.trim());
                          const newBody = paragraphs.map((p, pIdx) => ({
                            _key: `p-${pIdx}-${Date.now()}`,
                            _type: 'block',
                            children: [{ _key: `c-${pIdx}`, _type: 'span', marks: [], text: p }],
                            markDefs: [],
                            style: 'normal'
                          }));
                          setEditingItem({ ...editingItem, body: newBody });
                        }}
                        className={`w-full px-3 py-2 rounded-lg border leading-relaxed font-sans ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Conditional Fields: Trending Programs */}
                {activeSection === 'trendingPrograms' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">{t('Category', '所属类别')}</label>
                        <input
                          type="text"
                          value={editingItem.category || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                          placeholder="e.g. 📚 HSK / 🎓 Dual Degree"
                          className={`w-full px-3 py-1.5 rounded-lg border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">{t('Badge / Status Tag', '角标标签')}</label>
                        <input
                          type="text"
                          value={editingItem.badge || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, badge: e.target.value })}
                          placeholder="e.g. 📚 In Progress / 🔥 Hot"
                          className={`w-full px-3 py-1.5 rounded-lg border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">{t('Tuition / Price', '学费 / 价格')}</label>
                        <input
                          type="text"
                          value={editingItem.price || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                          placeholder="e.g. IDR 1.000.000"
                          className={`w-full px-3 py-1.5 rounded-lg border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">{t('Term Duration', '课时周期')}</label>
                        <input
                          type="text"
                          value={editingItem.term || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, term: e.target.value })}
                          placeholder="e.g. 10 Weeks / 4 Years"
                          className={`w-full px-3 py-1.5 rounded-lg border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">{t('Start Date', '开班 / 开学时间')}</label>
                        <input
                          type="text"
                          value={editingItem.startDate || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, startDate: e.target.value })}
                          placeholder="e.g. July 15, 2026"
                          className={`w-full px-3 py-1.5 rounded-lg border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">{t('Seats / Capacity', '名额限制')}</label>
                        <input
                          type="text"
                          value={editingItem.seats || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, seats: e.target.value })}
                          placeholder="e.g. 15 Seats"
                          className={`w-full px-3 py-1.5 rounded-lg border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                          }`}
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block font-semibold mb-1">{t('Target Page Link', '跳转链接')}</label>
                        <input
                          type="text"
                          value={editingItem.link || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                          placeholder="e.g. /hsk or /study-abroad"
                          className={`w-full px-3 py-1.5 rounded-lg border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">{t('Course Description & Highlights', '课程亮点与介绍')}</label>
                      <textarea
                        rows={4}
                        value={editingItem.desc || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, desc: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg border leading-relaxed font-sans ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Conditional Fields: Student Stories */}
                {activeSection === 'studentStories' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-semibold mb-1">{t('School / Company / Background', '就读院校 / 企业背景')}</label>
                      <input
                        type="text"
                        required
                        value={editingItem.school || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, school: e.target.value })}
                        placeholder="e.g. Marketing Manager, PT AVO Innovation"
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">{t('Story / Testimonial Quote', '学员真实心得感言')}</label>
                      <textarea
                        rows={4}
                        required
                        value={editingItem.quote || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, quote: e.target.value })}
                        placeholder={t('Enter student testimonial quote...', '在此输入学员感言...')}
                        className={`w-full px-3 py-2 rounded-lg border leading-relaxed font-sans ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Conditional Fields: Admissions List */}
                {activeSection === 'admissionsList' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">{t('Admitted University / School', '录取院校')}</label>
                      <input
                        type="text"
                        required
                        value={editingItem.school || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, school: e.target.value })}
                        placeholder="e.g. Huazhong University of Science and Technology"
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">{t('Program / Major', '录取专业')}</label>
                      <input
                        type="text"
                        required
                        value={editingItem.program || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, program: e.target.value })}
                        placeholder="e.g. Computer Science and Technology"
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block font-semibold mb-1">{t('Scholarship Awarded', '获得奖学金类别')}</label>
                      <input
                        type="text"
                        value={editingItem.scholarship || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, scholarship: e.target.value })}
                        placeholder="e.g. Chinese Government Scholarship - Full Scholarship"
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block font-semibold mb-1">{t('Admission Date Range', '录取学年范围')}</label>
                      <input
                        type="text"
                        value={editingItem.admissionDate || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, admissionDate: e.target.value })}
                        placeholder="e.g. September 2026 to July 2028"
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Conditional Fields: Campaigns */}
                {activeSection === 'campaigns' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">{t('Subtitle / Topic', '副标题 / 活动主题')}</label>
                        <input
                          type="text"
                          value={editingItem.subtitle || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, subtitle: e.target.value })}
                          className={`w-full px-3 py-1.5 rounded-lg border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">{t('Countdown Date / Event Date', '倒计时 / 举办日期')}</label>
                        <input
                          type="date"
                          value={editingItem.countdownDate ? new Date(editingItem.countdownDate).toISOString().slice(0, 10) : ''}
                          onChange={(e) => setEditingItem({ ...editingItem, countdownDate: new Date(e.target.value).toISOString() })}
                          className={`w-full px-3 py-1.5 rounded-lg border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">{t('Campaign Details / Agenda', '活动详情安排')}</label>
                      <textarea
                        rows={4}
                        placeholder={t('Enter campaign description...', '输入活动描述与安排...')}
                        value={
                          Array.isArray(editingItem.content)
                            ? editingItem.content.map((b: any) => b.children?.map((c: any) => c.text).join('')).join('\n\n')
                            : typeof editingItem.content === 'string' ? editingItem.content : ''
                        }
                        onChange={(e) => {
                          const text = e.target.value;
                          const paragraphs = text.split('\n\n').filter(p => p.trim());
                          const newContent = paragraphs.map((p, pIdx) => ({
                            _key: `cp-${pIdx}-${Date.now()}`,
                            _type: 'block',
                            children: [{ _key: `cc-${pIdx}`, _type: 'span', marks: [], text: p }],
                            markDefs: [],
                            style: 'normal'
                          }));
                          setEditingItem({ ...editingItem, content: newContent });
                        }}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Conditional Fields: News Page Channels */}
                {activeSection === 'newsPage' && (
                  <div>
                    <label className="block font-semibold mb-1">{t('Channel Subtitle / Tagline', '频道副标题 / 导语')}</label>
                    <input
                      type="text"
                      value={editingItem.subtitle || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, subtitle: e.target.value })}
                      className={`w-full px-3 py-1.5 rounded-lg border ${
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                      }`}
                    />
                  </div>
                )}

                {/* Common Settings: Active Toggle & Display Order */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingItem.isActive !== false}
                      onChange={(e) => setEditingItem({ ...editingItem, isActive: e.target.checked })}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-semibold">{t('Active / Display on website', '在前台页面正常展示')}</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">{t('Display Order:', '排序权重:')}</span>
                    <input
                      type="number"
                      value={editingItem.order || 1}
                      onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value, 10) || 1 })}
                      className={`w-16 px-2 py-1 rounded border text-center font-mono ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-700'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={`p-4 border-t flex items-center justify-end gap-2 sticky bottom-0 ${
                isLight ? 'bg-white/95 border-slate-100' : 'bg-slate-900/95 border-slate-800'
              }`}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  {t('Cancel', '取消')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-primary-600 hover:bg-primary-500 text-white flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('Save Changes', '保存生效')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Secondary Deletion Confirmation Modal (二次确认弹窗 - 严格对齐系统整体设计规范) */}
      {deleteConfirmTarget && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity ${
            isLight ? 'bg-slate-900/40 backdrop-blur-2xs' : 'bg-black/60 backdrop-blur-xs'
          } animate-in fade-in duration-150`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setDeleteConfirmTarget(null);
            }
          }}
        >
          <div 
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            {/* Modal Header */}
            <div className={`px-5 py-3.5 border-b flex items-center justify-between ${
              isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-950/50 border-slate-800/80'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className={`p-1.5 rounded-lg shrink-0 ${
                  isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-950/60 text-rose-400'
                }`}>
                  <Trash2 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className={`font-bold text-sm leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {t('Confirm Item Deletion', '确认删除内容条目')}
                  </h3>
                  <p className={`text-[10px] text-slate-400 dark:text-slate-500`}>
                    {t('Action requires secondary confirmation', '此操作需要二次确认')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmTarget(null)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-200/60 text-slate-400' : 'hover:bg-slate-800 text-slate-500'
                }`}
                title={t('Cancel & Close', '取消并关闭')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3.5 text-xs">
              <p className={`leading-relaxed text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                {t(
                  'Are you sure you want to permanently delete this content item? Once confirmed, the data will be immediately removed from local persistence and synchronised to the official portal.',
                  '您确定要从系统数据模型中永久删除此项内容吗？确认后将直接从本地存储移除，并即时同步下架官方网站对应前台展示。'
                )}
              </p>

              {/* Target Item Details Card */}
              <div className={`p-3 rounded-xl border space-y-2 ${
                isLight ? 'bg-slate-50/70 border-slate-200/80' : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                    {t('Content Collection:', '所属数据表:')}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] border ${
                    isLight ? 'bg-white border-slate-200 text-primary-700' : 'bg-slate-900 border-slate-700 text-primary-400'
                  }`}>
                    {t(deleteConfirmTarget.sectionTitleEn || '', deleteConfirmTarget.sectionTitleZh || '')}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <span className={`text-[11px] shrink-0 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('Item Title:', '条目标题:')}
                  </span>
                  <span className="font-bold text-right text-slate-900 dark:text-white line-clamp-2">
                    {deleteConfirmTarget.name}
                  </span>
                </div>

                {deleteConfirmTarget.subtitle && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>{t('Category / Tag:', '分类 / 标签:')}</span>
                    <span className="truncate max-w-[200px] text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                      {deleteConfirmTarget.subtitle}
                    </span>
                  </div>
                )}
              </div>

              {/* System Warning Banner */}
              <div className={`p-2.5 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
                isLight 
                  ? 'bg-rose-50/60 border-rose-200/70 text-rose-800' 
                  : 'bg-rose-950/30 border-rose-900/60 text-rose-300'
              }`}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <span>
                  {t(
                    'Irreversible: Deleted records cannot be undone. Please ensure you have backup copies if this media asset is still required.',
                    '不可逆操作提醒：此删除操作无法撤销。若后续仍需使用该素材或图文，请在删除前保留相关备份。'
                  )}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`px-5 py-3 border-t flex items-center justify-end gap-2 ${
              isLight ? 'bg-slate-50/60 border-slate-100' : 'bg-slate-950/40 border-slate-800/80'
            }`}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmTarget(null)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isLight 
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {t('Cancel', '取消')}
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('Deleting...', '正在删除...')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('Confirm Delete', '确认删除')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
