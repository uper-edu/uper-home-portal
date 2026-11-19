import {useEffect,useState,type ReactNode} from 'react';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {CrmSingleSelect,type CrmChoice} from './CrmSingleSelect';

export type EnrollmentListCopy=readonly [string,string,string];

export function enrollmentListText(lang:CrmLanguage,copy:EnrollmentListCopy){
  return copy[lang==='zh'?2:lang==='id'?1:0];
}

export function useEnrollmentSettingsFilters<K extends string>(list:string,defaults:Record<K|'sort',string>){
  const key='uper.enrollment.settings.filters.v1.'+list;
  const [filters,setFilters]=useState<Record<K|'sort',string>>(()=>{
    const result={...defaults};
    try{
      const saved=JSON.parse(sessionStorage.getItem(key)??'null');
      for(const field of Object.keys(defaults) as (K|'sort')[]){
        if(typeof saved?.[field]==='string')result[field]=saved[field];
      }
    }catch{/* Browsing with storage disabled still allows filtering. */}
    return result;
  });
  useEffect(()=>{
    try{sessionStorage.setItem(key,JSON.stringify(filters));}catch{/* Keep the current in-memory filters. */}
  },[key,filters]);
  const change=(patch:Partial<Record<K|'sort',string>>)=>setFilters(previous=>({...previous,...patch}));
  const clear=()=>setFilters(previous=>({...defaults,sort:previous.sort}));
  return {filters,change,clear};
}

export function EnrollmentSettingsSelect({lang,isLight,label,all,options,value,onChange}:{
  lang:CrmLanguage;isLight:boolean;label:EnrollmentListCopy;all?:EnrollmentListCopy;
  options:CrmChoice[];value:string;onChange:(value:string)=>void;
}){
  return <CrmSingleSelect lang={lang} isLight={isLight} label={enrollmentListText(lang,label)} value={value} onChange={onChange}
    options={all?[{value:'',label:enrollmentListText(lang,all)},...options]:options}/>;
}

export function EnrollmentSettingsListSummary({lang,count,total,filtered,onClear,children}:{
  lang:CrmLanguage;count:number;total:number;filtered:boolean;onClear:()=>void;children?:ReactNode;
}){
  const t=(copy:EnrollmentListCopy)=>enrollmentListText(lang,copy);
  return <div className="enrollment-settings-list-toolbar">
    <div className="enrollment-settings-list-summary">
      <span role="status" aria-atomic="true" className="crm-work-muted">
        {t([`Showing ${count} of ${total}`,`Menampilkan ${count} dari ${total}`,`显示 ${count} 条，共 ${total} 条`])}
      </span>
      {filtered&&<button type="button" className="crm-work-link" onClick={onClear}>{t(['Clear filters','Hapus filter','清除筛选'])}</button>}
    </div>
    {children&&<div className="enrollment-settings-list-sort">
      <span className="crm-work-muted" aria-hidden="true">{t(['Sort by','Urutkan','排序'])}</span>
      {children}
    </div>}
  </div>;
}
