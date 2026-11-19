import {useEffect,useState} from 'react';
import {AdminDisclosure} from '../admin/AdminDisclosure';
import {AdminRowAction} from '../admin/AdminListControl';
import {AdminListState} from '../admin/AdminList';
import {AdminFormGrid} from '../AdminFormLayout';
import {enrollmentClassTitle,enrollmentFormats,enrollmentLevels,enrollmentPeriods,type PublicEnrollmentClass} from '../../utils/enrollmentCatalog';
import {enrollmentGuideHref,enrollmentGuideText,type EnrollmentGuideAction,type EnrollmentGuideLanguage} from '../../utils/enrollmentGuidance';
import {interestOption} from '../EnrollmentInterests';
import {CrmSingleSelect} from './CrmSingleSelect';

export function CrmEnrollmentContactLink({lang,language,isLight,disabled,onInsert}:{
  lang:EnrollmentGuideLanguage;language:string;isLight:boolean;disabled:boolean;onInsert:(text:string)=>void;
}){
  const t=(zh:string,en:string,id:string)=>enrollmentGuideText(lang,zh,en,id);
  const [open,setOpen]=useState(false),[attempt,setAttempt]=useState(0);
  const [data,setData]=useState<{classes:PublicEnrollmentClass[];publicOrigin?:string}>();
  const [failed,setFailed]=useState(false);
  const [kind,setKind]=useState<'catalog'|'class'|'demand'>('catalog');
  const [level,setLevel]=useState(''),[period,setPeriod]=useState(''),[format,setFormat]=useState(''),[classId,setClassId]=useState('');
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    setFailed(false);
    fetch('/api/enrollment/classes',{signal:controller.signal,cache:'no-store'}).then(async response=>{
      if(!response.ok)throw Error();
      const result=await response.json();
      if(!Array.isArray(result.classes))throw Error();
      if(!controller.signal.aborted)setData(result);
    }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return ()=>controller.abort();
  },[open,attempt]);
  const selected=data?.classes.find(row=>row.id===classId);
  const origin=['localhost','127.0.0.1'].includes(window.location.hostname)?window.location.origin:data?.publicOrigin;
  const languageReady=language==='zh'||language==='en'||language==='id';
  function insert(){
    if(!origin||!languageReady||disabled||failed||(kind==='class'&&!selected))return;
    const action:EnrollmentGuideAction=selected&&kind==='class'
      ?{kind:selected.availability==='full'?'waitlist':'class',classId:selected.id,level:selected.level}
      :{kind,level,period,format};
    const url=new URL(enrollmentGuideHref(action,language,'whatsapp'),origin).href;
    const copy=action.kind==='waitlist'
      ?['这个班目前已满。你可以在这里查看最新余位和候补安排。','This class is currently full. You can check the latest availability and waitlist here.','Kelas ini saat ini penuh. Cek ketersediaan terbaru dan daftar tunggunya di sini.']
      :action.kind==='class'?['这里可以查看这个班的课表、学费和报名状态。','You can see this class’s schedule, fee, and enrollment status here.','Lihat jadwal, biaya, dan status pendaftaran kelas ini di sini.']
      :action.kind==='demand'?['如果现有班次不合适，可以在这里提交选课需求。','If the current classes don’t fit, you can share your preferences here.','Jika jadwal yang tersedia kurang cocok, sampaikan preferensimu di sini.']
      :['你可以在这里查看 UPER 的课程与报名班次。','You can browse UPER courses and available classes here.','Lihat kursus dan pilihan kelas UPER di sini.'];
    onInsert(enrollmentGuideText(language,copy[0],copy[1],copy[2])+'\n'+url);
  }
  const select=(label:string,value:string,choices:{value:string;label:string}[],onChange:(value:string)=>void)=>
    <CrmSingleSelect {...{label,value,onChange,lang,isLight,disabled}} options={choices}/>;
  const optional=(label:string,values:readonly string[])=>[{value:'',label},...values.map(value=>({value,label:interestOption(lang,value)}))];
  return <AdminDisclosure heading={t('加入报名链接','Add enrollment link','Tambahkan tautan pendaftaran')} density="compact" onToggle={event=>setOpen(event.currentTarget.open)}>
    {failed?<AdminListState lang={lang} state="error" onRetry={()=>setAttempt(value=>value+1)}/>:
      !data&&open?<AdminListState lang={lang} state="loading"/>:data&&<>
      <AdminFormGrid>
        <label>{t('报名入口','Enrollment destination','Tujuan pendaftaran')}{select(t('报名入口','Enrollment destination','Tujuan pendaftaran'),kind,[
          {value:'catalog',label:t('课程目录','Course catalog','Katalog kursus')},
          {value:'class',label:t('具体班次','Specific class','Kelas tertentu')},
          {value:'demand',label:t('登记选课需求','Course preferences','Preferensi kursus')},
        ],value=>setKind(value as typeof kind))}</label>
        {kind==='class'?<label>{t('班次','Class','Kelas')}{select(t('班次','Class','Kelas'),classId,[
          {value:'',label:t('选择班次','Select a class','Pilih kelas')},
          ...data.classes.map(row=>({value:row.id,label:enrollmentClassTitle(row,lang)})),
        ],setClassId)}</label>:<>
          <label>{t('级别','Level','Level')}{select(t('级别','Level','Level'),level,optional(t('不限','Any','Semua'),enrollmentLevels),setLevel)}</label>
          <label>{t('上课时段','Time slot','Waktu kelas')}{select(t('上课时段','Time slot','Waktu kelas'),period,optional(t('不限','Any','Semua'),enrollmentPeriods),setPeriod)}</label>
          <label>{t('班型','Class type','Jenis kelas')}{select(t('班型','Class type','Jenis kelas'),format,optional(t('不限','Any','Semua'),enrollmentFormats),setFormat)}</label>
        </>}
      </AdminFormGrid>
      {!origin&&<p role="status">{t('公开域名尚未配置。','Public website origin is not configured.','Alamat situs publik belum dikonfigurasi.')}</p>}
      <AdminRowAction disabled={disabled||!origin||!languageReady||(kind==='class'&&!selected)} onClick={insert}>
        {t('插入文案和链接','Insert message and link','Sisipkan pesan dan tautan')}
      </AdminRowAction>
    </>}
  </AdminDisclosure>;
}
