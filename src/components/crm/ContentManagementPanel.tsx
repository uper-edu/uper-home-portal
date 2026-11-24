import {AdminDateField} from '../admin/AdminDateField';
import {AdminDisclosure} from '../admin/AdminDisclosure';
import {AdminListState} from '../admin/AdminList';
import {AdminRowAction} from '../admin/AdminListControl';
import {formatCurrency} from '../../utils/currency';
import {AdminRefreshAction} from '../admin/AdminRefreshAction';
import {CrmPageAction} from './CrmPageAction';
import {AdminSearchField} from '../admin/AdminSearchField';
import {AdminSingleSelect} from '../admin/AdminSingleSelect';
import {CMS_REQUEST_TIMEOUT_MS,cmsImageFingerprint,cmsSaveRequest,canRetryCms} from '../../utils/cmsRecovery';
import {AdminFormGuide} from '../AdminFormGuide';
import {AdminEditor} from '../admin/AdminEditor';
import {AdminConfirmation} from '../admin/AdminConfirmation';
import {CrmDiscardDialog} from './CrmDetailWorkspace';
import {AdminFormGrid,AdminFormSection,AdminFormFeedback,AdminSavedReadError} from '../AdminFormLayout';
import {AdminStatus} from '../AdminStatus';
import {AdminField} from '../AdminForm';
import {AdminTopicFrame} from "../AdminTopicFrame";
import {BrowserMetadataGuide} from '../BrowserMetadataGuide';
import {PageMetadata} from '../PageMetadata';
import { cmsText } from '../../utils/cmsLanguage';
import type { CrmLanguage } from '../../utils/crmLanguage';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Newspaper, 
  GraduationCap, 
  Sparkles, 
  Plus, 
  Edit3, 
  Trash2, 
  Upload, 
  ExternalLink, 
  Image as ImageIcon, 
  Award,
  Calendar,
  LayoutList,
  ChevronRight,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { urlFor } from '../../cmsClient';

interface ContentManagementPanelProps {
  isLight: boolean;
  lang: CrmLanguage;
}

export type CmsSection = 
  | 'partners' 
  | 'news' 
  | 'trendingPrograms' 
  | 'studentStories' 
  | 'admissionsList' 
  | 'campaigns' 
  | 'newsPage'
  | 'programGallery';

export interface CmsSectionItem {
  id: CmsSection;
  titleEn: string;
  titleZh: string;
  icon: any;
  descEn: string;
  descZh: string;
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
        descZh: '中国及海外合作高校、国际教育伙伴与校区机构'
      },
      {
        id: 'trendingPrograms',
        titleEn: 'Trending Programs',
        titleZh: '精选热门项目',
        icon: GraduationCap,
        descEn: 'HSK courses, study tours & scholarship tracks',
        descZh: 'HSK考级班、名校游学营与奖学金直通班型'
      },
      {
        id: 'programGallery',
        titleEn: 'Home Program Galleries',
        titleZh: '首页项目图集',
        icon: LayoutList,
        descEn: 'Manage program images and display order',
        descZh: '管理项目图片与展示顺序'
      },
      {
        id: 'admissionsList',
        titleEn: 'Admissions Honors',
        titleZh: '录取捷报榜单',
        icon: Award,
        descEn: 'Offer notices, scholarship awards & certificates',
        descZh: '清北浙大等中国名校录取通知与奖学金捷报'
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
        descZh: '赴华留学政策、印尼华文教育前沿与官方公告'
      },
      {
        id: 'campaigns',
        titleEn: 'Special Campaigns',
        titleZh: '主题专案活动',
        icon: Calendar,
        descEn: 'Webinars, expos, admissions masterclasses',
        descZh: '名师公开课、教育展会巡展与留学讲座'
      },
      {
        id: 'newsPage',
        titleEn: 'News Channel Directory',
        titleZh: '资讯频道栏目',
        icon: LayoutList,
        descEn: 'Channel classification metadata & landing banners',
        descZh: '官网资讯中心栏目分类、封面图与频道元数据'
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
        descZh: '学员真实高分见证、就业转折与赴华学习感言'
      }
    ]
  }
];

export default function ContentManagementPanel({ isLight, lang }: ContentManagementPanelProps) {
  const cmsRequestId=useRef('');
  const [pendingCms,setPendingCms]=useState<any>(null),[cmsResult,setCmsResult]=useState(''),[cmsTone,setCmsTone]=useState<'saved'|'error'>('saved');
  const cmsActor=useRef('');
  const [cmsNotFound,setCmsNotFound]=useState(false);
  const cmsUploadBody=useRef<any>(null);
  const [retryImage,setRetryImage]=useState(false);
  const [storageWarning,setStorageWarning]=useState(false);
  const rememberCms=(value:any)=>{setPendingCms(value);setCmsNotFound(false);if(!value){cmsUploadBody.current=null;setRetryImage(false);}if(cmsActor.current){try{if(value)sessionStorage.setItem('cms-pending:'+cmsActor.current,JSON.stringify(value));else sessionStorage.removeItem('cms-pending:'+cmsActor.current);}catch{setStorageWarning(true);}}};
  useEffect(()=>{let live=true;fetch('/api/cms/identity').then(r=>r.ok?r.json():Promise.reject()).then(d=>{if(!live)return;cmsActor.current=d.id;try{const saved=JSON.parse(sessionStorage.getItem('cms-pending:'+d.id)||'null');if(saved&&(!saved.actor||saved.actor===d.id)){setPendingCms({...saved,actor:d.id});setEditingItem(saved.draft);setActiveSection(saved.collection);setIsModalOpen(true);}}catch{}}).catch(()=>{});return()=>{live=false;};},[]);

  const [activeSection, setActiveSection] = useState<CmsSection>('partners');
  const responsiveEditor = ['trendingPrograms', 'partners', 'news', 'admissionsList', 'campaigns', 'studentStories'].includes(activeSection);
  const DisplaySettingsLayout = responsiveEditor ? AdminFormGrid : 'div';
  const [items, setItems] = useState<any[]>([]);
  const [sectionCounts, setSectionCounts] = useState<Partial<Record<CmsSection, number>>>({});
  const [contentRead,setContentRead] = useState<{
    section:CmsSection;state:'loading'|'refreshing'|'ready'|'error'|'denied';hasSnapshot?:boolean;
  }>();
  const [awaitingSavedRead,setAwaitingSavedRead]=useState<CmsSection>();
  const activeSectionRef=useRef(activeSection);
  activeSectionRef.current=activeSection;
  const contentRequests=useRef<Partial<Record<CmsSection,number>>>({});
  const contentState=contentRead?.section===activeSection?contentRead.state:'loading';
  const isLoading=contentState==='loading';
  const hasSnapshot=contentRead?.section===activeSection&&!!contentRead.hasSnapshot;
  const canChangeContent=contentState==='ready'&&!pendingCms;
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const cmsDraftBase=useRef('');
  const [discardDraft,setDiscardDraft]=useState(false),[isSaving,setIsSaving]=useState(false);
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

  const partnerCategories = [
    ['Chinese Universities','中国高校'], ['Indonesian Universities & Schools','印尼院校及学校'],
    ['Educational Institutions','教育机构'], ['Corporate Partners','企业伙伴'],
  ] as const;
  const t = (en: string, zh: string) => cmsText(en, zh, lang);
  const closeEditor=()=>{if(isSaving||isUploading||pendingCms)return;if(JSON.stringify(editingItem)!==cmsDraftBase.current){setDiscardDraft(true);return;}setIsModalOpen(false);};

  useEffect(() => {
    if (!isModalOpen) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isModalOpen]);

  const allSectionItems = CMS_SECTION_GROUPS.flatMap(g => g.items);
  const currentActiveMeta = allSectionItems.find(s => s.id === activeSection) || allSectionItems[0];

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchItems = async (section: CmsSection, retainItems = false) => {
    const request=(contentRequests.current[section]??0)+1;
    contentRequests.current[section]=request;
    const current=()=>contentRequests.current[section]===request;
    if(activeSectionRef.current===section)setContentRead({section,state:retainItems?'refreshing':'loading',hasSnapshot:retainItems});
    try {
      const res = await fetch(`/api/cms/content/${section}`);
      if(res.status===401||res.status===403){
        if(current()&&activeSectionRef.current===section){
          setItems([]);
          setSectionCounts(prev=>({...prev,[section]:undefined}));
          setContentRead({section,state:'denied'});
        }
        return;
      }
      if(!res.ok)throw Error();
      const data = await res.json();
      if(!data.success||!Array.isArray(data.items))throw Error();
      if(!current())return;
      setSectionCounts(prev => ({...prev,[section]:data.items.length}));
      setAwaitingSavedRead(pending=>pending===section?undefined:pending);
      if(activeSectionRef.current===section){
        setItems(data.items);
        setContentRead({section,state:'ready',hasSnapshot:true});
      }
    } catch {
      if(current()&&activeSectionRef.current===section)setContentRead({section,state:'error',hasSnapshot:retainItems});
    }
  };

  // Sync all collection counts in background on mount
  useEffect(() => {
    const sections: CmsSection[] = ['partners', 'news', 'trendingPrograms', 'studentStories', 'admissionsList', 'campaigns', 'newsPage', 'programGallery'];
    sections.forEach(async (sec) => {
      try {
        const res = await fetch(`/api/cms/content/${sec}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setSectionCounts(prev => contentRequests.current[sec]?prev:{...prev,[sec]:data.items.length});
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    fetchItems(activeSection);
  }, [activeSection]);

  const handleOpenAdd = () => {
    if(!canChangeContent)return;setCmsResult('');
    setNotification(null);
    cmsRequestId.current=crypto.randomUUID();
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
        price: '',
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
    } else if (activeSection === 'programGallery') {
      emptyItem = { title: '', program: '', order: items.length + 1, image: { url: '' } };
    } else if (activeSection === 'newsPage') {
      emptyItem = {
        title: '',
        subtitle: '',
        order: items.length + 1,
        coverImage: { url: '' }
      };
    }
    cmsDraftBase.current=JSON.stringify(emptyItem);
    setEditingItem(emptyItem);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    if(!canChangeContent)return;setCmsResult('');
    setNotification(null);
    cmsRequestId.current=crypto.randomUUID();
    cmsDraftBase.current=JSON.stringify(item);
    setEditingItem(JSON.parse(JSON.stringify(item)));
    setIsModalOpen(true);
  };

  const requestDelete = (item: any) => {
    if(!canChangeContent)return;
    const id = item._id || item.id;
    const name = item.name || item.title || t('Untitled Item', '无标题内容');
    const subtitle = item.category || item.university || item.school || item.subtitle || '';
    setNotification(null);
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
        method: 'DELETE',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({requestId:'delete-'+id+'-'+(items.find(i=>(i._id||i.id)===id)?._cmsVersion||0),itemVersion:items.find(i=>(i._id||i.id)===id)?._cmsVersion})
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', t("Item deleted", "已删除内容") + ": " + name);
        setItems(prev => prev.filter(i => (i._id || i.id) !== id));
        setSectionCounts(prev => ({
          ...prev,
          [section]: Math.max(0, (prev[section] || 1) - 1)
        }));
        setDeleteConfirmTarget(null);
      } else {
        showNotification('error', t('Delete failed', '删除失败'));
      }
    } catch (err: any) {
      showNotification('error', t('Delete failed', '删除失败'));
    } finally {
      setIsDeleting(false);
    }
  };

  const finishCmsSave=async(section:CmsSection,result:{item?:any})=>{
    const savedItem=result?.item;
    const id=savedItem?._id||savedItem?.id;
    if(!id)throw Error('Missing saved CMS record');
    rememberCms(null);
    cmsRequestId.current='';
    cmsDraftBase.current='';
    setCmsResult('');
    setEditingItem(null);
    setIsModalOpen(false);
    setAwaitingSavedRead(section);
    setItems(previous=>previous.some(item=>(item._id||item.id)===id)
      ?previous.map(item=>(item._id||item.id)===id?savedItem:item)
      :[...previous,savedItem]);
    await fetchItems(section,true);
  };
  const checkCmsResult=async()=>{
    if(!pendingCms||isSaving||isUploading)return;
    setIsSaving(true);
    try{const r=await fetch(`/api/cms/operations/${encodeURIComponent(pendingCms.requestId)}?kind=${pendingCms.kind}&collection=${pendingCms.collection}`,{cache:'no-store',signal:AbortSignal.timeout(CMS_REQUEST_TIMEOUT_MS)});if(!r.ok)throw Error();const data=await r.json();
      if(data.state!=='committed'){setCmsNotFound(data.state==='not_found');setCmsResult(t('No committed result found yet. The original request may still be running. Check again.','暂未查到提交结果，原请求可能仍在处理，请再次查询。'));return;}
      if(pendingCms.kind==='upload'){applyUploadedImage(data.result.url,pendingCms.collection,pendingCms.target);rememberCms(null);setCmsTone('saved');setCmsResult(t('Image upload confirmed. Save content separately.','图片上传已确认，请另行保存内容。'));}
      else await finishCmsSave(pendingCms.collection,data.result);
    }catch{setCmsResult(t('Result unavailable. Your draft is retained.','暂时无法查询结果，草稿已保留。'));}finally{setIsSaving(false);}
  };
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();if(!editingItem||isSaving||isUploading||pendingCms||!cmsActor.current)return;
    if (activeSection === 'programGallery' && (!editingItem.program || !editingItem.image?.url)) {
      setCmsTone('error');
      setCmsResult(t('Choose a program and upload an image.', '请选择项目并上传图片。'));
      return;
    }
    const operation={kind:'save',actor:cmsActor.current,collection:activeSection,requestId:crypto.randomUUID(),draft:structuredClone(editingItem)};
    rememberCms(operation);setIsSaving(true);setCmsResult('');
    try{const res=await fetch(`/api/cms/content/${activeSection}`,{method:'POST',signal:AbortSignal.timeout(CMS_REQUEST_TIMEOUT_MS),headers:{'Content-Type':'application/json'},body:JSON.stringify(cmsSaveRequest(operation))});
      const data=await res.json();
      if(!res.ok||!data.success){if(res.status>=400&&res.status<500){rememberCms(null);setCmsTone('error');setCmsResult(res.status===409
        ?(lang==='zh'?'这条内容或保存请求与当前版本冲突。草稿已保留，请核对最新版本。':lang==='id'?'Konten atau permintaan simpan bertentangan dengan versi saat ini. Draf disimpan; periksa versi terbaru.':'This content or save request conflicts with the current version. The draft is retained. Review the latest version.')
        :t('Save rejected. Review permissions, fields or the latest version; draft retained.','保存被拒绝，请核对权限、字段或最新版本；草稿保留。'));return;}throw Error();}
      await finishCmsSave(operation.collection,data);
    }catch{setCmsResult(t('Save outcome unconfirmed. Query the result before continuing.','保存结果尚未确认，请先查询再继续。'));}finally{setIsSaving(false);}
  };
  const applyUploadedImage=(uploadedUrl:string,section:string,target:string)=>{
    setEditingItem((prev:any)=>{const next={...prev};
      if(section==='partners')next.logo={...(next.logo||{}),url:uploadedUrl};
      else if(section==='news'){next.image={...(next.image||{}),url:uploadedUrl};next.images=[{...(next.images?.[0]||{}),url:uploadedUrl,asset:{url:uploadedUrl}}];}
      else if(section==='studentStories'){next.image={...(next.image||{}),url:uploadedUrl};next.avatar={...(next.avatar||{}),url:uploadedUrl};}
      else if(section==='admissionsList'&&target==='certificateImage')next.certificateImage={...(next.certificateImage||{}),url:uploadedUrl};
      else if(section==='newsPage')next.coverImage={...(next.coverImage||{}),url:uploadedUrl};
      else next.image={...(next.image||{}),url:uploadedUrl};return next;});
  };
  const sendCmsUpload=async(operation:any,body:any)=>{
    setIsUploading(true);setCmsNotFound(false);
    try{const res=await fetch('/api/cms/upload',{method:'POST',signal:AbortSignal.timeout(CMS_REQUEST_TIMEOUT_MS),headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();
      if(!res.ok||!data.success){if(res.status>=400&&res.status<500){rememberCms(null);setCmsTone('error');setCmsResult(t('Image rejected. Draft retained.','图片被拒绝，草稿已保留。'));return;}throw Error();}
      applyUploadedImage(data.url,operation.collection,operation.target);rememberCms(null);setCmsTone('saved');setCmsResult(t('Image upload confirmed. Save content separately.','图片上传已确认，请另行保存内容。'));
    }catch{setCmsResult(t('Upload outcome unconfirmed. Query the result before continuing.','上传结果尚未确认，请先查询再继续。'));}finally{setIsUploading(false);if(fileInputRef.current)fileInputRef.current.value='';}
  };
  const retryCms=async()=>{
    if(isSaving||isUploading||!canRetryCms(pendingCms,cmsActor.current,cmsNotFound))return;
    if(pendingCms.kind==='upload'){
      if(!cmsUploadBody.current){setRetryImage(true);setCmsResult(t('Select the original image to retry the original request.','请重新选择原图片，以原请求重试。'));return;}
      await sendCmsUpload(pendingCms,cmsUploadBody.current);return;
    }
    const operation=pendingCms;setIsSaving(true);setCmsNotFound(false);
    try{const res=await fetch(`/api/cms/content/${operation.collection}`,{method:'POST',signal:AbortSignal.timeout(CMS_REQUEST_TIMEOUT_MS),headers:{'Content-Type':'application/json'},body:JSON.stringify(cmsSaveRequest(operation))});const data=await res.json();if(!res.ok||!data.success){if(res.status>=400&&res.status<500){rememberCms(null);setCmsTone('error');}setCmsResult(t('Original retry rejected. Draft retained; query before continuing.','原请求重试被拒绝，草稿保留，请查询结果后继续。'));return;}await finishCmsSave(operation.collection,data);}
    catch{setCmsResult(t('Save outcome unconfirmed. Query the result before continuing.','保存结果尚未确认，请先查询再继续。'));}finally{setIsSaving(false);}
  };
  const handleFileUpload=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file||!cmsActor.current||isSaving||isUploading||(pendingCms&&!retryImage))return;
    setIsUploading(true);
    try{const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});
      const fingerprint=await cmsImageFingerprint(data);
      if(pendingCms){
        if(!canRetryCms(pendingCms,cmsActor.current,cmsNotFound)||fingerprint!==pendingCms.imageFingerprint){setCmsResult(t('This is not the original image. The pending request is unchanged.','图片与原上传不一致，待确认请求保持不变。'));return;}
        const body={requestId:pendingCms.requestId,name:pendingCms.imageName,data};cmsUploadBody.current=body;await sendCmsUpload(pendingCms,body);
      }else{const operation={kind:'upload',actor:cmsActor.current,requestId:crypto.randomUUID(),collection:activeSection,target:uploadTargetField,draft:structuredClone(editingItem),imageFingerprint:fingerprint,imageName:file.name};const body={requestId:operation.requestId,name:file.name,data};cmsUploadBody.current=body;rememberCms(operation);setCmsResult('');await sendCmsUpload(operation,body);}
    }catch{showNotification('error',t('Unable to read image','无法读取图片'));}finally{setIsUploading(false);if(fileInputRef.current)fileInputRef.current.value='';}
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
    <div data-admin-form="" data-cms-theme={isLight ? "light" : "dark"} className={`rounded-2xl border transition-all ${
      isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900 border-slate-800'
    }`}>
      {notification&&!isModalOpen&&!deleteConfirmTarget&&<AdminFormFeedback
        state={notification.type==='success'?'saved':'error'} lang={lang} placement="floating">
        {notification.message}
      </AdminFormFeedback>}

      <PageMetadata lang={lang} options={{module:activeSection}}/>
      {pendingCms&&!isModalOpen&&<button type="button" onClick={()=>{setActiveSection(pendingCms.collection);setEditingItem(pendingCms.draft);setIsModalOpen(true);}}>{t('Review pending operation','查看待确认操作')}</button>}
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
              <h1 className={`font-bold text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {t('Website Content & Media Center', '官网全量内容与素材配置中心')}
              </h1>

            </div>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {lang==='zh'? `管理 ${allSectionItems.length} 类网站内容与图片。` :
                lang==='id'? `Kelola konten dan gambar situs dalam ${allSectionItems.length} koleksi.` :
                  `Manage website content and images in ${allSectionItems.length} collections.`}
            </p>
          </div>
        </div>

        {/* Global Stats Summary */}
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 ${
            isLight ? 'bg-white border-slate-200 text-slate-700 shadow-2xs' : 'bg-slate-900 border-slate-700 text-slate-300'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">{t('Total content:', '内容总数:')}</span>
            <span className="font-mono font-bold text-primary-600 dark:text-primary-400">
              {Object.values(sectionCounts).reduce((a, b) => a + b, 0)}
            </span>
          </div>
        </div>
      </div>

      <AdminDisclosure density="panel" heading={t('CMS operating guide','CMS 操作指南')}>
        <div className="space-y-3 max-w-3xl leading-relaxed">
          <BrowserMetadataGuide lang={lang}/><AdminFormGuide lang={lang}/>
          <section><h3 className="font-semibold">{t('Workspace and preferences', '工作区与偏好')}</h3><p>{t('Use the workspace menu to open the workspaces allowed by your staff permissions. Language and theme are shared with CRM. On narrow screens, open Language and appearance.', '从工作区菜单进入有权限的后台；语言与主题在 CMS 和 CRM 间沿用。窄屏中打开“语言与外观”调整偏好。')}</p></section>
          <section><h3 className="font-semibold">{t('Content editing', '内容编辑')}</h3><p>{t('Choose a collection, search or refresh its records, then add or edit content. Save changes in the editor. Opening the website previews saved content; it does not save an open draft.', '选择内容集合，搜索或刷新记录，再新增或编辑内容。在编辑器中保存；查看网站只预览已保存的内容，不会保存尚未提交的草稿。')}</p></section>
          <p>{t('Names and saved content remain in their original language. HSK questions and scoring are not changed by interface preferences.', '姓名及已保存内容保持原文；界面偏好不改变 HSK 题库和评分。')}</p>
        </div>
      </AdminDisclosure>
      {/* Main Master-Detail Body */}
      <AdminTopicFrame selection={activeSection} label={t("Content collections", "内容分类")} navigation={<>
        {/* LEFT COLUMN: Master Resource & Model Navigation Sidebar (Sticky on desktop, independent scroll) */}
        <aside className={`w-full lg:w-72 xl:w-80 shrink-0 p-3.5 sm:p-4 flex flex-col justify-between lg:sticky lg:top-[74px] lg:self-start lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto ${
          isLight ? 'bg-slate-50/70' : 'bg-slate-950/40'
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {t('Content Collections', '内容分类')}
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                isLight ? 'bg-white text-slate-600 border-slate-200' : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}>
                7 {t('collections', '类内容')}
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
                      const count = sectionCounts[sec.id];
                      return (
                        <button
                          key={sec.id}
                          aria-current={isActive ? "page" : undefined}
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
                              <div className={`cms-collection-description text-[10px] truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                {t(sec.descEn, sec.descZh)}
                              </div>
                            </div>
                          </div>

                          {count!==undefined&&<span className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 font-semibold ${
                            isActive
                              ? 'bg-primary-600 text-white'
                              : isLight ? 'bg-slate-200/70 text-slate-600' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {count}
                          </span>}
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
              <span>{t('Website content updates', '网站内容更新')}</span>
            </span>
            <span>
              {t(
                'Saved content is stored in MySQL. Reload the website to see updates. HSK questions and scoring are managed separately.',
                '内容保存到 MySQL，重新加载网站后可查看更新。HSK 题库和评分独立管理。'
              )}
            </span>
          </div>
        </aside></>}>

        {/* RIGHT COLUMN: Detail Workspace Main Content Area */}
        <section aria-label={t("Content editing", "内容编辑")} className="flex-1 min-w-0 p-4 sm:p-6 flex flex-col">
          <header className="admin-edit-header mb-3" data-theme={isLight?'light':'dark'}>
            <div className="admin-edit-title">
              <h2>{t(currentActiveMeta.titleEn,currentActiveMeta.titleZh)}</h2>
              <p className="crm-work-muted">{t(currentActiveMeta.descEn,currentActiveMeta.descZh)}</p>
            </div>
            <div className="admin-page-actions">
              {contentState!=='denied'&&<AdminRefreshAction label={t('Refresh data','刷新数据')}
                loading={isLoading||contentState==='refreshing'} onClick={()=>void fetchItems(activeSection,hasSnapshot)}/>}
              {hasSnapshot&&<CrmPageAction icon={Plus} variant="primary" disabled={!canChangeContent}
                label={t('Add New Item','新增内容')} onClick={handleOpenAdd}/>}
            </div>
          </header>

          {hasSnapshot&&<AdminSearchField className="mb-4 sm:w-60" label={t('Search in this table','搜索当前分类内容')}
            value={searchQuery} onChange={setSearchQuery}
            placeholder={t('Search in this table...', '搜索当前分类内容...')}/>}

          <div className="flex-1" aria-busy={isLoading||contentState==='refreshing'}>
            {isLoading&&<AdminListState lang={lang} state="loading"/>}
            {contentState==='error'&&awaitingSavedRead===activeSection&&<AdminSavedReadError lang={lang} onRetry={()=>void fetchItems(activeSection,true)}/>}
            {(contentState==='denied'||contentState==='error'&&awaitingSavedRead!==activeSection)&&<AdminListState lang={lang} state={contentState}
              message={contentState==='error'?t('Failed to load content','加载内容失败'):undefined}
              compact={hasSnapshot} onRetry={()=>void fetchItems(activeSection,hasSnapshot)}/>}
            {hasSnapshot&&(filteredItems.length===0
              ? <AdminListState lang={lang} state="empty"/>
              : (
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
                            <AdminStatus active={item.isActive !== false}>{item.isActive !== false ? t('Active', '在线') : t('Hidden', '隐藏')}</AdminStatus>
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
                          <AdminRowAction disabled={!canChangeContent} onClick={() => handleOpenEdit(item)} aria-label={t('Edit','编辑')+' · '+title}>
                            <Edit3 size={14} aria-hidden="true"/>
                            {t('Edit', '编辑')}
                          </AdminRowAction>

                          <button
                            type="button"
                            disabled={!canChangeContent}
                            onClick={() => requestDelete(item)}
                            className="p-1.5 rounded-lg transition-colors text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            title={t('Delete item (double confirmation required)', '删除此项（需二次确认）')}
                            aria-label={t('Delete','删除')+' · '+title}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </AdminTopicFrame>

      {/* Content editing */}
      {isModalOpen && editingItem && (
        <AdminEditor lang={lang} light={isLight} onClose={closeEditor} onSubmit={handleSave} required
          variant={activeSection==='trendingPrograms'?'drawer':'modal'} responsiveForm={responsiveEditor}
          title={editingItem._id?t('Edit Item','编辑内容与图片'):t('Create New Item','新建内容')}
          busy={isSaving||isUploading} closeDisabled={!!pendingCms}
          footer={<>
            <button type="button" onClick={closeEditor} disabled={isSaving||isUploading||!!pendingCms}>{t('Cancel','取消')}</button>
            <button type="submit" data-primary="" disabled={isSaving||isUploading||!!pendingCms}>{isSaving?t('Saving…','正在保存…'):t('Save Changes','保存生效')}</button>
          </>}
        >
              {(pendingCms||cmsResult)&&<AdminFormFeedback state={pendingCms?'unknown':cmsTone} lang={lang}>{cmsResult||t('Operation result unconfirmed. Query before continuing.','操作结果尚未确认，请先查询再继续。')}{pendingCms&&<button type="button" disabled={isSaving||isUploading} onClick={()=>void checkCmsResult()}>{t('Query operation result','查询操作结果')}</button>}</AdminFormFeedback>}
              {pendingCms&&cmsNotFound&&<button type="button" disabled={isSaving||isUploading} onClick={()=>void retryCms()}>{t('Retry original request','重试原请求')}</button>}
              {pendingCms&&retryImage&&<label>{t('Select original image','重新选择原图片')}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={isSaving||isUploading} onChange={handleFileUpload}/></label>}
              {storageWarning&&<AdminFormFeedback state="unknown" lang={lang}>{t('Draft remains on this page; refresh recovery is not guaranteed.','本页草稿仍保留；浏览器存储不可用，刷新恢复无法保证。')}</AdminFormFeedback>}
              {isSaving&&<AdminFormFeedback state="saving" lang={lang}/>}
              {notification&&<AdminFormFeedback state={notification.type==='error'?'error':'saved'} lang={lang}>{notification.message}</AdminFormFeedback>}
              <fieldset style={{border:0,padding:0,margin:0,minWidth:0}} data-admin-stack="" disabled={isSaving||isUploading||!!pendingCms} aria-label={t('Content fields','内容字段')}>
                {/* Primary Image Upload & Preview Box */}
                <div className={`p-4 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                }`}>
                  <AdminField className="block font-semibold mb-2 flex items-center justify-between">
                    <span>{t('Primary Image / Logo', '主图片 / Logo 封面')}</span>
                    <span className="text-[10px] text-primary-600 font-normal">
                      {t('PNG, JPEG or WebP up to 2 MB; uploaded to COS, only the URL is stored in the database', 'PNG、JPEG 或 WebP，最大 2 MB；上传到 COS，数据库仅保存资源地址')}
                    </span>
                  </AdminField>

                  <div className="flex items-center gap-4">
                    {/* Live Preview */}
                    <div className={`w-20 h-20 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
                    }`}>
                      {getItemImageUrl(editingItem) ? (
                        <img 
                          src={getItemImageUrl(editingItem)} 
                          alt={t('Image preview', '图片预览')}
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
                            else if (['trendingPrograms', 'programGallery'].includes(activeSection)) setEditingItem({ ...editingItem, image: { url: '' } });
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
                        aria-label={t('Image URL', '图片地址')}
                        placeholder={t('https://... or /images/uploads/...','https://... 或 /images/uploads/...')}
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
                            else if (['trendingPrograms', 'programGallery'].includes(activeSection)) next.image = { ...(next.image || {}), url: val };
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
                    <AdminField className="block font-semibold mb-2">
                      {t('Admission Certificate / Letter Image', '录取通知书 / 奖学金证书图片')}
                    </AdminField>
                    <div className="flex items-center gap-3">
                      <div className={`w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 ${
                        isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
                      }`}>
                        {editingItem.certificateImage ? (
                          <img 
                            src={urlFor(editingItem.certificateImage)?.url() || ''} 
                            alt={t('Certificate preview', '证书预览')}
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
                          aria-label={t('Certificate image URL', '证书图片地址')}
                          placeholder={t('https://... or /images/uploads/...', 'https://... 或 /images/uploads/...')}
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

                <AdminFormSection title={t('Content details', '内容信息')}>
                {/* Primary Name / Title */}
                <AdminField as="div">
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
                </AdminField>

                {activeSection === 'programGallery' && (
                  <AdminField as="div" required>
                    <AdminSingleSelect
                      label={t('Program', '所属项目')}
                      value={editingItem.program || ''}
                      options={[
                        { value: 'hsk', label: 'HSK' },
                        { value: 'csca', label: 'CSCA' },
                        { value: 'consultancy', label: t('Study Abroad', '赴华留学咨询') },
                        { value: 'tours', label: t('Study Tours', '中国研学') },
                      ]}
                      onChange={program => setEditingItem({ ...editingItem, program })}
                      lang={lang}
                      isLight={isLight}
                    />
                  </AdminField>
                )}

                {/* Conditional Fields: Partners */}
                {activeSection === 'partners' && (
                  <AdminFormGrid>
                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Category', '所属类别')}</label>
                      <AdminSingleSelect label={t('Category','所属类别')} lang={lang} isLight={isLight}
                        value={editingItem.category || ''}
                        onChange={category=>setEditingItem({...editingItem,category})}
                        options={partnerCategories.map(([value,zh])=>({value,label:t(value,zh)}))}/>
                    </AdminField>

                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Subcategory', '细分子类/备注')}</label>
                      <input
                        type="text"
                        placeholder={t('Example: High school', '例如：中学')}
                        value={editingItem.subcategory || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, subcategory: e.target.value })}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div" data-admin-full-width="">
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
                    </AdminField>
                  </AdminFormGrid>
                )}

                {/* Conditional Fields: News */}
                {activeSection === 'news' && (
                  <div data-admin-stack="">
                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Article Slug (URL path)', '文章别名 (URL路径)')}</label>
                      <input
                        type="text"
                        required
                        value={editingItem.slug?.current || ''}
                        onChange={(e) => setEditingItem({
                          ...editingItem,
                          slug: { ...(editingItem.slug || {}), current: e.target.value }
                        })}
                        placeholder={t('Example: study-in-china-2026', '例如：study-in-china-2026')}
                        className={`w-full px-3 py-1.5 rounded-lg border font-mono ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div">
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
                    </AdminField>

                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Summary / Excerpt', '文章摘要')}</label>
                      <textarea
                        rows={2}
                        value={editingItem.excerpt || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, excerpt: e.target.value })}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div">
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
                    </AdminField>
                  </div>
                )}

                {/* Conditional Fields: Trending Programs */}
                {activeSection === 'trendingPrograms' && (
                  <AdminFormGrid>
                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Category', '所属类别')}</label>
                      <input
                        type="text"
                        value={editingItem.category || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                        placeholder={t('Example: HSK course', '例如：HSK 课程')}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Badge / Status Tag', '角标标签')}</label>
                      <input
                        type="text"
                        value={editingItem.badge || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, badge: e.target.value })}
                        placeholder={t('Example: Open for registration', '例如：开放报名')}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Tuition / Price', '学费 / 价格')}</label>
                      <input
                        type="text"
                        value={editingItem.price || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                        placeholder={`${lang==='zh'?'例如：':lang==='id'?'Contoh: ':'Example: '}${formatCurrency(1000000,lang)}`}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Term Duration', '课时周期')}</label>
                      <input
                        type="text"
                        value={editingItem.term || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, term: e.target.value })}
                        placeholder={t('Example: 10 weeks', '例如：10 周')}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Start Date', '开班 / 开学时间')}</label>
                      <input
                        type="text"
                        value={editingItem.startDate || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, startDate: e.target.value })}
                        placeholder={t('Example: 15 July 2026', '例如：2026 年 7 月 15 日')}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Seats / Capacity', '名额限制')}</label>
                      <input
                        type="text"
                        value={editingItem.seats || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, seats: e.target.value })}
                        placeholder={t('Example: 15 places', '例如：15 个名额')}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div" data-admin-full-width="">
                      <label className="block font-semibold mb-1">{t('Target Page Link', '跳转链接')}</label>
                      <input
                        type="text"
                        value={editingItem.link || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                        placeholder={t('Example: /hsk', '例如：/hsk')}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div" data-admin-full-width="">
                      <label className="block font-semibold mb-1">{t('Course Description & Highlights', '课程亮点与介绍')}</label>
                      <textarea
                        rows={4}
                        value={editingItem.desc || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, desc: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg border leading-relaxed font-sans ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>
                  </AdminFormGrid>
                )}

                {/* Conditional Fields: Student Stories */}
                {activeSection === 'studentStories' && (
                  <div data-admin-stack="">
                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('School / Company / Background', '就读院校 / 企业背景')}</label>
                      <input
                        type="text"
                        required
                        value={editingItem.school || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, school: e.target.value })}
                        placeholder={t('Enter the institution name', '填写院校或企业名称')}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div">
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
                    </AdminField>
                  </div>
                )}

                {/* Conditional Fields: Admissions List */}
                {activeSection === 'admissionsList' && (
                  <div data-admin-stack="">
                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Admitted University / School', '录取院校')}</label>
                      <input
                        type="text"
                        required
                        value={editingItem.school || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, school: e.target.value })}
                        placeholder={t('Enter the institution name', '填写院校或企业名称')}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Program / Major', '录取专业')}</label>
                      <input
                        type="text"
                        required
                        value={editingItem.program || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, program: e.target.value })}
                        placeholder={t('Example: Computer science', '例如：计算机科学')}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Scholarship Awarded', '获得奖学金类别')}</label>
                      <input
                        type="text"
                        value={editingItem.scholarship || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, scholarship: e.target.value })}
                        placeholder={t('Example: Full scholarship', '例如：全额奖学金')}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Admission Date Range', '录取学年范围')}</label>
                      <input
                        type="text"
                        value={editingItem.admissionDate || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, admissionDate: e.target.value })}
                        placeholder={t('Example: September 2026 to July 2028', '例如：2026 年 9 月至 2028 年 7 月')}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>
                  </div>
                )}

                {/* Conditional Fields: Campaigns */}
                {activeSection === 'campaigns' && (
                  <div data-admin-stack="">
                    <AdminField as="div">
                      <label className="block font-semibold mb-1">{t('Subtitle / Topic', '副标题 / 活动主题')}</label>
                      <input
                        type="text"
                        value={editingItem.subtitle || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, subtitle: e.target.value })}
                        className={`w-full px-3 py-1.5 rounded-lg border ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </AdminField>

                    {(()=>{
                      const stored=editingItem.countdownDate;
                      const instant=stored?new Date(stored):null;
                      const invalid=!!instant&&!Number.isFinite(instant.getTime());
                      return <AdminDateField lang={lang} clearable
                        label={lang==='id'?'Tanggal hitung mundur / acara':t('Countdown Date / Event Date', '倒计时 / 举办日期')}
                        value={instant&&!invalid?instant.toISOString().slice(0,10):''}
                        error={invalid?t('Review the saved date.','原日期待核对。'):undefined}
                        onChange={date=>setEditingItem({...editingItem,countdownDate:date?new Date(date+'T00:00:00Z').toISOString():''})}/>;
                    })()}

                    <AdminField as="div">
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
                    </AdminField>
                  </div>
                )}

                {/* Conditional Fields: News Page Channels */}
                {activeSection === 'newsPage' && (
                  <AdminField as="div">
                    <label className="block font-semibold mb-1">{t('Channel Subtitle / Tagline', '频道副标题 / 导语')}</label>
                    <input
                      type="text"
                      value={editingItem.subtitle || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, subtitle: e.target.value })}
                      className={`w-full px-3 py-1.5 rounded-lg border ${
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                      }`}
                    />
                  </AdminField>
                )}

                </AdminFormSection>
                <AdminFormSection title={t('Display settings', '展示设置')}>
                {/* Common Settings: Active Toggle & Display Order */}
                <DisplaySettingsLayout className={responsiveEditor?undefined:"flex items-center justify-between gap-4"}>
                  <AdminField className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingItem.isActive !== false}
                      onChange={(e) => setEditingItem({ ...editingItem, isActive: e.target.checked })}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-semibold">{t('Active / Display on website', '在前台页面正常展示')}</span>
                  </AdminField>

                  <AdminField>
                    {t('Display Order:', '排序权重:')}
                    <input
                      type="number"
                      value={editingItem.order || 1}
                      onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value, 10) || 1 })}
                      className={`w-16 px-2 py-1 rounded border text-center font-mono ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-700'
                      }`}
                    />
                  </AdminField>
                </DisplaySettingsLayout>
                </AdminFormSection>
              </fieldset>
        </AdminEditor>
      )}
      {discardDraft&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscardDraft(false)} onDiscard={()=>{setDiscardDraft(false);setIsModalOpen(false);}}/>}
      {deleteConfirmTarget&&<AdminConfirmation light={isLight} busy={isDeleting} danger closeOnBackdrop
        title={t('Confirm Item Deletion','确认删除内容条目')}
        description={t('This permanently removes the item from the website.','删除后，这项内容将从官网下架，且无法撤销。')}
        cancelLabel={t('Cancel','取消')} confirmLabel={isDeleting?t('Deleting...','正在删除...'):t('Confirm Delete','确认删除')}
        onCancel={()=>setDeleteConfirmTarget(null)} onConfirm={()=>void handleConfirmDelete()}
      >
        <p className="cms-delete-target">
          <strong>{deleteConfirmTarget.name}</strong>
          <span>{t(deleteConfirmTarget.sectionTitleEn||'',deleteConfirmTarget.sectionTitleZh||'')}{deleteConfirmTarget.subtitle&&` · ${deleteConfirmTarget.subtitle}`}</span>
        </p>
        {notification?.type==='error'&&<AdminFormFeedback lang={lang} state="error">{notification.message}</AdminFormFeedback>}
      </AdminConfirmation>}
    </div>
  );
}
