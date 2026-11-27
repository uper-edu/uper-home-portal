import {useEffect,useState} from 'react';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {AdminSingleSelect,type AdminSelectChoice} from '../admin/AdminSingleSelect';

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
  options:AdminSelectChoice[];value:string;onChange:(value:string)=>void;
}){
  const field=enrollmentListText(lang,label);
  const selected=value&&options.find(option=>option.value===value);
  return <AdminSingleSelect lang={lang} isLight={isLight} label={field} value={value} onChange={onChange}
    displayValue={selected?`${field} · ${selected.label}`:undefined}
    options={all?[{value:'',label:enrollmentListText(lang,all)},...options]:options}/>;
}
