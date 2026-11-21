import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useEffect,useState,type MouseEvent} from 'react';
import {enrollmentClassTitle,type PublicEnrollmentClass} from '../utils/enrollmentCatalog';
import {EnrollmentClassPreview} from './EnrollmentClassPreview';
import {enrollmentAppointmentRequested,enrollmentGuideHref,enrollmentGuideText,type EnrollmentGuideAction,type EnrollmentGuideLanguage} from '../utils/enrollmentGuidance';
import {trackEvent} from '../utils/analytics';
import {chatPromotionParams,type ChatOrigin,type ChatSource} from '../services/portalChat';
import {ArrowRight} from 'lucide-react';
import {isPlainLinkClick,rememberChat,type ChatMessageAnchor} from '../utils/chatJourneyNavigation';

let catalogRequest:Promise<Map<string,PublicEnrollmentClass>>|undefined;
function readPublicClasses(){
  return catalogRequest??=(async()=>{
    const response=await fetch('/api/enrollment/classes',{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('Class catalog unavailable');
    const {classes}:{classes:PublicEnrollmentClass[]}=await response.json();
    return new Map(classes.map(row=>[row.id,row]));
  })().finally(()=>{catalogRequest=undefined;});
}

export function ChatEnrollmentGuide({action,language,entry,origin,anchor}:{action?:EnrollmentGuideAction;language:string;entry:ChatSource;origin?:ChatOrigin;anchor?:ChatMessageAnchor}){
  const {search}=useLocation();
  const navigate=useNavigate();
  const rows=action?.rows;
  const [catalog,setCatalog]=useState<Map<string,PublicEnrollmentClass>>();
  useEffect(()=>{
    if(!rows?.some(row=>row.sessions===undefined||row.opened===undefined))return;
    let active=true;
    void readPublicClasses().then(result=>{if(active)setCatalog(result);},()=>{});
    return ()=>{active=false;};
  },[rows]);
  if(!action)return null;
  const lang:EnrollmentGuideLanguage=action.replyLanguage??(language.startsWith('zh')?'zh':language.startsWith('id')?'id':'en');
  const t=(zh:string,en:string,id:string)=>enrollmentGuideText(lang,zh,en,id);
  const source=chatPromotionParams(origin ?? {source:entry},search);
  function onClick(event:MouseEvent<HTMLAnchorElement>) {
    trackEvent('link_click',{target:'enrollment',entry_point:entry});
    if (!anchor || !isPlainLinkClick(event)) return;
    const url = new URL(event.currentTarget.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    const chatRecommendation = rememberChat(anchor);
    navigate(url.pathname+url.search+url.hash,{state:{chatRecommendation}});
  }
  const linkClass='inline-flex min-h-11 items-center rounded-lg font-semibold text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2';
  if(rows?.length)return <div className="not-prose enrollment-class-grid mt-3" data-enrollment-card-group={rows.some(row=>!action.linkOnlyClassIds?.includes(row.id))||undefined}>
    {rows.map(snapshot=>{
      const current=(snapshot.sessions===undefined||snapshot.opened===undefined)?catalog?.get(snapshot.id):undefined;
      const row=current??snapshot;
      const titleLink=enrollmentGuideHref({...action,kind:'class',classId:row.id},lang,'ai_chat',source);
      if(action.linkOnlyClassIds?.includes(row.id))return <Link key={row.id} className={linkClass} to={titleLink} onClick={onClick}>
        {enrollmentClassTitle(row,lang)}
      </Link>;
      return <EnrollmentClassPreview key={row.id} row={row} language={lang} titleLink={titleLink} chatPresentation
        actionLink={action.inspection||action.intakePaused||action.question==='view_without_contact'||!row.price?undefined:titleLink+'&apply=1'}
        intakePaused={action.intakePaused} availabilitySnapshot={!current} onNavigate={onClick}/>;
    })}
  </div>;
  return <Link className="chat-enrollment-next" to={enrollmentGuideHref(action,lang,'ai_chat',source)} onClick={onClick}>
    {action.kind==='demand'?t('登记选课需求','Submit course preferences','Kirim preferensi kursus'):
     action.kind==='advisor'?t('咨询 UPER','Ask UPER','Tanya UPER'):
     enrollmentAppointmentRequested(action)?t('联系 UPER 约课','Arrange one-to-one lessons','Atur jadwal kelas privat'):
     (action.kind==='records'||action.kind==='paused'&&action.recordsAvailable)?t('我的报名','My enrollments','Pendaftaran saya'):
     action.kind==='catalog'&&action.level&&action.period==='weekend'&&!action.levelUnavailable
        ? t(`查看 ${action.level} 周末班`,`View weekend ${action.level} classes`,`Lihat kelas akhir pekan ${action.level}`):
     action.kind==='catalog'&&action.question==='apply'&&!action.levelUnavailable?t('查看可报名班次','View open classes','Lihat kelas yang terbuka'):
     action.kind==='viewing'?t('查看课表','View schedules','Lihat jadwal'):
     t('查看课程与报名','View courses and enrollment','Lihat kursus dan pendaftaran')}
    <ArrowRight size={16} aria-hidden="true"/>
  </Link>;
}
