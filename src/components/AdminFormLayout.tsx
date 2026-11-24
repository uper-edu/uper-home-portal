import {useId,type ReactNode,type ComponentPropsWithoutRef,type ComponentPropsWithRef} from 'react';
import type {CrmLanguage} from '../utils/crmLanguage';

/** Presentation only. Caller retains state, permissions, validation and transaction boundaries. */
export function AdminFormSection({title,titleId,actions,description,children,className='',bodyClassName='',variant='plain'}:{title:ReactNode;titleId?:string;actions?:ReactNode;description?:ReactNode;children:ReactNode;className?:string;bodyClassName?:string;variant?:'plain'|'card'|'subgroup'}){
 const uid=useId(),id=titleId||'admin-section-'+uid;
 return <section className={`admin-form-section ${className}`.trim()} data-admin-section={variant} aria-labelledby={id}>
  <header className="admin-form-section-heading"><div><h3 data-admin-section-title id={id}>{title}</h3>{description&&<p>{description}</p>}</div>{actions&&<div className="admin-form-section-tools">{actions}</div>}</header>
  <div className={`admin-form-section-body ${bodyClassName}`.trim()}>{children}</div>
 </section>;
}
/** Paired fields follow reading order and collapse when their own container is narrow. */
export function AdminFormGrid({children,className=''}:{children:ReactNode;className?:string}){
 return <div className={`admin-form-grid-container ${className}`.trim()}>
  <div className="admin-form-responsive-grid" data-admin-grid="">{children}</div>
 </div>;
}
export function AdminFormSummary({title,fields}:{title?:string;fields:readonly (readonly [string,ReactNode,'wide'?])[]}){
 return <div className="admin-form-summary">
  {title&&<p className="admin-form-summary-title">{title}</p>}
  <dl>{fields.map(([label,value,span])=><div key={label} data-summary-span={span}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
 </div>;
}
export function AdminFormActions({children,className='',...props}:ComponentPropsWithoutRef<'div'>){return <div {...props} className={`admin-form-actions ${className}`.trim()}>{children}</div>;}
export type AdminFeedbackState='dirty'|'saving'|'saved'|'error'|'unknown';
const messages={
 dirty:['Unsaved changes','Perubahan belum disimpan','有未保存修改'],
 saving:['Saving…','Menyimpan…','正在保存…'],
 saved:['Changes saved.','Perubahan disimpan.','修改已保存。'],
 error:['Save failed. Your input is retained.','Gagal menyimpan. Isian tetap disimpan.','保存失败，输入已保留。'],
 unknown:['Save outcome unknown. Check the result before submitting again.','Hasil simpan belum pasti. Periksa sebelum mengirim lagi.','保存结果尚未确认，请先查询再提交。'],
} as const;
export function AdminFormFeedback({state,lang='en',children,className='',placement='inline',...props}:Omit<ComponentPropsWithRef<'p'>,'children'> & {state:AdminFeedbackState;lang?:CrmLanguage;placement?:'inline'|'floating';children?:ReactNode}){
 const tone=({dirty:'neutral',saving:'info',saved:'success',error:'danger',unknown:'warning'}as const)[state];
 return <p {...props} className={`admin-form-feedback ${className}`.trim()} data-state={state} data-tone={tone} data-placement={placement} role={props.role||(state==='error'||state==='unknown'?'alert':'status')} aria-atomic="true">{children||messages[state][lang==='zh'?2:lang==='id'?1:0]}</p>;
}

/** A confirmed write whose updated record could not be loaded. */
export function AdminSavedReadError({lang,onRetry,busy=false}:{lang:CrmLanguage;onRetry:()=>void;busy?:boolean}){
 const message=lang==='zh'?'修改已保存，暂时无法读取最新记录。':lang==='id'?'Perubahan sudah disimpan. Data terbaru belum dapat dimuat.':'Changes were saved. The latest record could not be loaded.';
 const retry=lang==='zh'?'重新读取':lang==='id'?'Muat ulang':'Reload';
 return <AdminFormFeedback state="error" lang={lang}>
  {message}{' '}<button type="button" disabled={busy} onClick={onRetry}>{retry}</button>
 </AdminFormFeedback>;
}

/** A fixed value in an editor. It stays readable and selectable without a form control. */
export function AdminStaticField({label,value,fullWidth=false}:{
  label:ReactNode;value:ReactNode;fullWidth?:boolean;
}){
  return <dl className="admin-field" data-admin-full-width={fullWidth||undefined}>
    <dt className="admin-field-label">{label}</dt>
    <dd className="admin-static-field-value">{value==null||value===''?'—':value}</dd>
  </dl>;
}
