import {EnrollmentMailWorkspace} from '../EnrollmentMailWorkspace';
import {BookOpen, Layers, CalendarCheck, Clock3, Mail} from 'lucide-react';
import {AdminTopicFrame} from '../AdminTopicFrame';
import {AdminListState} from '../admin/AdminList';
import {AdminRecordHeader} from '../admin/AdminRecordHeader';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {enrollmentSettingsReturnPath} from '../../utils/crmEnrollmentManagement';
import {CrmEnrollmentTemplates} from './CrmEnrollmentTemplates';
import {CrmCourses} from './CrmCourses';
import {CrmEnrollmentClasses} from './CrmEnrollmentClasses';
import {CrmEnrollmentRules} from './CrmEnrollmentRules';
import {CrmRecordTitle} from './CrmRecordWorkspace';
import {enrollmentSettingSections, enrollmentSettingsPath, resolveEnrollmentSettingsTopic} from './operationsSections';

const topicIcons={courses:BookOpen,'enrollment-templates':Layers,'enrollment-classes':CalendarCheck,'enrollment-rules':Clock3,'enrollment-mail':Mail};

export function CrmEnrollmentSettings({lang,isLight,allowed,params,rulesDirty,onRulesDraftChange,onEditorDraftChange,onNavigate}:{
  lang:CrmLanguage;isLight:boolean;allowed:boolean;params:URLSearchParams;rulesDirty:boolean;
  onRulesDraftChange:(dirty:boolean)=>void;onEditorDraftChange:(dirty:boolean)=>void;onNavigate:(href:string)=>void;
}){
  const index=lang==='zh'?2:lang==='id'?1:0;
  const title=['Course and class settings','Pengaturan kursus dan kelas','课程与班次设置'][index];
  const topic=resolveEnrollmentSettingsTopic(params);
  const classId=topic==='enrollment-classes'?params.get('enrollmentClass')??undefined:undefined;
  const returnTo=enrollmentSettingsReturnPath(params.get('enrollmentReturn'));
  const back=returnTo??'/crm?tab=enrollment-management';
  const backLabel=new URLSearchParams(back.split('?')[1]).has('classId')
    ?['Back to class roster','Kembali ke daftar siswa','返回班次名单'][index]
    :['Back to enrollment management','Kembali ke pengelolaan pendaftaran','返回报名管理'][index];
  return <section className="crm-ops-workspace-sample" data-theme={isLight?'light':'dark'}>
    <AdminRecordHeader back={{label:backLabel,onClick:()=>onNavigate(back)}} title={<CrmRecordTitle title={title}/>}/>
    {allowed?<AdminTopicFrame label={title} selection={topic} navigation={
      <nav className="crm-ops-nav" aria-label={title}>
        {enrollmentSettingSections.map(({id,title:label})=>{
          const Icon=topicIcons[id];
          return <button key={id} type="button" aria-current={id===topic?'page':undefined}
            onClick={()=>{if(id!==topic)onNavigate(enrollmentSettingsPath(id,{returnTo}));}}>
            <Icon size={16} aria-hidden="true"/>{label[index]}
            {id==='enrollment-rules'&&rulesDirty&&<span aria-label={['Unsaved changes','Perubahan belum disimpan','有未保存修改'][index]}> ●</span>}
          </button>;
        })}
      </nav>
    }>
      <div className="crm-ops-content">
        {topic==='courses'&&<CrmCourses lang={lang} isLight={isLight} onDraftChange={onEditorDraftChange}/>}
        {topic==='enrollment-templates'&&<CrmEnrollmentTemplates lang={lang} isLight={isLight} selected={params.get('enrollmentTemplate')??undefined}
          onCreateClass={createFrom=>onNavigate(enrollmentSettingsPath('enrollment-classes',{returnTo,createFrom}))} onDraftChange={onEditorDraftChange}/>}
        {topic==='enrollment-classes'&&<CrmEnrollmentClasses key={classId??'all'} lang={lang} isLight={isLight} target={classId} createFrom={params.get('createFromTemplate')??undefined} onDraftChange={onEditorDraftChange}
          onShowAll={()=>onNavigate(enrollmentSettingsPath(topic,{returnTo}))}/>}
        {topic==='enrollment-mail'&&<EnrollmentMailWorkspace lang={lang} isLight={isLight} onDraft={onEditorDraftChange}/>}
        <div hidden={topic!=='enrollment-rules'}>
          <CrmEnrollmentRules lang={lang} isLight={isLight} active={topic==='enrollment-rules'} onDraftChange={onRulesDraftChange}/>
        </div>
      </div>
    </AdminTopicFrame>:<AdminListState lang={lang} state="denied"/>}
  </section>;
}
