import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useEffect,useRef,useState,type MouseEvent} from 'react';
import {enrollmentClassLookupLimit,enrollmentClassTitle,enrollmentInstant,type PublicEnrollmentClass} from '../utils/enrollmentCatalog';
import {ChatClassSchedule,EnrollmentClassPreview} from './EnrollmentClassPreview';
import {enrollmentAppointmentRequested,enrollmentGuideHref,enrollmentGuideText,type sharedEnrollmentComparison,type EnrollmentGuideAction,type EnrollmentGuideLanguage} from '../utils/enrollmentGuidance';
import {trackEvent} from '../utils/analytics';
import {chatPromotionParams,type ChatOrigin,type ChatSource} from '../services/portalChat';
import {isPlainLinkClick,rememberChat,type ChatMessageAnchor} from '../utils/chatJourneyNavigation';
import {formatCurrency} from '../utils/currency';
import {enrollmentDateFormatter,enrollmentTimeZoneLabel} from '../utils/enrollmentDateFormat';
import {preloadEnrollmentNavigation,readEnrollmentClassDetails} from '../services/enrollmentClassDetails';
import {loadEnrollmentIntake} from '../services/enrollmentFormModule';
import {watchReadReconnect} from '../services/readReconnect';

type ClassCatalog=Map<string,PublicEnrollmentClass>;
type ClassBatchResult={rows:PublicEnrollmentClass[];temporaryFailure:boolean};
type CatalogBatch={ids:Set<string>;request:Promise<ClassBatchResult>;controller:AbortController;readers:number};
const inFlightClasses=new Map<string,CatalogBatch>();
let pendingCatalog:CatalogBatch|undefined;
function prepareCatalogBatch(){
  const ids=new Set<string>();
  const controller=new AbortController();
  // Nearby cards may enter the viewport in separate observer callbacks.
  const request=new Promise<void>(resolve=>setTimeout(resolve,32)).then(async()=>{
    if(pendingCatalog===batch)pendingCatalog=undefined;
    if(controller.signal.aborted)return {rows:[],temporaryFailure:false};
    if(navigator.onLine===false)return {rows:[],temporaryFailure:true};
    let temporaryFailure=false;
    const rows=await readEnrollmentClassDetails([...ids],AbortSignal.any([controller.signal,AbortSignal.timeout(8000)]),{
      onTemporaryFailure:()=>{temporaryFailure=true;},
    });
    return {rows,temporaryFailure};
  }).finally(()=>forgetCatalogBatch(batch));
  const batch:CatalogBatch={ids,request,controller,readers:0};
  return batch;
}
function forgetCatalogBatch(batch:CatalogBatch) {
  if(pendingCatalog===batch)pendingCatalog=undefined;
  for(const id of batch.ids){
    if(inFlightClasses.get(id)===batch)inFlightClasses.delete(id);
  }
}
function releaseCatalogBatch(batch:CatalogBatch) {
  batch.readers--;
  if(batch.readers)return;
  // React can replace one reader with another during the same render.
  queueMicrotask(()=>{
    if(batch.readers)return;
    forgetCatalogBatch(batch);
    batch.controller.abort();
  });
}
function readPublicClasses(ids:string[],onBatch:(rows:PublicEnrollmentClass[])=>void,onSettled:(temporaryFailure:boolean)=>void){
  const requested=new Set(ids);
  const batches=new Set<CatalogBatch>();
  for(const id of requested){
    let batch=inFlightClasses.get(id);
    if(!batch){
      if(!pendingCatalog||pendingCatalog.ids.size===enrollmentClassLookupLimit)pendingCatalog=prepareCatalogBatch();
      batch=pendingCatalog;
      batch.ids.add(id);
      inFlightClasses.set(id,batch);
    }
    batches.add(batch);
  }
  let active=true;
  let failed=false;
  for(const batch of batches){
    batch.readers++;
    void batch.request.then(result=>{
      batches.delete(batch);
      if(!active)return;
      failed ||= result.temporaryFailure;
      onBatch(result.rows.filter(row=>requested.has(row.id)));
      if(!batches.size)onSettled(failed);
    },()=>{
      batches.delete(batch);
      if(active&&!batches.size)onSettled(failed);
    });
  }
  return ()=>{
    active=false;
    for(const batch of batches)releaseCatalogBatch(batch);
    batches.clear();
  };
}

export function ChatEnrollmentGuide({action,language,entry,origin,anchor,comparison,cards=false,active=true}:{
  action:EnrollmentGuideAction;language:string;entry:ChatSource;origin?:ChatOrigin;anchor?:ChatMessageAnchor;
  comparison?:ReturnType<typeof sharedEnrollmentComparison>;cards?:boolean;active?:boolean;
}){
  const {search}=useLocation();
  const navigate=useNavigate();
  const rows=action.rows;
  const linkOnly=action.linkOnlyClassIds;
  const missingClassKey=cards&&rows ? JSON.stringify([...new Set(rows
    .filter(row=>!linkOnly?.includes(row.id)&&(row.sessions===undefined||row.opened===undefined))
    .map(row=>row.id))].sort()) : '[]';
  const [catalog,setCatalog]=useState<{key:string;rows:ClassCatalog}>();
  const receivedClasses=useRef<typeof catalog>(undefined);
  const cardGroup=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!active)return;
    if(receivedClasses.current?.key!==missingClassKey)receivedClasses.current={key:missingClassKey,rows:new Map()};
    const collected=receivedClasses.current.rows;
    const ids=JSON.parse(missingClassKey) as string[];
    if(ids.every(id=>collected.has(id)))return;
    let disposed=false;
    let unsubscribe:(()=>void)|undefined;
    let reconnect:ReturnType<typeof watchReadReconnect>|undefined;
    const load=()=>{
      if(disposed||unsubscribe)return;
      const missing=ids.filter(id=>!collected.has(id));
      if(!missing.length)return;
      reconnect??=watchReadReconnect(load,{foregroundOnly:true});
      unsubscribe=readPublicClasses(missing,result=>{
        if(!result.length)return;
        for(const row of result)collected.set(row.id,row);
        setCatalog({key:missingClassKey,rows:new Map(collected)});
      },temporaryFailure=>{
        unsubscribe=undefined;
        if(temporaryFailure)reconnect?.failed();
        else reconnect?.stop();
      });
    };
    let timer:ReturnType<typeof setTimeout>|undefined;
    const group=cardGroup.current;
    const observer=group && typeof IntersectionObserver==='function' ? new IntersectionObserver(([visibility])=>{
      clearTimeout(timer);
      if(visibility.isIntersecting)timer=setTimeout(()=>{
        observer?.disconnect();
        load();
      },150);
    },{rootMargin:'200px 0px'}) : undefined;
    if(observer&&group)observer.observe(group);
    else load();
    return ()=>{disposed=true;unsubscribe?.();reconnect?.stop();observer?.disconnect();clearTimeout(timer);};
  },[missingClassKey,active]);
  const lang:EnrollmentGuideLanguage=action.replyLanguage??(language.startsWith('zh')?'zh':language.startsWith('id')?'id':'en');
  const t=(zh:string,en:string,id:string)=>enrollmentGuideText(lang,zh,en,id);
  const source=chatPromotionParams(origin ?? {source:entry},search);
  function onClick(event:MouseEvent<HTMLAnchorElement>) {
    trackEvent('link_click',{target:'enrollment',entry_point:entry});
    if (!isPlainLinkClick(event)) return;
    const url = new URL(event.currentTarget.href);
    if (url.origin !== location.origin) return;
    preloadEnrollmentNavigation(url);
    if ((/^\/enrollment\/[a-zA-Z0-9-]{1,64}\/?$/.test(url.pathname)&&url.searchParams.get('apply')==='1') ||
      ['/enrollment/interest','/enrollment/mine'].includes(url.pathname)) void loadEnrollmentIntake().catch(()=>{});
    if (!anchor) return;
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
    const dateFormat=enrollmentDateFormatter(lang,
      first.firstLesson.slice(0,4)!==second.firstLesson.slice(0,4)?'shortDayWithYear':'shortDay',first.timeZone);
    const zoneLabel=enrollmentTimeZoneLabel(first.timeZone);
    return <div className="chat-comparison">
      <dl className="chat-comparison-facts">
        <div><dt>{t(`课表（${zoneLabel}）`,`Schedule (${zoneLabel})`,`Jadwal (${zoneLabel})`)}</dt>
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
          const starts=enrollmentInstant(row.firstLesson,row.timeZone)!;
          const date=dateFormat.format(starts);
          const firstSession=showFirstTime?`${date} ${row.firstLesson.slice(11)} ${zoneLabel}`:date;
          return <Link key={row.id} to={classHref(row.id)} className="chat-class-option" onClick={onClick}
            aria-label={t(`查看第 ${row.batchNumber} 期，首课 ${firstSession}`,`View batch ${row.batchNumber}, first session ${firstSession}`,`Lihat angkatan ${row.batchNumber}, kelas pertama ${firstSession}`)}>
            <span className="chat-class-option-info">
              <span>{t(`第 ${row.batchNumber} 期首课`,`Batch ${row.batchNumber} · First session`,`Angkatan ${row.batchNumber} · Kelas pertama`)}</span>
              <time dateTime={starts.toISOString()}><strong className="chat-value">{date}</strong>{showFirstTime&&<small className="chat-value">{row.firstLesson.slice(11)} {zoneLabel}</small>}</time>
            </span>
            <span className="chat-class-option-action">{t('查看','View','Lihat')}</span>
          </Link>;
        })}
      </div>
    </div>;
  }
  if(cards&&rows?.length)return <div ref={cardGroup} className="not-prose enrollment-class-grid" data-enrollment-card-group>
    {rows.filter(row=>!linkOnly?.includes(row.id)).map(snapshot=>{
      const current=catalog?.key===missingClassKey&&(snapshot.sessions===undefined||snapshot.opened===undefined)
        ?catalog.rows.get(snapshot.id):undefined;
      const row=current??snapshot;
      const titleLink=classHref(row.id);
      return <EnrollmentClassPreview key={row.id} row={row} language={lang} titleLink={titleLink} chatPresentation chatPrimaryAction={rows.length===1}
        actionLink={action.inspection||action.intakePaused||action.question==='view_without_contact'||!row.price?undefined:titleLink+'&apply=1'}
        intakeStatus={action.intakePaused?'paused':undefined} availabilitySnapshot={!current} onNavigate={onClick}/>;
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
