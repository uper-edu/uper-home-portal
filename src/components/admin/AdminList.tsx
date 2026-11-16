import type {ReactNode,Ref} from 'react';
import type {CrmLanguage} from '../../utils/crmLanguage';

type Column=string|{label:string;numeric?:boolean;sort?:'ascending'|'descending'|'other'};
type ListState='loading'|'empty'|'error'|'denied';

export function AdminListTable({label,headers,children,busy,viewportRef,className=''}:{
  label:string;headers:readonly Column[];children:ReactNode;busy?:boolean;viewportRef?:Ref<HTMLDivElement>;className?:string;
}){
  return <div className={`crm-list-table ${className}`.trim()} ref={viewportRef} aria-busy={busy||undefined}>
    <table aria-label={label}>
      <thead><tr>{headers.map(column=>typeof column==='string'
        ?<th key={column} scope="col">{column}</th>
        :<th key={column.label} scope="col" aria-sort={column.sort} className={column.numeric?'crm-list-number':undefined}>{column.label}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>;
}

const copy={
  loading:['正在加载…','Loading…','Memuat…'],
  empty:['暂无符合条件的记录。','No matching records.','Tidak ada catatan yang sesuai.'],
  error:['暂时无法加载记录。','Records could not be loaded.','Catatan belum dapat dimuat.'],
  denied:['当前账号无权查看这些记录。','You do not have access to these records.','Anda tidak memiliki akses ke catatan ini.'],
  retry:['重试','Retry','Coba lagi'],
  previous:['上一页','Previous','Sebelumnya'],
  next:['下一页','Next','Berikutnya'],
  pages:['列表分页','List pagination','Navigasi halaman daftar'],
} as const;
const text=(lang:CrmLanguage,key:keyof typeof copy)=>copy[key][lang==='zh'?0:lang==='id'?2:1];

export function AdminListState({lang,state,message,onRetry,compact=false}:{
  lang:CrmLanguage;state:ListState;message?:string;onRetry?:()=>void;compact?:boolean;
}){
  return <div className="admin-list-state" data-list-state={state} data-compact={compact||undefined}>
    <p role={state==='error'||state==='denied'?'alert':'status'}>{message||text(lang,state)}</p>
    {state==='error'&&onRetry&&<button className="admin-list-control" type="button" onClick={onRetry}>{text(lang,'retry')}</button>}
  </div>;
}

export function AdminListPagination({lang,page,pageCount,busy,summary,onPageChange}:{
  lang:CrmLanguage;page:number;pageCount:number;busy?:boolean;summary?:ReactNode;onPageChange:(page:number)=>void;
}){
  if(pageCount<2)return null;
  const status=lang==='zh'?`第 ${page} 页，共 ${pageCount} 页`:lang==='id'?`Halaman ${page} dari ${pageCount}`:`Page ${page} of ${pageCount}`;
  return <nav className="admin-list-pagination" aria-label={text(lang,'pages')}>
    <span role="status" aria-atomic="true">{summary?<><span className="admin-list-page-label">{status}</span><span aria-hidden="true">{summary}</span></>:status}</span>
    <div>
      <button className="admin-list-control" type="button" disabled={busy||page<=1} onClick={()=>onPageChange(page-1)}>{text(lang,'previous')}</button>
      <button className="admin-list-control" type="button" disabled={busy||page>=pageCount} onClick={()=>onPageChange(page+1)}>{text(lang,'next')}</button>
    </div>
  </nav>;
}
