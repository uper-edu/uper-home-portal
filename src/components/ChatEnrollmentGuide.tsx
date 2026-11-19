import {useLocation} from 'react-router-dom';
import {useEffect,useState} from 'react';
import type {PublicEnrollmentClass} from '../utils/enrollmentCatalog';
import {EnrollmentClassPreview} from './EnrollmentClassPreview';
import {enrollmentAppointmentRequested,enrollmentGuideHref,enrollmentGuideText,type EnrollmentGuideAction,type EnrollmentGuideLanguage} from '../utils/enrollmentGuidance';
import {trackEvent} from '../utils/analytics';

let catalogRequest:Promise<Map<string,PublicEnrollmentClass>>|undefined;
function readPublicClasses(){
  return catalogRequest??=(async()=>{
    const response=await fetch('/api/enrollment/classes',{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('Class catalog unavailable');
    const {classes}:{classes:PublicEnrollmentClass[]}=await response.json();
    return new Map(classes.map(row=>[row.id,row]));
  })().finally(()=>{catalogRequest=undefined;});
}

export function ChatEnrollmentGuide({action,language,entry}:{action?:EnrollmentGuideAction;language:string;entry:'standalone_chat'|'homepage_widget'}){
  const {search}=useLocation();
  const rows=action?.rows;
  const [catalog,setCatalog]=useState<Map<string,PublicEnrollmentClass>>();
  useEffect(()=>{
    if(!rows?.some(row=>row.sessions===undefined||row.opened===undefined))return;
    let active=true;
    void readPublicClasses().then(result=>{if(active)setCatalog(result);},()=>{});
    return ()=>{active=false;};
  },[rows]);
  if(!action)return null;
  const lang:EnrollmentGuideLanguage=language.startsWith('zh')?'zh':language.startsWith('id')?'id':'en';
  const t=(zh:string,en:string,id:string)=>enrollmentGuideText(lang,zh,en,id);
  const source=new URLSearchParams(search);
  if(entry==='homepage_widget'&&!source.has('entry_point'))source.set('entry_point',entry);
  const onClick=()=>trackEvent('link_click',{target:'enrollment',entry_point:entry});
  const linkClass='inline-flex min-h-11 items-center rounded-lg font-semibold text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2';
  if(rows?.length)return <div className="not-prose enrollment-class-grid mt-3" data-enrollment-card-group>
    {rows.map(snapshot=>{
      const current=(snapshot.sessions===undefined||snapshot.opened===undefined)?catalog?.get(snapshot.id):undefined;
      const row=current??snapshot;
      const titleLink=enrollmentGuideHref({...action,kind:'class',classId:row.id},lang,'ai_chat',source);
      return <EnrollmentClassPreview key={row.id} row={row} language={lang} titleLink={titleLink}
        actionLink={action.inspection||action.question==='view_without_contact'?undefined:titleLink+'&apply=1'} availabilitySnapshot={!current} onNavigate={onClick}/>;
    })}
  </div>;
  return <a className={linkClass} href={enrollmentGuideHref(action,lang,'ai_chat',source)} onClick={onClick}>
    {action.kind==='demand'?t('登记选课需求','Submit course preferences','Kirim preferensi kursus'):
     action.kind==='advisor'?t('咨询 UPER','Ask UPER','Tanya UPER'):
     enrollmentAppointmentRequested(action)?t('联系 UPER 约课','Arrange one-to-one lessons','Atur jadwal kelas privat'):
     action.kind==='records'?t('我的报名','My enrollments','Pendaftaran saya'):
     action.kind==='viewing'?t('查看课表','View schedules','Lihat jadwal'):
     t('查看课程与报名','View courses and enrollment','Lihat kursus dan pendaftaran')}
  </a>;
}
