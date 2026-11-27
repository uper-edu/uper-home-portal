import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import {BookOpen,CalendarCheck,Layers,Users} from 'lucide-react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {AdminHeader,AdminModuleLink,adminText} from '../components/AdminHeader';
import {AdminDiscardDialog} from '../components/admin/AdminDiscardDialog';
import {PageMetadata} from '../components/PageMetadata';
import CrmAccess,{type CrmEmployee} from '../components/CrmAccess';
import {CrmEnrollmentSettings} from '../components/crm/CrmEnrollmentSettings';
import {academicSections,enrollmentSettingsPath,resolveEnrollmentSettingsTopic} from '../components/crm/operationsSections';
import {canManageAcademics,canReadFacultyCompensation} from '../utils/accessControl';
import {canViewEnrollmentManagement,enrollmentSettingsReturnPath} from '../utils/crmEnrollmentManagement';
import {useAdminTheme} from '../utils/adminPreferences';
import {guardAdminWorkspaceHistory} from '../utils/adminWorkspaceHistory';
import type {CrmLanguage} from '../utils/crmLanguage';
import '../components/admin-workspace.css';
import '../components/crm/crm-detail-workspace.css';

const topicIcons={courses:BookOpen,'enrollment-templates':Layers,'enrollment-classes':CalendarCheck,faculty:Users};

function AcademicWorkspace({employee,lang,setLang}:{employee:CrmEmployee;lang:CrmLanguage;setLang:(lang:CrmLanguage)=>void}){
  const {isLight,toggleTheme}=useAdminTheme();
  const navigate=useNavigate();
  const {search}=useLocation();
  const dirty=useRef(false);
  const setDirty=useCallback((value:boolean)=>{dirty.current=value;},[]);
  const [destination,setDestination]=useState<string>();
  const accepted=useRef({url:window.location.href,state:window.history.state});
  const allowed=canManageAcademics(employee);
  const finance=canReadFacultyCompensation(employee);
  const params=new URLSearchParams(search);
  const topic=resolveEnrollmentSettingsTopic(params);
  const hasAccess=allowed||finance&&topic==='faculty';
  const returnTo=enrollmentSettingsReturnPath(params.get('enrollmentReturn'));
  const t=(en:string,id:string,zh:string)=>adminText(lang,en,id,zh);
  const go=(href:string)=>{
    const target=new URL(href,window.location.origin);
    setDirty(false);
    navigate(target.pathname+target.search+target.hash);
    accepted.current={url:window.location.href,state:window.history.state};
  };
  const onNavigate=(href:string)=>{
    if(dirty.current)setDestination(href);
    else go(href);
  };
  const lastTopic=useRef(topic);
  useLayoutEffect(()=>{
    if(lastTopic.current===topic)return;
    lastTopic.current=topic;
    window.scrollTo({top:0,behavior:'instant'});
  },[topic]);
  useLayoutEffect(()=>{
    const restore=(event:PopStateEvent)=>{
      if(dirty.current&&window.location.href!==accepted.current.url){
        const requested=window.location.href;
        event.stopImmediatePropagation();
        window.history.pushState(accepted.current.state,'',accepted.current.url);
        setDestination(requested);
      }else if(window.location.pathname==='/academics'){
        accepted.current={url:window.location.href,state:window.history.state};
      }
    };
    const beforeUnload=(event:BeforeUnloadEvent)=>{
      if(dirty.current){event.preventDefault();event.returnValue='';}
    };
    const clearGuard=guardAdminWorkspaceHistory(restore);
    window.addEventListener('beforeunload',beforeUnload);
    return ()=>{
      clearGuard();
      window.removeEventListener('beforeunload',beforeUnload);
    };
  },[]);
  return <div data-admin-workspace="academics" data-theme={isLight?'light':'dark'} className={`min-h-screen flex flex-col ${isLight?'bg-[#f5f5f7] text-slate-900':'bg-slate-950 text-slate-100'}`}>
    <PageMetadata lang={lang} options={{module:topic,state:hasAccess?undefined:'denied'}}/>
    <a className="admin-skip-link" href="#academic-main">{t('Skip to workspace','Lewati ke ruang kerja','跳到工作区')}</a>
    <AdminHeader workspace="academics" {...{employee,lang,setLang,isLight,toggleTheme}} onWorkspaceNavigate={onNavigate}
      navigation={(allowed||finance)&&academicSections.filter(section=>allowed||section.id==='faculty').map(({id,title})=>{
        const Icon=topicIcons[id];
        const current=id===topic;
        return <AdminModuleLink key={id} href={enrollmentSettingsPath(id,{returnTo})} current={current}
          onNavigate={!current||id==='faculty'&&params.has('facultyId')?onNavigate:undefined}>
          <Icon size={16} aria-hidden="true"/>{title[lang==='zh'?2:lang==='id'?1:0]}
        </AdminModuleLink>;
      })}/>
    <main id="academic-main" tabIndex={-1} className="admin-workspace-main flex-1">
      {hasAccess?<CrmEnrollmentSettings {...{lang,isLight,allowed,finance,params,onNavigate}}
        canSales={canViewEnrollmentManagement(employee)} onEditorDraftChange={setDirty}/>:<>
        <h1>{t('Academic management access denied','Tidak memiliki akses manajemen akademik','无教务管理访问权限')}</h1>
        {employee.permissions.includes('crm.read')&&<Link to="/crm">{t('Sales management','Manajemen penjualan','销售管理')}</Link>}
      </>}
    </main>
    {destination&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDestination(undefined)} onDiscard={()=>{
      setDestination(undefined);
      go(destination);
    }}/>}
  </div>;
}

export default function AcademicWorkbench(){
  return <CrmAccess workspace="academics">
    {(employee,lang,setLang)=><AcademicWorkspace key={employee.id} {...{employee,lang,setLang}}/>}
  </CrmAccess>;
}
