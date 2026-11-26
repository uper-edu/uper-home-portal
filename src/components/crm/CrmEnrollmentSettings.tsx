import {EnrollmentMailWorkspace} from '../EnrollmentMailWorkspace';
import {BookOpen, Layers, CalendarCheck, Clock3, Mail, Users} from 'lucide-react';
import {lazy,Suspense} from 'react';
import {AdminTopicFrame} from '../AdminTopicFrame';
import {AdminListState} from '../admin/AdminList';
import {AdminRecordBack} from '../admin/AdminRecordHeader';
import {AdminPageHeader} from '../admin/AdminPageHeader';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {facultyIdPattern} from '../../utils/crmFaculty';
import {enrollmentSettingsReturnPath} from '../../utils/crmEnrollmentManagement';
import {CrmEnrollmentTemplates} from './CrmEnrollmentTemplates';
import {CrmCourses} from './CrmCourses';
import {CrmEnrollmentClasses} from './CrmEnrollmentClasses';
import {CrmEnrollmentRules} from './CrmEnrollmentRules';
import {enrollmentSettingSections, enrollmentSettingsPath, resolveEnrollmentSettingsTopic} from './operationsSections';

const Faculty=lazy(()=>import('./CrmFaculty').then(module=>({default:module.CrmFaculty})));
const topicIcons={courses:BookOpen,'enrollment-templates':Layers,'enrollment-classes':CalendarCheck,faculty:Users,'enrollment-rules':Clock3,'enrollment-mail':Mail};

export function CrmEnrollmentSettings({lang,isLight,allowed,finance,params,rulesDirty,onRulesDraftChange,onEditorDraftChange,onNavigate}:{
  lang:CrmLanguage;isLight:boolean;allowed:boolean;finance:boolean;params:URLSearchParams;rulesDirty:boolean;
  onRulesDraftChange:(dirty:boolean)=>void;onEditorDraftChange:(dirty:boolean)=>void;onNavigate:(href:string)=>void;
}){
  const index=lang==='zh'?2:lang==='id'?1:0;
  const title=['Course and class settings','Pengaturan kursus dan kelas','课程与班次设置'][index];
  const topic=resolveEnrollmentSettingsTopic(params);
  const classId=topic==='enrollment-classes'?params.get('enrollmentClass')??undefined:undefined;
  const facultyParam=topic==='faculty'?params.get('facultyId'):null;
  const facultyId=facultyParam&&facultyIdPattern.test(facultyParam)?facultyParam:undefined;
  const returnTo=enrollmentSettingsReturnPath(params.get('enrollmentReturn'));
  const facultyList=enrollmentSettingsPath('faculty',{returnTo});
  const back=allowed?returnTo??'/crm?tab=enrollment-management':'/crm?tab=dashboard&dashboardTopic=economics';
  const backLabel=!allowed?['Back to course economics','Kembali ke hasil kursus','返回课程收益'][index]:new URLSearchParams(back.split('?')[1]).has('classId')
    ?['Back to class roster','Kembali ke daftar siswa','返回班次名单'][index]
    :['Back to enrollment management','Kembali ke pengelolaan pendaftaran','返回报名管理'][index];
  return <section className="crm-ops-workspace-sample" data-theme={isLight?'light':'dark'}>
    {!facultyId&&<AdminPageHeader className="enrollment-settings-heading" title={title}
      subtitle={['Manage courses, class templates, schedules and enrollment settings.','Kelola kursus, templat kelas, jadwal, dan pengaturan pendaftaran.','维护课程、班型模板和班次安排，设置报名规则及招生邮件。'][index]}
      actions={<AdminRecordBack target={{label:backLabel,onClick:()=>onNavigate(back)}}/>}/>}
    {allowed||finance&&topic==='faculty'?<AdminTopicFrame label={title} selection={topic} navigation={
      <nav className="crm-ops-nav" aria-label={title}>
        {enrollmentSettingSections.filter(({id})=>allowed||id==='faculty').map(({id,title:label})=>{
          const Icon=topicIcons[id];
          return <button key={id} type="button" aria-current={id===topic?'page':undefined}
            onClick={()=>{if(id!==topic||facultyId&&id==='faculty')onNavigate(enrollmentSettingsPath(id,{returnTo}));}}>
            <Icon size={16} aria-hidden="true"/>{label[index]}
            {id==='enrollment-rules'&&rulesDirty&&<span aria-label={['Unsaved changes','Perubahan belum disimpan','有未保存修改'][index]}> ●</span>}
          </button>;
        })}
      </nav>
    }>
      <div className="crm-ops-content">
        {topic==='courses'&&<CrmCourses lang={lang} isLight={isLight} onDraftChange={onEditorDraftChange}
          onCreateTemplate={createFromCourse=>onNavigate(enrollmentSettingsPath('enrollment-templates',{returnTo,createFromCourse}))}/>}
        {topic==='enrollment-templates'&&<CrmEnrollmentTemplates lang={lang} isLight={isLight} selected={params.get('enrollmentTemplate')??undefined}
          createFromCourse={params.get('createFromCourse')??undefined}
          onCreateClass={createFrom=>onNavigate(enrollmentSettingsPath('enrollment-classes',{returnTo,createFrom}))} onDraftChange={onEditorDraftChange}/>}
        {topic==='enrollment-classes'&&<CrmEnrollmentClasses key={classId??'all'} lang={lang} isLight={isLight} target={classId} createFrom={params.get('createFromTemplate')??undefined} onDraftChange={onEditorDraftChange}
          onShowAll={()=>onNavigate(enrollmentSettingsPath(topic,{returnTo}))}/>}
        {topic==='enrollment-mail'&&<EnrollmentMailWorkspace lang={lang} isLight={isLight} onDraft={onEditorDraftChange}/>}
        {topic==='faculty'&&<Suspense fallback={<AdminListState lang={lang} state="loading"/>}>
          <Faculty lang={lang} isLight={isLight} canEdit={allowed} canRates={finance} onDraftChange={onEditorDraftChange}
            selectedId={facultyId} listHref={facultyList} recordHref={id=>enrollmentSettingsPath('faculty',{returnTo,facultyId:id})}
            onNavigate={onNavigate}/>
        </Suspense>}
        {allowed&&<div hidden={topic!=='enrollment-rules'}>
          <CrmEnrollmentRules lang={lang} isLight={isLight} active={topic==='enrollment-rules'} onDraftChange={onRulesDraftChange}/>
        </div>}
      </div>
    </AdminTopicFrame>:<AdminListState lang={lang} state="denied"/>}
  </section>;
}
