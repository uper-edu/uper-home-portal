import {useId,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import {ChevronDown,SlidersHorizontal} from 'lucide-react';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {AdminSearchField,type AdminSearchFieldProps} from './AdminSearchField';
import {AdminSingleSelect} from './AdminSingleSelect';
import {AdminRowAction} from './AdminListControl';
import './admin-list-toolbar.css';

type Sort=Pick<ComponentProps<typeof AdminSingleSelect>,'options'|'value'|'onChange'>;

export function AdminListToolbar({lang,isLight,search,sort,children,more,count,total,filtered,onClear}:{
  lang:CrmLanguage;isLight:boolean;search:Omit<AdminSearchFieldProps,'inputRef'|'className'>;
  sort:Sort;children?:ReactNode;more?:{count:number;fields:ReactNode};
  count:number;total:number;filtered:boolean;onClear:()=>void;
}){
  const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const moreId=useId();
  const searchInput=useRef<HTMLInputElement>(null);
  const moreButton=useRef<HTMLButtonElement>(null);
  const [expanded,setExpanded]=useState(false);
  const sortLabel=t('Sort','Urutkan','排序');
  const moreLabel=t('More filters','Filter lainnya','更多筛选');
  const selectedSort=sort.options.find(option=>option.value===sort.value);
  return <div className="admin-list-toolbar" role="group" aria-label={t('Filters and sorting','Filter dan pengurutan','筛选与排序')}>
    <div className="admin-list-toolbar-row">
      <div className="admin-list-toolbar-filters">
        <AdminSearchField {...search} className="admin-list-toolbar-search" inputRef={searchInput}/>
        {children}
        {more&&<button ref={moreButton} type="button" className="admin-list-control admin-list-toolbar-more"
          aria-expanded={expanded} aria-controls={moreId} onClick={()=>setExpanded(open=>!open)}>
          <SlidersHorizontal size={16} aria-hidden="true"/>
          <span>{moreLabel}{more.count>0&&` (${more.count})`}</span>
          <ChevronDown size={15} aria-hidden="true"/>
        </button>}
      </div>
      <AdminSingleSelect {...sort} label={sortLabel} lang={lang} isLight={isLight} className="admin-list-toolbar-sort"
        displayValue={selectedSort?`${sortLabel} · ${selectedSort.label}`:undefined}/>
    </div>
    {more&&<div id={moreId} hidden={!expanded} className="admin-list-toolbar-extra" role="group" aria-label={moreLabel}
      onKeyDown={event=>{
        if(event.key!=='Escape'||event.defaultPrevented)return;
        event.stopPropagation();
        setExpanded(false);
        moreButton.current?.focus();
      }}>{more.fields}</div>}
    <div className="admin-list-toolbar-summary">
      <span role="status" aria-atomic="true">{t(`Showing ${count} of ${total}`,`Menampilkan ${count} dari ${total}`,`显示 ${count} 条，共 ${total} 条`)}</span>
      {filtered&&<AdminRowAction onClick={()=>{
        onClear();
        searchInput.current?.focus({preventScroll:true});
      }}>{t('Clear filters','Hapus filter','清除筛选')}</AdminRowAction>}
    </div>
  </div>;
}
