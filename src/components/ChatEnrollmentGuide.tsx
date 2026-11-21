import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useEffect,useState,type MouseEvent} from 'react';
import {enrollmentClassTitle,enrollmentInstant,type PublicEnrollmentClass} from '../utils/enrollmentCatalog';
import {ChatClassSchedule,EnrollmentClassPreview} from './EnrollmentClassPreview';
import {enrollmentAppointmentRequested,enrollmentGuideHref,enrollmentGuideText,type sharedEnrollmentComparison,type EnrollmentGuideAction,type EnrollmentGuideLanguage} from '../utils/enrollmentGuidance';
import {trackEvent} from '../utils/analytics';
import {chatPromotionParams,type ChatOrigin,type ChatSource} from '../services/portalChat';
import {isPlainLinkClick,rememberChat,type ChatMessageAnchor} from '../utils/chatJourneyNavigation';
import {formatCurrency} from '../utils/currency';

let catalogRequest:Promise<Map<string,PublicEnrollmentClass>>|undefined;
function readPublicClasses(){
  return catalogRequest??=(async()=>{
    const response=await fetch('/api/enrollment/classes',{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('Class catalog unavailable');
    const {classes}:{classes:PublicEnrollmentClass[]}=await response.json();
    return new Map(classes.map(row=>[row.id,row]));
  })().finally(()=>{catalogRequest=undefined;});
}

export function ChatEnrollmentGuide({action,language,entry,origin,anchor,comparison,cards=false}:{
  action:EnrollmentGuideAction;language:string;entry:ChatSource;origin?:ChatOrigin;anchor?:ChatMessageAnchor;
  comparison?:ReturnType<typeof sharedEnrollmentComparison>;cards?:boolean;
}){
  const {search}=useLocation();
  const navigate=useNavigate();
  const rows=action.rows;
  const linkOnly=action.linkOnlyClassIds;
  const [catalog,setCatalog]=useState<Map<string,PublicEnrollmentClass>>();
  useEffect(()=>{
    if(!cards||!rows?.some(row=>!linkOnly?.includes(row.id)&&(row.sessions===undefined||row.opened===undefined)))return;
    let active=true;
    void readPublicClasses().then(result=>{if(active)setCatalog(result);},()=>{});
    return ()=>{active=false;};
  },[cards,rows,linkOnly]);
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
  const classHref=(id:string)=>enrollmentGuideHref({...action,kind:'class',classId:id},lang,'ai_chat',source);
  if(comparison){
    const {rows:[first,second],plan,periods}=comparison;
    const perPeriod=formatCurrency(Math.round(first.price/periods),lang);
    const approximate=first.price%periods!==0;
    const showFirstTime=action.detailFields?.includes('first')||first.firstLesson.slice(11)!==second.firstLesson.slice(11);
    const dateFormat=new Intl.DateTimeFormat({zh:'zh-CN',en:'en-GB',id:'id-ID'}[lang],{
      ...(first.firstLesson.slice(0,4)!==second.firstLesson.slice(0,4)?{year:'numeric'}:{}),month:'short',day:'numeric',timeZone:'Asia/Jakarta',
    });
    return <div className="chat-comparison">
      <dl className="chat-comparison-facts">
        <div><dt>{t('课表（WIB）','Schedule (WIB)','Jadwal (WIB)')}</dt>
          <dd className="chat-comparison-schedule"><ChatClassSchedule row={first} language={lang}/></dd></div>
        <div><dt>{t('全程学费','Total tuition','Total biaya')}</dt>
          <dd><strong className="chat-comparison-price chat-value">{formatCurrency(first.price,lang)}</strong>
            <span>{t(approximate?'平均每节约':'每节',approximate?'About':'',approximate?'Sekitar':'')} <span className="chat-value">{perPeriod}</span>{t('',' per period',' per jam pelajaran')}</span>
            {first.standardPrice&&first.standardPrice>first.price&&(action.inspection||action.detailFields?.includes('price'))?
              <span>{t('标准总价','Standard total','Total harga normal')} <del className="chat-value">{formatCurrency(first.standardPrice,lang)}</del></span>:null}
          </dd></div>
      </dl>
      <p className="chat-comparison-duration">{t(`共 ${periods} 节 · 每次上 ${plan.lessons} 节（${plan.lessons*first.minutes} 分钟）`,
        `${periods} periods total · ${plan.lessons} per session (${plan.lessons*first.minutes} min)`,
        `Total ${periods} jam pelajaran · ${plan.lessons} per sesi (${plan.lessons*first.minutes} menit)`)}</p>
      <div className="chat-class-options" role="group" aria-label={t('选择要查看的班次','Choose a class to view','Pilih kelas untuk dilihat')}>
        {comparison.rows.map(row=>{
          const date=dateFormat.format(enrollmentInstant(row.firstLesson)!);
          const firstSession=showFirstTime?`${date} ${row.firstLesson.slice(11)} WIB`:date;
          return <Link key={row.id} to={classHref(row.id)} className="chat-class-option" onClick={onClick}
            aria-label={t(`查看第 ${row.batchNumber} 期，首课 ${firstSession}`,`View batch ${row.batchNumber}, first session ${firstSession}`,`Lihat angkatan ${row.batchNumber}, kelas pertama ${firstSession}`)}>
            <span className="chat-class-option-info">
              <span>{t(`第 ${row.batchNumber} 期首课`,`Batch ${row.batchNumber} · First session`,`Angkatan ${row.batchNumber} · Kelas pertama`)}</span>
              <time dateTime={`${row.firstLesson}+07:00`}><strong className="chat-value">{date}</strong>{showFirstTime&&<small className="chat-value">{row.firstLesson.slice(11)} WIB</small>}</time>
            </span>
            <span className="chat-class-option-action">{t('查看','View','Lihat')}</span>
          </Link>;
        })}
      </div>
    </div>;
  }
  if(cards&&rows?.length)return <div className="not-prose enrollment-class-grid" data-enrollment-card-group>
    {rows.filter(row=>!linkOnly?.includes(row.id)).map(snapshot=>{
      const current=(snapshot.sessions===undefined||snapshot.opened===undefined)?catalog?.get(snapshot.id):undefined;
      const row=current??snapshot;
      const titleLink=classHref(row.id);
      return <EnrollmentClassPreview key={row.id} row={row} language={lang} titleLink={titleLink} chatPresentation chatPrimaryAction={rows.length===1}
        actionLink={action.inspection||action.intakePaused||action.question==='view_without_contact'||!row.price?undefined:titleLink+'&apply=1'}
        intakePaused={action.intakePaused} availabilitySnapshot={!current} onNavigate={onClick}/>;
    })}
  </div>;
  if(rows?.length){
    const showBatch=rows.length>1&&new Set(rows.map(row=>row.batchNumber)).size===rows.length&&
      rows.every(row=>row.level===rows[0].level&&row.format===rows[0].format&&row.period===rows[0].period&&
        Number.isSafeInteger(row.batchNumber)&&Number(row.batchNumber)>0);
    const shortTitle=(row:typeof rows[number])=>enrollmentClassTitle({...row,period:undefined},lang);
    const distinctShortTitles=new Set(rows.map(shortTitle)).size===rows.length;
    return <div className="chat-class-links">{rows.filter(row=>linkOnly?.includes(row.id)).map(row=>{
      const title=enrollmentClassTitle(row,lang);
      const target=distinctShortTitles?shortTitle(row):title;
      const label=rows.length===1?t('查看班次','View class','Lihat kelas'):
        showBatch?t(`查看第 ${row.batchNumber} 期`,`View batch ${row.batchNumber}`,`Lihat angkatan ${row.batchNumber}`):
        t(`查看 ${target}`,`View ${target}`,`Lihat ${target}`);
      return <Link key={row.id} className="chat-enrollment-next" to={classHref(row.id)}
        aria-label={label.includes(title)?undefined:`${label} · ${title}`} onClick={onClick}>{label}</Link>;
    })}</div>;
  }
  const primary=action.kind==='demand'||action.kind==='records'||enrollmentAppointmentRequested(action);
  return <Link className={`chat-enrollment-next${primary?' chat-enrollment-next--primary':''}`} to={enrollmentGuideHref(action,lang,'ai_chat',source)} onClick={onClick}>
    {action.kind==='demand'?t('登记选课需求','Submit course preferences','Kirim preferensi kursus'):
     action.kind==='advisor'?t('咨询 UPER','Ask UPER','Tanya UPER'):
     enrollmentAppointmentRequested(action)?t('联系 UPER 约课','Arrange one-to-one lessons','Atur jadwal kelas privat'):
     (action.kind==='records'||action.kind==='paused'&&action.recordsAvailable)?t('我的报名','My enrollments','Pendaftaran saya'):
     action.kind==='catalog'&&action.level&&action.period==='weekend'&&!action.levelUnavailable
        ? t(`查看 ${action.level} 周末班`,`View weekend ${action.level} classes`,`Lihat kelas akhir pekan ${action.level}`):
     action.kind==='catalog'&&action.question==='apply'&&!action.levelUnavailable?t('查看可报名班次','View open classes','Lihat kelas yang terbuka'):
     action.kind==='viewing'?t('查看课表','View schedules','Lihat jadwal'):
     t('查看课程与报名','View courses and enrollment','Lihat kursus dan pendaftaran')}
  </Link>;
}
