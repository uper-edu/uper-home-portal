import './crm-courses.css';
import {lazy,Suspense} from 'react';
import {AdminListState} from '../admin/AdminList';
import {AdminRecordBack} from '../admin/AdminRecordHeader';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {facultyIdPattern} from '../../utils/crmFaculty';
import {enrollmentSettingsReturnPath} from '../../utils/crmEnrollmentManagement';
import {CrmEnrollmentTemplates} from './CrmEnrollmentTemplates';
import {CrmCourses} from './CrmCourses';
import {CrmEnrollmentClasses} from './CrmEnrollmentClasses';
import {enrollmentSettingsPath,resolveEnrollmentSettingsTopic} from './operationsSections';

const Faculty=lazy(()=>import('./CrmFaculty').then(module=>({default:module.CrmFaculty})));

export function CrmEnrollmentSettings({lang,isLight,allowed,finance,canSales,params,onEditorDraftChange,onNavigate}:{
  lang:CrmLanguage;isLight:boolean;allowed:boolean;finance:boolean;canSales:boolean;params:URLSearchParams;
  onEditorDraftChange:(dirty:boolean)=>void;onNavigate:(href:string)=>void;
}){
  const index=lang==='zh'?2:lang==='id'?1:0;
  const topic=resolveEnrollmentSettingsTopic(params);
  const classId=topic==='enrollment-classes'?params.get('enrollmentClass')??undefined:undefined;
  const facultyParam=topic==='faculty'?params.get('facultyId'):null;
  const facultyId=facultyParam&&facultyIdPattern.test(facultyParam)?facultyParam:undefined;
  const returnTo=enrollmentSettingsReturnPath(params.get('enrollmentReturn'));
  const facultyList=enrollmentSettingsPath('faculty',{returnTo});
  const back=canSales&&returnTo?returnTo:!allowed&&finance?'/crm?tab=dashboard&dashboardTopic=economics':undefined;
  const backLabel=!returnTo?['Back to course economics','Kembali ke hasil kursus','返回课程收益'][index]:new URLSearchParams(back?.split('?')[1]).has('classId')
    ?['Back to class roster','Kembali ke daftar siswa','返回班次名单'][index]
    :['Back to enrollment management','Kembali ke pengelolaan pendaftaran','返回报名管理'][index];
  const secondaryActions=back&&<AdminRecordBack target={{label:backLabel,onClick:()=>onNavigate(back)}}/>;
  return <>
    {topic==='courses'&&<CrmCourses lang={lang} isLight={isLight} secondaryActions={secondaryActions} onDraftChange={onEditorDraftChange}
      onCreateTemplate={createFromCourse=>onNavigate(enrollmentSettingsPath('enrollment-templates',{returnTo,createFromCourse}))}/>}
    {topic==='enrollment-templates'&&<CrmEnrollmentTemplates lang={lang} isLight={isLight} secondaryActions={secondaryActions} selected={params.get('enrollmentTemplate')??undefined}
      createFromCourse={params.get('createFromCourse')??undefined}
      onCreateClass={createFrom=>onNavigate(enrollmentSettingsPath('enrollment-classes',{returnTo,createFrom}))} onDraftChange={onEditorDraftChange}/>}
    {topic==='enrollment-classes'&&<CrmEnrollmentClasses key={classId??'all'} lang={lang} isLight={isLight} secondaryActions={secondaryActions} canSales={canSales} target={classId} createFrom={params.get('createFromTemplate')??undefined} onDraftChange={onEditorDraftChange}
      onShowAll={()=>onNavigate(enrollmentSettingsPath(topic,{returnTo}))}/>}
    {topic==='faculty'&&<Suspense fallback={<AdminListState lang={lang} state="loading"/>}>
      <Faculty lang={lang} isLight={isLight} canEdit={allowed} canRates={allowed} canReadRates={allowed||finance} onDraftChange={onEditorDraftChange}
        selectedId={facultyId} secondaryActions={secondaryActions} listHref={facultyList} recordHref={id=>enrollmentSettingsPath('faculty',{returnTo,facultyId:id})}
        onNavigate={onNavigate}/>
    </Suspense>}
  </>;
}
