import {EnrollmentClassName} from '../components/EnrollmentClassName';
import {enrollmentReadinessMessage} from '../utils/enrollmentReadinessCopy';
import { enrollmentCopy,enrollmentClassTitle,enrollmentFixedLessonDuration,enrollmentPrivateLessonTitle,enrollmentScheduleLabel } from '../utils/enrollmentCatalog';
import {EnrollmentCourseOverview} from '../components/EnrollmentCourseOverview';
import {EnrollmentClassPreview} from '../components/EnrollmentClassPreview';
import {EnrollmentTeacherLabel} from '../components/EnrollmentTeacherLabel';
import {EnrollmentPriceActions} from '../components/EnrollmentRecordLayout';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, ChevronRight, MessageCircle, Minus, Plus } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeSiteLanguage } from '../utils/siteMetadata';
import { watchPromotionLanguage } from '../utils/promotionLookup';
import { formatCurrency } from '../utils/currency';
import { type EnrollmentClassIdentity, type PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { PublicSingleSelect } from '../components/PublicSingleSelect';
import { enrollmentAppointmentUrl,enrollmentCatalogUrl,enrollmentLandingTimeoutMs,intakeReadinessUrl,servicingReadinessUrl,parseEnrollmentCatalog, parseEnrollmentReadiness,preloadEnrollmentNavigation,readEnrollmentLandingData,type PublicEnrollmentAppointment } from '../services/enrollmentClassDetails';
import { EnrollmentModuleBoundary, lazyEnrollmentModule } from '../components/EnrollmentModuleBoundary';
import {loadEnrollmentApplication, loadEnrollmentIntake} from '../services/enrollmentFormModule';
import {watchReadReconnect} from '../services/readReconnect';
import VisitorBoundary from '../components/VisitorBoundary';
import {readEnrollmentDraft} from '../services/visitorContact';
import {visitorScope} from '../services/visitorScope';

import {learnerPreviewToken} from '../utils/enrollmentLearnerPreview';
import {linkHubReturnUrl,promotionEntryUrl} from '../utils/promotionNavigation';
import {normalizeEnrollmentChatSelection} from '../utils/enrollmentChatJourney';
import {isPlainLinkClick,readChatRecommendation,readEnrollmentPosition,rememberEnrollment,rememberEnrollmentPosition,returnAlongJourney,type ChatJourneyState,type EnrollmentPosition} from '../utils/chatJourneyNavigation';
import {trackEvent} from '../utils/analytics';
import {enrollmentOrderReturnParam,EnrollmentJourneyLink,useEnrollmentJourneyState,useEnrollmentRecordReturn} from '../components/EnrollmentJourneyLink';
import './enrollment.css';

const EnrollmentForm = lazyEnrollmentModule(() => loadEnrollmentIntake().then(module => module.EnrollmentIntake));
const EnrollmentPaymentForm = lazyEnrollmentModule(() => loadEnrollmentApplication().then(module => module.EnrollmentForm));
const loadEnrollmentAssistance = () => import('../components/EnrollmentAssistance');
const EnrollmentAssistanceForm = lazyEnrollmentModule(() => loadEnrollmentAssistance().then(module => module.EnrollmentAssistanceForm));
const EnrollmentSupport = lazyEnrollmentModule(() => import('../components/EnrollmentSupport').then(module => module.EnrollmentSupport));

function EnrollmentApplication(props: ComponentProps<typeof EnrollmentForm>) {
  return <VisitorBoundary><EnrollmentForm {...props}/></VisitorBoundary>;
}

function ClassIntakeMode({classId,application,waitlist}:{classId:string;application:ReactNode;waitlist:ReactNode}) {
  // A committed application may have taken the last seat while its response was lost.
  // Check the original draft only after VisitorBoundary has confirmed ownership.
  const pending=readEnrollmentDraft<{applicationRequestId?:string}>(visitorScope(),'apply:'+classId);
  return pending?.applicationRequestId ? application : waitlist;
}

function EnrollmentAssistance({language,navigation}: Pick<ComponentProps<typeof EnrollmentAssistanceForm>, 'language'|'navigation'>) {
  const {hash}=useLocation();
  useEffect(()=>{void loadEnrollmentAssistance().catch(()=>{});},[]);
  return <VisitorBoundary><EnrollmentAssistanceForm key={hash} hash={hash} language={language} navigation={navigation}/></VisitorBoundary>;
}

const copy = {
  title: ['Course enrollment', 'Pendaftaran kelas', '课程报名'],
  online: ['Online classes · Find a class that fits', 'Kelas online · Pilih kelas yang sesuai', '在线学习 · 选择适合你的班次'],
  loading: ['Loading classes…', 'Memuat kelas…', '正在加载班次…'],
  loadingSection: ['Loading this section…', 'Memuat bagian ini…', '正在加载…'],
  sectionUnavailable: ['This section could not load. Refresh the page to try again.', 'Bagian ini belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.', '此区域暂时无法加载，请刷新页面重试。'],
  refreshPage: ['Refresh page', 'Muat ulang halaman', '刷新页面'],
  error: ['Classes could not be loaded.', 'Kelas belum dapat dimuat.', '班次暂时无法加载。'],
  offline: ['You’re offline. We’ll check again when you reconnect.', 'Anda sedang offline. Kami akan memeriksa lagi saat koneksi kembali.', '网络已断开，恢复连接后会自动重试。'],
  retry: ['Try again', 'Coba lagi', '重试'],
  empty: ['No classes match these filters.', 'Belum ada kelas yang cocok.', '暂无符合筛选条件的班次。'],
  reset: ['View all classes', 'Lihat semua kelas', '查看全部班次'],
  period: ['Time slot', 'Waktu', '时段'],
  format: ['Class type', 'Jenis kelas', '班型'],
  level: ['Level', 'Level', '级别'],
  allLevels: ['All', 'Semua', '全部'],
  allPeriods: ['All times', 'Semua waktu', '全部时段'],
  allFormats: ['All class types', 'Semua jenis kelas', '全部班型'],
  weekend: ['Weekend', 'Akhir pekan', '周末'],
  mixed: ['Weekdays & weekends', 'Hari kerja & akhir pekan', '工作日与周末'],
  'weekday-evening': ['Weekday evenings', 'Malam hari kerja', '工作日晚间'],
  standard: ['Standard class', 'Kelas standar', '标准班'],
  small: ['Small group', 'Kelas kecil', '小班'],
  'one-on-one': ['One-to-one', 'Kelas privat', '一对一'],
  appointment: ['Schedule with an advisor', 'Atur jadwal dengan konsultan', '时间与顾问确认'],
  appointmentAction: ['View course', 'Lihat kursus', '查看课程'],
  opened: ['Class confirmed', 'Kelas dikonfirmasi', '已成班'],
  recruiting: ['Enrollment open', 'Pendaftaran dibuka', '报名中'],
  apply: ['Apply for this class', 'Daftar kelas ini', '申请这个班'],
  join: ['Join waitlist', 'Masuk daftar tunggu', '加入候补'],
  standardPrice: ['Standard price', 'Harga standar', '标准价'],
  courseIntro: ['About this course', 'Tentang kursus ini', '课程介绍'],
  rules: ['Class opening and refund policy', 'Ketentuan pembukaan kelas dan pengembalian dana', '开班与退款规则'],
  rulesTitle: ['Class opening and refund policy', 'Ketentuan pembukaan kelas dan pengembalian dana', '开班与退款说明'],
  backDetail: ['Back to class details', 'Kembali ke detail kelas', '返回班次详情'],
  backWaitlist: ['Back to waitlist entry', 'Kembali ke detail daftar tunggu', '返回候补详情'],
  backMatch: ['Back to matching results', 'Kembali ke hasil pencocokan', '返回匹配结果'],
  noMatchBody: ['Try another level, time, or class type.', 'Coba level, waktu, atau jenis kelas lain.', '试试其他级别、时段或班型。'],
  payment: ['Transfer & proof', 'Transfer dan bukti', '转账与凭证'],
  backMine: ['Back to my enrollments', 'Kembali ke pendaftaran saya', '返回我的报名'],
  noMatch: ['Need a different class?', 'Butuh kelas lain?', '没找到合适的班？'],
  details: ['Class details', 'Detail kelas', '班次详情'],
  back: ['Back to classes', 'Kembali ke daftar kelas', '返回课程报名'],
  unavailable: ['This class is unavailable.', 'Kelas ini tidak tersedia.', '此班次暂不可查看。'],
  mine: ['My enrollments', 'Pendaftaran saya', '我的报名'],
  waitlistDetail: ['Waitlist details', 'Detail daftar tunggu', '候补详情'],
  demandDetail: ['Course preference details', 'Detail preferensi kursus', '选课需求详情'],
  recordUnavailable: ['This record is not available.', 'Catatan ini tidak tersedia.', '这条记录无法查看。'],
  interest: ['Tell us what you want to study', 'Sampaikan kursus yang Anda inginkan', '告诉我们你想上的课'],
  full: ['Full', 'Penuh', '满班'],
  limited: ['Few seats left', 'Kursi terbatas', '空位紧张'],
  available: ['Seats available', 'Kursi tersedia', '有空位'],
  outcomes: ['What you will learn', 'Yang akan Anda pelajari', '学完能做什么'],
  material: ['Course and materials', 'Kursus dan materi', '课程内容与教材'],
  resources: ['Practice and resources', 'Latihan dan sumber daya', '课后练习与资源'],
  consultCatalog: ['Help me choose', 'Tanya kelas', '咨询'],
  consultClass: ['Class advice in AI Chat', 'Tanya kelas ini lewat AI Chat', '咨询这个班'],
  consultClassAction: ['Class advice', 'Tanya kelas', '咨询'],
  backChat: ['Back to chat', 'Kembali ke chat', '返回咨询'],
  backLinkHub: ['All links', 'Semua tautan', '全部入口'],
} as const;

const catalogLevels = ['all', '1', '2', '3', '4'];
const catalogLevel = (label: string) => label === 'HSK 4A' || label === 'HSK 4B' ? '4' : label.slice(4);
type EnrollmentNavigationState = ChatJourneyState & {
  enrollmentClassPreview?: EnrollmentClassIdentity & {id:string};
};

export default function Enrollment() {
  const { i18n } = useTranslation();
  const language = normalizeSiteLanguage(i18n.resolvedLanguage || i18n.language);
  const t = (key: keyof typeof copy) => copy[key][language === 'zh' ? 2 : language === 'id' ? 1 : 0];
  const [params, setParams] = useSearchParams();
  const { classId:routeClassId, recordKind, recordId, topic } = useParams();
  const previewToken = learnerPreviewToken();
  const [previewRow,setPreviewRow]=useState<PublicEnrollmentClass>();
  const [previewView,setPreviewView]=useState<'detail'|'catalog'|'rules'|'apply'>('detail');
  const classId=previewToken?(previewView==='catalog'?undefined:previewRow?.id):routeClassId;
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = location.state as EnrollmentNavigationState | undefined;
  const fromChat = readChatRecommendation(navigation);
  const chatReturnState = fromChat ? {chatRecommendation:fromChat} : undefined;
  const pathname = location.pathname.replace(/\/$/, '');
  const record = recordId && (recordKind === 'waitlist' || recordKind === 'demands') ? { kind:recordKind, id:recordId } as const : undefined;
  const mine = pathname === '/enrollment/mine' || !!recordId;
  const interest = pathname === '/enrollment/interest';
  const paymentPage = pathname === '/enrollment/payment';
  const assisted = pathname === '/enrollment/assist';
  const orderId = params.get('order');
  const hasOrder = params.has('order');
  const orderView = hasOrder && !recordId ? params.get('view') : null;
  const journeyState = useEnrollmentJourneyState();
  const recordReturn = useEnrollmentRecordReturn();
  const application = previewToken?previewView==='apply':params.get('apply') === '1' || hasOrder;
  const classPreview = !application && navigation?.enrollmentClassPreview?.id===classId
    ? navigation?.enrollmentClassPreview : undefined;
  const rulesPage = !!classId && (previewToken?previewView==='rules':params.get('view')==='rules');
  const invalidClassId = !!routeClassId && !/^[a-zA-Z0-9-]{1,64}$/.test(routeClassId);
  // Older class links can carry an existing order. Open it through the same
  // verified payment view even after the class leaves the public catalog.
  const payment = paymentPage || Boolean(routeClassId&&!invalidClassId&&!previewToken&&!rulesPage&&params.get('order'));
  const appointmentId = params.get('appointment');
  const needsReadiness = !previewToken && !assisted && !topic && !rulesPage;
  const appointmentRegistration=interest&&!!appointmentId;
  const servicingOnly = mine || payment || appointmentRegistration;
  const readinessUrl = needsReadiness ? servicingOnly ? servicingReadinessUrl : intakeReadinessUrl : undefined;
  const formRoute = interest || (mine && (!recordId || !!record)) || (payment && hasOrder) ||
    (application && !!routeClassId && !invalidClassId);
  const catalogUrl = needsReadiness && !interest && !mine && !payment && !invalidClassId
    ? routeClassId ? '/api/enrollment/classes?'+new URLSearchParams({classId:routeClassId}) : enrollmentCatalogUrl
    : !previewToken && (topic === 'one-on-one'||appointmentRegistration) && appointmentId && /^[a-zA-Z0-9-]{1,64}$/.test(appointmentId)
      ? enrollmentAppointmentUrl(appointmentId)
      : undefined;
  useEffect(() => {
    if (classId && (application || rulesPage)) window.scrollTo(0, 0);
  }, [classId, application, rulesPage]);
  useEffect(() => {
    if (!mine || !(orderId || recordId)) return;
    window.scrollTo(0,0);
    document.getElementById('enrollment-mine-heading')?.focus({preventScroll:true});
  }, [mine,orderId,recordId,orderView]);
  // A detail page may have been open for a while before the learner applies.
  const classApplication = !!routeClassId && application && !hasOrder;
  const catalogKey = catalogUrl && (classApplication ? catalogUrl+'#apply' : catalogUrl);
  const readinessKey = readinessUrl && (classApplication ? readinessUrl+'#apply:'+routeClassId : readinessUrl);
  const [loadedCatalog,setCatalog]=useState<{key:string;revision:number;data:ReturnType<typeof parseEnrollmentCatalog>;receivedAt:number}>();
  const [failedKey,setFailedKey]=useState<string>();
  const [reload, setReload] = useState(0);
  const [readinessReload,setReadinessReload]=useState(0);
  const [loadedAvailability, setAvailability] = useState<{key:string;revision:number;data:ReturnType<typeof parseEnrollmentReadiness>}>();
  const [checkingReadiness,setCheckingReadiness]=useState(false);
  const availability = loadedAvailability?.key===readinessKey ? loadedAvailability?.data : undefined;
  const catalog=loadedCatalog?.key===catalogKey?loadedCatalog?.data:undefined;
  const classes=previewToken?(previewRow?[previewRow]:undefined):invalidClassId?[]:catalog?.classes;
  const appointments=catalog?.appointments;
  const failed=!!catalogKey&&failedKey===catalogKey;
  const readinessFailed=needsReadiness&&availability?.accepting===false&&availability.reasons.includes('check_failed');
  const browsingCatalog=!!catalogUrl&&readinessUrl===intakeReadinessUrl&&!application&&!formRoute;
  useEffect(()=>{
    if (!browsingCatalog || params.has('lang')) return;
    return watchPromotionLanguage(params,language=>{
      if (!new URLSearchParams(window.location.search).has('lang')) void i18n.changeLanguage(language);
    });
  },[browsingCatalog,params,i18n]);
  const catalogCurrent=!!catalog&&loadedCatalog?.revision===reload;
  const readinessCurrent=!!availability&&loadedAvailability?.revision===readinessReload;
  const intakeAccepting=browsingCatalog&&!readinessCurrent ? undefined : availability?.accepting;
  const accepting=previewToken?!!previewRow?.price:needsReadiness&&!servicingOnly?intakeAccepting:undefined;
  const canApplyToClass=browsingCatalog&&accepting===true&&!catalogCurrent ? undefined : accepting;
  const servicing=needsReadiness?availability?.servicing:undefined;
  useEffect(()=>{
    if(previewToken||!classes)return;
    performance.clearMarks('uper:enrollment:catalog-ready');
    performance.mark('uper:enrollment:catalog-ready');
  },[previewToken,classes]);
  useEffect(()=>{
    if(previewToken||accepting===undefined)return;
    performance.clearMarks('uper:enrollment:intake-checked');
    performance.mark('uper:enrollment:intake-checked');
  },[previewToken,accepting,availability]);
  const requestedLevel = params.get('level');
  const level = requestedLevel && catalogLevels.includes(requestedLevel) ? requestedLevel : 'all';
  const period = params.get('period') || '';
  const format = params.get('format') || '';

  useEffect(() => {
    setCatalog(current=>current?.key===catalogKey?current:undefined);
    setFailedKey(undefined);
    if(!catalogUrl||!catalogKey)return;
    const abort = new AbortController();
    const reconnect=watchReadReconnect(()=>setReload(reload+1),{foregroundOnly:true});
    const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(enrollmentLandingTimeoutMs)]);
    readEnrollmentLandingData(catalogUrl,signal,parseEnrollmentCatalog,'classes').then(data => {
      if(!abort.signal.aborted)setCatalog({key:catalogKey,revision:reload,data,receivedAt:performance.now()});
      reconnect.stop();
    }).catch(() => {
      if(!abort.signal.aborted&&!reconnect.failed())setFailedKey(catalogKey);
    });
    return () => { reconnect.stop(); abort.abort(); };
  }, [reload,catalogUrl,catalogKey]);
  useEffect(() => {
    setAvailability(current=>current?.key===readinessKey?current:undefined);
    if(!readinessUrl||!readinessKey){
      setCheckingReadiness(false);
      return;
    }
    setCheckingReadiness(true);
    const abort = new AbortController();
    const reconnect=watchReadReconnect(()=>setReadinessReload(readinessReload+1),{foregroundOnly:true});
    const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(enrollmentLandingTimeoutMs)]);
    const publishReadiness=(data:ReturnType<typeof parseEnrollmentReadiness>)=>{
      if(abort.signal.aborted)return;
      // The API can report a temporary check failure inside a successful HTTP response.
      if(!data.accepting&&data.reasons.includes('check_failed')){
        if(reconnect.failed())return;
      }else reconnect.stop();
      setAvailability({key:readinessKey,revision:readinessReload,data});
    };
    readEnrollmentLandingData(readinessUrl,signal,parseEnrollmentReadiness,'availability')
      .then(publishReadiness,()=>publishReadiness({accepting:false,servicing:true,reasons:['check_failed']}))
      .finally(() => { if (!abort.signal.aborted) setCheckingReadiness(false); });
    return () => { reconnect.stop(); abort.abort(); };
  }, [readinessReload,readinessUrl,readinessKey]);
  const catalogSettled=catalogCurrent||failed;
  useEffect(()=>{
    if(!browsingCatalog || (!catalogSettled&&!readinessCurrent))return;
    let wasHidden=document.hidden;
    const onVisibility=()=>{
      const returning=wasHidden&&!document.hidden;
      wasHidden=document.hidden;
      if(returning){
        // A pending reconnect and a foreground refresh can be triggered by the same event.
        if(catalogSettled)setReload(reload+1);
        if(readinessCurrent)setReadinessReload(readinessReload+1);
      }
    };
    document.addEventListener('visibilitychange',onVisibility);
    return ()=>document.removeEventListener('visibilitychange',onVisibility);
  },[browsingCatalog,catalogSettled,readinessCurrent,reload,readinessReload]);
  useEffect(() => {
    // The learner has entered a form route. Download the form while its data
    // loads, but let the existing readiness checks decide when to mount it.
    const ready = servicingOnly ? servicing : accepting;
    if (needsReadiness && formRoute && ready !== false) {
      const loadForm = payment ? loadEnrollmentApplication : loadEnrollmentIntake;
      void loadForm().catch(() => {});
    }
  }, [needsReadiness,formRoute,servicingOnly,servicing,accepting,payment]);
  useEffect(()=>{
    if(!previewToken)return;
    const receive=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin||event.source!==window.parent||
        event.data?.type!=='enrollment-preview-data'||event.data.token!==previewToken||
        !['detail','catalog'].includes(event.data.view)||typeof event.data.row?.id!=='string')return;
      setPreviewRow(event.data.row);
      setPreviewView(event.data.view);
      window.scrollTo(0,0);
    };
    window.addEventListener('message',receive);
    window.parent.postMessage({type:'enrollment-preview-ready',token:previewToken},window.location.origin);
    return ()=>window.removeEventListener('message',receive);
  },[previewToken]);
  useEffect(()=>{
    if(!previewToken||!previewRow)return;
    const navigatePreview=(event:MouseEvent)=>{
      const target=(event.target as Element|null)?.closest?.('a[href]');
      if(!target)return;
      event.preventDefault();
      event.stopPropagation();
      if(event.type==='auxclick')return;
      const url=new URL(target.getAttribute('href')!,window.location.origin);
      if(url.origin!==window.location.origin)return;
      if(url.pathname==='/enrollment')setPreviewView('catalog');
      else if(url.pathname==='/enrollment/'+encodeURIComponent(previewRow.id)){
        setPreviewView(url.searchParams.get('apply')==='1'?'apply':url.searchParams.get('view')==='rules'?'rules':'detail');
      }else return;
      window.scrollTo(0,0);
    };
    document.addEventListener('click',navigatePreview,true);
    document.addEventListener('auxclick',navigatePreview,true);
    return ()=>{
      document.removeEventListener('click',navigatePreview,true);
      document.removeEventListener('auxclick',navigatePreview,true);
    };
  },[previewToken,previewRow]);

  const returnPosition = readEnrollmentPosition(navigation);
  const restoredPositionKey = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (restoredPositionKey.current === location.key) return;
    restoredPositionKey.current = undefined;
    if (!returnPosition || previewToken || topic || !classes) return;
    const fromAppointment=returnPosition.focus.startsWith('appointment:');
    // The readiness result can add a header action or another row above the cards.
    if(fromAppointment&&needsReadiness&&!readinessCurrent)return;
    const restore=()=>{
      restoredPositionKey.current = location.key;
      for (const detail of document.querySelectorAll<HTMLDetailsElement>('.enrollment-course details[data-enrollment-section]'))
        detail.open = returnPosition.expanded.includes(detail.dataset.enrollmentSection!);
      const active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) return;
      const focusTarget=fromAppointment
        ? document.getElementById(returnPosition.focus)
        : document.querySelector<HTMLElement>('[data-enrollment-consult="'+returnPosition.focus+'"]');
      focusTarget?.focus({preventScroll:true});
      const focusOffset=returnPosition.focusOffset;
      if(focusTarget&&typeof focusOffset==='number'&&Number.isFinite(focusOffset)){
        window.scrollTo({top:window.scrollY+focusTarget.getBoundingClientRect().top-focusOffset,behavior:'instant'});
      }else window.scrollTo({top:returnPosition.scrollY,behavior:'instant'});
    };
    if(!fromAppointment){restore();return;}
    let cancelled=false;
    void document.fonts.ready.then(()=>{if(!cancelled)restore();});
    return ()=>{cancelled=true;};
  }, [location.key, returnPosition, Boolean(classes), previewToken, topic, needsReadiness, readinessCurrent]);

  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true, state:chatReturnState });
  }
  const catalogParams = new URLSearchParams(params);
  catalogParams.delete('apply');
  catalogParams.delete('order');
  catalogParams.delete('proof');
  catalogParams.delete('view');
  catalogParams.delete('target');
  catalogParams.delete(enrollmentOrderReturnParam);
  catalogParams.delete('appointmentLevel');
  catalogParams.delete('appointment');
  const waitlistId = params.get('waitlist');
  const matchId = params.get('fromDemand');
  const publicParams = new URLSearchParams(catalogParams);
  for (const key of ['waitlist','fromDemand','join']) publicParams.delete(key);
  const listPath = '/enrollment?' + publicParams.toString();
  const waitlistPath = waitlistId ? '/enrollment/mine/waitlist/'+encodeURIComponent(waitlistId)+'?'+publicParams.toString() : undefined;
  const matchPath = matchId ? '/enrollment/mine/demands/'+encodeURIComponent(matchId)+'?'+publicParams.toString() : undefined;
  const minePath = '/enrollment/mine?' + catalogParams.toString();
  const originalOrderParams = new URLSearchParams(catalogParams);
  if (orderId) originalOrderParams.set('order',orderId);
  const originalOrderPath = '/enrollment/mine?' + originalOrderParams.toString();
  const returnToOrder=hasOrder&&params.get(enrollmentOrderReturnParam)==='1';
  const isOrderSubpage = orderView==='refund'||orderView==='refund-contact'||orderView==='invitation'||orderView==='transfers'||orderView==='transfer';
  const backToOrder = <EnrollmentJourneyLink className="enrollment-back" to={originalOrderPath}
    state={journeyState} onClick={prepareEnrollmentNavigation}><ArrowLeft size={15} aria-hidden="true"/>
    {enrollmentCopy(language,['返回报名详情','Back to enrollment details','Kembali ke detail pendaftaran'])}
  </EnrollmentJourneyLink>;
  const mineBack = <EnrollmentJourneyLink className="enrollment-back" to={minePath}
    state={journeyState} onClick={prepareEnrollmentNavigation}><ArrowLeft size={15} aria-hidden="true"/>
    {t('backMine')}
  </EnrollmentJourneyLink>;
  const interestPath = '/enrollment/interest?' + catalogParams.toString();
  const detailsPath = (id: string, apply = false) => {
    const query = new URLSearchParams(catalogParams);
    if (apply) query.set('apply', '1');
    return '/enrollment/' + encodeURIComponent(id) + '?' + query.toString();
  };
  const selected = classes?.find(row => row.id === classId);
  const {rows,privateLessons,levelCounts}=useMemo(()=>{
    const rows:PublicEnrollmentClass[]=[];
    const privateLessons:PublicEnrollmentAppointment[]=[];
    const levelCounts=new Map<string,number>();
    if(!classId&&!topic&&!formRoute){
      const countAndMatch=(label:string)=>{
        const key=catalogLevel(label);
        levelCounts.set(key,(levelCounts.get(key)??0)+1);
        return level==='all'||key===level;
      };
      for(const row of classes??[]){
        if((!period||row.period===period)&&(!format||row.format===format)&&countAndMatch(row.level))rows.push(row);
      }
      if(format==='one-on-one'||!format&&!period){
        for(const item of appointments??[]){
          if(countAndMatch(item.level))privateLessons.push(item);
        }
      }
    }
    return {rows,privateLessons,levelCounts};
  },[classes,appointments,classId,topic,formRoute,period,format,level]);
  const appointmentPath = (item: PublicEnrollmentAppointment) => {
    const query = new URLSearchParams(publicParams);
    query.set('lang', language);
    query.set('appointmentLevel', catalogLevel(item.level));
    query.set('appointment',item.id);
    return '/enrollment/help/one-on-one?' + query.toString();
  };
  function openAppointment(event:ReactMouseEvent<HTMLAnchorElement>,id:string) {
    prepareEnrollmentNavigation(event);
    if(!isPlainLinkClick(event))return;
    event.preventDefault();
    const focus=`appointment:${id}` as const;
    const focusOffset=document.getElementById(focus)?.getBoundingClientRect().top;
    const position:EnrollmentPosition={scrollY:window.scrollY,focus,focusOffset,expanded:[]};
    rememberEnrollmentPosition(position);
    navigate(event.currentTarget.pathname+event.currentTarget.search,{state:{...chatReturnState,enrollmentPosition:position}});
  }
  const offline=navigator.onLine===false;
  const offlineReadinessFailure=offline&&readinessFailed;
  const catalogFailure=<p role="alert">{t(offline?'offline':'error')}{!offline&&
    <> <button className="enrollment-quiet" type="button" onClick={()=>setReload(value=>value+1)}>{t('retry')}</button></>}</p>;
  const readinessNotice=<div role="status" className="enrollment-form-error">
    {availability?.reasons.map(reason=><p key={reason}>{offlineReadinessFailure&&reason==='check_failed'?t('offline'):enrollmentReadinessMessage(reason,language)}</p>)}
    {readinessFailed&&!offline&&<button type="button" className="enrollment-quiet" disabled={checkingReadiness}
      onClick={()=>setReadinessReload(value=>value+1)}>{t('retry')}</button>}
  </div>;
  const intakeNotice=accepting===false&&!previewToken&&!(failed&&offlineReadinessFailure)&&readinessNotice;
  const backChat = !previewToken && fromChat && <Link
    className="enrollment-back enrollment-chat-return" to={fromChat.url}
    onClick={event => {
      if (!isPlainLinkClick(event)) return;
      event.preventDefault();
      returnAlongJourney(navigate,fromChat,{chatMessageAnchor:fromChat.anchor});
    }}><ArrowLeft size={15} aria-hidden="true"/>{t('backChat')}</Link>;
  const hubPath = !previewToken && !fromChat && linkHubReturnUrl(params,language);
  const chatPath = promotionEntryUrl('/chat',params,language);
  function startConsultation(event:ReactMouseEvent<HTMLAnchorElement>, row?:PublicEnrollmentClass, focus:EnrollmentPosition['focus']=row?'class':'catalog') {
    trackEvent('link_click',{target:row?'enrollment_class_consultation':'enrollment_catalog_consultation'});
    if (!isPlainLinkClick(event)) return;
    const selection=normalizeEnrollmentChatSelection(row?{kind:'class',classId:row.id}:{kind:'catalog',level,period,format});
    if (!selection) return;
    event.preventDefault();
    const expanded = [...document.querySelectorAll<HTMLDetailsElement>('.enrollment-course details[open][data-enrollment-section]')]
      .map(detail=>detail.dataset.enrollmentSection!);
    const enrollmentConsultation = rememberEnrollment({
      scrollY:window.scrollY,focus,expanded,
    },selection,row&&enrollmentClassTitle(row,language));
    navigate(chatPath,{state:{enrollmentConsultation}});
  }
  const consultCatalog = !previewToken && !fromChat && <Link data-enrollment-consult="catalog"
    className="enrollment-outline enrollment-consult-action" to={chatPath} onClick={event=>startConsultation(event)}>
    <MessageCircle size={16} aria-hidden="true"/>{t('consultCatalog')}</Link>;
  function prepareEnrollmentNavigation(event:ReactMouseEvent<HTMLAnchorElement>,appointmentSnapshot?:Parameters<typeof preloadEnrollmentNavigation>[1]) {
    if (previewToken || !isPlainLinkClick(event)) return;
    const url = new URL(event.currentTarget.href);
    preloadEnrollmentNavigation(url,appointmentSnapshot);
    const recordPage = /^\/enrollment\/mine(?:\/|$)/.test(url.pathname);
    if (recordPage || url.searchParams.get('apply') === '1' || url.pathname === '/enrollment/interest') {
      void loadEnrollmentIntake().catch(() => {});
    }
  }
  const classCard=(row:PublicEnrollmentClass,inCatalog:boolean,priceInActions=false)=><EnrollmentClassPreview key={row.id} row={row} language={language} detail={!inCatalog} priceInActions={priceInActions}
    intakeStatus={previewToken||canApplyToClass===true?undefined:canApplyToClass===false&&!readinessFailed?'paused':failed||readinessFailed?'unverified':'checking'}
    navigationState={inCatalog?{...chatReturnState,enrollmentClassPreview:{
      id:row.id,level:row.level,format:row.format,period:row.period,batchNumber:row.batchNumber,
    }}:chatReturnState} titleLink={inCatalog?detailsPath(row.id):undefined}
    onNavigate={prepareEnrollmentNavigation}/>;
  function deferredSection(content: ReactNode, navigation?: ReactNode, standalone = false) {
    const notice = (message: ReactNode) => standalone
      ? <section className="enrollment-screen">{navigation}{message}</section>
      : <>{navigation}{message}</>;
    return <EnrollmentModuleBoundary key={pathname}
      pending={notice(<p role="status">{t('loadingSection')}</p>)}
      failure={notice(<div className="enrollment-form-error" role="alert">
        <p>{t('sectionUnavailable')}</p>
        <button type="button" className="enrollment-quiet" onClick={() => window.location.reload()}>{t('refreshPage')}</button>
      </div>)}>
      {content}
    </EnrollmentModuleBoundary>;
  }

  if(previewToken&&!previewRow)return <p className="enrollment-screen" role="status">{t('loading')}</p>;
  if(previewToken&&previewView==='apply'&&previewRow)return <section className="enrollment-screen enrollment-apply-screen">
    <Link className="enrollment-back" to={detailsPath(previewRow.id)}><ArrowLeft size={15} aria-hidden="true"/>{t('backDetail')}</Link>
    <h1>{t('apply')}</h1>
    {classCard(previewRow,false)}
    <p>{enrollmentCopy(language,['学员预览，到此为止。','End of learner preview.','Akhir pratinjau siswa.'])}</p>
  </section>;

  const backCatalog = <Link className="enrollment-back" to={listPath} state={chatReturnState} onClick={prepareEnrollmentNavigation}><ArrowLeft size={15} aria-hidden="true"/>{t('back')}</Link>;
  if (assisted) return deferredSection(<EnrollmentAssistance language={language} navigation={<>{backChat}{recordReturn?mineBack:backCatalog}</>}/>,
    <>{backChat}{recordReturn?mineBack:backCatalog}</>, true);
  if (topic) {
    const helpBack=topic==='one-on-one'
      ? <EnrollmentJourneyLink className="enrollment-back" to={listPath} state={{...chatReturnState,enrollmentPosition:returnPosition}} onClick={prepareEnrollmentNavigation}>
        <ArrowLeft size={15} aria-hidden="true"/>
        {enrollmentCopy(language,['返回课程报名','Back to course enrollment','Kembali ke pendaftaran kursus'])}
      </EnrollmentJourneyLink>
      : returnToOrder?backToOrder:mineBack;
    const appointmentLevel = params.get('appointmentLevel') ?? requestedLevel;
    const appointment=topic==='one-on-one'?appointments?.find(item=>item.id===appointmentId):undefined;
    const appointmentState=topic==='one-on-one'&&appointmentId!==null&&!appointment
      ? failed?'failed':catalogUrl&&!catalog?'loading':'unavailable' : undefined;
    const registrationQuery=new URLSearchParams(publicParams);
    if(appointment){
      registrationQuery.set('appointment',appointment.id);
      registrationQuery.set('format','one-on-one');
    }
    return deferredSection(<EnrollmentSupport key={appointmentId??topic} topic={topic} language={language}
        level={appointmentLevel && /^[1-4]$/.test(appointmentLevel) ? appointmentLevel : undefined}
        appointment={appointment} appointmentState={appointmentState} onAppointmentRetry={()=>setReload(value=>value+1)}
        period={appointment&&!fromChat&&params.get('enrollment_via')!=='ai_chat'?undefined:period}
        format={params.get('format')??undefined} returnAction={backChat} backAction={helpBack} offline={params.get('mode')==='offline'}
        registrationLink={appointment?{
          to:'/enrollment/interest?'+registrationQuery,
          state:{...chatReturnState,enrollmentPosition:returnPosition},
          onClick:event=>prepareEnrollmentNavigation(event,catalog&&loadedCatalog?
            {id:appointment.id,data:catalog,receivedAt:loadedCatalog.receivedAt}:undefined),
        }:undefined}/>,
      <>{backChat}{helpBack}</>, true);
  }

  if (rulesPage) return <section className="enrollment-screen enrollment-apply-screen enrollment-support">
    {backChat}
    <Link className="enrollment-back" to={detailsPath(classId!)} state={chatReturnState} onClick={prepareEnrollmentNavigation}><ArrowLeft size={15} aria-hidden="true"/>{t('backDetail')}</Link>
    <h1>{t('rulesTitle')}</h1>
    <div className="enrollment-result-body">
      <article className="enrollment-record"><h2>{enrollmentCopy(language,['原班无法如期开课','If the original class won’t open','Jika kelas asal tidak dibuka'])}</h2>
        <p>{enrollmentCopy(language,[
          '班次确认不开班后请勿再转账。已转账仍可提交凭证。核实足额到账后，可转班或等待合适班次。已有核实到账的学员也可联系销售或客服申请原路退款。',
          'Please stop making payments when the class is cancelled. If you already transferred funds, you can still submit proof. Once full payment is verified, you can transfer to another class or wait for a suitable one. Contact sales or support to request a refund of verified payments to the original payment method.',
          'Jika kelas dibatalkan, jangan lakukan transfer lagi. Jika sudah mentransfer, Anda masih dapat mengirim bukti. Setelah pembayaran lunas diverifikasi, Anda dapat pindah atau menunggu kelas yang sesuai. Hubungi tim penjualan atau layanan pelanggan untuk meminta pengembalian pembayaran terverifikasi ke metode pembayaran awal.',
        ])}</p></article>
      <article className="enrollment-record"><h2>{enrollmentCopy(language,['学员自行退出','If you decide to withdraw','Jika Anda mengundurkan diri'])}</h2>
        <p>{enrollmentCopy(language,[
          '班次待成班时，可联系销售或客服申请退回已核实的实收。确认开班后，个人原因退出原则上不退款。特殊情况请联系销售或客服申请审核。',
          'While class opening is pending, contact sales or support to request a refund of verified payments. Once the class is confirmed, personal withdrawals are generally non-refundable. Contact sales or support if you need an exception reviewed.',
          'Selama pembukaan kelas belum dikonfirmasi, hubungi tim penjualan atau layanan pelanggan untuk meminta pengembalian pembayaran terverifikasi. Setelah kelas dikonfirmasi, pengunduran diri karena alasan pribadi umumnya tidak dapat dikembalikan dananya. Hubungi tim kami untuk peninjauan kasus khusus.',
        ])}</p></article>
    </div>
  </section>;

  if (payment) return <section className="enrollment-screen enrollment-payment">
    {backChat}
    {returnToOrder||params.get('proof')==='upload'&&hasOrder ? backToOrder : mineBack}
    <h1>{t('payment')}</h1>
    {servicing === undefined ? <p role="status">{t('loading')}</p> : servicing && params.has('order')
      ? deferredSection(<VisitorBoundary><EnrollmentPaymentForm key={params.get('order')} language={language} payment/></VisitorBoundary>)
      : <p>{t('unavailable')}</p>}
  </section>;
  if (mine) return <section className="enrollment-screen enrollment-mine" data-record-detail={!!recordId||hasOrder}>
    {recordId||hasOrder ? <div>{backChat}{isOrderSubpage?backToOrder:mineBack}</div> : <>{backChat}{backCatalog}</>}
    <h1 id="enrollment-mine-heading" tabIndex={-1}>
      {record?.kind==='waitlist'?t('waitlistDetail'):record?.kind==='demands'?t('demandDetail'):hasOrder
        ?enrollmentCopy(language,['报名详情','Enrollment details','Detail pendaftaran']):t('mine')}
    </h1>
    {recordId && !record ? <p>{t('recordUnavailable')}</p>
      : servicing === undefined ? <p role="status">{t('loading')}</p>
      : servicing ? deferredSection(<EnrollmentApplication key={pathname} language={language} mine record={record}/>)
      : <p>{t('unavailable')}</p>}
  </section>;
  if(appointmentRegistration){
    const appointment=appointments?.find(item=>item.id===appointmentId);
    const loading=servicing===undefined||catalogUrl&&!catalog;
    const detail='/enrollment/help/one-on-one?'+new URLSearchParams(params);
    const demandsParams=new URLSearchParams(catalogParams);
    demandsParams.set('tab','demands');
    const registrationHeading=<>
      {backChat}
      <Link className="enrollment-back" to={detail} state={{...chatReturnState,enrollmentPosition:returnPosition}}><ArrowLeft size={15} aria-hidden="true"/>
        {enrollmentCopy(language,['返回一对一详情','Back to one-to-one details','Kembali ke detail kelas privat'])}</Link>
      <h1>{enrollmentCopy(language,['登记一对一约课','Request one-to-one lessons','Ajukan kelas privat'])}</h1>
    </>;
    const completionBack=<EnrollmentJourneyLink className="enrollment-back" to={'/enrollment/mine?'+demandsParams.toString()}
      onClick={prepareEnrollmentNavigation}><ArrowLeft size={15} aria-hidden="true"/>
      {enrollmentCopy(language,['返回选课需求','Back to course preferences','Kembali ke preferensi kursus'])}
    </EnrollmentJourneyLink>;
    return <section className="enrollment-screen enrollment-apply-screen enrollment-intake">
      {!failed&&!readinessFailed&&!loading&&appointment&&servicing?deferredSection(
        <EnrollmentApplication key={appointment.id} language={language} demandOnly privateLesson={appointment}
          privateLessonNavigation={{registrationHeading,completionBack}}/>,registrationHeading):
        <>{registrationHeading}{failed?catalogFailure:readinessFailed?readinessNotice:loading
          ? <p role="status">{t('loading')}</p> : <p role="status">{t('unavailable')}</p>}</>}
    </section>;
  }
  if (interest) return <section className="enrollment-screen enrollment-apply-screen enrollment-intake">
    {backChat}
    {backCatalog}
    <h1>{t('interest')}</h1>
    {accepting === undefined ? <p role="status">{t('loading')}</p> :
      accepting ? deferredSection(<EnrollmentApplication key={String(interest)} language={language} demandOnly={interest}/>) : intakeNotice}
  </section>;

  if (application && selected && !params.has('order') && accepting && selected.price>0) {
    const details = waitlistPath ?? detailsPath(selected.id);
    const applicationProps={classId:selected.id,language,returnAction:backChat,applicationClass:{
        title: enrollmentClassTitle(selected,language),
        schedule: enrollmentScheduleLabel(selected,language),
        price: selected.price,
        detailsPath: details,
        fromWaitlist: waitlistId ?? undefined,
        listPath,
    }};
    const applicationNavigation=<>{backChat}<Link className="enrollment-back" to={details} state={waitlistId?journeyState:chatReturnState} onClick={prepareEnrollmentNavigation}><ArrowLeft size={15} aria-hidden="true"/>{t(waitlistId ? 'backWaitlist' : 'backDetail')}</Link><h1>{t('apply')}</h1></>;
    const explicitWaitlist=params.get('join')==='1';
    if(selected.availability!=='full'&&!explicitWaitlist)return <section className="enrollment-screen enrollment-apply-screen">
      {deferredSection(<EnrollmentApplication key={selected.id} {...applicationProps}/>,applicationNavigation)}
    </section>;
    const applicationForm=<section className="enrollment-screen enrollment-apply-screen">
      {deferredSection(<EnrollmentForm key={selected.id} {...applicationProps}/>,applicationNavigation)}
    </section>;
    const waitlistForm=<section className="enrollment-screen enrollment-apply-screen enrollment-intake">
      {backChat}
      {backCatalog}
      <h1>{t('join')}</h1>
      {deferredSection(<EnrollmentForm key={selected.id} classId={selected.id} language={language} full waitlistClass={selected}/>)}
      <Link className="enrollment-quiet" to={minePath} state={chatReturnState} onClick={prepareEnrollmentNavigation}>{t('mine')}</Link>
    </section>;
    return <VisitorBoundary>{explicitWaitlist?waitlistForm:<ClassIntakeMode classId={selected.id} application={applicationForm} waitlist={waitlistForm}/>}</VisitorBoundary>;
  }

  const classHasIntakeAction=!!selected&&!!canApplyToClass&&selected.price>0;

  if (classId) return <section className="enrollment-screen enrollment-detail">
    {backChat}
    <Link className="enrollment-back" to={application ? detailsPath(classId) : matchPath ?? listPath} state={matchPath?journeyState:chatReturnState} onClick={prepareEnrollmentNavigation}><ArrowLeft size={15} aria-hidden="true"/>{t(application ? 'backDetail' : matchPath ? 'backMatch' : 'back')}</Link>
    <header className="enrollment-title-row enrollment-detail-title">
      <h1>{t(application && selected ? selected.availability === 'full' ? 'join' : 'apply' : 'details')}</h1>
      {selected&&!application&&!previewToken&&!fromChat&&<Link data-enrollment-consult="class"
        className="enrollment-quiet enrollment-consult-action" to={chatPath}
        aria-label={t('consultClass')} onClick={event=>startConsultation(event,selected)}>
        <MessageCircle size={16} aria-hidden="true"/>{t('consultClassAction')}
      </Link>}
    </header>
    {failed ? catalogFailure
      : !classes ? <>{classPreview&&<h2 className="enrollment-class-heading"><EnrollmentClassName title={enrollmentClassTitle(classPreview,language)}/></h2>}<p role="status">{t('loading')}</p></>
      : !selected ? <><p>{t('unavailable')}</p>
        {application&&<Link className="enrollment-quiet" to={minePath} state={chatReturnState} onClick={prepareEnrollmentNavigation}>{t('mine')}</Link>}
      </>
      : application ? <div className="enrollment-apply-layout">
        {classCard(selected, false)}
        {accepting && selected.price>0 && deferredSection(<EnrollmentApplication key={selected.id} classId={selected.id} language={language} full={selected.availability==='full'}/>)}
        {intakeNotice}
        {accepting===false&&servicing&&<Link className="enrollment-quiet" to={minePath} state={chatReturnState} onClick={prepareEnrollmentNavigation}>{t('mine')}</Link>}
      </div> : <div className="enrollment-detail-layout">
        <aside className="enrollment-detail-aside">
          {classCard(selected, false, classHasIntakeAction)}
          {intakeNotice}
          {classHasIntakeAction && <EnrollmentPriceActions hideLabel
            label={enrollmentCopy(language,['课程总价','Total tuition','Total biaya'])}
            amount={selected.price} standardPrice={selected.standardPrice} language={language}>
            <Link className="enrollment-primary" to={detailsPath(selected.id, true)}
              state={chatReturnState} onClick={prepareEnrollmentNavigation}>{t(selected.availability === 'full' ? 'join' : 'apply')}</Link>
          </EnrollmentPriceActions>}
        </aside>
        <section className="enrollment-course">
          <h2>{t('courseIntro')}</h2>
          {selected.introduction?.[language] || selected.introduction?.en
            ? <EnrollmentCourseOverview introduction={selected.introduction} language={language}/>
            : (['outcomes', 'material', 'resources'] as const).map(key => {
            const description = key === 'outcomes' ? selected.learningOutcomes : selected[key];
            if (!description) return null;
            return <details key={key} data-enrollment-section={key} open={key === 'outcomes'}>
              <summary>
                <span>{t(key)}<small aria-hidden="true">{description}</small></span>
                <Plus size={16} aria-hidden="true"/><Minus size={16} aria-hidden="true"/>
              </summary>
              <p>{description}</p>
            </details>;
          })}
          <Link className="enrollment-course-policy" to={detailsPath(selected.id)+'&view=rules'} state={chatReturnState}>
            {t('rules')}<ChevronRight size={16} aria-hidden="true"/>
          </Link>
        </section>

      </div>}
  </section>;

  return <section className="enrollment-screen enrollment-catalog">
    {backChat}
    {hubPath && <Link className="enrollment-back" to={hubPath}><ArrowLeft size={15} aria-hidden="true"/>{t('backLinkHub')}</Link>}
    <header className="enrollment-title-row">
      <div>
        <h1>{t('title')}</h1>
        <p className="enrollment-subtitle">{t('online')}</p>
      </div>
      {(consultCatalog || servicing) && <div className="enrollment-title-actions">
        {consultCatalog}
        {servicing && <Link className="enrollment-outline" to={minePath} state={chatReturnState} onClick={prepareEnrollmentNavigation}>{t('mine')}<ChevronRight size={16} aria-hidden="true"/></Link>}
      </div>}
    </header>
    {intakeNotice}
    <div className="enrollment-catalog-controls">
      <div className="enrollment-category-tabs enrollment-levels" role="group" aria-label={t('level')}>
        {catalogLevels.map(value => <button key={value} type="button" aria-pressed={level === value} onClick={() => filter('level', value)}>
          <span className="enrollment-level-name">{value === 'all' ? t('allLevels') : 'HSK ' + value}</span>
          {value !== 'all' && <span className="enrollment-tab-count" hidden={Boolean(failed)}
            aria-hidden={!classes || undefined} data-pending={!classes || undefined}>{levelCounts.get(value) ?? 0}</span>}
        </button>)}
      </div>
      <div className="enrollment-filters">
        <PublicSingleSelect label={t('period')} value={period} onChange={value => filter('period', value)}
          options={[{ value: '', label: t('allPeriods') }, { value: 'weekday-evening', label: t('weekday-evening') }, { value: 'weekend', label: t('weekend') }, { value: 'mixed', label: t('mixed') }]}/>
        <PublicSingleSelect label={t('format')} value={format} onChange={value => filter('format', value)}
          options={[{ value: '', label: t('allFormats') }, { value: 'standard', label: t('standard') }, { value: 'small', label: t('small') }, { value: 'one-on-one', label: t('one-on-one') }]}/>
      </div>
    </div>
    {failed
      ? catalogFailure
      : !classes && <div className="enrollment-class-grid" role="status">
        <span className="sr-only">{t('loading')}</span>
        <div className="enrollment-catalog-placeholder" aria-hidden="true"/>
        <div className="enrollment-catalog-placeholder hidden md:block" aria-hidden="true"/>
      </div>}
    {rows.length || privateLessons.length ? <div className="enrollment-class-grid">
      {rows.map(row => classCard(row, true))}
      {privateLessons.map(item=>{
        const to=appointmentPath(item);
        const onClick=(event:ReactMouseEvent<HTMLAnchorElement>)=>openAppointment(event,item.id);
        return <article key={item.id} className="enrollment-class-card enrollment-appointment-card">
          <h2><Link id={`appointment:${item.id}`} to={to} state={chatReturnState} onClick={onClick}>
            <EnrollmentClassName title={enrollmentPrivateLessonTitle(item.level,language)}/><ChevronRight size={15} aria-hidden="true"/>
          </Link></h2>
          <p className="enrollment-teacher"><EnrollmentTeacherLabel teacherType={item.teacherType} language={language}/></p>
          <p className="enrollment-schedule">{t('appointment')}</p>
          <p>{enrollmentFixedLessonDuration(item.lessons,item.minutes,language)}</p>
          <div className="enrollment-class-bottom">
            <div className="enrollment-prices">
              <strong>{formatCurrency(item.price*item.lessons,language)}</strong>
              {item.standardPrice>item.price&&<small>
                <span className="sr-only">{enrollmentCopy(language,['标准价','Standard price','Harga standar'])}{' '}</span>
                <del className="enrollment-reference-price">{formatCurrency(item.standardPrice*item.lessons,language)}</del>
              </small>}
            </div>
            <Link className="enrollment-primary" to={to} state={chatReturnState} onClick={onClick}>{t('appointmentAction')}</Link>
          </div>
        </article>;
      })}
    </div>
      : classes&&!failed&&<div className="enrollment-class-card enrollment-empty">
        <CalendarDays size={20} aria-hidden="true"/><div><p><strong>{t('empty')}</strong></p><p>{t('noMatchBody')}</p></div>
        <div className="enrollment-empty-actions">
          {(level !== 'all' || period || format) && <button className="enrollment-primary" type="button" onClick={() => {
            const next = new URLSearchParams(params);
            for (const key of ['level','period','format']) next.delete(key);
            setParams(next, {replace:true,preventScrollReset:true,state:chatReturnState});
          }}>{t('reset')}</button>}
          {!previewToken && !fromChat && <Link data-enrollment-consult="catalog-empty"
            className="enrollment-outline" to={chatPath} onClick={event=>startConsultation(event,undefined,'catalog-empty')}>
            <MessageCircle size={16} aria-hidden="true"/>{t('consultCatalog')}</Link>}
        </div>
      </div>}
    {accepting && (classes || failed) && <div className="enrollment-interest-link"><p>{t('noMatch')}</p><Link className="enrollment-quiet" to={interestPath} state={chatReturnState} onClick={prepareEnrollmentNavigation}>{t('interest')}<ArrowUpRight size={15} aria-hidden="true"/></Link></div>}
  </section>;
}
